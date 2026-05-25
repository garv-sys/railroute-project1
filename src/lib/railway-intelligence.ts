import STATIONS from "@/data/all_stations.json";

export type Station = {
  code: string;
  name: string;
};

export type RouteStop = {
  code: string;
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

export const STATE_BY_CODE: Record<string, string> = {
  NDLS: "Delhi",
  DLI: "Delhi",
  NZM: "Delhi",
  ANVT: "Delhi",
  JP: "Rajasthan",
  AII: "Rajasthan",
  JU: "Rajasthan",
  PNBE: "Bihar",
  PPTA: "Bihar",
  RJPB: "Bihar",
  DNR: "Bihar",
  GAYA: "Bihar",
  HJP: "Bihar",
  CSMT: "Maharashtra",
  BCT: "Maharashtra",
  LTT: "Maharashtra",
  BDTS: "Maharashtra",
  PUNE: "Maharashtra",
  HWH: "West Bengal",
  SDAH: "West Bengal",
  KOAA: "West Bengal",
  MAS: "Tamil Nadu",
  MS: "Tamil Nadu",
  SBC: "Karnataka",
  BNC: "Karnataka",
  BNCE: "Karnataka",
  SMVB: "Karnataka",
  YPR: "Karnataka",
  SC: "Telangana",
  HYB: "Telangana",
  ADI: "Gujarat",
  LKO: "Uttar Pradesh",
  CNB: "Uttar Pradesh",
  DDU: "Uttar Pradesh",
  PRYJ: "Uttar Pradesh",
  BSB: "Uttar Pradesh",
  AGC: "Uttar Pradesh",
  GZB: "Uttar Pradesh",
  BPL: "Madhya Pradesh",
  NGP: "Maharashtra",
  KLK: "Haryana",
  SML: "Himachal Pradesh",
  ASR: "Punjab",
  CDG: "Chandigarh",
  GHY: "Assam",
  TVC: "Kerala",
};

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
  pryj: ["PRYJ"],
  prayagraj: ["PRYJ"],
  patna: ["PNBE", "RJPB", "DNR", "PPTA"],
  delhi: ["NDLS", "DLI", "NZM", "ANVT"],
  mumbai: ["CSMT", "BCT", "LTT", "BDTS"],
  kolkata: ["HWH", "SDAH", "KOAA"],
  chennai: ["MAS", "MS"],
};

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
];

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bJn\b/g, "Junction");
}

export function stationByCode(code: string) {
  return stations.find((station) => station.code.toUpperCase() === code.toUpperCase());
}

export function stationState(code: string) {
  return STATE_BY_CODE[code.toUpperCase()] || "India";
}

export function stationCityName(station: Station) {
  return titleCase(station.name.replace(/\bJN\b|\bJUNCTION\b|\bRAILWAY STATION\b/gi, "").trim());
}

export function stationLabel(station: Station, withCode = true) {
  const label = `${stationCityName(station)} (${stationState(station.code)})`;
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

export function stationMatches(query: string, limit = 40) {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  const aliasCodes = Object.entries(STATION_ALIASES)
    .filter(([alias]) => alias.includes(normalized) || normalized.includes(alias))
    .flatMap(([, codes]) => codes);

  return stations
    .map((station) => {
      const name = normalizeText(station.name);
      const city = normalizeText(stationCityName(station));
      const code = normalizeText(station.code);
      const aliasBoost = aliasCodes.includes(station.code) ? 120 : 0;
      let score = 0;
      score += aliasBoost;
      if (code === normalized) score += 500;
      if (code.startsWith(normalized)) score += 80;
      if (city.startsWith(normalized)) score += 70;
      if (name.startsWith(normalized)) score += 58;
      if (city.includes(normalized) || name.includes(normalized)) score += 38;
      return { station, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || stationCityName(a.station).localeCompare(stationCityName(b.station)))
    .slice(0, limit)
    .map((item) => item.station);
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
