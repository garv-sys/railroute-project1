import {
  configure,
  searchTrainBetweenStations,
  getAvailability,
  checkPNRStatus,
  trackTrain,
  liveAtStation,
  getTrainInfo,
} from 'irctc-connect';

// Initialize the API key
const API_KEY = process.env.IRCTC_API_KEY || '';
if (API_KEY) {
  configure(API_KEY);
}

const INDIAN_RAIL_API_KEY = process.env.INDIAN_RAIL_API_KEY || '';
const INDIAN_RAIL_API_BASE = 'https://indianrailapi.com/api/v2';

// Concurrency queue to throttle simultaneous outgoing API calls
class ConcurrencyLimiter {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private maxConcurrency: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrency) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const apiLimiter = new ConcurrencyLimiter(8); // Increased to 8 for massive speedup

// Asynchronous retry system with backoff to recover from 429 rate limit statuses gracefully
async function fetchWithRetry(key: string, fetchFn: () => Promise<any>, retries = 3, delayMs = 1500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const data = await fetchFn();
      if (data && data.success === false && data.error && (data.error.includes("Too many requests") || data.error.includes("429"))) {
        const sleepTime = attempt * delayMs;
        console.warn(`[irctc-connect] Rate-limited for ${key} (Attempt ${attempt}/${retries}). Sleeping for ${sleepTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, sleepTime));
        continue;
      }
      return data;
    } catch (error: any) {
      if (attempt === retries) throw error;
      const sleepTime = attempt * delayMs;
      console.warn(`[irctc-connect] Fetch error for ${key} (Attempt ${attempt}/${retries}): ${error.message || error}. Sleeping for ${sleepTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, sleepTime));
    }
  }
}

// Simple in-memory cache to prevent rate-limiting/spamming
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

async function fetchWithCache(key: string, fetchFn: () => Promise<any>, ttl: number = CACHE_TTL_MS) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  try {
    const data = await apiLimiter.run(() => fetchWithRetry(key, fetchFn));
    // Do not cache explicit API failures from proxy
    if (data && data.success === false) {
      return data;
    }
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`[irctc-connect] Error fetching ${key}:`, error);
    throw error;
  }
}

// Helper to ensure date is always DD-MM-YYYY
function normalizeDate(d?: string) {
  if (!d) return new Date().toISOString().split('T')[0].split('-').reverse().join('-');
  
  const cleanDate = d.replace(/\//g, '-');
  if (cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return cleanDate.split('-').reverse().join('-');
  }
  return cleanDate;
}

function toYyyyMmDd(d?: string) {
  const ddmmyyyy = normalizeDate(d);
  const [day, month, year] = ddmmyyyy.split('-');
  return `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
}

async function fetchIndianRailApi(path: string) {
  if (!INDIAN_RAIL_API_KEY) {
    return null;
  }

  const res = await fetch(`${INDIAN_RAIL_API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`IndianRailAPI ${res.status}`);
  }

  const data = await res.json();
  const responseCode = String(data?.ResponseCode || '');
  const status = String(data?.Status || data?.Message || '').toUpperCase();

  if (responseCode && responseCode !== '200') {
    throw new Error(data?.Message || data?.Status || `IndianRailAPI ${responseCode}`);
  }

  if (status && status !== 'SUCCESS' && status !== '') {
    throw new Error(data?.Message || data?.Status || 'IndianRailAPI request failed');
  }

  return data;
}

function normalizeIndianRailTrains(data: any) {
  if (!data?.Trains || !Array.isArray(data.Trains)) {
    return [];
  }

  return data.Trains.map((train: any) => ({
    train_no: String(train.TrainNo || train.TrainNumber || ''),
    train_name: train.TrainName || train.Name || 'Unknown Train',
    from_stn_code: train.Source || train.From || '',
    to_stn_code: train.Destination || train.To || '',
    from_time: train.DepartureTime || train.Source?.Departure || '--:--',
    to_time: train.ArrivalTime || train.Destination?.Arrival || '--:--',
    travel_time: train.TravelTime || train.Duration || 'N/A',
    running_days: train.RunningDays || '1111111',
    train_type: train.TrainType || 'EXP',
  })).filter((train: any) => train.train_no);
}

function normalizeIndianRailAvailability(data: any) {
  const availability = Array.isArray(data?.Availability) ? data.Availability : [];
  return {
    success: true,
    provider: 'indianrailapi',
    data: {
      availability: availability.map((item: any) => ({
        date: item.JourneyDate,
        availabilityText: item.Availability,
        status: item.Availability,
        predictionPercentage: parseInt(String(item.Confirm || '').replace(/\D/g, ''), 10) || undefined,
      })),
      fare: {},
    },
  };
}

