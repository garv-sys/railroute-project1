import STATIONS from "@/data/all_stations.json";
import OFFICIAL_STATION_STATES from "@/data/station_states.json";

export type Station = {
  code: string;
  name: string;
};

export type RouteStop = {
  code: string;
  stationName?: string;
  arrival: string;
  departure: string;
  halt: string;
  distance: number;
  platform?: string;
  day?: number;
};

export type TrainDetails = {
  trainNo: string;
  trainName: string;
  type: string;
  source: string;
  destination: string;
  runningDays: string[];
  classes: string[];
  route: RouteStop[];
};

const OFFICIAL_STATE_BY_CODE = OFFICIAL_STATION_STATES as Record<string, string>;

const SUPPLEMENTAL_STATIONS: Station[] = [
  { code: "DDU", name: "PT DEEN DAYAL UPADHYAYA JN" },
  { code: "PRYJ", name: "PRAYAGRAJ JN" },
  { code: "SMVB", name: "SMVT BENGALURU" },
  { code: "RJPB", name: "RAJENDRA NAGAR BIHAR" },
];

export const stations = [
  ...(STATIONS as Station[]),
  ...SUPPLEMENTAL_STATIONS.filter((extra) => !(STATIONS as Station[]).some((station) => station.code === extra.code)),
];

const MODERN_STATION_NAMES: Record<string, string> = {
  ALD: "PRAYAGRAJ JN",
  ALY: "PRAYAGRAJ RAMBAGH",
};

export const STATE_BY_CODE: Record<string, string> = {
  NDLS: "Delhi",
  DLI: "Delhi",
  NZM: "Delhi",
  ANVT: "Delhi",
  JP: "Rajasthan",
  AII: "Rajasthan",
  BHL: "Rajasthan",
  BKN: "Rajasthan",
  JU: "Rajasthan",
  KOTA: "Rajasthan",
  MJ: "Rajasthan",
  UDZ: "Rajasthan",
  AWR: "Rajasthan",
  PNBE: "Bihar",
  PPTA: "Bihar",
  RJPB: "Bihar",
  DNR: "Bihar",
  BJU: "Bihar",
  GAYA: "Bihar",
  HJP: "Bihar",
  MFP: "Bihar",
  BGP: "Bihar",
  CSMT: "Maharashtra",
  BCT: "Maharashtra",
  LTT: "Maharashtra",
  BDTS: "Maharashtra",
  PUNE: "Maharashtra",
  KYN: "Maharashtra",
  HWH: "West Bengal",
  SDAH: "West Bengal",
  KOAA: "West Bengal",
  NJP: "West Bengal",
  MAS: "Tamil Nadu",
  MS: "Tamil Nadu",
  TBM: "Tamil Nadu",
  TBMS: "Tamil Nadu",
  CBE: "Tamil Nadu",
  MDU: "Tamil Nadu",
  TPJ: "Tamil Nadu",
  SBC: "Karnataka",
  BNC: "Karnataka",
  BNCE: "Karnataka",
  SMVB: "Karnataka",
  YPR: "Karnataka",
  MYS: "Karnataka",
  UBL: "Karnataka",
  DWR: "Karnataka",
  MAQ: "Karnataka",
  MAJN: "Karnataka",
  SC: "Telangana",
  HYB: "Telangana",
  KCG: "Telangana",
  WL: "Telangana",
  ADI: "Gujarat",
  ST: "Gujarat",
  BRC: "Gujarat",
  RJT: "Gujarat",
  LKO: "Uttar Pradesh",
  CNB: "Uttar Pradesh",
  DDU: "Uttar Pradesh",
  PRYJ: "Uttar Pradesh",
  BSB: "Uttar Pradesh",
  ALD: "Uttar Pradesh",
  ALY: "Uttar Pradesh",
  AGC: "Uttar Pradesh",
  GZB: "Uttar Pradesh",
  SLN: "Uttar Pradesh",
  GKP: "Uttar Pradesh",
  MTC: "Uttar Pradesh",
  MB: "Uttar Pradesh",
  BE: "Uttar Pradesh",
  JHS: "Uttar Pradesh",
  BPL: "Madhya Pradesh",
  REWA: "Madhya Pradesh",
  GWL: "Madhya Pradesh",
  INDB: "Madhya Pradesh",
  JBP: "Madhya Pradesh",
  KTE: "Madhya Pradesh",
  STA: "Madhya Pradesh",
  RTM: "Madhya Pradesh",
  NGP: "Maharashtra",
  KLK: "Haryana",
  AADR: "Himachal Pradesh",
  SML: "Himachal Pradesh",
  ASR: "Punjab",
  LDH: "Punjab",
  JUC: "Punjab",
  CDG: "Chandigarh",
  GHY: "Assam",
  DMV: "Assam",
  TVC: "Kerala",
  ERS: "Kerala",
  ERN: "Kerala",
  KCVL: "Kerala",
  CLT: "Kerala",
  CAN: "Kerala",
  PGT: "Kerala",
  BZA: "Andhra Pradesh",
  VSKP: "Andhra Pradesh",
  TPTY: "Andhra Pradesh",
  GNT: "Andhra Pradesh",
  NLR: "Andhra Pradesh",
  RJY: "Andhra Pradesh",
  BBS: "Odisha",
  CTC: "Odisha",
  PURI: "Odisha",
  SBP: "Odisha",
  ROU: "Odisha",
  RNC: "Jharkhand",
  TATA: "Jharkhand",
  DHN: "Jharkhand",
  BKSC: "Jharkhand",
  JAT: "Jammu and Kashmir",
  SVDK: "Jammu and Kashmir",
  DDN: "Uttarakhand",
  HW: "Uttarakhand",
  KGM: "Uttarakhand",
  MAO: "Goa",
  VSG: "Goa",
  KRMI: "Goa",
};

