import { NextResponse } from "next/server";

import { getTrainSchedule } from "@/services/irctcService";
import {
  searchTrainDirectory,
  stationByCode,
  stationLabelFromCode,
  stationState,
  titleCase,
  TRAIN_DIRECTORY,
  type RouteStop,
  type TrainDetails,
} from "@/lib/railway-intelligence";

function pickArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.route)) return value.data.route;
  if (Array.isArray(value?.data?.schedule)) return value.data.schedule;
  if (Array.isArray(value?.route)) return value.route;
  if (Array.isArray(value?.schedule)) return value.schedule;
  return [];
}

function normalizeStop(stop: any, index: number): RouteStop | null {
  const code = String(stop?.stnCode || stop?.station_code || stop?.stationCode || stop?.code || stop?.StationCode || "").toUpperCase();
  if (!code) return null;

  return {
    code,
    arrival: String(stop?.arrTime || stop?.arrival || stop?.ArrivalTime || stop?.scharr || (index === 0 ? "Start" : "--:--")),
    departure: String(stop?.depTime || stop?.departure || stop?.DepartureTime || stop?.schdep || "--:--"),
    halt: String(stop?.haltTime || stop?.halt || stop?.HaltTime || (index === 0 ? "-" : "2 min")),
    distance: Number(stop?.distance || stop?.Distance || stop?.dayCnt || index * 110),
    platform: stop?.platform || stop?.PlatformNo || stop?.pf || undefined,
    day: Number(stop?.day || stop?.dayCnt || stop?.Day || 1),
  };
}

function normalizeTrain(query: string, live: any, fallback?: TrainDetails): TrainDetails | null {
  const route = pickArray(live).map(normalizeStop).filter(Boolean) as RouteStop[];
  if (route.length < 2) return fallback || null;

  const data = live?.data || live;
  const trainNo = String(data?.trainNo || data?.train_no || data?.trainNumber || data?.number || query).replace(/\D/g, "") || query;
  const trainName = String(data?.trainName || data?.train_name || data?.name || fallback?.trainName || "Indian Railways Train").toUpperCase();

  return {
    trainNo,
    trainName,
    type: data?.trainType || data?.type || fallback?.type || "Express",
    source: route[0].code,
    destination: route[route.length - 1].code,
    runningDays: data?.runningDays || data?.runsOn || fallback?.runningDays || ["Daily"],
    classes: data?.classes || fallback?.classes || ["SL", "3A", "2A", "1A"],
    route,
  };
}

function enrich(train: TrainDetails) {
  return {
    ...train,
    sourceLabel: stationLabelFromCode(train.source),
    destinationLabel: stationLabelFromCode(train.destination),
    route: train.route.map((stop) => {
      const station = stationByCode(stop.code);
      return {
        ...stop,
        stationName: station ? titleCase(station.name) : stop.code,
        state: stationState(stop.code),
        label: stationLabelFromCode(stop.code),
      };
    }),
  };
}

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    const cleanQuery = String(query || "").trim();

    if (!cleanQuery) {
      return NextResponse.json({ error: "Missing train number or name" }, { status: 400 });
    }

    const directoryMatches = searchTrainDirectory(cleanQuery);
    const numeric = cleanQuery.match(/\d{5}/)?.[0];
    const fallback = directoryMatches[0] || TRAIN_DIRECTORY.find((train) => train.trainNo === numeric);

    if (numeric) {
      try {
        const live = await getTrainSchedule(numeric);
        const normalized = normalizeTrain(numeric, live, fallback);
        if (normalized) {
          return NextResponse.json({ success: true, source: "live", trains: [enrich(normalized)] });
        }
      } catch (error) {
        console.warn(`[Train Search] Live schedule failed for ${numeric}:`, error);
      }
    }

    const trains = (directoryMatches.length ? directoryMatches : fallback ? [fallback] : []).map(enrich);
    if (!trains.length) {
      return NextResponse.json({ success: true, source: "directory", trains: [] });
    }

    return NextResponse.json({ success: true, source: "directory", trains });
  } catch (error) {
    console.error("Train Search API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