export async function searchDirectTrains(fromStn: string, toStn: string, date?: string) {
  const dateStr = normalizeDate(date);
  const key = `search_${fromStn}_${toStn}_${dateStr}`;
  return fetchWithCache(key, async () => {
    try {
      return await searchTrainBetweenStations(fromStn, toStn, dateStr);
    } catch (primaryError) {
      const fallback = await fetchIndianRailApi(`/TrainBetweenStation/apikey/${INDIAN_RAIL_API_KEY}/From/${fromStn}/To/${toStn}`);
      if (!fallback) throw primaryError;
      return { success: true, provider: 'indianrailapi', data: normalizeIndianRailTrains(fallback) };
    }
  });
}

export async function checkSeatAvailability(trainNo: string, fromStn: string, toStn: string, date: string, classType: string) {
  const dateStr = normalizeDate(date);
  const key = `avail_${trainNo}_${fromStn}_${toStn}_${dateStr}_${classType}`;
  return fetchWithCache(key, async () => {
    try {
      return await getAvailability(trainNo, fromStn, toStn, dateStr, classType, 'GN');
    } catch (primaryError) {
      const fallback = await fetchIndianRailApi(
        `/SeatAvailability/apikey/${INDIAN_RAIL_API_KEY}/TrainNumber/${trainNo}/From/${fromStn}/To/${toStn}/Date/${toYyyyMmDd(dateStr)}/Quota/GN/Class/${classType}`
      );
      if (!fallback) throw primaryError;
      return normalizeIndianRailAvailability(fallback);
    }
  });
}

export async function getFare(trainNo: string, fromStn: string, toStn: string, classType?: string, quota = 'GN') {
  const key = `fare_${trainNo}_${fromStn}_${toStn}_${classType || 'ALL'}_${quota}`;
  return fetchWithCache(key, async () => {
    if (!INDIAN_RAIL_API_KEY) {
      return { success: false, error: 'Fare enquiry requires live availability or INDIAN_RAIL_API_KEY fallback.' };
    }

    const data = await fetchIndianRailApi(`/TrainFare/apikey/${INDIAN_RAIL_API_KEY}/TrainNumber/${trainNo}/From/${fromStn}/To/${toStn}/Quota/${quota}`);
    const fares = Array.isArray(data?.Fares) ? data.Fares : [];
    const selected = classType ? fares.find((fare: any) => fare.Code === classType) : undefined;
    return {
      success: true,
      provider: 'indianrailapi',
      data: {
        trainNo: data?.TrainNumber || trainNo,
        trainName: data?.TrainName,
        distance: data?.Distance,
        fares,
        fare: selected || null,
      },
    };
  }, 60 * 60 * 1000);
}

export async function getPNR(pnr: string) {
  const cleanPnr = pnr.trim().replace(/\D/g, '');
  if (cleanPnr.length !== 10) {
    return { success: false, error: 'Invalid PNR number. Must be a 10-digit number.' };
  }

  const key = `pnr_${cleanPnr}`;
  try {
    const res = await fetchWithCache(key, async () => {
      try {
        return await checkPNRStatus(cleanPnr);
      } catch (primaryError) {
        const fallback = await fetchIndianRailApi(`/PNRCheck/apikey/${INDIAN_RAIL_API_KEY}/PNRNumber/${cleanPnr}/Route/1/`);
        if (!fallback) throw primaryError;
        return { success: true, provider: 'indianrailapi', data: fallback };
      }
    }, 60000);
    if (res && res.success !== false && res.data) {
      return res;
    }
    return { success: false, error: 'IRCTC returned an invalid or empty PNR status.' };
  } catch (e: any) {
    console.warn(`[irctc-connect] Live PNR lookup failed:`, e.message);
    return { success: false, error: 'Failed to connect to IRCTC proxy server.' };
  }
}

export async function getLiveStatus(trainNo: string, date?: string) {
  const dateStr = normalizeDate(date);
  const key = `live_${trainNo}_${dateStr}`;
  return fetchWithCache(key, async () => {
    try {
      return await trackTrain(trainNo, dateStr);
    } catch (primaryError) {
      const fallback = await fetchIndianRailApi(`/livetrainstatus/apikey/${INDIAN_RAIL_API_KEY}/trainnumber/${trainNo}/date/${toYyyyMmDd(dateStr)}/`);
      if (!fallback) throw primaryError;
      return { success: true, provider: 'indianrailapi', data: fallback };
    }
  }, 60000);
}

export async function getLiveStation(stationCode: string) {
  const key = `station_${stationCode}`;
  return fetchWithCache(key, () => liveAtStation(stationCode), 60000);
}

export async function getTrainSchedule(trainNo: string) {
  const key = `schedule_${trainNo}`;
  return fetchWithCache(key, () => getTrainInfo(trainNo), 86400000); // 1 day cache
}