const STATE_KEYWORDS: { state: string; keywords: string[] }[] = [
  {
    state: "Rajasthan",
    keywords: [
      "ajmer",
      "alwar",
      "bhilwara",
      "bikaner",
      "chittaurgarh",
      "chittorgarh",
      "jaipur",
      "jodhpur",
      "kota",
      "marwar",
      "pali",
      "rajasthan",
      "sawai madhopur",
      "udaipur",
    ],
  },
  {
    state: "Bihar",
    keywords: [
      "ara",
      "begusarai",
      "bhagalpur",
      "bihar",
      "danapur",
      "gaya",
      "hajipur",
      "muzaffarpur",
      "patliputra",
      "patna",
      "rajendra nagar",
      "samastipur",
    ],
  },
  {
    state: "Uttar Pradesh",
    keywords: [
      "agra",
      "aligarh",
      "ayodhya",
      "bareilly",
      "deoria",
      "ghaziabad",
      "gorakhpur",
      "jhansi",
      "kanpur",
      "lucknow",
      "mathura",
      "meerut",
      "moradabad",
      "prayagraj",
      "sultanpur",
      "varanasi",
    ],
  },
  {
    state: "Madhya Pradesh",
    keywords: ["bhopal", "gwalior", "indore", "jabalpur", "katni", "rewa", "sagar", "satna", "ujjain", "ratlam"],
  },
  {
    state: "Maharashtra",
    keywords: ["aurangabad", "bandra", "c shivaji", "csmt", "kalyan", "latur", "lokmanyatilak", "mumbai", "nagpur", "pune", "solapur", "thane"],
  },
  {
    state: "Karnataka",
    keywords: ["bangalore", "bengaluru", "belagavi", "bengalooru", "dharwar", "hubli", "ksr", "mangalore", "mysore", "mysuru", "smvt", "whitefield", "yesvantpur"],
  },
  {
    state: "Tamil Nadu",
    keywords: ["chennai", "coimbatore", "madurai", "salem", "tiruchchirappalli", "tiruchirappalli", "tirunelveli", "vellore"],
  },
  {
    state: "Kerala",
    keywords: ["alappuzha", "calicut", "ernakulam", "kannur", "kochi", "kollam", "kozhikode", "palakkad", "thrissur", "trivandrum", "thiruvananthapuram"],
  },
  {
    state: "Telangana",
    keywords: ["hyderabad", "kachiguda", "secunderabad", "telangana", "warangal"],
  },
  {
    state: "Andhra Pradesh",
    keywords: ["guntur", "kakinada", "nellore", "rajahmundry", "tirupati", "vijayawada", "visakhapatnam", "vizag"],
  },
  {
    state: "West Bengal",
    keywords: ["asansol", "howrah", "kolkata", "malda", "new jalpaiguri", "sealdah", "siliguri"],
  },
  {
    state: "Gujarat",
    keywords: ["ahmedabad", "bharuch", "gandhidham", "rajkot", "surat", "vadodara", "valsad"],
  },
  {
    state: "Punjab",
    keywords: ["amritsar", "jalandhar", "ludhiana", "pathankot", "punjab"],
  },
  {
    state: "Haryana",
    keywords: ["ambala", "faridabad", "gurgaon", "gurugram", "hisar", "kalka", "panipat", "rohtak"],
  },
  {
    state: "Odisha",
    keywords: ["bhubaneswar", "cuttack", "puri", "rourkela", "sambalpur"],
  },
  {
    state: "Jharkhand",
    keywords: ["bokaro", "dhanbad", "jasidih", "ranchi", "tatanagar"],
  },
  {
    state: "Assam",
    keywords: ["dibrugarh", "guwahati", "kamakhya", "silchar", "tinsukia"],
  },
  {
    state: "Jammu and Kashmir",
    keywords: ["jammu", "katra", "srinagar", "udhampur"],
  },
  {
    state: "Uttarakhand",
    keywords: ["dehradun", "haridwar", "kathgodam", "rishikesh", "roorkee"],
  },
  {
    state: "Goa",
    keywords: ["goa", "karmali", "madgaon", "margao", "thivim", "vasco"],
  },
  {
    state: "Himachal Pradesh",
    keywords: ["kalka shimla", "shimla", "solan", "una himachal"],
  },
  {
    state: "Chhattisgarh",
    keywords: ["bilaspur", "durg", "raipur"],
  },
  {
    state: "Tripura",
    keywords: ["agartala"],
  },
  {
    state: "Manipur",
    keywords: ["jiribam"],
  },
];

export const STATION_COORDS: Record<string, { lat: number; lng: number }> = {
  PNBE: { lat: 25.6094, lng: 85.1376 },
  DDU: { lat: 25.2733, lng: 83.0087 },
  PRYJ: { lat: 25.4358, lng: 81.8463 },
  CNB: { lat: 26.4535, lng: 80.3483 },
  NDLS: { lat: 28.6423, lng: 77.2209 },
  JP: { lat: 26.9196, lng: 75.7878 },
  HWH: { lat: 22.5839, lng: 88.3428 },
  CSMT: { lat: 18.94, lng: 72.835 },
  BCT: { lat: 18.969, lng: 72.8194 },
  MAS: { lat: 13.0827, lng: 80.2756 },
  SBC: { lat: 12.9774, lng: 77.5708 },
  BNC: { lat: 12.9922, lng: 77.598 },
  SMVB: { lat: 13.0358, lng: 77.7228 },
  YPR: { lat: 13.0238, lng: 77.5507 },
  SC: { lat: 17.4344, lng: 78.5013 },
  ADI: { lat: 23.0225, lng: 72.5714 },
  LKO: { lat: 26.8333, lng: 80.915 },
  BPL: { lat: 23.268, lng: 77.4132 },
  NGP: { lat: 21.1458, lng: 79.0882 },
  GHY: { lat: 26.185, lng: 91.75 },
  KLK: { lat: 30.8398, lng: 76.9406 },
  SML: { lat: 31.1048, lng: 77.1734 },
};

const STATION_ALIASES: Record<string, string[]> = {
  bangalore: ["SBC", "BNC", "SMVB", "YPR"],
  banglore: ["SBC", "BNC", "SMVB", "YPR"],
  bengaluru: ["SBC", "BNC", "SMVB", "YPR"],
  blr: ["SBC", "BNC", "SMVB", "YPR"],
  ksr: ["SBC"],
  majestic: ["SBC"],
  ddu: ["DDU"],
  deendayal: ["DDU"],
  mughalsarai: ["DDU"],
  ald: ["PRYJ"],
  allahabad: ["PRYJ"],
  allahabadjunction: ["PRYJ"],
  pryj: ["PRYJ"],
  prayagraj: ["PRYJ"],
  patna: ["PNBE", "RJPB", "DNR", "PPTA"],
  delhi: ["NDLS", "DLI", "NZM", "ANVT"],
  mumbai: ["CSMT", "BCT", "LTT", "BDTS"],
  kolkata: ["HWH", "SDAH", "KOAA"],
  chennai: ["MAS", "MS"],
  tambaram: ["TBM", "TBMS"],
};

const STATION_BY_CODE = new Map(stations.map((station) => [station.code.toUpperCase(), station]));

const STATION_SEARCH_INDEX = stations.map((station) => {
  const displayName = MODERN_STATION_NAMES[station.code.toUpperCase()] || station.name;
  const city = titleCase(displayName.replace(/\bJN\b|\bJUNCTION\b|\bRAILWAY STATION\b/gi, "").trim());
  return {
    station,
    name: normalizeText(displayName),
    city,
    cityNormalized: normalizeText(city),
    code: normalizeText(station.code),
  };
});

const STATION_MATCH_CACHE = new Map<string, Station[]>();

export const TRAIN_DIRECTORY: TrainDetails[] = [
  {
    trainNo: "12395",
    trainName: "ZIYARAT EXPRESS",
    type: "Superfast",
    source: "PNBE",
    destination: "JP",
    runningDays: ["Mon", "Wed", "Fri"],
    classes: ["SL", "3A", "2A", "1A"],
    route: [
      { code: "PNBE", arrival: "Start", departure: "07:45", halt: "-", distance: 0, platform: "1", day: 1 },
      { code: "DDU", arrival: "12:15", departure: "12:25", halt: "10 min", distance: 211, platform: "4", day: 1 },
      { code: "CNB", arrival: "17:25", departure: "17:35", halt: "10 min", distance: 560, platform: "7", day: 1 },
      { code: "NDLS", arrival: "23:35", departure: "23:55", halt: "20 min", distance: 1001, platform: "5", day: 1 },
      { code: "JP", arrival: "04:45", departure: "End", halt: "-", distance: 1310, platform: "3", day: 2 },
    ],
  },
  {
    trainNo: "12309",
    trainName: "RAJENDRA NAGAR TEJAS RAJDHANI",
    type: "Rajdhani",
    source: "RJPB",
    destination: "NDLS",
    runningDays: ["Daily"],
    classes: ["3A", "2A", "1A"],
    route: [
      { code: "RJPB", arrival: "Start", departure: "19:10", halt: "-", distance: 0, platform: "1", day: 1 },
      { code: "PNBE", arrival: "19:20", departure: "19:30", halt: "10 min", distance: 6, platform: "4", day: 1 },
      { code: "DDU", arrival: "22:35", departure: "22:45", halt: "10 min", distance: 215, platform: "3", day: 1 },
      { code: "CNB", arrival: "03:45", departure: "03:50", halt: "5 min", distance: 562, platform: "2", day: 2 },
      { code: "NDLS", arrival: "07:40", departure: "End", halt: "-", distance: 1002, platform: "16", day: 2 },
    ],
  },
  {
    trainNo: "12951",
    trainName: "MUMBAI RAJDHANI",
    type: "Rajdhani",
    source: "BCT",
    destination: "NDLS",
    runningDays: ["Daily"],
    classes: ["3A", "2A", "1A"],
    route: [
      { code: "BCT", arrival: "Start", departure: "16:35", halt: "-", distance: 0, platform: "4", day: 1 },
      { code: "ADI", arrival: "22:05", departure: "22:15", halt: "10 min", distance: 492, platform: "1", day: 1 },
      { code: "JP", arrival: "04:45", departure: "04:55", halt: "10 min", distance: 1160, platform: "2", day: 2 },
      { code: "NDLS", arrival: "08:35", departure: "End", halt: "-", distance: 1384, platform: "3", day: 2 },
    ],
  },
  {
    trainNo: "12376",
    trainName: "JSME TBM SF EXPRESS",
    type: "Superfast",
    source: "JSME",
    destination: "TBM",
    runningDays: ["Wed"],
    classes: ["SL", "3A", "2A"],
    route: [
      { code: "JSME", arrival: "Start", departure: "13:10", halt: "-", distance: 0, platform: "2", day: 1 },
      { code: "MDP", arrival: "13:35", departure: "13:37", halt: "2 min", distance: 29, day: 1 },
      { code: "CRJ", arrival: "14:28", departure: "14:30", halt: "2 min", distance: 86, day: 1 },
      { code: "ASN", arrival: "15:40", departure: "16:00", halt: "20 min", distance: 111, day: 1 },
      { code: "JOC", arrival: "16:43", departure: "16:45", halt: "2 min", distance: 148, day: 1 },
      { code: "PRR", arrival: "17:28", departure: "17:30", halt: "2 min", distance: 187, day: 1 },
      { code: "CKP", arrival: "19:23", departure: "19:28", halt: "5 min", distance: 306, day: 1 },
      { code: "ROU", arrival: "20:47", departure: "20:55", halt: "8 min", distance: 407, day: 1 },
      { code: "JSG", arrival: "22:30", departure: "22:35", halt: "5 min", distance: 508, day: 1 },
      { code: "SBP", arrival: "23:25", departure: "23:35", halt: "10 min", distance: 557, day: 1 },
      { code: "BRGA", arrival: "00:17", departure: "00:19", halt: "2 min", distance: 599, day: 2 },
      { code: "BLGR", arrival: "01:16", departure: "01:21", halt: "5 min", distance: 675, day: 2 },
      { code: "TIG", arrival: "02:20", departure: "02:30", halt: "10 min", distance: 739, day: 2 },
      { code: "KSNG", arrival: "02:45", departure: "02:47", halt: "2 min", distance: 752, day: 2 },
      { code: "MNGD", arrival: "03:53", departure: "03:55", halt: "2 min", distance: 824, day: 2 },
      { code: "RGDA", arrival: "05:15", departure: "05:20", halt: "5 min", distance: 878, day: 2 },
      { code: "PVP", arrival: "05:58", departure: "06:00", halt: "2 min", distance: 925, day: 2 },
      { code: "VBL", arrival: "06:23", departure: "06:25", halt: "2 min", distance: 949, day: 2 },
      { code: "VZM", arrival: "07:15", departure: "07:20", halt: "5 min", distance: 1002, day: 2 },
      { code: "VSKP", arrival: "08:35", departure: "08:55", halt: "20 min", distance: 1063, platform: "3", day: 2 },
      { code: "SLO", arrival: "10:59", departure: "11:00", halt: "1 min", distance: 1214, day: 2 },
      { code: "RJY", arrival: "11:48", departure: "11:50", halt: "2 min", distance: 1264, day: 2 },
      { code: "EE", arrival: "13:04", departure: "13:05", halt: "1 min", distance: 1354, day: 2 },
      { code: "BZA", arrival: "14:35", departure: "14:45", halt: "10 min", distance: 1413, day: 2 },
      { code: "TEL", arrival: "15:14", departure: "15:15", halt: "1 min", distance: 1445, day: 2 },
      { code: "OGL", arrival: "16:43", departure: "16:45", halt: "2 min", distance: 1552, day: 2 },
      { code: "NLR", arrival: "18:08", departure: "18:10", halt: "2 min", distance: 1668, day: 2 },
      { code: "GDR", arrival: "18:58", departure: "19:00", halt: "2 min", distance: 1706, day: 2 },
      { code: "SPE", arrival: "19:38", departure: "19:40", halt: "2 min", distance: 1761, day: 2 },
      { code: "MS", arrival: "21:40", departure: "21:45", halt: "5 min", distance: 1848, day: 2 },
      { code: "TBM", arrival: "22:25", departure: "End", halt: "-", distance: 1872, day: 2 },
    ],
  },
];

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bJn\b/g, "Junction");
}

export function stationByCode(code: string) {
  return STATION_BY_CODE.get(code.toUpperCase());
}

export function stationState(code: string) {
  const upperCode = code.toUpperCase();
  if (STATE_BY_CODE[upperCode]) return STATE_BY_CODE[upperCode];
  if (OFFICIAL_STATE_BY_CODE[upperCode]) return OFFICIAL_STATE_BY_CODE[upperCode];

  const station = stationByCode(upperCode);
  if (!station) return "India";

  const normalizedName = normalizeText(`${station.name} ${stationCityName(station)}`);
  const normalizedWords = `${station.name} ${stationCityName(station)}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const match = STATE_KEYWORDS.find(({ keywords }) => {
    return keywords.some((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      if (normalizedKeyword.length <= 4 && !keyword.includes(" ")) return normalizedWords.includes(keyword.toLowerCase());
      return normalizedName.includes(normalizedKeyword);
    });
  });

  return match?.state || "India";
}

export function stationCityName(station: Station) {
  const name = MODERN_STATION_NAMES[station.code.toUpperCase()] || station.name;
  return titleCase(name.replace(/\bJN\b|\bJUNCTION\b|\bRAILWAY STATION\b/gi, "").trim());
}

export function stationLabel(station: Station, withCode = true) {
  const state = stationState(station.code);
  const city = stationCityName(station);
  const label = state === "India" ? city : `${city} (${state})`;
  return withCode ? `${label} — ${station.code}` : label;
}

export function stationLabelFromCode(code: string, withCode = true) {
  const station = stationByCode(code);
  if (!station) return code;
  return stationLabel(station, withCode);
}

export function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function stationMatches(query: string, limit = 18) {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  const cacheKey = `${normalized}:${limit}`;
  const cached = STATION_MATCH_CACHE.get(cacheKey);
  if (cached) return cached;

  const isShortCodeLikeQuery = normalized.length <= 3;
  const aliasMatches = Object.entries(STATION_ALIASES).filter(([alias]) => alias.includes(normalized) || normalized.includes(alias));
  const aliasCodes = aliasMatches.flatMap(([, codes]) => codes);
  const exactAliasCodes = aliasMatches.filter(([alias]) => normalizeText(alias) === normalized).flatMap(([, codes]) => codes);

  const matches = STATION_SEARCH_INDEX
    .map(({ station, name, city, cityNormalized, code }) => {
      const aliasBoost = exactAliasCodes.includes(station.code) ? 620 : aliasCodes.includes(station.code) ? 120 : 0;
      let score = 0;
      score += aliasBoost;
      if (code === normalized) score += 500;
      if (code.startsWith(normalized)) score += 80;
      if (cityNormalized.startsWith(normalized)) score += 70;
      if (name.startsWith(normalized)) score += 58;
      if (!isShortCodeLikeQuery && (cityNormalized.includes(normalized) || name.includes(normalized))) score += 38;
      return { station, city, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.city.localeCompare(b.city))
    .slice(0, limit)
    .map((item) => item.station);
  STATION_MATCH_CACHE.set(cacheKey, matches);
  return matches;
}

export function searchTrainDirectory(query: string) {
  const normalized = normalizeText(query);
  return TRAIN_DIRECTORY.filter((train) => {
    return normalizeText(train.trainNo).includes(normalized) || normalizeText(train.trainName).includes(normalized);
  });
}

export function buildCoachSeats(classType: string, coach = "B1") {
  const isChair = ["CC", "EC"].includes(classType);
  const normalizedClass = classType === "3E" ? "3A" : classType;
  const count = isChair ? 56 : normalizedClass === "1A" ? 18 : normalizedClass === "2A" ? 46 : 72;

  return Array.from({ length: Math.min(count, normalizedClass === "1A" ? 18 : 40) }, (_, index) => {
    const number = index + 1;
    const state = number % 11 === 0 ? "WL" : number % 7 === 0 ? "RAC" : number % 5 === 0 ? "booked" : "available";
    let berth = `${number}${number % 2 ? "W" : "A"}`;
    let cabin = "";
    if (!isChair && normalizedClass === "1A") {
      const cabinIndex = index < 12 ? Math.floor(index / 4) : 3 + Math.floor((index - 12) / 2);
      cabin = index < 12 ? `Cabin ${String.fromCharCode(65 + cabinIndex)}` : `Coupe ${String.fromCharCode(65 + cabinIndex)}`;
      berth = index % 2 === 0 ? "LB" : "UB";
    } else if (!isChair && normalizedClass === "2A") {
      berth = ["LB", "UB", "LB", "UB", "SL", "SU"][index % 6];
    } else if (!isChair) {
      berth = ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"][index % 8];
    }
    return {
      id: `${coach}-${number}`,
      number,
      berth,
      cabin,
      state,
    };
  });
}
