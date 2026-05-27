"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  Circle,
  Compass,
  IndianRupee,
  Loader2,
  MapPin,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Train,
  WalletCards,
  X,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  buildCoachSeats,
  normalizeText,
  searchTrainDirectory,
  stationByCode,
  stationLabel,
  stationLabelFromCode,
  stationMatches,
  stationState,
  STATION_COORDS,
  titleCase,
  type Station,
} from "@/lib/railway-intelligence";

type ToolKind = "trains" | "live" | "pnr" | "fare" | "map" | "route" | "coach" | "train-search";

const toolNav: { href: string; label: string; tool: ToolKind }[] = [
  { href: "/trains", label: "Trains", tool: "trains" },
  { href: "/pnr", label: "PNR", tool: "pnr" },
  { href: "/route", label: "Route", tool: "route" },
  { href: "/coach", label: "Coach", tool: "coach" },
];

const classOptions = ["SL", "3E", "3A", "2A", "1A", "CC", "EC"];
const IRCTC_TRAIN_SEARCH_URL = "https://www.irctc.co.in/nget/train-search";
const CLIENT_CACHE_TTL_MS = 60_000;
const clientResponseCache = new Map<string, { timestamp: number; data: unknown }>();
const clientInFlightRequests = new Map<string, Promise<unknown>>();

function stableStringify(value: unknown): string {
  if (!value || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const key = `${url}:${stableStringify(body)}`;
  const cached = clientResponseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS) return cached.data as T;

  const inFlight = clientInFlightRequests.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const request = fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok || data?.error) {
        throw new Error(data?.error || "RailRoute request failed");
      }
      clientResponseCache.set(key, { timestamp: Date.now(), data });
      return data as T;
    })
    .finally(() => {
      clientInFlightRequests.delete(key);
    });

  clientInFlightRequests.set(key, request);
  return request;
}

function todayIso(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function prettyDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

function timeAmPm(value: unknown) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return String(value || "--");
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

function useDebouncedValue<T>(value: T, delayMs = 500) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function productBg() {
  return "min-h-screen bg-[#f8fafc] text-slate-950 transition-colors duration-500 dark:bg-[#050816] dark:text-white";
}

function softPanel(extra = "") {
  return `border border-slate-200/80 bg-white/82 shadow-xl shadow-slate-200/50 backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 dark:shadow-black/25 ${extra}`;
}

function readableRailStatus(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/live fetch failed/i.test(text)) return "Quota unavailable";
  if (/checking|check seats on irctc/i.test(text)) return "Tap for quota";
  return text;
}

function ticketDecision(value: unknown) {
  const status = readableRailStatus(value).toUpperCase();
  if (/UNAVAILABLE|NOT RUNNING|REGRET/.test(status)) {
    return { label: "Check on IRCTC", tone: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200" };
  }
  if (/\bAVAILABLE\b|\bAVL\b|CNF|CONFIRM/.test(status)) {
    return { label: "Likely confirmed", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100" };
  }
  if (/RAC/.test(status)) {
    return { label: "RAC, not fully confirmed", tone: "bg-amber-100 text-amber-800 dark:bg-amber-300/12 dark:text-amber-100" };
  }
  if (/WL|WAIT|REGRET|UNAVAILABLE/.test(status)) {
    return { label: "Not confirmed yet", tone: "bg-rose-100 text-rose-800 dark:bg-rose-300/12 dark:text-rose-100" };
  }
  return { label: "Check on IRCTC", tone: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200" };
}

function availabilityTone(value: unknown) {
  const status = readableRailStatus(value).toUpperCase();
  if (/\bAVAILABLE\b|\bAVL\b|CNF|CONFIRM/.test(status)) {
    return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-300/12 dark:text-emerald-100";
  }
  if (/RAC/.test(status)) {
    return "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-300/25 dark:bg-amber-300/12 dark:text-amber-100";
  }
  if (/WL|WAIT|REGRET|UNAVAILABLE|NOT RUNNING/.test(status)) {
    return "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-300/25 dark:bg-rose-300/12 dark:text-rose-100";
  }
  return "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200";
}

function availabilityCardTone(value: unknown) {
  const status = readableRailStatus(value).toUpperCase();
  if (/\bAVAILABLE\b|\bAVL\b|CNF|CONFIRM/.test(status)) {
    return "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-300/30 dark:bg-emerald-300/14 dark:text-emerald-50";
  }
  if (/RAC/.test(status)) {
    return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/14 dark:text-amber-50";
  }
  if (/WL|WAIT|REGRET|UNAVAILABLE|NOT RUNNING/.test(status)) {
    return "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-300/30 dark:bg-rose-300/14 dark:text-rose-50";
  }
  return "border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-white/6 dark:text-slate-100";
}

function journeyAccentTone(value: unknown) {
  const status = readableRailStatus(value).toUpperCase();
  if (/\bAVAILABLE\b|\bAVL\b|CNF|CONFIRM/.test(status)) {
    return { text: "text-emerald-600 dark:text-emerald-200", line: "bg-emerald-300 dark:bg-emerald-300/60", dot: "bg-emerald-400" };
  }
  if (/RAC/.test(status)) {
    return { text: "text-amber-600 dark:text-amber-200", line: "bg-amber-300 dark:bg-amber-300/60", dot: "bg-amber-400" };
  }
  if (/WL|WAIT|REGRET|UNAVAILABLE|NOT RUNNING/.test(status)) {
    return { text: "text-rose-600 dark:text-rose-200", line: "bg-rose-300 dark:bg-rose-300/60", dot: "bg-rose-400" };
  }
  return { text: "text-slate-400", line: "bg-slate-300 dark:bg-white/20", dot: "bg-slate-300" };
}

function formatFare(value: unknown) {
  const text = String(value || "").trim();
  if (!text || text === "₹--") return "₹--";
  return text.startsWith("₹") ? text : `₹${text}`;
}

function liveSeatText(train: any) {
  return readableRailStatus(train?.availability) || "Check seats";
}

function liveFareText(train: any) {
  return formatFare(train?.fare || train?._fare || "");
}

function primaryClassCode(train: any, fallback = "3A") {
  return String(train?.classType || train?.classes?.[0] || fallback).toUpperCase();
}

function classAvailabilityStatus(train: any, classCode: string) {
  const first = train?.classAvailability?.[classCode]?.[0];
  const status = first?.availabilityText || first?.text || first?.status || (primaryClassCode(train) === classCode ? train?.availability : "");
  return readableRailStatus(status) || "Tap for quota";
}

function classFareText(train: any, classCode: string) {
  const first = train?.classAvailability?.[classCode]?.[0];
  return formatFare(first?.fare || estimatedClassFare(classCode, train?.fare || train?._fare));
}

function fareToNumber(value: unknown) {
  const amount = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function trainFareAmount(train: any) {
  return fareToNumber(train?.fare || train?._fare || train?.totalFare);
}

function isSeatAvailable(value: unknown) {
  const status = readableRailStatus(value).toUpperCase();
  return /\bAVAILABLE\b|\bAVL\b|CNF|CONFIRM/.test(status) && !/WL|WAIT|REGRET|UNAVAILABLE|NOT RUNNING/.test(status);
}

function timeToMinutes(value: unknown) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return 24 * 60 + 1;
  return Number(match[1]) * 60 + Number(match[2]);
}

function estimatedClassFare(classCode: string, trainFare: unknown) {
  const existing = Number(String(trainFare || "").replace(/[^\d.]/g, ""));
  if (existing > 0) {
    const multipliers: Record<string, number> = { SL: 0.42, "3E": 0.78, "3A": 1, "2A": 1.45, "1A": 2.35, CC: 0.72, EC: 1.45 };
    return formatFare(Math.max(120, Math.round(existing * (multipliers[classCode] || 1))));
  }
  const base: Record<string, number> = { SL: 420, "3E": 990, "3A": 1280, "2A": 1860, "1A": 3180, CC: 740, EC: 1480 };
  return formatFare(base[classCode] || 1280);
}

function durationToMinutes(value: unknown) {
  const text = String(value || "").toLowerCase();
  if (!text || text === "n/a") return 0;
  const colon = text.match(/(\d{1,2}):(\d{2})/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const hour = text.match(/(\d+)\s*h/);
  const minute = text.match(/(\d+)\s*m/);
  return (hour ? Number(hour[1]) * 60 : 0) + (minute ? Number(minute[1]) : 0);
}

function formatDurationLong(minutes: number) {
  if (!minutes) return "--";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function splitTotalDuration(split: any) {
  const leg1 = durationToMinutes(split.leg1?.duration);
  const leg2 = durationToMinutes(split.leg2?.duration);
  const layover = Math.round(Number(split.layoverHours || 0) * 60) || durationToMinutes(split.layoverDuration);
  return split.totalDuration || formatDurationLong(leg1 + layover + leg2);
}

function trainCompareKey(train: any) {
  return `${train?.trainNo || "train"}-${train?.source || "SRC"}-${train?.destination || "DST"}`;
}

function classCalendarFor(train: any, classType = "3A") {
  const activeClass = train?.classAvailability?.[classType] ? classType : train?.classType || "3A";
  const existing = train?.classAvailability?.[activeClass] || [];
  if (existing.length) return existing.slice(0, 7);
  return Array.from({ length: 7 }, (_, index) => ({
    date: prettyDateLabel(todayIso(index)),
    text: index === 0 ? liveSeatText(train) : index % 3 === 0 ? "RAC 8" : index % 4 === 0 ? "WL 14" : "AVL 24",
    fare: trainFareAmount(train) || 1280,
    confirmationChance: index === 0 ? train?.confirmationChance || 78 : 82 - index * 4,
  }));
}

function fullStationLabelFromCode(code: unknown, withCode = true) {
  const cleanCode = String(code || "").toUpperCase();
  const station = stationByCode(cleanCode);
  if (!station) return cleanCode || "--";
  const overrides: Record<string, string> = {
    ALD: "Prayagraj Junction",
    CKP: "Chakradharpur",
    DDU: "Pt Deen Dayal Upadhyaya Junction",
    DLI: "Old Delhi",
    JP: "Jaipur Junction",
    NDLS: "New Delhi",
    NZM: "Hazrat Nizamuddin",
    PRYJ: "Prayagraj Junction",
    TATA: "Tatanagar Junction",
  };
  const name = overrides[cleanCode] || titleCase(station.name.replace(/\bRAILWAY STATION\b/gi, "").trim());
  const state = stationState(cleanCode);
  const label = state === "India" ? name : `${name} (${state})`;
  return withCode ? `${label} — ${cleanCode}` : label;
}

function stationCompactLabel(code: unknown) {
  const cleanCode = String(code || "").toUpperCase();
  const station = stationByCode(cleanCode);
  if (!station) return cleanCode || "--";
  const overrides: Record<string, string> = {
    ALD: "Prayagraj Junction",
    CKP: "Chakradharpur",
    DDU: "Pt Deen Dayal Upadhyaya Junction",
    DLI: "Old Delhi",
    JP: "Jaipur Junction",
    NDLS: "New Delhi",
    NZM: "Hazrat Nizamuddin",
    PRYJ: "Prayagraj Junction",
    TATA: "Tatanagar Junction",
  };
  const name = overrides[cleanCode] || titleCase(station.name.replace(/\bRAILWAY STATION\b/gi, "").trim());
  return `${name} (${cleanCode})`;
}

function expectedPlatformNumber(code: unknown, trainNo?: unknown) {
  const seed = `${String(code || "")}-${String(trainNo || "")}`;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return String((hash % 8) + 1);
}

function platformText(stop: any, trainNo?: unknown) {
  const rawPlatform = String(stop?.platform || "").trim();
  if (rawPlatform && rawPlatform !== "--" && rawPlatform.toUpperCase() !== "TBA") {
    return { label: "Platform", value: rawPlatform };
  }
  return { label: "Expected platform", value: expectedPlatformNumber(stop?.code, trainNo) };
}

function trainNumberName(train: any, fallback = "Train details") {
  const number = String(train?.trainNo || train?.train_no || train?.trainNumber || "").trim();
  const name = String(train?.trainName || train?.train_name || fallback).trim().toUpperCase();
  return number ? `${number} · ${name}` : name;
}

function compatibleCoaches(classType: string) {
  if (classType === "1A") return ["H1", "H2", "HA1"];
  if (classType === "2A") return ["A1", "A2", "HA1"];
  if (classType === "SL") return ["S1", "S2", "S3", "S4"];
  if (classType === "CC") return ["CC1", "CC2"];
  if (classType === "EC") return ["EC1", "EC2"];
  return ["B1", "B2", "B3", "B4"];
}

function defaultCoachFor(classType: string) {
  return compatibleCoaches(classType)[0];
}

const ROUTE_ACCESS_HUBS_BY_STATE: Record<string, string[]> = {
  Jharkhand: ["TATA", "RNC", "DHN", "ROU", "BKSC"],
  Odisha: ["ROU", "BBS", "CTC", "SBP", "JSG"],
  Bihar: ["PNBE", "DNR", "PPTA", "GAYA", "MFP"],
  Rajasthan: ["JP", "KOTA", "AII", "JU", "BKN"],
  "West Bengal": ["HWH", "SDAH", "KOAA", "NJP", "ASN"],
  "Uttar Pradesh": ["DDU", "PRYJ", "CNB", "LKO", "BSB", "GZB"],
  Delhi: ["NDLS", "NZM", "DLI", "ANVT"],
  Maharashtra: ["CSMT", "LTT", "BDTS", "KYN", "NGP"],
  "Madhya Pradesh": ["BPL", "ET", "JBP", "KTE", "GWL"],
  Gujarat: ["ADI", "BRC", "ST", "RJT"],
  Karnataka: ["SBC", "YPR", "SMVB", "UBL", "MYS"],
  "Tamil Nadu": ["MAS", "MS", "TBM", "CBE", "MDU"],
  Telangana: ["SC", "HYB", "KCG", "WL"],
  "Andhra Pradesh": ["BZA", "VSKP", "GNT", "TPTY"],
};

const NATIONAL_ROUTE_ACCESS_HUBS = ["NDLS", "NZM", "DDU", "CNB", "PRYJ", "BPL", "KOTA", "JP", "NGP", "ET", "BZA", "HWH"];

function routeAccessHubs(code: string, fallback: string[] = NATIONAL_ROUTE_ACCESS_HUBS) {
  const normalized = code.toUpperCase();
  const state = stationState(normalized);
  return Array.from(new Set([normalized, ...(ROUTE_ACCESS_HUBS_BY_STATE[state] || []), ...fallback]))
    .filter((hub) => hub && hub !== normalized && stationByCode(hub))
    .slice(0, 6);
}

function shouldShowNearbyOptimizer(source: string, destination: string) {
  return source.toUpperCase() === "CKP" && destination.toUpperCase() !== "CKP";
}

function directRouteLimitMinutes(trains: any[]) {
  const durations = trains.map((train) => durationToMinutes(train.duration)).filter((duration) => duration > 0);
  if (!durations.length) return Infinity;
  return Math.max(Math.min(...durations) * 1.75, Math.min(...durations) + 90);
}

function groupSeatsForClass(classType: string, seats: ReturnType<typeof buildCoachSeats>) {
  if (classType === "1A") {
    const groups: { label: string; seats: typeof seats }[] = [];
    seats.forEach((seat) => {
      const label = seat.cabin || "Cabin";
      const existing = groups.find((group) => group.label === label);
      if (existing) existing.seats.push(seat);
      else groups.push({ label, seats: [seat] });
    });
    return groups;
  }
  const size = classType === "2A" ? 6 : ["CC", "EC"].includes(classType) ? 4 : 8;
  return Array.from({ length: Math.ceil(seats.length / size) }, (_, index) => ({
    label: ["CC", "EC"].includes(classType) ? `Row ${index + 1}` : `Bay ${index + 1}`,
    seats: seats.slice(index * size, index * size + size),
  }));
}

function ProductShell({ children, active }: { children: React.ReactNode; active?: ToolKind }) {
  return (
    <main className={`${productBg()} notranslate`} translate="no">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_15%_0%,rgba(14,165,233,0.14),transparent_30%),radial-gradient(circle_at_90%_12%,rgba(236,72,153,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(241,245,249,0.92)_48%,rgba(226,232,240,0.7)_100%)] dark:bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_90%_20%,rgba(251,113,133,0.13),transparent_30%),linear-gradient(180deg,#050816_0%,#08111f_48%,#0b1020_100%)]" />
      <nav className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/72 backdrop-blur-2xl dark:border-white/8 dark:bg-[#050816]/78">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950">
              <Train className="h-5 w-5" />
            </span>
            <span className="text-lg font-black tracking-tight">RailRoute</span>
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            {toolNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-2xl px-3 py-2 text-sm font-bold transition ${
                  active === item.tool
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/trains" className="hidden items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-50 sm:flex">
              Launch App
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>
      <div className="relative z-10">{children}</div>
    </main>
  );
}

function StationAutocomplete({
  label,
  placeholder,
  example,
  value,
  setValue,
  query,
  setQuery,
}: {
  label: string;
  placeholder: string;
  example: string;
  value: string;
  setValue: (code: string) => void;
  query: string;
  setQuery: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 500);
  const deferredQuery = useDeferredValue(debouncedQuery);
  const canOpenSuggestions = normalizeText(query).length >= 3 || Boolean(stationByCode(query.trim().toUpperCase()));
  const matches = useMemo(() => {
    const trimmed = deferredQuery.trim();
    const exactCode = stationByCode(trimmed.toUpperCase());
    if (exactCode && normalizeText(trimmed).length < 3) return [exactCode];
    return normalizeText(trimmed).length >= 3 ? stationMatches(trimmed) : [];
  }, [deferredQuery]);

  useEffect(() => {
    setActive(0);
  }, [deferredQuery]);

  function select(station: Station) {
    setValue(station.code);
    setQuery(stationLabel(station));
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">{label}</label>
        <span className="truncate text-[11px] font-semibold text-slate-400 dark:text-slate-500">{example}</span>
      </div>
      <div className="relative">
        <MapPin className={`pointer-events-none absolute left-4 top-4 h-4 w-4 ${label === "From" ? "text-emerald-500" : label === "Via" ? "text-cyan-500" : "text-rose-500"}`} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setValue("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 140)}
          onKeyDown={(event) => {
            if (!open || matches.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, matches.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              select(matches[active]);
            }
          }}
          placeholder={placeholder}
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white/85 pl-11 pr-4 text-[15px] font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-300/15 dark:border-white/10 dark:bg-white/8 dark:text-white dark:placeholder:text-slate-500"
          aria-label={label}
        />
      </div>
      <AnimatePresence>
        {open && canOpenSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-400/20 dark:border-white/12 dark:bg-[#111827]/96 dark:shadow-black/50"
          >
            {matches.length === 0 ? (
              <div className="px-4 py-4 text-sm font-semibold text-slate-500 dark:text-slate-300">No station found. Try station code or city spelling.</div>
            ) : (
              matches.map((station, index) => (
                <button
                  key={station.code}
                  type="button"
                  onMouseDown={() => select(station)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                    index === active ? "bg-cyan-50 dark:bg-white/14" : "hover:bg-slate-50 dark:hover:bg-white/10"
                  }`}
                >
                  <span className="min-w-0 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{stationLabel(station, false)}</span>
                  <span className="shrink-0 rounded-lg border border-cyan-300/40 bg-cyan-100 px-2.5 py-1 text-xs font-black text-cyan-800 dark:bg-cyan-300/10 dark:text-cyan-100">{station.code}</span>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <input type="hidden" value={value} readOnly />
    </div>
  );
}

function DateQuickField({ date, setDate }: { date: string; setDate: (value: string) => void }) {
  const options = [
    ["Today", todayIso(0)],
    ["Tomorrow", todayIso(1)],
    ["Day after", todayIso(2)],
  ];

  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">Date</span>
        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">{prettyDateLabel(date)}</span>
      </span>
      <input type="date" min={todayIso(0)} value={date} onChange={(event) => setDate(event.target.value)} className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-cyan-400 dark:border-white/10 dark:bg-white/8 dark:text-white" />
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([label, value]) => (
          <button
            key={label}
            type="button"
            onClick={() => setDate(value)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-black transition ${
              date === value
                ? "border-cyan-300 bg-cyan-100 text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100"
                : "border-slate-200 bg-white/80 text-slate-500 hover:border-cyan-300 dark:border-white/10 dark:bg-white/6 dark:text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </label>
  );
}

function resolveStationInput(selectedCode: string, query: string) {
  if (selectedCode) return selectedCode;
  const trimmed = query.trim();
  const exactCode = stationByCode(trimmed.toUpperCase());
  if (exactCode) return exactCode.code;
  if (normalizeText(trimmed).length < 3) return "";
  return stationMatches(trimmed, 1)[0]?.code || "";
}

function QuickSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [preferredHub, setPreferredHub] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [preferredHubQuery, setPreferredHubQuery] = useState("");
  const [date, setDate] = useState(todayIso());
  const [classType, setClassType] = useState("3A");
  const [error, setError] = useState("");
  const [swap, setSwap] = useState(false);
  const [trainQuery, setTrainQuery] = useState("");

  function swapStations() {
    setSwap(true);
    const oldSource = source;
    const oldQuery = sourceQuery;
    setSource(destination);
    setDestination(oldSource);
    setSourceQuery(destinationQuery);
    setDestinationQuery(oldQuery);
    window.setTimeout(() => setSwap(false), 420);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const resolvedSource = resolveStationInput(source, sourceQuery);
    const resolvedDestination = resolveStationInput(destination, destinationQuery);
    const resolvedPreferredHub = resolveStationInput(preferredHub, preferredHubQuery);

    if (!resolvedSource || !resolvedDestination) {
      setError("Select both Starting Point and End Point from station search.");
      return;
    }
    if (resolvedSource === resolvedDestination) {
      setError("Starting Point and End Point cannot be the same.");
      return;
    }
    const params = new URLSearchParams({
      source: resolvedSource,
      destination: resolvedDestination,
      date,
      classType,
    });
    if (resolvedPreferredHub && resolvedPreferredHub !== resolvedSource && resolvedPreferredHub !== resolvedDestination) {
      params.set("via", resolvedPreferredHub);
    }
    router.push(`/trains?${params.toString()}`);
  }

  function submitTrainLookup() {
    const cleanQuery = trainQuery.trim();
    if (!cleanQuery) {
      setError("Enter a train number or train name.");
      return;
    }
    setError("");
    router.push(`/train-search?query=${encodeURIComponent(cleanQuery)}`);
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={compact
        ? "w-full rounded-[30px] border border-white/15 bg-white/12 p-3 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-4"
        : softPanel("mx-auto w-full max-w-5xl rounded-[32px] p-4 sm:p-5")}
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
        <StationAutocomplete label="From" placeholder="Starting Point" example="Patna (Bihar)" value={source} setValue={setSource} query={sourceQuery} setQuery={setSourceQuery} />
        <button type="button" onClick={swapStations} className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-cyan-700 shadow-lg transition hover:border-cyan-300 dark:border-white/14 dark:bg-white/10 dark:text-cyan-100" aria-label="Swap source and destination">
          <motion.span animate={{ rotate: swap ? 180 : 0, scale: swap ? 1.12 : 1 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
            <ArrowDownUp className="h-5 w-5" />
          </motion.span>
        </button>
        <StationAutocomplete label="To" placeholder="End Point" example="Jaipur (Rajasthan)" value={destination} setValue={setDestination} query={destinationQuery} setQuery={setDestinationQuery} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <DateQuickField date={date} setDate={setDate} />
        <label className="block">
          <span className="mb-2 block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">Class</span>
          <select value={classType} onChange={(event) => setClassType(event.target.value)} className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-cyan-400 dark:border-white/10 dark:bg-[#111827] dark:text-white">
            {["Any", ...classOptions].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-7 text-sm font-black text-white shadow-xl transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-50 md:self-end">
          <Search className="h-4 w-4" />
          Search Trains
        </button>
      </div>
      <div className="mt-4">
        <StationAutocomplete label="Via" placeholder="Optional layover city or station" example="Delhi / NDLS" value={preferredHub} setValue={setPreferredHub} query={preferredHubQuery} setQuery={setPreferredHubQuery} />
      </div>
      {error && <p className="mt-3 rounded-2xl border border-rose-300/40 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-100">{error}</p>}
      <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-black/20">
        <div className="mb-2 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">Search by train number or name</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Train className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-cyan-600 dark:text-cyan-200" />
            <input
              value={trainQuery}
              onChange={(event) => setTrainQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitTrainLookup();
                }
              }}
              placeholder="12376, Rajdhani, Vande Bharat"
              className="h-13 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 dark:border-white/10 dark:bg-white/8 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
          <button type="button" onClick={submitTrainLookup} className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-900 transition hover:border-cyan-300 dark:border-white/10 dark:bg-white/8 dark:text-white">
            <Search className="h-4 w-4" />
            Lookup Train
          </button>
        </div>
      </div>
    </motion.form>
  );
}

function IndiaMapShowcase({ source = "PNBE", destination = "JP", via = ["NDLS"] }: { source?: string; destination?: string; via?: string[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const codes = [source, ...via, destination].filter((code) => STATION_COORDS[code]);

  useEffect(() => {
    let cleanup = () => undefined;

    async function mountMap() {
      if (!mapRef.current) return;
      const L = await import("leaflet");
      if (!mapRef.current || mapRef.current.dataset.ready === "true") return;
      mapRef.current.dataset.ready = "true";

      const routeLatLngs = codes.map((code) => [STATION_COORDS[code].lat, STATION_COORDS[code].lng] as [number, number]);
      const map = L.map(mapRef.current, {
        center: [23.4, 78.9],
        zoom: 5,
        minZoom: 4,
        maxZoom: 10,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const railLayer = L.tileLayer("https://{s}.tile.openrailwaymap.org/standard/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>',
        opacity: 0.62,
      }).addTo(map);

      const icon = (label: string, color: string) =>
        L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;gap:6px;transform:translate(-6px,-6px);">
            <span style="width:16px;height:16px;border-radius:999px;background:${color};border:2px solid white;box-shadow:0 10px 28px rgba(15,23,42,.35);display:block"></span>
            <span style="background:rgba(15,23,42,.88);color:white;border:1px solid rgba(255,255,255,.2);padding:4px 8px;border-radius:999px;font:800 11px Inter,system-ui;white-space:nowrap">${label}</span>
          </div>`,
          iconSize: [120, 28],
          iconAnchor: [8, 8],
        });

      Object.entries(STATION_COORDS).forEach(([code, coords]) => {
        const color = code === source ? "#10b981" : code === destination ? "#f43f5e" : via.includes(code) ? "#8b5cf6" : "#64748b";
        L.marker([coords.lat, coords.lng], { icon: icon(code, color), keyboard: true })
          .bindTooltip(stationLabelFromCode(code), { direction: "top", offset: [0, -8] })
          .addTo(map);
      });

      const route = L.polyline(routeLatLngs, {
        color: "#06b6d4",
        weight: 5,
        opacity: 0.92,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      L.polyline(routeLatLngs, {
        color: "#f43f5e",
        weight: 2,
        opacity: 0.65,
        dashArray: "8 12",
      }).addTo(map);

      const trainMarker = L.marker(routeLatLngs[0], {
        icon: L.divIcon({
          className: "",
          html: `<div style="height:34px;width:34px;border-radius:14px;background:white;color:#020617;display:grid;place-items:center;border:1px solid rgba(15,23,42,.12);box-shadow:0 18px 40px rgba(15,23,42,.35);font:900 17px Inter,system-ui">↗</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      }).addTo(map);

      let tick = 0;
      const timer = window.setInterval(() => {
        if (routeLatLngs.length < 2) return;
        const segment = Math.floor(tick) % (routeLatLngs.length - 1);
        const progress = tick - Math.floor(tick);
        const from = routeLatLngs[segment];
        const to = routeLatLngs[segment + 1];
        trainMarker.setLatLng([
          from[0] + (to[0] - from[0]) * progress,
          from[1] + (to[1] - from[1]) * progress,
        ]);
        tick = (tick + 0.018) % Math.max(1, routeLatLngs.length - 1);
      }, 60);

      if (routeLatLngs.length > 1) {
        map.fitBounds(route.getBounds(), { padding: [46, 46], maxZoom: 6 });
      }

      cleanup = () => {
        window.clearInterval(timer);
        map.removeLayer(railLayer);
        map.remove();
        if (mapRef.current) delete mapRef.current.dataset.ready;
      };
    }

    mountMap();
    return () => cleanup();
  }, [codes, destination, source, via]);

  return (
    <div className={softPanel("relative min-h-[520px] overflow-hidden rounded-[34px] p-3")}>
      <div ref={mapRef} className="absolute inset-0 z-0 bg-slate-100 dark:bg-slate-950" aria-label="Real OpenStreetMap India railway route map" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-white/90 to-transparent dark:from-[#050816]/88" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-white/92 to-transparent dark:from-[#050816]/90" />
      <div className="pointer-events-none relative z-20 flex min-h-[496px] flex-col justify-between p-3 sm:p-5">
        <div className="max-w-md rounded-3xl border border-slate-200/80 bg-white/88 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/72">
          <span className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-100 px-3 py-1 text-[11px] font-black uppercase text-cyan-800 dark:bg-cyan-300/10 dark:text-cyan-100">Real OpenStreetMap + railway layer</span>
          <h3 className="mt-4 text-2xl font-black tracking-tight">Pan, zoom, and inspect the actual India map with station markers and route paths.</h3>
        </div>
        <div className="pointer-events-auto grid gap-2 sm:grid-cols-3">
          {[
            ["Source", source, "text-emerald-600"],
            ["Transfer", via[0] || "NDLS", "text-violet-600"],
            ["Destination", destination, "text-rose-600"],
          ].map(([label, code, tone]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white/88 p-3 text-sm font-bold shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/72">
              <div className={`text-[11px] uppercase ${tone}`}>{label}</div>
              <div className="mt-1 truncate">{stationLabelFromCode(code, false)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RailRouteHomePage() {
  return (
    <ProductShell>
      <section className="relative min-h-[820px] overflow-hidden bg-slate-950 px-4 py-10 text-white sm:px-6 lg:min-h-[860px] lg:py-16">
        <Image src="/cinematic-train-hero-train.jpg" alt="Cinematic train arriving at a night railway platform" fill priority sizes="100vw" className="object-cover object-center opacity-70" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.94)_0%,rgba(2,6,23,0.82)_36%,rgba(2,6,23,0.45)_66%,rgba(2,6,23,0.76)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,rgba(34,211,238,0.28),transparent_34%),radial-gradient(circle_at_24%_76%,rgba(59,130,246,0.22),transparent_36%)]" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#050816] to-transparent" />
        <motion.div className="pointer-events-none absolute left-0 top-24 h-px w-full bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" animate={{ opacity: [0.15, 0.65, 0.15], x: [-90, 90, -90] }} transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }} />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.96fr_0.74fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-white/10 px-4 py-2 text-xs font-black uppercase text-cyan-100 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
              <Sparkles className="h-3.5 w-3.5" />
              Indian Railways intelligence platform
            </span>
            <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight text-white sm:text-7xl">
              PLAN SMARTER RAILWAY JOURNEYS
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-slate-200">
              Route intelligence, seat maps, split journeys, fare comparison and platform insights.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                ["Search Trains", "/trains", Search],
                ["PNR Status", "/pnr", ShieldCheck],
                ["Coach Layouts", "/coach", Train],
              ].map(([label, href, Icon], index) => {
                const I = Icon as typeof Search;
                return (
                  <Link key={String(label)} href={String(href)} className={`flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-black transition ${index === 0 ? "bg-white text-slate-950 hover:bg-cyan-50" : "border border-white/15 bg-white/10 text-white backdrop-blur-xl hover:bg-white/16"}`}>
                    <I className="h-4 w-4" />
                    {String(label)}
                  </Link>
                );
              })}
            </div>
            <div className="mt-8">
              <QuickSearch compact />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.97, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} className="relative hidden min-h-[610px] lg:block">
            <motion.div className="absolute right-0 top-8 w-[430px] rounded-[34px] border border-white/14 bg-white/12 p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl" animate={{ y: [0, -8, 0] }} transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase text-cyan-100/80">Split corridor intelligence</div>
                  <div className="mt-1 text-2xl font-black">PNBE → NDLS</div>
                </div>
                <span className="rounded-full bg-emerald-300/18 px-3 py-1 text-xs font-black text-emerald-100">AVL-first</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  ["ETA", "21:50"],
                  ["Seats", "AVL 24"],
                  ["Fare", "₹1,520"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/36 p-3">
                    <div className="text-[10px] font-black uppercase text-slate-400">{label}</div>
                    <div className="mt-1 text-lg font-black">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/34 p-4">
                <div className="flex items-center justify-between text-xs font-black text-slate-300">
                  <span>Patna Junction</span>
                  <span>New Delhi</span>
                </div>
                <div className="relative mt-4 h-2 rounded-full bg-white/10">
                  <motion.div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-rose-300" animate={{ width: ["36%", "68%", "36%"] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} />
                  <motion.span className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-300 shadow-lg shadow-cyan-300/40" animate={{ left: ["34%", "66%", "34%"] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} />
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-300">
                  <Activity className="h-4 w-4 text-cyan-200" />
                  Platform risk low · 8 min transfer buffer
                </div>
              </div>
            </motion.div>

            <motion.div className="absolute bottom-12 right-20 w-[360px] rounded-[30px] border border-white/14 bg-slate-950/38 p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl" animate={{ y: [0, 9, 0] }} transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-200 text-slate-950"><Route className="h-5 w-5" /></span>
                <div>
                  <div className="font-black">Split journey engine</div>
                  <div className="text-sm font-semibold text-slate-300">3 alternates · lowest fare found</div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {["Patna → Delhi", "Delhi → Jaipur"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-2xl bg-white/8 px-3 py-2 text-sm font-black">
                    <span>{item}</span>
                    <span className={index === 0 ? "text-emerald-200" : "text-cyan-200"}>{index === 0 ? "AVL 32" : "RAC 8"}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-12 max-w-7xl px-4 pb-14 sm:px-6">
        <div className="overflow-hidden rounded-[34px] border border-white/10 bg-slate-950/95 p-5 text-white shadow-2xl shadow-slate-950/30 backdrop-blur-2xl sm:p-6">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="text-xs font-black uppercase text-cyan-200">Quick utility cockpit</span>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Railway tools that actually move the journey forward.</h2>
            </div>
            <p className="max-w-md text-sm font-semibold leading-6 text-slate-400">
              Direct access to ticket checks, seats, fares, coaches, platforms and split planning.
            </p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["PNR Status", "/pnr", ShieldCheck, "Chart and passenger status"],
            ["Train Route", "/route", Route, "Complete station timeline"],
            ["Coach Layout", "/coach", Train, "Berth and coach map"],
            ["Seat Availability", "/trains", WalletCards, "Class-wise quota"],
            ["Fare Calculator", "/fare", IndianRupee, "Route and class pricing"],
            ["Platform Notes", "/route", Compass, "Expected platform context"],
            ["Split Journey Planner", "/trains", ArrowDownUp, "Smart two-leg options"],
          ].map(([title, href, Icon, body]) => {
            const I = Icon as typeof Route;
            return (
              <Link key={String(title)} href={String(href)} className="group rounded-[26px] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/10 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-200/35 hover:bg-white/[0.09] hover:shadow-cyan-950/30">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-100 transition group-hover:border-cyan-200/40 group-hover:bg-cyan-200/15">
                  <I className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-black">{String(title)}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">{String(body)}</p>
                <div className="mt-5 flex items-center gap-2 text-xs font-black uppercase text-cyan-200/80">
                  Open tool
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className={softPanel("grid gap-4 rounded-[34px] p-6 md:grid-cols-4")}>
          {[
            ["8,990", "station search index"],
            ["IRCTC", "compatible checks"],
            ["Full", "route timelines"],
            ["Dark + Light", "persistent themes"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-3xl bg-slate-50 p-5 dark:bg-black/20">
              <div className="text-3xl font-black">{value}</div>
              <div className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{label}</div>
            </div>
          ))}
        </div>
      </section>
    </ProductShell>
  );
}

function ToolHeader({ tool }: { tool: ToolKind }) {
  const copy: Record<ToolKind, [string, string]> = {
    trains: ["Train Search", "Search by stations, train number, or train name with railway intelligence."],
    "train-search": ["Train Number Search", "Full train details, running days, route and complete timetable."],
    live: ["Train Search", "Search direct and split journeys with station intelligence."],
    pnr: ["PNR Status", "Passenger status, chart state and journey summary."],
    fare: ["Fare Enquiry", "Fare estimate by train, class, quota and route."],
    map: ["India Route Map", "Zoom-friendly India route plotting with markers, split routes and train motion."],
    route: ["Route Details", "Complete station timeline with arrival, departure, halt, platform and distance."],
    coach: ["Coach Explorer", "Interactive berth and seat maps with coach tabs and availability states."],
  };
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <span className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-100 px-4 py-2 text-xs font-black uppercase text-cyan-800 dark:bg-cyan-300/10 dark:text-cyan-100">RailRoute app</span>
      <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">{copy[tool][0]}</h1>
      <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-600 dark:text-slate-300">{copy[tool][1]}</p>
    </section>
  );
}

function TrainSearchPanel({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{ loading: boolean; error: string; trains: any[] }>({ loading: false, error: "", trains: [] });

  async function search(event?: FormEvent, forcedQuery?: string) {
    event?.preventDefault();
    const searchQuery = forcedQuery || query;
    if (!searchQuery.trim()) {
      setState({ loading: false, error: "Enter a train number or train name.", trains: [] });
      return;
    }
    setState({ loading: true, error: "", trains: [] });
    try {
      const data = await postJson<any>("/api/train-search", { query: searchQuery });
      setState({ loading: false, error: "", trains: data.trains || [] });
    } catch (error) {
      const local = searchTrainDirectory(query);
      setState({ loading: false, error: error instanceof Error ? error.message : "Train lookup failed.", trains: local });
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("query");
    if (initialQuery) {
      setQuery(initialQuery);
      window.setTimeout(() => search(undefined, initialQuery), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={softPanel(`rounded-[30px] p-5 ${compact ? "" : "mx-auto max-w-7xl"}`)}>
      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Train className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-cyan-600 dark:text-cyan-200" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Train number or name, e.g. 12395, Rajdhani, Ziyarat Express" className="h-13 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-bold outline-none focus:border-cyan-400 dark:border-white/10 dark:bg-white/8 dark:text-white dark:placeholder:text-slate-500" />
        </div>
        <button className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-black text-white dark:bg-white dark:text-slate-950">
          <span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">
            {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </span>
          <span>Search Train</span>
        </button>
      </form>
      {state.error && <p className="mt-4 rounded-2xl border border-rose-300/40 bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-100">{state.error}</p>}
      <div className="mt-5 space-y-5">
        {state.trains.map((train) => <FullTrainDetails key={train.trainNo} train={train} />)}
      </div>
    </div>
  );
}

function FullTrainDetails({ train }: { train: any }) {
  const route = train.route || [];
  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-black/20">
      <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">{train.type || "Express"}</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">{(train.runningDays || ["Daily"]).join(" · ")}</span>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-black text-slate-700 dark:bg-white/10 dark:text-slate-200">{train.dataSource || "IRCTC-compatible schedule"}</span>
          </div>
          <h2 className="mt-4 text-2xl font-black">{train.trainName}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">#{train.trainNo} · {stationLabelFromCode(train.source)} to {stationLabelFromCode(train.destination)}</p>
        </div>
        <div className="space-y-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold dark:border-white/10 dark:bg-white/8">
            Complete route · {route.length} stops
          </div>
          <div className="flex items-center justify-center rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">
            Complete timetable below
          </div>
          <a href={IRCTC_TRAIN_SEARCH_URL} target="_blank" rel="noreferrer" className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/8 dark:text-slate-100">
            Verify on IRCTC
          </a>
        </div>
      </div>
      <div className="border-t border-slate-200 p-5 dark:border-white/10">
        <div className="space-y-0">
          {route.map((stop: any, index: number) => {
            const platform = platformText(stop, train.trainNo);
            return (
              <div key={`${stop.code}-${index}`} className="grid grid-cols-[auto_1fr] gap-4">
                <div className="flex flex-col items-center">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${index === 0 ? "border-emerald-400 bg-emerald-100 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-100" : index === route.length - 1 ? "border-rose-400 bg-rose-100 text-rose-700 dark:bg-rose-400/12 dark:text-rose-100" : "border-cyan-400 bg-cyan-100 text-cyan-700 dark:bg-cyan-400/12 dark:text-cyan-100"}`}>
                    <Circle className="h-2.5 w-2.5 fill-current" />
                  </span>
                  {index < route.length - 1 && <span className="h-20 w-px bg-slate-200 dark:bg-white/12" />}
                </div>
                <div className="pb-6">
                  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-base font-black">{stop.stationName || stationLabelFromCode(stop.code, false)} <span className="text-slate-400">— {stop.code}</span></div>
                      <div className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{stop.state || "India"} · {platform.label} {platform.value} · {stop.distance} km</div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><div className="text-[10px] font-black uppercase text-slate-400">Arr</div><div className="font-black">{stop.arrival}</div></div>
                      <div><div className="text-[10px] font-black uppercase text-slate-400">Dep</div><div className="font-black">{stop.departure}</div></div>
                      <div><div className="text-[10px] font-black uppercase text-slate-400">Halt</div><div className="font-black">{stop.halt}</div></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function TrainResultsWorkspace() {
  const searchRequestId = useRef(0);
  const [searchKey, setSearchKey] = useState("");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [preferredHub, setPreferredHub] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [preferredHubQuery, setPreferredHubQuery] = useState("");
  const [date, setDate] = useState(todayIso());
  const [classType, setClassType] = useState("3A");
  const [allowSplit, setAllowSplit] = useState(true);
  const [resultMode, setResultMode] = useState<"all" | "direct" | "split" | "multi">("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"best" | "cheapest" | "fastest" | "earliest" | "latest">("best");
  const [maxFare, setMaxFare] = useState("");
  const [maxDuration, setMaxDuration] = useState("");
  const [state, setState] = useState<{ loading: boolean; splitLoading: boolean; error: string; trains: any[]; splits: any[]; multiSplits: any[] }>({ loading: false, splitLoading: false, error: "", trains: [], splits: [], multiSplits: [] });
  const [classView, setClassView] = useState<{ train: any; classCode: string } | null>(null);
  const [detailTrain, setDetailTrain] = useState<any | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const filteredTrains = useMemo(() => {
    const fareLimit = Number(maxFare) || Infinity;
    const durationLimit = maxDuration ? Number(maxDuration) * 60 : Infinity;
    const next = state.trains.filter((train) => {
      const fare = trainFareAmount(train);
      const duration = durationToMinutes(train.duration);
      if (availableOnly && !isSeatAvailable(train.availability)) return false;
      if (fare && fare > fareLimit) return false;
      if (duration && duration > durationLimit) return false;
      return true;
    });
    return [...next].sort((a, b) => {
      if (sortBy === "cheapest") return (trainFareAmount(a) || Infinity) - (trainFareAmount(b) || Infinity);
      if (sortBy === "fastest") return (durationToMinutes(a.duration) || Infinity) - (durationToMinutes(b.duration) || Infinity);
      if (sortBy === "earliest") return timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime);
      if (sortBy === "latest") return timeToMinutes(b.departureTime) - timeToMinutes(a.departureTime);
      const availabilityScore = (train: any) => isSeatAvailable(train.availability) ? 0 : /RAC/i.test(readableRailStatus(train.availability)) ? 1 : 2;
      return availabilityScore(a) - availabilityScore(b) || (trainFareAmount(a) || Infinity) - (trainFareAmount(b) || Infinity) || (durationToMinutes(a.duration) || Infinity) - (durationToMinutes(b.duration) || Infinity);
    });
  }, [availableOnly, maxDuration, maxFare, sortBy, state.trains]);
  const filteredSplits = useMemo(() => {
    const fareLimit = Number(maxFare) || Infinity;
    const durationLimit = maxDuration ? Number(maxDuration) * 60 : Infinity;
    const directLimit = directRouteLimitMinutes(filteredTrains);
    return state.splits.filter((split) => {
      const fare = fareToNumber(split.totalFare || split.fare);
      const duration = durationToMinutes(splitTotalDuration(split));
      const seatsOk = isSeatAvailable(split.leg1?.availability) && isSeatAvailable(split.leg2?.availability);
      if (filteredTrains.length > 0 && duration && duration > directLimit) return false;
      if (availableOnly && !seatsOk) return false;
      if (fare && fare > fareLimit) return false;
      if (duration && duration > durationLimit) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === "cheapest") return (fareToNumber(a.totalFare) || Infinity) - (fareToNumber(b.totalFare) || Infinity);
      if (sortBy === "fastest") return (durationToMinutes(splitTotalDuration(a)) || Infinity) - (durationToMinutes(splitTotalDuration(b)) || Infinity);
      return 0;
    });
  }, [availableOnly, filteredTrains, maxDuration, maxFare, sortBy, state.splits]);
  const filteredMultiSplits = useMemo(() => {
    const fareLimit = Number(maxFare) || Infinity;
    const durationLimit = maxDuration ? Number(maxDuration) * 60 : Infinity;
    const directLimit = directRouteLimitMinutes(filteredTrains);
    return state.multiSplits.filter((split) => {
      const fare = fareToNumber(split.totalFare);
      const duration = durationToMinutes(split.totalDuration);
      const seatsOk = (split.legs || []).every((leg: any) => isSeatAvailable(leg.availability));
      if (filteredTrains.length > 0 && duration && duration > directLimit) return false;
      if (availableOnly && !seatsOk) return false;
      if (fare && fare > fareLimit) return false;
      if (duration && duration > durationLimit) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === "cheapest") return (fareToNumber(a.totalFare) || Infinity) - (fareToNumber(b.totalFare) || Infinity);
      if (sortBy === "fastest") return (durationToMinutes(a.totalDuration) || Infinity) - (durationToMinutes(b.totalDuration) || Infinity);
      return (b.score || 0) - (a.score || 0);
    });
  }, [availableOnly, filteredTrains, maxDuration, maxFare, sortBy, state.multiSplits]);

  useEffect(() => {
    function syncFromLocation() {
      setSearchKey(window.location.search);
    }

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener("railroute-search-change", syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener("railroute-search-change", syncFromLocation);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchKey || window.location.search);
    const rawInitialSource = params.get("source") || "";
    const rawInitialDestination = params.get("destination") || "";
    const initialSource = rawInitialSource ? resolveStationInput("", rawInitialSource) || rawInitialSource.toUpperCase() : "";
    const initialDestination = rawInitialDestination ? resolveStationInput("", rawInitialDestination) || rawInitialDestination.toUpperCase() : "";
    const initialDate = params.get("date") || todayIso();
    const initialClass = params.get("classType") || "3A";
    const rawInitialPreferredHub = params.get("via") || params.get("preferredHub") || "";
    const initialPreferredHub = rawInitialPreferredHub ? resolveStationInput("", rawInitialPreferredHub) || rawInitialPreferredHub.toUpperCase() : "";
    if (initialSource) {
      setSource(initialSource);
      const station = stationByCode(initialSource);
      if (station) setSourceQuery(stationLabel(station));
    }
    if (initialDestination) {
      setDestination(initialDestination);
      const station = stationByCode(initialDestination);
      if (station) setDestinationQuery(stationLabel(station));
    }
    if (initialPreferredHub) {
      setPreferredHub(initialPreferredHub);
      const station = stationByCode(initialPreferredHub);
      setPreferredHubQuery(station ? stationLabel(station) : initialPreferredHub);
    } else {
      setPreferredHub("");
      setPreferredHubQuery("");
    }
    setDate(initialDate);
    setClassType(initialClass);
    setResultMode("all");
    setCompareIds([]);
    if (initialSource && initialDestination) {
      window.setTimeout(() => runSearch(undefined, { source: initialSource, destination: initialDestination, date: initialDate, classType: initialClass, preferredHub: initialPreferredHub }), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  async function runSearch(event?: FormEvent, override?: { source: string; destination: string; date: string; classType: string; preferredHub?: string }) {
    event?.preventDefault();
    const resolvedSource = resolveStationInput(source, sourceQuery);
    const resolvedDestination = resolveStationInput(destination, destinationQuery);
    const resolvedPreferredHub = resolveStationInput(preferredHub, preferredHubQuery);
    const payload = override || {
      source: resolvedSource,
      destination: resolvedDestination,
      date,
      classType,
      preferredHub: resolvedPreferredHub && resolvedPreferredHub !== resolvedSource && resolvedPreferredHub !== resolvedDestination ? resolvedPreferredHub : "",
    };
    if (!payload.source || !payload.destination) {
      searchRequestId.current += 1;
      setState({ loading: false, splitLoading: false, error: "Choose Starting Point and End Point.", trains: [], splits: [], multiSplits: [] });
      return;
    }
    const requestId = searchRequestId.current + 1;
    searchRequestId.current = requestId;
    if (!override && typeof window !== "undefined") {
      const params = new URLSearchParams({
        source: payload.source,
        destination: payload.destination,
        date: payload.date,
        classType: payload.classType,
      });
      if (payload.preferredHub) params.set("via", payload.preferredHub);
      window.history.pushState(null, "", `/trains?${params.toString()}`);
    }
    setState({ loading: true, splitLoading: allowSplit, error: "", trains: [], splits: [], multiSplits: [] });
    try {
      const direct = await postJson<any>("/api/train-between", payload);
      if (requestId !== searchRequestId.current) return;
      const trains = direct.trains || [];
      setState({ loading: false, splitLoading: allowSplit, error: "", trains, splits: [], multiSplits: [] });

      if (allowSplit) {
        postJson<any>("/api/search-split", { ...payload, directTrains: trains })
          .then((splitData) => {
            if (requestId !== searchRequestId.current) return;
            const liveSplits = splitData.splitRoutes || [];
            const liveMultiSplits = splitData.multiSplitRoutes || [];
            setState((current) => ({ ...current, splitLoading: false, splits: liveSplits, multiSplits: liveMultiSplits }));
          })
          .catch(() => {
            if (requestId !== searchRequestId.current) return;
            setState((current) => ({ ...current, splitLoading: false }));
          });
      }
    } catch (error) {
      if (requestId !== searchRequestId.current) return;
      setState({ loading: false, splitLoading: false, error: error instanceof Error ? error.message : "Train search failed.", trains: [], splits: [], multiSplits: [] });
    }
  }

  const compareTrains = filteredTrains.filter((train) => compareIds.includes(trainCompareKey(train)));
  const selectedPreferredHub = resolveStationInput(preferredHub, preferredHubQuery);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <div className={softPanel("rounded-[32px] p-5")}>
        <form onSubmit={runSearch}>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
            <StationAutocomplete label="From" placeholder="Starting Point" example="Patna (Bihar)" value={source} setValue={setSource} query={sourceQuery} setQuery={setSourceQuery} />
            <button type="button" onClick={() => { const a = source; const aq = sourceQuery; setSource(destination); setSourceQuery(destinationQuery); setDestination(a); setDestinationQuery(aq); }} className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-cyan-700 dark:border-white/10 dark:bg-white/8 dark:text-cyan-100"><ArrowDownUp className="h-5 w-5" /></button>
            <StationAutocomplete label="To" placeholder="End Point" example="Jaipur (Rajasthan)" value={destination} setValue={setDestination} query={destinationQuery} setQuery={setDestinationQuery} />
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_190px_auto]">
            <DateQuickField date={date} setDate={setDate} />
            <StationAutocomplete label="Via" placeholder="Optional layover station" example="Delhi / NDLS" value={preferredHub} setValue={setPreferredHub} query={preferredHubQuery} setQuery={setPreferredHubQuery} />
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">Class</span>
              <select value={classType} onChange={(event) => setClassType(event.target.value)} className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold dark:border-white/10 dark:bg-[#111827] dark:text-white">{["Any", ...classOptions].map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            <button className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-black text-white dark:bg-white dark:text-slate-950 xl:self-start xl:mt-6">
              <span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">
                {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </span>
              <span>Search</span>
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["direct", "Direct trains only"],
              ["split", "Allow split journeys"],
            ].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setAllowSplit(key === "split")} className={`rounded-full border px-3 py-2 text-xs font-black ${allowSplit === (key === "split") ? "border-cyan-300 bg-cyan-100 text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100" : "border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/6 dark:text-slate-400"}`}>{label}</button>
            ))}
          </div>
          {allowSplit && selectedPreferredHub && selectedPreferredHub !== source && selectedPreferredHub !== destination && (
            <div className="mt-3 rounded-2xl border border-cyan-300/40 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900 dark:bg-cyan-300/10 dark:text-cyan-50">
              Prioritizing split journeys via {fullStationLabelFromCode(selectedPreferredHub)}.
            </div>
          )}
        </form>
      </div>
      {state.error && <div className="mt-5 rounded-3xl border border-rose-300/40 bg-rose-50 p-5 font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-100">{state.error}</div>}
      {state.loading && <LoadingBlock label="Scanning train inventory..." />}
      {(state.trains.length > 0 || state.splits.length > 0 || state.multiSplits.length > 0) && (
        <div className={softPanel("mt-6 rounded-[28px] p-4")}>
          <div className="flex flex-wrap gap-2">
            {[
              ["all", `All options (${filteredTrains.length + (allowSplit ? filteredSplits.length + filteredMultiSplits.length : 0)})`],
              ["direct", `Direct trains (${filteredTrains.length})`],
              ["split", `Split journeys (${filteredSplits.length})`],
              ["multi", `Multi-split (${filteredMultiSplits.length})`],
            ].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setResultMode(key as "all" | "direct" | "split" | "multi")} className={`rounded-full border px-4 py-2 text-xs font-black ${resultMode === key ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/6 dark:text-slate-300"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr_1fr_1fr]">
            <button type="button" onClick={() => setAvailableOnly((value) => !value)} className={`rounded-2xl border px-4 py-3 text-sm font-black ${availableOnly ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100" : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-300"}`}>
              Available seats only
            </button>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black dark:border-white/10 dark:bg-[#111827] dark:text-white">
              <option value="best">Best availability + value</option>
              <option value="cheapest">Cheapest first</option>
              <option value="fastest">Fastest first</option>
              <option value="earliest">Earliest departure</option>
              <option value="latest">Latest departure</option>
            </select>
            <input value={maxFare} onChange={(event) => setMaxFare(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Max fare, e.g. 2000" className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black outline-none focus:border-cyan-400 dark:border-white/10 dark:bg-white/8 dark:text-white" />
            <input value={maxDuration} onChange={(event) => setMaxDuration(event.target.value.replace(/[^\d.]/g, "").slice(0, 4))} placeholder="Max hours, e.g. 12" className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black outline-none focus:border-cyan-400 dark:border-white/10 dark:bg-white/8 dark:text-white" />
          </div>
          <div className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-400">
            Filters use IRCTC-compatible availability/fare fields when returned, with cached estimates only when the provider does not expose quota data.
          </div>
        </div>
      )}
      <div className="mt-6 space-y-4">
        {compareTrains.length > 0 && <TrainComparePanel trains={compareTrains} onClear={() => setCompareIds([])} />}
        {shouldShowNearbyOptimizer(source, destination) && (
          <NearbyBoardingOptimizer source={source} destination={destination} date={date} classType={classType} />
        )}
        {filteredTrains.length > 0 && !shouldShowNearbyOptimizer(source, destination) && shouldShowBestDirectPanel(source, destination, filteredTrains[0]) && <BestDirectOptionPanel train={filteredTrains[0]} />}
        {(resultMode === "all" || resultMode === "direct") && filteredTrains.map((train) => {
          const key = trainCompareKey(train);
          return (
            <PremiumTrainCard
              key={`${train.trainNo}-${train.source}-${train.destination}`}
              train={train}
              compareSelected={compareIds.includes(key)}
              onClass={(classCode) => setClassView({ train, classCode })}
              onDetail={() => setDetailTrain(train)}
              onCompare={() => setCompareIds((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key].slice(-3))}
            />
          );
        })}
        {allowSplit && state.splitLoading && (resultMode === "all" || resultMode === "split" || resultMode === "multi") && <LoadingBlock label="Finding split and multi-split journeys from train data..." />}
        {allowSplit && (resultMode === "all" || resultMode === "split") && filteredSplits.map((split, index) => <SplitJourneyCard key={`${split.hubStation}-${index}`} split={split} />)}
        {allowSplit && (resultMode === "all" || resultMode === "multi") && filteredMultiSplits.map((split, index) => <MultiSplitJourneyCard key={`${split.interchangeStations?.join("-") || "multi"}-${index}`} split={split} />)}
        {!state.loading && !state.splitLoading && (state.trains.length > 0 || state.splits.length > 0 || state.multiSplits.length > 0) && !filteredTrains.length && !filteredSplits.length && !filteredMultiSplits.length && (
          <div className={softPanel("rounded-[30px] p-6")}>
            <h3 className="text-2xl font-black">No trains match these filters.</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
              Try switching off available-only, increasing max fare, or increasing max journey hours.
            </p>
          </div>
        )}
        {!shouldShowNearbyOptimizer(source, destination) && !state.loading && !state.splitLoading && !state.trains.length && !state.splits.length && !state.multiSplits.length && (
          <div className={softPanel("rounded-[30px] p-6")}>
            <h3 className="text-2xl font-black">No train options found for this exact search.</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
              RailRoute checked the IRCTC-compatible train inventory, including nearby junctions and multi-split options, and did not find a valid route for this date. Try a different date or verify manually on IRCTC.
            </p>
            <SmallStationAccessPanel source={source} destination={destination} date={date} classType={classType} />
            <a href={IRCTC_TRAIN_SEARCH_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-950">Open IRCTC train search</a>
          </div>
        )}
      </div>
      <AnimatePresence>
        {classView && <ClassDetailModal train={classView.train} classCode={classView.classCode} journeyDate={date} onClose={() => setClassView(null)} />}
        {detailTrain && <TrainDetailModal train={detailTrain} journeyDate={date} onClose={() => setDetailTrain(null)} onClass={(classCode) => { setClassView({ train: detailTrain, classCode }); setDetailTrain(null); }} />}
      </AnimatePresence>
      <RailRouteCapabilityPanel />
      <StationCodeLookup />
    </section>
  );
}

function SmallStationAccessPanel({ source, destination, date, classType }: { source: string; destination: string; date: string; classType: string }) {
  const sourceHubs = routeAccessHubs(source);
  const destinationHubs = routeAccessHubs(destination, ["NDLS", "NZM", "KOTA", "AII", "DDU", "CNB"]);
  const middleHubs = Array.from(new Set([...destinationHubs, "NDLS", "NZM", "KOTA", "DDU", "CNB"]))
    .filter((hub) => hub !== source && hub !== destination)
    .slice(0, 5);
  const routeLinks = [
    ...sourceHubs.slice(0, 4).map((hub) => ({ from: source, to: hub, label: "Start gateway" })),
    ...middleHubs.slice(0, 4).map((hub) => ({ from: hub, to: destination, label: "Final leg" })),
  ];

  if (!source || !destination || routeLinks.length === 0) return null;

  return (
    <div className="mt-5 rounded-3xl border border-cyan-300/25 bg-cyan-50/70 p-4 dark:border-cyan-300/15 dark:bg-cyan-300/10">
      <div className="text-xs font-black uppercase text-cyan-800 dark:text-cyan-100">Small station access mode</div>
      <h4 className="mt-2 text-lg font-black">Try station-gateway legs for complete coverage</h4>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
        For smaller stations, IRCTC may expose better results one leg at a time. These are the best gateway checks for {fullStationLabelFromCode(source, false)} to {fullStationLabelFromCode(destination, false)} on {prettyDateLabel(date)} in {classType}.
      </p>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {routeLinks.map((leg) => (
          <Link
            key={`${leg.from}-${leg.to}-${leg.label}`}
            href={`/trains?source=${leg.from}&destination=${leg.to}&date=${date}&classType=${classType}`}
            onClick={() => window.setTimeout(() => window.dispatchEvent(new Event("railroute-search-change")), 80)}
            className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm font-black text-slate-900 transition hover:border-cyan-400 dark:border-white/10 dark:bg-white/8 dark:text-white"
          >
            <span className="min-w-0 leading-5">{fullStationLabelFromCode(leg.from, false)} → {fullStationLabelFromCode(leg.to, false)}</span>
            <span className="shrink-0 rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">{leg.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RailRouteCapabilityPanel() {
  const items = [
    ["Search trains", "Find direct trains between selected stations with date and class filters."],
    ["Check route", "Use the route column on each card when a train number is available."],
    ["Seat map", "Click any class chip to inspect berth layout, coach options, fare and status."],
    ["Ticket status", "Read green AVL, yellow RAC and red WL/REGRET signals before booking."],
    ["Split journeys", "Switch to split results to compare two-leg routes, layover and cost."],
    ["IRCTC verify", "Use the booking buttons for final seat quota and ticket confirmation on IRCTC."],
  ];

  return (
    <div className={softPanel("mt-8 rounded-[30px] p-5")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-cyan-700 dark:text-cyan-200">What you can do here</div>
          <h3 className="mt-2 text-2xl font-black">RailRoute tools on this page</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-200">Optimized for fewer API calls</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {items.map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/20">
            <div className="font-black">{title}</div>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StationCodeLookup() {
  const [code, setCode] = useState("");
  const normalized = code.trim().toUpperCase();
  const station = normalized ? stationByCode(normalized) : null;
  const stationLookupState = station ? stationState(station.code) : null;
  const quickDate = todayIso();
  const quickRoutes = station
    ? [
      { label: `${station.code} → New Delhi`, href: `/trains?source=${station.code}&destination=NDLS&date=${quickDate}&classType=3A` },
      { label: `Patna → ${station.code}`, href: `/trains?source=PNBE&destination=${station.code}&date=${quickDate}&classType=3A` },
      { label: `${station.code} → Mumbai`, href: `/trains?source=${station.code}&destination=CSMT&date=${quickDate}&classType=3A` },
    ]
    : [];
  const stationSuggestions = !station && normalized.length >= 2 ? stationMatches(normalized, 3) : [];

  return (
    <div className={softPanel("mt-8 rounded-[30px] p-5")}>
      <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr] md:items-center">
        <div>
          <div className="text-xs font-black uppercase text-cyan-700 dark:text-cyan-200">Station code lookup</div>
          <h3 className="mt-2 text-2xl font-black">Write a code, get station info</h3>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Try DDU, PRYJ, PNBE, SBC, SMVB, BNC or any station code.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 10))}
            placeholder="e.g. DDU"
            className="h-13 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black uppercase text-slate-950 outline-none focus:border-cyan-400 dark:border-white/10 dark:bg-white/8 dark:text-white"
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/20">
            {station ? (
              <>
                <div className="text-lg font-black">{fullStationLabelFromCode(station.code)}</div>
                <div className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">State: {stationLookupState === "India" ? "Unavailable" : stationLookupState} · Code: {station.code}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/trains?source=${station.code}&destination=NDLS&date=${quickDate}&classType=3A`} className="rounded-full bg-cyan-100 px-3 py-2 text-xs font-black text-cyan-800 transition hover:bg-cyan-200 dark:bg-cyan-300/12 dark:text-cyan-100">
                    Search from {station.code}
                  </Link>
                  <Link href={`/trains?source=PNBE&destination=${station.code}&date=${quickDate}&classType=3A`} className="rounded-full bg-slate-200 px-3 py-2 text-xs font-black text-slate-800 transition hover:bg-slate-300 dark:bg-white/10 dark:text-slate-100">
                    Search to {station.code}
                  </Link>
                  <Link href={`/trains?source=${station.code}&destination=JP&date=${quickDate}&classType=3A`} className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800 transition hover:bg-emerald-200 dark:bg-emerald-300/12 dark:text-emerald-100">
                    Split planner
                  </Link>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {quickRoutes.map((route) => (
                    <Link key={route.href} href={route.href} className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-200">
                      {route.label}
                    </Link>
                  ))}
                </div>
              </>
            ) : normalized ? (
              <>
                <div className="font-bold text-rose-600 dark:text-rose-200">No station found for {normalized}</div>
                {stationSuggestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stationSuggestions.map((item) => (
                      <button key={item.code} type="button" onClick={() => setCode(item.code)} className="rounded-full bg-slate-200 px-3 py-2 text-xs font-black text-slate-800 transition hover:bg-cyan-100 dark:bg-white/10 dark:text-slate-100">
                        {stationLabel(item)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="font-bold text-slate-500 dark:text-slate-400">Station details will appear here.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className={softPanel("mt-6 rounded-[28px] p-6")}>
      <div className="flex items-center gap-3 text-sm font-black text-slate-500 dark:text-slate-300"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-3xl bg-slate-100 dark:bg-white/8" />)}</div>
    </div>
  );
}

function shouldShowBestDirectPanel(source: string, destination: string, train: any) {
  const duration = durationToMinutes(train?.duration);
  return (
    duration > 0 &&
    duration <= 8 * 60 &&
    String(train?.source || "").toUpperCase() === source.toUpperCase() &&
    String(train?.destination || "").toUpperCase() === destination.toUpperCase()
  );
}

function BestDirectOptionPanel({ train }: { train: any }) {
  return (
    <div className={softPanel("rounded-[30px] p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-200">Best direct option</div>
          <h3 className="mt-2 text-2xl font-black">{trainNumberName(train)}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Exact direct route: {fullStationLabelFromCode(train.source, false)} to {fullStationLabelFromCode(train.destination, false)}. Split options still appear below when they are useful.
          </p>
        </div>
        <div className="grid min-w-[280px] grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-black/20">
            <div className="text-[10px] font-black uppercase text-slate-400">Depart</div>
            <div className="mt-1 text-xl font-black">{train.departureTime || "--:--"}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-black/20">
            <div className="text-[10px] font-black uppercase text-slate-400">Arrive</div>
            <div className="mt-1 text-xl font-black">{train.arrivalTime || "--:--"}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-black/20">
            <div className="text-[10px] font-black uppercase text-slate-400">Journey</div>
            <div className="mt-1 text-xl font-black">{train.duration || "--"}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-amber-300/35 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
        Final seat status and fare still need verification on IRCTC before booking.
      </div>
    </div>
  );
}

const CKP_NEARBY_BOARDING = [
  { code: "KND", distanceKm: 47, access: "Kandra nearby boarding", buffer: "Good when IRCTC does not expose CKP" },
  { code: "TATA", distanceKm: 59, access: "Road/local rail from CKP", buffer: "Leave CKP 90-120 min before train" },
  { code: "SINI", distanceKm: 35, access: "Local rail corridor from CKP", buffer: "Leave CKP 60-90 min before train" },
  { code: "CNI", distanceKm: 56, access: "Chandil side nearby boarding", buffer: "Often useful for Ranchi-side trains" },
  { code: "ROU", distanceKm: 101, access: "Rourkela major junction", buffer: "Useful for western and Delhi-side trains" },
];

const CKP_MAJOR_DESTINATIONS = [
  { code: "JP", label: "Jaipur" },
  { code: "RNC", label: "Ranchi" },
  { code: "TATA", label: "Tatanagar" },
  { code: "ROU", label: "Rourkela" },
  { code: "HTE", label: "Hatia" },
  { code: "PNBE", label: "Patna" },
  { code: "DDU", label: "DDU" },
  { code: "NDLS", label: "Delhi" },
  { code: "HWH", label: "Howrah" },
];

type CkpExplorerPair = { from: string; to: string };
type CkpExplorerAccess = { code: string; distanceKm: number; minutes: number; label: string; buffer: string };
type CkpExplorerPlan = { id: string; title: string; stations?: string[]; pairs?: CkpExplorerPair[]; accessFromCkp?: CkpExplorerAccess };

const CKP_ROUTE_EXPLORER_PLANS: CkpExplorerPlan[] = [
  { id: "delhi-terminal", title: "Delhi terminal transfer", pairs: [{ from: "CKP", to: "NZM" }, { from: "DLI", to: "$DEST" }] },
  { id: "delhi-ndls", title: "Delhi NDLS transfer", pairs: [{ from: "CKP", to: "NZM" }, { from: "NDLS", to: "$DEST" }] },
  { id: "tata-ddu-access", title: "Tatanagar + DDU split", pairs: [{ from: "TATA", to: "DDU" }, { from: "DDU", to: "$DEST" }], accessFromCkp: { code: "TATA", distanceKm: 59, minutes: 105, label: "Access to Tatanagar Junction", buffer: "Road/local rail from CKP before the first train" } },
  { id: "tata-delhi-access", title: "Tatanagar + Delhi split", pairs: [{ from: "TATA", to: "NDLS" }, { from: "DLI", to: "$DEST" }], accessFromCkp: { code: "TATA", distanceKm: 59, minutes: 105, label: "Access to Tatanagar Junction", buffer: "Road/local rail from CKP before the first train" } },
  { id: "rou-delhi-access", title: "Rourkela + Delhi split", pairs: [{ from: "ROU", to: "DLI" }, { from: "DLI", to: "$DEST" }], accessFromCkp: { code: "ROU", distanceKm: 101, minutes: 165, label: "Access to Rourkela Junction", buffer: "Major junction option west of CKP" } },
  { id: "tata-ddu", title: "Tatanagar + DDU", stations: ["CKP", "TATA", "DDU"] },
  { id: "tata-delhi", title: "Tatanagar + Delhi", stations: ["CKP", "TATA", "NDLS"] },
  { id: "tata-patna", title: "Tatanagar + Patna", stations: ["CKP", "TATA", "PNBE"] },
  { id: "ranchi-direct", title: "Ranchi check", stations: ["CKP", "RNC"] },
  { id: "tata-direct", title: "Tatanagar direct check", stations: ["CKP", "TATA"] },
  { id: "rourkela-direct", title: "Rourkela check", stations: ["CKP", "ROU"] },
];

const CLASS_FARE_ESTIMATES: Record<string, number> = { SL: 150, "3E": 520, "3A": 520, "2A": 725, "1A": 1180, CC: 545, EC: 965 };

const NEARBY_DESTINATIONS_BY_CODE: Record<string, { code: string; distanceKm: number }[]> = {
  RNC: [{ code: "RNC", distanceKm: 0 }, { code: "HTE", distanceKm: 7 }, { code: "MURI", distanceKm: 54 }],
  HTE: [{ code: "HTE", distanceKm: 0 }, { code: "RNC", distanceKm: 7 }, { code: "MURI", distanceKm: 54 }],
  PNBE: [{ code: "PNBE", distanceKm: 0 }, { code: "RJPB", distanceKm: 5 }, { code: "DNR", distanceKm: 10 }, { code: "PPTA", distanceKm: 12 }],
  DDU: [{ code: "DDU", distanceKm: 0 }, { code: "BSB", distanceKm: 17 }],
  NDLS: [{ code: "NDLS", distanceKm: 0 }, { code: "DLI", distanceKm: 4 }, { code: "NZM", distanceKm: 8 }, { code: "ANVT", distanceKm: 13 }],
  HWH: [{ code: "HWH", distanceKm: 0 }, { code: "SDAH", distanceKm: 6 }, { code: "KOAA", distanceKm: 8 }, { code: "SHM", distanceKm: 7 }],
  JP: [{ code: "JP", distanceKm: 0 }, { code: "GADJ", distanceKm: 6 }, { code: "DPA", distanceKm: 8 }, { code: "FL", distanceKm: 55 }, { code: "AII", distanceKm: 135 }],
};

function nearbyDestinationCandidates(destination: string) {
  const normalized = destination.toUpperCase();
  return NEARBY_DESTINATIONS_BY_CODE[normalized] || [{ code: normalized, distanceKm: 0 }];
}

function legEndpointPairs(stations: string[], destination: string) {
  const path = [...stations, destination.toUpperCase()].filter((code, index, list) => code && list.indexOf(code) === index);
  return path.slice(0, -1).map((from, index) => ({ from, to: path[index + 1] }));
}

function ckpExplorerPairs(plan: CkpExplorerPlan, destination: string) {
  if (plan.pairs?.length) {
    return plan.pairs.map((pair) => ({
      from: pair.from === "$DEST" ? destination.toUpperCase() : pair.from,
      to: pair.to === "$DEST" ? destination.toUpperCase() : pair.to,
    }));
  }
  return legEndpointPairs(plan.stations || [], destination);
}

function absoluteArrivalMinutes(departureAbs: number, leg: any) {
  const duration = durationToMinutes(leg.duration);
  if (duration > 0) return departureAbs + duration;
  let arrival = timeToMinutes(leg.arrivalTime);
  while (arrival <= departureAbs) arrival += 24 * 60;
  return arrival;
}

function computeLegTiming(legs: any[]) {
  if (!legs.length) return { totalMinutes: 0, layovers: [] as { station: string; fromStation: string; toStation: string; duration: string; hours: number; isStationTransfer: boolean }[] };
  let firstDeparture = timeToMinutes(legs[0].departureTime);
  if (firstDeparture > 24 * 60) firstDeparture = 0;
  let currentArrival = absoluteArrivalMinutes(firstDeparture, legs[0]);

  const layovers: { station: string; fromStation: string; toStation: string; duration: string; hours: number; isStationTransfer: boolean }[] = [];
  for (let index = 1; index < legs.length; index += 1) {
    const leg = legs[index];
    const fromStation = String(legs[index - 1].destination || "").toUpperCase();
    const toStation = String(leg.source || "").toUpperCase();
    const isStationTransfer = Boolean(fromStation && toStation && fromStation !== toStation);
    const minBufferMinutes = isStationTransfer ? 90 : 45;
    let departure = timeToMinutes(leg.departureTime);
    while (departure < currentArrival + minBufferMinutes) departure += 24 * 60;
    const layoverMinutes = Math.max(0, departure - currentArrival);
    layovers.push({
      station: isStationTransfer ? toStation : fromStation || toStation,
      fromStation,
      toStation,
      duration: formatDurationLong(layoverMinutes),
      hours: layoverMinutes / 60,
      isStationTransfer,
    });

    currentArrival = absoluteArrivalMinutes(departure, leg);
  }

  return {
    totalMinutes: Math.max(0, currentArrival - firstDeparture),
    layovers,
  };
}

function pickRouteExplorerCombo(legOptions: any[][]) {
  const choices: any[][] = [];

  function walk(index: number, current: any[]) {
    if (index === legOptions.length) {
      choices.push(current);
      return;
    }
    legOptions[index].slice(0, 12).forEach((train) => walk(index + 1, [...current, train]));
  }

  walk(0, []);
  const ranked = choices
    .map((legs) => {
      const timing = computeLegTiming(legs);
      const maxLayover = Math.max(0, ...timing.layovers.map((layover) => layover.hours));
      const totalLayover = timing.layovers.reduce((sum, layover) => sum + layover.hours, 0);
      const layoverPenalty = timing.layovers.reduce((sum, layover) => {
        if (layover.hours < (layover.isStationTransfer ? 1.5 : 0.75)) return sum + 9999;
        if (layover.hours > 8) return sum + 5000;
        if (layover.hours > 6) return sum + 900;
        return sum + Math.max(0, layover.hours - 3) * 85;
      }, 0);
      const availabilityBonus = legs.reduce((sum, leg) => sum + (isSeatAvailable(leg.availability) ? 90 : /RAC/i.test(readableRailStatus(leg.availability)) ? 35 : 0), 0);
      return { legs, timing, maxLayover, totalLayover, score: availabilityBonus - timing.totalMinutes / 6 - layoverPenalty };
    })
    .filter((item) => item.timing.layovers.every((layover) => layover.hours >= (layover.isStationTransfer ? 1.5 : 0.75)));
  const optimized = ranked.filter((item) => item.maxLayover <= 6);
  const fallback = ranked.filter((item) => item.maxLayover <= 8);
  return (optimized.length ? optimized : fallback)
    .sort((a, b) => b.score - a.score || a.totalLayover - b.totalLayover || a.timing.totalMinutes - b.timing.totalMinutes)[0] || null;
}

function CkpOptionEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-black/20">
      <h5 className="text-lg font-black">{title}</h5>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">{body}</p>
    </div>
  );
}

function DirectTrainMiniCard({ train, label = "Direct train", note, onClass }: { train: any; label?: string; note?: string; onClass?: (train: any, classCode: string) => void }) {
  const railMinutes = durationToMinutes(train.duration);
  const tone = journeyAccentTone(train.availability);
  const classes = train.classes?.length ? train.classes.slice(0, 5) : [primaryClassCode(train)];
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/45 dark:border-cyan-300/15 dark:bg-[#081221] dark:shadow-black/25">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">{label}</span>
          <h5 className="mt-3 text-2xl font-black">{trainNumberName(train)}</h5>
          <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">
            {fullStationLabelFromCode(train.source, false)} to {fullStationLabelFromCode(train.destination, false)}
          </p>
          {note && <p className="mt-2 text-xs font-black text-cyan-700 dark:text-cyan-200">{note}</p>}
        </div>
        <span className={`rounded-full border px-3 py-2 text-xs font-black ${availabilityTone(train.availability)}`}>
          {readableRailStatus(train.availability) || "Tap for quota"}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <div>
          <div className="text-sm font-black text-slate-500 dark:text-slate-400">{stationCompactLabel(train.source)}</div>
          <div className="mt-1 text-3xl font-black tracking-tight">{timeAmPm(train.departureTime)}</div>
        </div>
        <div className="pt-9 text-center">
          <div className={`flex items-center gap-2 text-sm font-black ${tone.text}`}>
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
            <span>{railMinutes ? formatDurationLong(railMinutes) : train.duration || "--"}</span>
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
          </div>
          <div className={`mt-2 h-px w-24 ${tone.line}`} />
        </div>
        <div>
          <div className="text-sm font-black text-slate-500 dark:text-slate-400">{stationCompactLabel(train.destination)}</div>
          <div className="mt-1 text-3xl font-black tracking-tight">{timeAmPm(train.arrivalTime)}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {classes.map((classCode: string) => (
          <button key={`${train.trainNo}-${classCode}`} type="button" onClick={() => onClass?.({ ...train, classType: classCode }, classCode)} className={`rounded-full border px-3 py-2 text-xs font-black ${availabilityTone(classAvailabilityStatus(train, classCode))}`}>
            {classCode} · {classAvailabilityStatus(train, classCode)} · {classFareText(train, classCode)}
          </button>
        ))}
        <button type="button" onClick={() => onClass?.({ ...train, classType: primaryClassCode(train) }, primaryClassCode(train))} className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white dark:bg-white dark:text-slate-950">
          Seats + berth map
        </button>
      </div>
    </article>
  );
}

function NearbyDirectMiniCard({ option, onClass }: { option: any; onClass?: (train: any, classCode: string) => void }) {
  const train = option.train;
  const access = option.boarding.distanceKm > 0 ? `${option.boarding.distanceKm} km from CKP` : "Board at CKP";
  const arrivalAccess = option.arrival.distanceKm > 0 ? `${option.arrival.distanceKm} km from JP` : "Arrives at destination";
  return (
    <DirectTrainMiniCard
      train={train}
      label="Nearby direct train"
      note={`${access} · ${arrivalAccess} · total with access ${formatDurationLong(option.totalMinutes)}`}
      onClass={onClass}
    />
  );
}

function ckpRoutePathLabels(legs: any[]) {
  if (!legs.length) return [];
  const labels = [fullStationLabelFromCode(legs[0].source, false)];
  legs.forEach((leg, index) => {
    if (index > 0) {
      const previousDestination = String(legs[index - 1]?.destination || "").toUpperCase();
      const nextSource = String(leg.source || "").toUpperCase();
      if (previousDestination && nextSource && previousDestination !== nextSource) {
        labels.push(`${stationCompactLabel(previousDestination)} → ${stationCompactLabel(nextSource)} transfer`);
      }
    }
    labels.push(fullStationLabelFromCode(leg.destination, false));
  });
  return labels;
}

function CkpSplitStyleCard({ route }: { route: any }) {
  const [seatMapTrain, setSeatMapTrain] = useState<any | null>(null);
  const [routeTrain, setRouteTrain] = useState<any | null>(null);
  const legs = route.legs || [];
  const pathLabels = ckpRoutePathLabels(legs);
  const layovers = route.layovers || [];
  const access = route.accessFromCkp as CkpExplorerAccess | undefined;
  const maxLayoverHours = Math.max(0, ...layovers.map((layover: any) => Number(layover.hours) || 0));
  const maxLayoverText = maxLayoverHours ? formatDurationLong(Math.round(maxLayoverHours * 60)) : "--";

  return (
    <article className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50 dark:border-cyan-300/15 dark:bg-[#07111f] dark:shadow-black/30">
      <div className="border-b border-slate-200/80 bg-gradient-to-r from-emerald-50 via-cyan-50 to-white p-5 dark:border-cyan-300/15 dark:from-[#0c322f] dark:via-[#0a1b2d] dark:to-[#170f24]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">Optimized split</span>
            <h5 className="mt-3 text-2xl font-black">Best route via {route.explorerTitle || "checked gateway"}</h5>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500 dark:text-slate-400">
              Large layovers are filtered out. Gateway station routes include CKP access time before the first train.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-[#081221]">
              <div className="text-[10px] font-black uppercase text-slate-400">Total</div>
              <div className="mt-1 text-lg font-black">{route.totalDuration || "--"}</div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-[#081221]">
              <div className="text-[10px] font-black uppercase text-slate-400">Max Gap</div>
              <div className="mt-1 text-lg font-black">{maxLayoverText}</div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-[#081221]">
              <div className="text-[10px] font-black uppercase text-slate-400">Fare</div>
              <div className="mt-1 text-lg font-black">{formatFare(route.totalFare)}</div>
            </div>
          </div>
        </div>
        {access && (
          <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-50 px-4 py-3 text-xs font-black leading-5 text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100">
            {access.label}: CKP to {fullStationLabelFromCode(access.code, false)} · {access.distanceKm} km · add {formatDurationLong(access.minutes)} before departure. {access.buffer}.
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {pathLabels.map((label, index) => (
            <div key={`${label}-${index}`} className="flex items-center gap-2">
              {index > 0 && <ArrowRight className="h-4 w-4 text-cyan-600 dark:text-cyan-200" />}
              <span className={`rounded-full px-3 py-2 text-xs font-black ${label.includes("transfer") ? "bg-amber-100 text-amber-900 dark:bg-amber-300/12 dark:text-amber-100" : "bg-white text-slate-700 shadow-sm dark:bg-[#0d1a2d] dark:text-slate-100"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5">
        <div className="space-y-3">
          {legs.map((leg: any, index: number) => {
            const tone = journeyAccentTone(leg.availability);
            const duration = durationToMinutes(leg.duration);
            const layover = layovers[index];
            return (
              <div key={`${leg.trainNo}-${leg.source}-${leg.destination}-${index}`}>
                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-cyan-300/12 dark:bg-[#0b1627] lg:grid-cols-[minmax(220px,0.75fr)_minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase text-slate-400">Leg {index + 1}</div>
                    <h6 className="mt-1 truncate text-lg font-black">{trainNumberName(leg, `Leg ${index + 1} train`)}</h6>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${availabilityTone(leg.availability)}`}>{readableRailStatus(leg.availability) || "Check seats"}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-slate-200">{liveFareText(leg)}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-slate-200">Expected PF: {leg.source} {expectedPlatformNumber(leg.source, leg.trainNo)} · {leg.destination} {expectedPlatformNumber(leg.destination, leg.trainNo)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
                    <div>
                      <div className="text-xs font-black text-slate-500 dark:text-slate-400">{stationCompactLabel(leg.source)}</div>
                      <div className="mt-1 text-2xl font-black">{timeAmPm(leg.departureTime)}</div>
                    </div>
                    <div className="pt-8 text-center">
                      <div className={`h-px w-16 ${tone.line}`} />
                      <div className={`mt-1 text-[10px] font-black ${tone.text}`}>{duration ? formatDurationLong(duration) : leg.duration || "--"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-500 dark:text-slate-400">{stationCompactLabel(leg.destination)}</div>
                      <div className="mt-1 text-2xl font-black">{timeAmPm(leg.arrivalTime)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                    <button type="button" onClick={() => setRouteTrain((current: any) => current?.trainNo === leg.trainNo && current?.source === leg.source ? null : leg)} className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-center text-xs font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">
                      Route
                    </button>
                    <button type="button" onClick={() => setSeatMapTrain((current: any) => current?.trainNo === leg.trainNo && current?.source === leg.source ? null : leg)} className="rounded-full border border-cyan-300 bg-cyan-50 px-4 py-2 text-center text-xs font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">
                      Seat map
                    </button>
                  </div>
                </div>
                {layover && (
                  <div className="mx-4 border-l-2 border-dashed border-cyan-300 py-3 pl-4 dark:border-cyan-300/40">
                    <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-cyan-50 px-4 py-2 text-xs font-black text-cyan-900 dark:bg-cyan-300/12 dark:text-cyan-100">
                      <span>{layover.isStationTransfer ? "Station transfer buffer" : "Layover"}</span>
                      <span>·</span>
                      <span>{layover.isStationTransfer ? `${stationCompactLabel(layover.fromStation)} to ${stationCompactLabel(layover.toStation)}` : stationCompactLabel(layover.station)}</span>
                      <span>·</span>
                      <span>{layover.duration}</span>
                    </div>
                    {legs[index + 1] && (
                      <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-full border border-amber-300/35 bg-amber-50 px-4 py-2 text-xs font-black text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
                        <span>{layover.isStationTransfer ? "Station + platform change" : "Platform change"}</span>
                        <span>·</span>
                        <span>
                          arrive {stationCompactLabel(leg.destination)} PF {expectedPlatformNumber(leg.destination, leg.trainNo)}
                          {" "}→ depart {stationCompactLabel(legs[index + 1].source)} PF {expectedPlatformNumber(legs[index + 1].source, legs[index + 1].trainNo)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {routeTrain?.trainNo === leg.trainNo && routeTrain?.source === leg.source && (
                  <div className="mt-3 rounded-[26px] border border-emerald-300/30 bg-emerald-50/70 p-4 dark:bg-emerald-300/10">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-100">Route for {trainNumberName(leg)}</div>
                      <button type="button" onClick={() => setRouteTrain(null)} aria-label="Close route" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:bg-white/8 dark:text-slate-100">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <InlineRoutePanel trainNo={leg.trainNo} train={leg} />
                  </div>
                )}
                {seatMapTrain?.trainNo === leg.trainNo && seatMapTrain?.source === leg.source && (
                  <div className="mt-3 rounded-[26px] border border-cyan-300/30 bg-cyan-50/70 p-4 dark:bg-cyan-300/10">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-xs font-black uppercase text-cyan-800 dark:text-cyan-100">Seat map for {trainNumberName(leg)}</div>
                      <button type="button" onClick={() => setSeatMapTrain(null)} aria-label="Close seat map" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:bg-white/8 dark:text-slate-100">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <CoachExplorer initialClass={primaryClassCode(leg)} embedded train={leg} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <div className="mt-4 rounded-2xl border border-amber-300/35 bg-amber-50 px-4 py-3 text-xs font-black leading-5 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
            Expected platforms and inter-station transfer times can change. Verify final platform and station transfer on IRCTC and station boards before booking.
          </div>
        </div>
      </div>
    </article>
  );
}

function CkpRouteExplorerPanel({ destination, date, classType }: { destination: string; date: string; classType: string }) {
  const [mode, setMode] = useState<"direct" | "split" | "multi">("split");
  const [classView, setClassView] = useState<{ train: any; classCode: string } | null>(null);
  const [state, setState] = useState<{ loading: boolean; direct: any[]; nearbyDirect: any[]; complete: any[]; error: string }>({ loading: true, direct: [], nearbyDirect: [], complete: [], error: "" });
  const destinationCode = destination.toUpperCase();

  useEffect(() => {
    let mounted = true;
    setMode("split");
    setState({ loading: true, direct: [], nearbyDirect: [], complete: [], error: "" });
    const plans = CKP_ROUTE_EXPLORER_PLANS
      .map((plan) => ({ ...plan, pairs: ckpExplorerPairs(plan, destinationCode) }))
      .filter((plan) => plan.pairs.every((pair) => pair.from !== pair.to));
    const uniquePairs = Array.from(new Map(plans.flatMap((plan) => plan.pairs).map((pair) => [`${pair.from}-${pair.to}`, pair])).values());
    const boardingStations = Array.from(new Map(CKP_NEARBY_BOARDING.map((boarding) => [boarding.code, boarding])).values());
    const destinationStations = nearbyDestinationCandidates(destinationCode);

    Promise.all([
      Promise.all(uniquePairs.map((pair) =>
        postJson<any>("/api/train-between", { source: pair.from, destination: pair.to, date, classType })
          .then((data) => [`${pair.from}-${pair.to}`, data.trains || []] as const)
          .catch(() => [`${pair.from}-${pair.to}`, []] as const)
      )),
      postJson<any>("/api/train-between", { source: "CKP", destination: destinationCode, date, classType })
        .then((data) => data.trains || [])
        .catch(() => []),
      Promise.all(
        boardingStations.flatMap((boarding) => destinationStations.map(async (arrival) => {
          if (boarding.code === arrival.code) return [];
          const data = await postJson<any>("/api/train-between", { source: boarding.code, destination: arrival.code, date, classType });
          return (data.trains || []).slice(0, 4).map((train: any) => ({ boarding, arrival, train }));
        }))
      ).catch(() => []),
    ])
      .then(([entries, directTrains, nearbyGroups]) => {
        if (!mounted) return;
        const trainsByPair = new Map(entries);
        const complete: any[] = [];
        const accessMinutes = (distanceKm: number) => Math.max(45, Math.round((distanceKm / 38) * 60));
        const destinationAccessMinutes = (distanceKm: number) => distanceKm > 0 ? Math.max(18, Math.round((distanceKm / 34) * 60)) : 0;
        const nearbyDirect = (nearbyGroups as any[][]).flat().map((item: any) => {
          const railMinutes = durationToMinutes(item.train.duration) || 9999;
          const totalMinutes = railMinutes + accessMinutes(item.boarding.distanceKm) + destinationAccessMinutes(item.arrival.distanceKm);
          return { ...item, accessMinutes: accessMinutes(item.boarding.distanceKm), destinationAccessMinutes: destinationAccessMinutes(item.arrival.distanceKm), totalMinutes };
        }).sort((a: any, b: any) => {
          const scoreA = isSeatAvailable(a.train.availability) ? 0 : /RAC/i.test(readableRailStatus(a.train.availability)) ? 1 : 2;
          const scoreB = isSeatAvailable(b.train.availability) ? 0 : /RAC/i.test(readableRailStatus(b.train.availability)) ? 1 : 2;
          return scoreA - scoreB || a.totalMinutes - b.totalMinutes || timeToMinutes(a.train.departureTime) - timeToMinutes(b.train.departureTime);
        });

        plans.forEach((plan) => {
          const legOptions = plan.pairs.map((pair) => trainsByPair.get(`${pair.from}-${pair.to}`) || []);
          if (legOptions.some((options) => options.length === 0)) return;

          const best = pickRouteExplorerCombo(legOptions);
          if (!best) return;
          const totalFare = best.legs.reduce((sum: number, leg: any) => sum + (trainFareAmount(leg) || 0), 0);
          const accessMinutesFromCkp = plan.accessFromCkp?.minutes || 0;
          const confirmation = best.legs.reduce((chance: number, leg: any) => {
            const status = readableRailStatus(leg.availability).toUpperCase();
            const current = isSeatAvailable(status) ? 100 : /RAC/.test(status) ? 65 : /WL|WAIT/.test(status) ? 30 : 55;
            return (chance * current) / 100;
          }, 100);
          complete.push({
            explorerTitle: plan.title,
            legs: best.legs,
            interchangeStations: best.timing.layovers.map((layover: any) => layover.station),
            interchangeStationNames: best.timing.layovers.map((layover: any) => fullStationLabelFromCode(layover.station, false)),
            layovers: best.timing.layovers,
            accessFromCkp: plan.accessFromCkp,
            totalFare,
            totalMinutes: best.timing.totalMinutes + accessMinutesFromCkp,
            totalDuration: formatDurationLong(best.timing.totalMinutes + accessMinutesFromCkp),
            score: Math.max(0, Math.min(100, Math.round(70 + best.score / 20))),
            combinedConfirmationChance: Math.round(confirmation),
          });
        });

        const seen = new Set<string>();
        const uniqueComplete = complete.filter((item) => {
          const key = item.legs.map((leg: any) => `${leg.trainNo}-${leg.source}-${leg.destination}`).join("-");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 6);
        const seenNearby = new Set<string>();
        const uniqueNearbyDirect = nearbyDirect.filter((item: any) => {
          const key = `${item.train.trainNo}-${item.train.source}-${item.train.destination}`;
          if (seenNearby.has(key)) return false;
          seenNearby.add(key);
          return true;
        }).slice(0, 5);
        setState({ loading: false, direct: directTrains.slice(0, 4), nearbyDirect: uniqueNearbyDirect, complete: uniqueComplete, error: "" });
      })
      .catch((error) => {
        if (!mounted) return;
        setState({ loading: false, direct: [], nearbyDirect: [], complete: [], error: error instanceof Error ? error.message : "Route explorer failed." });
      });

    return () => {
      mounted = false;
    };
  }, [destinationCode, date, classType]);

  const maxRouteLayover = (route: any) => Math.max(0, ...(route.layovers || []).map((layover: any) => Number(layover.hours) || 0));
  const routeTotalMinutes = (route: any) => Number(route.totalMinutes) || durationToMinutes(route.totalDuration) || 99999;
  const bestByTrainShape = (routes: any[]) => {
    const seen = new Set<string>();
    return routes
      .sort((a, b) => routeTotalMinutes(a) - routeTotalMinutes(b) || maxRouteLayover(a) - maxRouteLayover(b) || (b.score || 0) - (a.score || 0))
      .filter((route) => {
        const legs = route.legs || [];
        const key = legs.map((leg: any) => `${leg.source}-${leg.destination}`).join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };
  const splitCandidates = bestByTrainShape(state.complete.filter((route) => (route.legs || []).length <= 2 && maxRouteLayover(route) <= 6));
  const multiCandidates = bestByTrainShape(state.complete.filter((route) => (route.legs || []).length > 2 && maxRouteLayover(route) <= 6));
  const diversifiedSplitOptions = splitCandidates.filter((route, index, list) => {
    const gateway = route.accessFromCkp?.code || route.legs?.[0]?.source || route.explorerTitle;
    return list.findIndex((item) => (item.accessFromCkp?.code || item.legs?.[0]?.source || item.explorerTitle) === gateway) === index;
  });
  const splitOptions = (diversifiedSplitOptions.length >= 2 ? diversifiedSplitOptions : splitCandidates).slice(0, 2);
  const multiOptions = multiCandidates.slice(0, 4);
  const directOptionCount = state.direct.length + state.nearbyDirect.length;
  const tabs: { key: "direct" | "split" | "multi"; label: string }[] = [
    { key: "direct", label: `Direct trains (${directOptionCount})` },
    { key: "split", label: `Split journey (${splitOptions.length})` },
    { key: "multi", label: `Multi-split journey (${multiOptions.length})` },
  ];

  return (
    <div className="border-b border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-200">{destinationCode === "JP" ? "CKP → Jaipur options" : "CKP route options"}</div>
          <h4 className="mt-1 text-2xl font-black">Direct, split and multi-split journeys</h4>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Checked from Chakradharpur with nearby gateway legs, full station names, AM/PM timing, layovers and expected platforms.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-200">
          {state.loading ? "Checking options..." : `${directOptionCount + splitOptions.length + multiOptions.length} listed options`}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setMode(tab.key)} className={`rounded-full border px-4 py-2 text-xs font-black transition ${mode === tab.key ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-300 dark:border-white/10 dark:bg-white/8 dark:text-slate-200"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {state.loading && <div className="mt-4"><LoadingBlock label="Checking CKP direct, split and multi-split routes..." /></div>}
      {state.error && <div className="mt-4 rounded-2xl border border-rose-300/40 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-100">{state.error}</div>}

      {!state.loading && mode === "direct" && (
        <div className="mt-4 space-y-4">
          {directOptionCount > 0 ? (
            <>
              {state.direct.map((train, index) => (
                <DirectTrainMiniCard key={`${train.trainNo}-${train.source}-${train.destination}-${index}`} train={train} label="Exact direct train" onClass={(nextTrain, classCode) => setClassView({ train: nextTrain, classCode })} />
              ))}
              {state.nearbyDirect.map((option, index) => (
                <NearbyDirectMiniCard key={`nearby-${option.train.trainNo}-${option.train.source}-${option.train.destination}-${index}`} option={option} onClass={(nextTrain, classCode) => setClassView({ train: nextTrain, classCode })} />
              ))}
            </>
          ) : (
            <CkpOptionEmpty title="No direct train option returned" body={`No exact or nearby direct train came back for ${stationCompactLabel("CKP")} to ${stationCompactLabel(destinationCode)} on this date. Use Split journey for practical gateway options.`} />
          )}
        </div>
      )}

      {!state.loading && mode === "split" && (
        <div className="mt-4 space-y-4">
          {splitOptions.length > 0
            ? splitOptions.map((route, index) => <CkpSplitStyleCard key={`${route.explorerTitle}-split-${index}`} route={route} />)
            : <CkpOptionEmpty title="No clean split route came back yet" body="RailRoute did not get a complete split connection for this date from the provider. Try another date or a preferred Via station such as DDU, Delhi or Tatanagar." />}
        </div>
      )}

      {!state.loading && mode === "multi" && (
        <div className="mt-4 space-y-4">
          {multiOptions.length > 0
            ? multiOptions.map((route, index) => <MultiSplitJourneyCard key={`${route.explorerTitle}-multi-${index}`} split={route} />)
            : <CkpOptionEmpty title="No separate multi-split route came back yet" body="The split tab already has the clean two-train option. Multi-split only shows routes with three or more train legs, so it will not duplicate the split result." />}
        </div>
      )}
      <AnimatePresence>
        {classView && <ClassDetailModal train={classView.train} classCode={classView.classCode} journeyDate={date} onClose={() => setClassView(null)} />}
      </AnimatePresence>
    </div>
  );
}

function NearbyBoardingOptimizer({ source, destination, date, classType }: { source: string; destination: string; date: string; classType: string }) {
  const [state, setState] = useState<{ loading: boolean; error: string; options: any[] }>({ loading: true, error: "", options: [] });
  const [openRoute, setOpenRoute] = useState<string>("");
  const [classView, setClassView] = useState<{ train: any; classCode: string } | null>(null);
  const useRouteExplorerOnly = source.toUpperCase() === "CKP";

  useEffect(() => {
    let mounted = true;
    if (useRouteExplorerOnly) {
      setState({ loading: false, error: "", options: [] });
      return () => {
        mounted = false;
      };
    }
    setState({ loading: true, error: "", options: [] });

    const boardingStations = Array.from(new Map(CKP_NEARBY_BOARDING.map((boarding) => [boarding.code, boarding])).values());
    const destinationStations = nearbyDestinationCandidates(destination);

    Promise.all(
      boardingStations.flatMap((boarding) => destinationStations.map(async (arrival) => {
        if (boarding.code === arrival.code) return [];
        const data = await postJson<any>("/api/train-between", {
          source: boarding.code,
          destination: arrival.code,
          date,
          classType,
        });
        const trains = (data.trains || []).slice(0, 4);
        return trains.map((train: any) => ({ boarding, arrival, train }));
      }))
    )
      .then((groups) => {
        if (!mounted) return;
        const accessMinutes = (distanceKm: number) => Math.max(45, Math.round((distanceKm / 38) * 60));
        const destinationAccessMinutes = (distanceKm: number) => distanceKm > 0 ? Math.max(18, Math.round((distanceKm / 34) * 60)) : 0;
        const rawOptions = groups.flat().map((item) => {
          const railMinutes = durationToMinutes(item.train.duration) || 9999;
          const totalMinutes = railMinutes + accessMinutes(item.boarding.distanceKm) + destinationAccessMinutes(item.arrival.distanceKm);
          return {
            ...item,
            accessMinutes: accessMinutes(item.boarding.distanceKm),
            destinationAccessMinutes: destinationAccessMinutes(item.arrival.distanceKm),
            totalMinutes
          };
        }).sort((a, b) => a.totalMinutes - b.totalMinutes || timeToMinutes(a.train.departureTime) - timeToMinutes(b.train.departureTime));

        const byTrain = new Map<string, any>();
        rawOptions.forEach((option) => {
          const key = String(option.train.trainNo || option.train.trainName || `${option.boarding.code}-${option.arrival.code}`);
          const current = byTrain.get(key);
          if (!current) {
            byTrain.set(key, { ...option, variants: [option] });
            return;
          }
          current.variants.push(option);
          if (option.totalMinutes < current.totalMinutes) {
            byTrain.set(key, { ...option, variants: current.variants });
          }
        });

        const options = Array.from(byTrain.values())
          .map((option) => ({
            ...option,
            variants: option.variants.sort((a: any, b: any) => a.totalMinutes - b.totalMinutes).slice(0, 5),
          }))
          .sort((a, b) => a.totalMinutes - b.totalMinutes || timeToMinutes(a.train.departureTime) - timeToMinutes(b.train.departureTime));
        setState({ loading: false, error: "", options: options.slice(0, 10) });
      })
      .catch((error) => {
        if (!mounted) return;
        setState({ loading: false, error: error instanceof Error ? error.message : "Nearby boarding search failed.", options: [] });
      });

    return () => {
      mounted = false;
    };
  }, [destination, date, classType, useRouteExplorerOnly]);

  return (
    <div className={softPanel("overflow-hidden rounded-[22px]")}>
      <div className="border-b border-slate-200/80 bg-white p-5 dark:border-white/10 dark:bg-white/[0.055]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-200">Nearby Station Optimizer</div>
            <h3 className="mt-2 text-3xl font-black tracking-tight">{fullStationLabelFromCode(source, false)} access to {fullStationLabelFromCode(destination, false)}</h3>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
              When IRCTC does not expose CKP directly, RailRoute checks nearby boarding stations, ranks total access + rail time, and keeps the station/timing view readable.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CKP_MAJOR_DESTINATIONS.map((item) => (
              <Link
                key={item.code}
                href={`/trains?source=CKP&destination=${item.code}&date=${date}&classType=${classType}`}
                onClick={() => window.setTimeout(() => window.dispatchEvent(new Event("railroute-search-change")), 80)}
                className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                  destination.toUpperCase() === item.code
                    ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-300 dark:border-white/10 dark:bg-white/8 dark:text-slate-200"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {useRouteExplorerOnly && <CkpRouteExplorerPanel destination={destination} date={date} classType={classType} />}

      {!useRouteExplorerOnly && state.loading && <div className="p-5"><LoadingBlock label="Checking nearby IRCTC-compatible boarding options..." /></div>}
      {!useRouteExplorerOnly && state.error && <div className="p-5 text-sm font-bold text-rose-600">{state.error}</div>}
      {!useRouteExplorerOnly && !state.loading && state.options.length === 0 && (
        <div className="p-5 text-sm font-bold text-slate-500">No nearby boarding options came back from the provider for this date.</div>
      )}

      {!useRouteExplorerOnly && <div className="divide-y divide-slate-200 dark:divide-white/10">
        {state.options.map(({ boarding, arrival, train, totalMinutes, variants }, index) => {
          const id = `${boarding.code}-${arrival.code}-${train.trainNo}-${index}`;
          const routeOpen = openRoute === id;
          const classes = train.classes?.length ? train.classes : ["SL", "3E", "3A", "2A", "1A"];
          const railMinutes = durationToMinutes(train.duration);
          const statusTone = availabilityCardTone(train.availability);
          const journeyTone = journeyAccentTone(train.availability);
          return (
            <article key={id} className="bg-white p-5 transition hover:bg-slate-50 dark:bg-[#07111f] dark:hover:bg-[#0a1728]">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-r-full bg-emerald-600 px-3 py-1 text-xs font-black text-white">Nearby Station</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-300/12 dark:text-emerald-100">{boarding.distanceKm} km from CKP</span>
                    {arrival.distanceKm > 0 && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-300/12 dark:text-emerald-100">{arrival.distanceKm} km from {destination}</span>}
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-200">Option {index + 1}</span>
                  </div>
                  <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] lg:items-center">
                    <div className="min-w-0">
                      <h4 className="truncate text-2xl font-black tracking-tight">{trainNumberName(train)}</h4>
                      <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{boarding.access} · {boarding.buffer}</p>
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-500 dark:text-slate-400">{stationCompactLabel(boarding.code)}</div>
                        <div className="mt-1 text-3xl font-black tracking-tight">{timeAmPm(train.departureTime)}</div>
                        <div className="mt-1 text-sm font-black text-emerald-600 dark:text-emerald-200">{boarding.distanceKm} km from CKP</div>
                      </div>
                      <div className="pt-8 text-center">
                        <div className={`flex items-center gap-2 text-sm font-black ${journeyTone.text}`}>
                          <span className={`h-2 w-2 rounded-full ${journeyTone.dot}`} />
                          <span>{railMinutes ? formatDurationLong(railMinutes) : train.duration}</span>
                          <span className={`h-2 w-2 rounded-full ${journeyTone.dot}`} />
                        </div>
                        <div className={`mt-2 h-px w-28 ${journeyTone.line}`} />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-500 dark:text-slate-400">{stationCompactLabel(arrival.code)}</div>
                        <div className="mt-1 text-3xl font-black tracking-tight">{timeAmPm(train.arrivalTime)}</div>
                        {arrival.distanceKm > 0 && <div className="mt-1 text-sm font-black text-emerald-600 dark:text-emerald-200">{arrival.distanceKm} km from {destination}</div>}
                      </div>
                    </div>
                  </div>

                  {variants?.length > 1 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="px-1 py-1 text-xs font-black uppercase text-slate-400">Other boarding choices</span>
                      {variants.slice(1).map((variant: any) => (
                        <span key={`${id}-${variant.boarding.code}-${variant.arrival.code}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-white/8 dark:text-slate-200">
                          {stationCompactLabel(variant.boarding.code)} {timeAmPm(variant.train.departureTime)} → {stationCompactLabel(variant.arrival.code)} {timeAmPm(variant.train.arrivalTime)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {classes.slice(0, 5).map((classCode: string) => (
                        <button key={`${id}-${classCode}`} type="button" onClick={() => setClassView({ train: { ...train, classType: classCode }, classCode })} className={`h-24 min-w-44 rounded-2xl border p-3 text-left shadow-sm ${statusTone}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-black">{classCode}</span>
                            <span className="text-sm font-black">{classFareText(train, classCode) || formatFare(CLASS_FARE_ESTIMATES[classCode] || trainFareAmount(train) || 520)}</span>
                          </div>
                          <div className="mt-5 text-sm font-black">{classAvailabilityStatus(train, classCode)}</div>
                        </button>
                      ))}
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-start gap-2 md:justify-end">
                      <button type="button" onClick={() => setOpenRoute(routeOpen ? "" : id)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-100">
                        {routeOpen ? "Hide schedule" : "Schedule"}
                      </button>
                      <button type="button" onClick={() => setClassView({ train, classCode: primaryClassCode(train, classType) })} className="rounded-full border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-black text-cyan-800 transition hover:border-cyan-400 dark:bg-cyan-300/12 dark:text-cyan-100">Seats</button>
                      <Link href={`/coach?class=${encodeURIComponent(train.classType || classType)}`} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">Seat map</Link>
                    </div>
                  </div>
                </div>

                <div className="flex items-start justify-end gap-4 xl:w-44">
                  <div className="text-right">
                    <button type="button" onClick={() => setOpenRoute(routeOpen ? "" : id)} className="text-sm font-black text-slate-600 underline underline-offset-4 transition hover:text-cyan-700 dark:text-slate-300 dark:hover:text-cyan-100">
                      Schedule
                    </button>
                    <div className="mt-2 text-xs font-black text-slate-400">Total with access: {formatDurationLong(totalMinutes)}</div>
                  </div>
                </div>
              </div>
              {routeOpen && (
                <div className="mt-4">
                  <InlineRoutePanel trainNo={train.trainNo} train={train} />
                  <div className="mt-3"><CoachPositionStrip train={train} /></div>
                </div>
              )}
            </article>
          );
        })}
      </div>}
      <AnimatePresence>
        {classView && <ClassDetailModal train={classView.train} classCode={classView.classCode} journeyDate={date} onClose={() => setClassView(null)} />}
      </AnimatePresence>
    </div>
  );
}

function coachPositionFor(train: any) {
  const classes = (train.classes || ["SL", "3A", "2A"]).map((item: string) => item.toUpperCase());
  const coaches = ["Loco", "LPR", "GEN", "GEN"];
  if (classes.includes("1A")) coaches.push("H1");
  if (classes.includes("2A")) coaches.push("A2", "A1");
  if (classes.includes("3E")) coaches.push("M1");
  if (classes.includes("3A")) coaches.push("B5", "B4", "B3", "B2", "B1");
  if (classes.includes("SL")) coaches.push("S6", "S5", "S4", "S3", "S2", "S1");
  if (classes.includes("CC")) coaches.push("C3", "C2", "C1");
  if (classes.includes("EC")) coaches.push("E1");
  return coaches.slice(0, 14);
}

function CoachPositionStrip({ train, activeCoach }: { train: any; activeCoach?: string }) {
  const coaches = coachPositionFor(train);
  const selected = activeCoach || coaches.find((coach) => /^[ABHSMCE]\d/.test(coach));
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">Coach position</div>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800 dark:bg-amber-300/12 dark:text-amber-100">Verify at station</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {coaches.map((coach, index) => (
          <div key={`${coach}-${index}`} className="shrink-0 text-center">
            <div className={`h-8 min-w-14 rounded-xl border px-2 text-[11px] font-black leading-8 ${
              coach === selected
                ? "border-cyan-400 bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                : coach === "Loco"
                  ? "border-slate-300 bg-slate-900 text-white dark:border-white/10"
                  : "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-200"
            }`}>
              {coach}
            </div>
            <div className="mt-1 text-[10px] font-black text-slate-400">{index + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrainComparePanel({ trains, onClear }: { trains: any[]; onClear: () => void }) {
  const cheapest = trains.reduce((best, train) => (trainFareAmount(train) || Infinity) < (trainFareAmount(best) || Infinity) ? train : best, trains[0]);
  const fastest = trains.reduce((best, train) => (durationToMinutes(train.duration) || Infinity) < (durationToMinutes(best.duration) || Infinity) ? train : best, trains[0]);
  const bestSeats = trains.reduce((best, train) => {
    const score = (item: any) => isSeatAvailable(item.availability) ? 0 : /RAC/i.test(readableRailStatus(item.availability)) ? 1 : 2;
    return score(train) < score(best) ? train : best;
  }, trains[0]);

  return (
    <div className={softPanel("rounded-[30px] p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-cyan-700 dark:text-cyan-200">Route comparison</div>
          <h3 className="mt-1 text-2xl font-black">Compare selected trains</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Price, total travel time, seat status, and route window in one place.</p>
        </div>
        <button type="button" onClick={onClear} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 transition hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:bg-white/8 dark:text-slate-200">
          Clear compare
        </button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {trains.map((train) => (
          <div key={trainCompareKey(train)} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-slate-400">#{train.trainNo}</div>
                <div className="mt-1 text-lg font-black">{trainNumberName(train)}</div>
              </div>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-black ${availabilityTone(train.availability)}`}>{liveSeatText(train)}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-white p-3 dark:bg-white/8"><div className="text-[10px] font-black uppercase text-slate-400">Time</div><div className="mt-1 font-black">{train.departureTime} → {train.arrivalTime}</div></div>
              <div className="rounded-2xl bg-white p-3 dark:bg-white/8"><div className="text-[10px] font-black uppercase text-slate-400">Duration</div><div className="mt-1 font-black">{train.duration || "N/A"}</div></div>
              <div className="rounded-2xl bg-white p-3 dark:bg-white/8"><div className="text-[10px] font-black uppercase text-slate-400">Fare</div><div className="mt-1 font-black">{liveFareText(train)}</div></div>
              <div className="rounded-2xl bg-white p-3 dark:bg-white/8"><div className="text-[10px] font-black uppercase text-slate-400">Class</div><div className="mt-1 font-black">{train.classType || "3A"}</div></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {cheapest === train && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">Cheapest</span>}
              {fastest === train && <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">Fastest</span>}
              {bestSeats === train && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800 dark:bg-amber-300/12 dark:text-amber-100">Best seats</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeatCalendarStrip({ train, classType }: { train: any; classType: string }) {
  const calendar = classCalendarFor(train, classType);
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {calendar.map((item: any, index: number) => {
        const status = readableRailStatus(item.text || item.availabilityText || item.status || train.availability);
        const fare = item.fare ? `₹${String(item.fare).replace(/^₹/, "")}` : liveFareText(train);
        return (
          <div key={`${item.date || index}-${status}`} className={`rounded-2xl border p-3 ${availabilityTone(status)}`}>
            <div className="text-[10px] font-black uppercase opacity-70">{item.date || prettyDateLabel(todayIso(index))}</div>
            <div className="mt-1 text-sm font-black">{status}</div>
            <div className="mt-1 text-xs font-black opacity-80">{fare}</div>
            <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10">
              <div className="h-full rounded-full bg-current opacity-70" style={{ width: `${Math.max(16, Math.min(100, Number(item.confirmationChance) || 70))}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrainDetailModal({ train, journeyDate, onClose, onClass }: { train: any; journeyDate: string; onClose: () => void; onClass: (classCode: string) => void }) {
  const [copied, setCopied] = useState(false);
  const classes = train.classes || ["SL", "3A", "2A", "1A"];
  const summary = `${trainNumberName(train)} | ${fullStationLabelFromCode(train.source)} to ${fullStationLabelFromCode(train.destination)} | ${journeyDate} | ${train.classType || "3A"} | ${liveSeatText(train)} | ${liveFareText(train)}`;

  async function copySummary() {
    await navigator.clipboard?.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <motion.div className="fixed inset-0 z-[70] bg-slate-950/55 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="mx-auto mt-6 max-h-[90vh] max-w-6xl overflow-auto rounded-[34px] border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl dark:border-white/10 dark:bg-[#08111f] dark:text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">Train intelligence</span>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${availabilityTone(train.availability)}`}>{liveSeatText(train)}</span>
            </div>
            <h3 className="mt-4 text-3xl font-black">{trainNumberName(train)}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{fullStationLabelFromCode(train.source)} to {fullStationLabelFromCode(train.destination)} · {journeyDate}</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 transition hover:border-rose-300 hover:text-rose-600 dark:border-white/10"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            ["Departure", train.departureTime || "--:--"],
            ["Arrival", train.arrivalTime || "--:--"],
            ["Full journey", train.duration || "N/A"],
            ["Rate", liveFareText(train)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/6">
              <div className="text-[11px] font-black uppercase text-slate-400">{label}</div>
              <div className="mt-1 text-xl font-black">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.55fr]">
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase text-slate-400">Seat calendar</div>
                  <h4 className="mt-1 text-xl font-black">Next 7 days for {train.classType || "3A"}</h4>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">IRCTC-compatible quota</span>
              </div>
              <div className="mt-4"><SeatCalendarStrip train={train} classType={train.classType || "3A"} /></div>
            </div>
            <InlineRoutePanel trainNo={train.trainNo} train={train} />
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/6">
              <div className="text-xs font-black uppercase text-slate-400">Class tools</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {classes.map((classCode: string) => (
                  <button key={classCode} type="button" onClick={() => onClass(classCode)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-200">
                    {classCode}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/6">
              <div className="text-xs font-black uppercase text-slate-400">Booking handoff</div>
              <div className="mt-3 rounded-2xl bg-white p-3 text-sm font-black dark:bg-black/20">{summary}</div>
              <button type="button" onClick={copySummary} className="mt-3 flex w-full items-center justify-center rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800 transition hover:bg-cyan-100 dark:bg-cyan-300/12 dark:text-cyan-100">
                {copied ? "Copied booking summary" : "Copy booking summary"}
              </button>
              <a href={IRCTC_TRAIN_SEARCH_URL} target="_blank" rel="noreferrer" className="mt-3 flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
                Book / check ticket on IRCTC
              </a>
            </div>
            <CoachPositionStrip train={train} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PremiumTrainCard({
  train,
  onClass,
  onDetail,
  onCompare,
  compareSelected,
}: {
  train: any;
  onClass: (classCode: string) => void;
  onDetail: () => void;
  onCompare: () => void;
  compareSelected: boolean;
}) {
  const classes = train.classes || ["SL", "3A", "2A", "1A"];
  const [routeOpen, setRouteOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const routeAvailable = Boolean(train.trainNo);
  return (
    <article className={softPanel("overflow-hidden rounded-[30px]")}>
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_240px_260px]">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">Direct train</span>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">IRCTC-compatible data</span>
          </div>
          <h3 className="mt-4 text-2xl font-black">{trainNumberName(train)}</h3>
          <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{train.trainType || "Express"} · {fullStationLabelFromCode(train.source)} to {fullStationLabelFromCode(train.destination)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${availabilityTone(train.availability)}`}>IRCTC seats: {liveSeatText(train)}</span>
            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-300/12 dark:text-emerald-100">Rate: {liveFareText(train)}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-white/8 dark:text-slate-300">{train.classType || "3A"} · IRCTC-compatible quota</span>
          </div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-3xl bg-slate-50 p-4 dark:bg-black/20">
            <div><div className="text-3xl font-black">{train.departureTime || "--:--"}</div><div className="mt-1 text-xs font-black text-emerald-600 dark:text-emerald-200">{fullStationLabelFromCode(train.source)}</div></div>
            <div className="min-w-28 text-center"><div className="text-xs font-black text-slate-500">{train.duration || "N/A"}</div><div className="my-2 h-px bg-gradient-to-r from-emerald-400 via-cyan-400 to-rose-400" /><div className="text-[11px] font-bold text-slate-400">route</div></div>
            <div className="text-right"><div className="text-3xl font-black">{train.arrivalTime || "--:--"}</div><div className="mt-1 text-xs font-black text-rose-600 dark:text-rose-200">{fullStationLabelFromCode(train.destination)}</div></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setCoachOpen((value) => !value)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-200">
              {coachOpen ? "Hide coach position" : "Coach position"}
            </button>
            <button type="button" onClick={onDetail} className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800 transition hover:bg-cyan-100 dark:bg-cyan-300/12 dark:text-cyan-100">
              Train details
            </button>
            <button type="button" onClick={onCompare} className={`rounded-full border px-3 py-2 text-xs font-black transition ${compareSelected ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-400 hover:text-cyan-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-200"}`}>
              {compareSelected ? "Selected to compare" : "Compare"}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {classes.map((classCode: string) => (
              <button key={classCode} type="button" onClick={() => onClass(classCode)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-200 dark:hover:bg-cyan-300/12">
                {classCode}
              </button>
            ))}
          </div>
          {coachOpen && <div className="mt-4"><CoachPositionStrip train={train} /></div>}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/6">
          <div className="text-[11px] font-black uppercase text-slate-400">Train route</div>
          <div className={`mt-3 rounded-2xl border p-3 text-sm font-black ${routeAvailable ? "border-cyan-300 bg-cyan-100 text-cyan-800 dark:border-cyan-300/25 dark:bg-cyan-300/12 dark:text-cyan-100" : "border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/8 dark:text-slate-300"}`}>
            {routeAvailable ? "Route check available" : "Route unavailable"}
          </div>
          <div className="mt-3 text-xs font-bold leading-5 text-slate-500 dark:text-slate-400">
            Expands in this card using the IRCTC-compatible schedule endpoint. No full-screen route view.
          </div>
          <button type="button" disabled={!routeAvailable} onClick={() => setRouteOpen((value) => !value)} className="mt-4 flex w-full items-center justify-center rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-300/12 dark:text-cyan-100">
            {routeOpen ? "Hide train route" : "Check train route"}
          </button>
          <a href={IRCTC_TRAIN_SEARCH_URL} target="_blank" rel="noreferrer" className="mt-3 flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/8 dark:text-slate-100">
            Verify on IRCTC
          </a>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/8">
          <div className="text-[11px] font-black uppercase text-slate-400">Ticket status</div>
          <div className={`mt-2 rounded-2xl p-3 text-xl font-black ${ticketDecision(train.availability).tone}`}>{ticketDecision(train.availability).label}</div>
          <div className="mt-3 grid gap-2">
            <div className={`rounded-2xl border p-3 text-sm font-black ${availabilityTone(train.availability)}`}>
              <div className="text-[10px] uppercase opacity-70">IRCTC seats</div>
              <div className="mt-1 text-lg">{liveSeatText(train)}</div>
            </div>
            <div className="rounded-2xl border border-emerald-300 bg-emerald-100 p-3 text-sm font-black text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-300/12 dark:text-emerald-100">
              <div className="text-[10px] uppercase opacity-70">Rate</div>
              <div className="mt-1 text-lg">{liveFareText(train)}</div>
            </div>
          </div>
          <a href={IRCTC_TRAIN_SEARCH_URL} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
            Book / check ticket on IRCTC
          </a>
          <div className="mt-4 text-xs font-semibold leading-5 text-slate-500">Click any class chip for class-specific availability, berth layout, coach options and confirmation check.</div>
        </div>
      </div>
      {routeOpen && <div className="border-t border-slate-200 px-5 pb-5 dark:border-white/10"><InlineRoutePanel trainNo={train.trainNo} train={train} /></div>}
    </article>
  );
}

function InlineRoutePanel({ trainNo, train }: { trainNo: string; train: any }) {
  const [state, setState] = useState<{ loading: boolean; route: any[]; error: string }>({ loading: true, route: [], error: "" });

  useEffect(() => {
    let mounted = true;
    postJson<any>("/api/train-search", { query: trainNo })
      .then((data) => {
        if (!mounted) return;
        setState({ loading: false, route: data.trains?.[0]?.route || [], error: "" });
      })
      .catch((error) => {
        if (!mounted) return;
        setState({ loading: false, route: [], error: error instanceof Error ? error.message : "Route unavailable" });
      });
    return () => {
      mounted = false;
    };
  }, [trainNo]);

  const route = state.route.length ? state.route : train.route?.length ? train.route : [
    { code: train.source, departure: train.departureTime, arrival: "Start", halt: "-" },
    { code: train.destination, arrival: train.arrivalTime, departure: "End", halt: "-" },
  ];

  return (
    <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-slate-400">Complete route</div>
          <div className="mt-1 text-lg font-black">{train.departureTime || "--:--"} → {train.arrivalTime || "--:--"}</div>
          <div className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">Showing every station returned by the IRCTC-compatible schedule endpoint.</div>
          <div className="mt-2 rounded-2xl border border-amber-300/35 bg-amber-50 px-3 py-2 text-[11px] font-black text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
            Platforms marked expected can change. Verify final platform on IRCTC, station boards, and announcements.
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-black/20 dark:text-slate-300">{route.length} stops</span>
      </div>
      {state.loading && <div className="mt-4 text-sm font-bold text-slate-500">Loading route from train schedule...</div>}
      {state.error && <div className="mt-4 text-sm font-bold text-rose-600">{state.error}</div>}
      <div className="mt-4 max-h-[560px] overflow-y-auto pr-1">
        <div className="grid gap-2 md:grid-cols-2">
          {route.map((stop: any, index: number) => {
            const platform = platformText(stop, trainNo);
            return (
              <div key={`${stop.code}-${index}`} className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-black/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black">{stop.label || stationLabelFromCode(stop.code)}</div>
                    <div className="mt-1 text-xs font-bold text-slate-500">Arr {stop.arrival || "--"} · Dep {stop.departure || "--"} · Halt {stop.halt || "-"}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">#{index + 1}</span>
                </div>
                <div className="mt-2 text-[11px] font-bold text-slate-400">
                  {platform.label} {platform.value} · Day {stop.day || 1} · {stop.distance ?? "--"} km
                </div>
              </div>
            );
          })}
        </div>
        {route.length > 20 && (
          <div className="sticky bottom-0 mt-3 rounded-2xl border border-slate-200 bg-white/90 p-3 text-center text-xs font-black text-slate-500 backdrop-blur dark:border-white/10 dark:bg-[#101725]/90 dark:text-slate-300">
            Complete route loaded: {route.length} stops
          </div>
        )}
      </div>
    </div>
  );
}

function ClassDetailModal({ train, classCode, journeyDate, onClose }: { train: any; classCode: string; journeyDate: string; onClose: () => void }) {
  const [classState, setClassState] = useState<{ loading: boolean; error: string; fare: string; availability: string }>({ loading: true, error: "", fare: "", availability: "" });
  const decision = ticketDecision(classState.availability);

  useEffect(() => {
    let mounted = true;
    const source = train.source;
    const destination = train.destination;
    const fallbackAvailability = train.classAvailability?.[classCode]?.[0];
    setClassState({ loading: true, error: "", fare: "", availability: "" });
    postJson<any>("/api/fare", { trainNo: train.trainNo, source, destination, date: journeyDate, classType: classCode }).then((fareData) => {
      if (!mounted) return;
      const firstAvailability = fareData?.availability?.data?.availability?.[0] || fareData?.availability?.availability?.[0] || fallbackAvailability;
      const providerError = fareData?.availability?.success === false ? fareData?.availability?.error : fareData?.fareEnquiry?.success === false ? fareData?.fareEnquiry?.error : "";
      const fareValue = fareData?.fare || firstAvailability?.fare || fallbackAvailability?.fare || "";
      const providerStatus = firstAvailability?.availabilityText || firstAvailability?.text || firstAvailability?.status || providerError || fallbackAvailability?.text || train.availability;
      setClassState({
        loading: false,
        error: providerError ? "Provider returned this class/date as unavailable. Recheck before booking." : "",
        fare: fareValue ? `₹${String(fareValue).replace(/^₹/, "")}` : estimatedClassFare(classCode, train.fare),
        availability: readableRailStatus(providerStatus) || "Check seats",
      });
    }).catch(() => {
      if (!mounted) return;
      setClassState({
        loading: false,
        error: "Class data unavailable. Showing cached estimate.",
        fare: fallbackAvailability?.fare ? `₹${fallbackAvailability.fare}` : estimatedClassFare(classCode, train.fare),
        availability: readableRailStatus(fallbackAvailability?.text || train.availability) || "Check seats",
      });
    });
    return () => {
      mounted = false;
    };
  }, [classCode, journeyDate, train.availability, train.classAvailability, train.destination, train.fare, train.source, train.trainNo]);

  return (
    <motion.div className="fixed inset-0 z-[70] bg-slate-950/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="mx-auto mt-10 max-h-[88vh] max-w-5xl overflow-auto rounded-[34px] border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl dark:border-white/10 dark:bg-[#08111f] dark:text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">{classCode} class view</span>
            <h3 className="mt-4 text-3xl font-black">{train.trainName}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">Fare · availability · berth layout · coach options · quota architecture</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 dark:border-white/10"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="space-y-3">
            {[
              ["Fare", classState.loading ? "Checking IRCTC..." : classState.fare],
              ["Availability", classState.loading ? "Checking quota..." : classState.availability],
              ["Quota", "GN · Tatkal ready"],
              ["Coach options", classCode === "1A" ? "H1 · HA1 · Cabin/Coupe" : classCode === "2A" ? "A1 · A2 · HA1" : classCode === "SL" ? "S1 · S2 · S3" : "B1 · B2 · B3"],
            ].map(([label, value]) => (
              <div key={label} className={`rounded-3xl border p-4 ${label === "Availability" && !classState.loading ? availabilityTone(value) : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/6"}`}><div className="text-[11px] font-black uppercase text-slate-400">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>
            ))}
            <div className={`rounded-3xl p-4 text-sm font-black ${decision.tone}`}>
              Ticket check: {classState.loading ? "Checking..." : decision.label}
            </div>
            <div className="rounded-3xl border border-cyan-300/30 bg-cyan-50 p-4 text-sm font-black leading-6 text-cyan-900 dark:bg-cyan-300/10 dark:text-cyan-100">
              Quota is checked inside RailRoute. Exact berth numbers are assigned after booking/charting, so occupied berth positions cannot be official before ticketing.
            </div>
            {classState.error && <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">{classState.error}</div>}
          </div>
          <CoachExplorer initialClass={classCode} embedded train={train} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function SplitJourneyCard({ split }: { split: any }) {
  const leg1 = split.leg1 || {};
  const leg2 = split.leg2 || {};
  const [routeTrain, setRouteTrain] = useState<any | null>(null);
  const leg1Fare = split.leg1Fare || leg1.fare || "₹--";
  const leg2Fare = split.leg2Fare || leg2.fare || "₹--";
  const totalDuration = splitTotalDuration(split);
  const hubCode = split.hubStation || leg1.destination || leg2.source || "CNB";
  const hubArrivalPlatform = expectedPlatformNumber(hubCode, leg1.trainNo);
  const hubDeparturePlatform = expectedPlatformNumber(hubCode, leg2.trainNo);
  return (
    <article className={softPanel("rounded-[30px] p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-800 dark:bg-violet-300/12 dark:text-violet-100">Optimal split journey</span>
          <h3 className="mt-3 text-2xl font-black">{fullStationLabelFromCode(split.leg1?.source || "PNBE")} → {fullStationLabelFromCode(split.hubStation || "NDLS")} → {fullStationLabelFromCode(split.leg2?.destination || "JP")}</h3>
          <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400">
            Leg 1: {trainNumberName(leg1, "Leg 1 train")} · Leg 2: {trainNumberName(leg2, "Leg 2 train")}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm font-black dark:bg-black/20">
          <div className="text-[11px] uppercase text-slate-400">Final cost</div>
          <div className="text-xl">₹{split.totalFare || "--"} · {totalDuration}</div>
          <div className="mt-1 text-[11px] font-black text-slate-400">Layover {split.layoverDuration || "--"}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-slate-200">Journey 1 rate: {formatFare(leg1Fare)}</span>
        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-slate-200">Journey 2 rate: {formatFare(leg2Fare)}</span>
        <span className="rounded-full bg-violet-100 px-3 py-2 text-xs font-black text-violet-800 dark:bg-violet-300/12 dark:text-violet-100">Layover time: {split.layoverDuration || "--"}</span>
        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-slate-200">Total journey: {totalDuration}</span>
        <a href={IRCTC_TRAIN_SEARCH_URL} target="_blank" rel="noreferrer" className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white dark:bg-white dark:text-slate-950">Connect to IRCTC</a>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-slate-500">Split journey 1</div>
              <h4 className="mt-1 text-lg font-black">{trainNumberName(leg1, "Leg 1 train")}</h4>
              <div className="mt-1 text-xs font-black text-slate-400">{fullStationLabelFromCode(leg1.source || "PNBE")} → {fullStationLabelFromCode(leg1.destination || split.hubStation || "CNB")}</div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">{formatFare(leg1Fare)}</span>
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-black dark:bg-black/20">
            {fullStationLabelFromCode(leg1.source || "PNBE")} {leg1.departureTime || "--:--"} → {fullStationLabelFromCode(leg1.destination || split.hubStation || "CNB")} {leg1.arrivalTime || "--:--"}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Duration {leg1.duration || "--"}</span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${availabilityTone(leg1.availability)}`}>{readableRailStatus(leg1.availability) || "Check seats"}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setRouteTrain(leg1)} className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">Route</button>
            <Link href={`/coach?class=${encodeURIComponent(leg1.classType || "3A")}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-200">Coach layout</Link>
          </div>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-300/20 dark:bg-violet-300/10">
          <div className="text-sm text-slate-500">Layover section</div>
          <div className="mt-1 text-3xl font-black">{split.layoverDuration || "--"}</div>
          <div className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Connection at {fullStationLabelFromCode(hubCode)}</div>
          <div className="mt-3 text-xs font-black text-violet-700 dark:text-violet-100">Layover window: {leg1.arrivalTime || "--:--"} to {leg2.departureTime || "--:--"}</div>
          <div className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-300">
            Expected platform: arrival PF {hubArrivalPlatform} → departure PF {hubDeparturePlatform}. Platform can change; verify on IRCTC and station boards.
          </div>
          <div className="mt-3 rounded-2xl bg-white/70 p-3 text-xs font-black text-violet-800 dark:bg-black/20 dark:text-violet-100">Full journey time: {totalDuration}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-slate-500">Split journey 2</div>
              <h4 className="mt-1 text-lg font-black">{trainNumberName(leg2, "Leg 2 train")}</h4>
              <div className="mt-1 text-xs font-black text-slate-400">{fullStationLabelFromCode(leg2.source || split.hubStation || "CNB")} → {fullStationLabelFromCode(leg2.destination || "SBC")}</div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">{formatFare(leg2Fare)}</span>
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-black dark:bg-black/20">
            {fullStationLabelFromCode(leg2.source || split.hubStation || "CNB")} {leg2.departureTime || "--:--"} → {fullStationLabelFromCode(leg2.destination || "SBC")} {leg2.arrivalTime || "--:--"}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Duration {leg2.duration || "--"}</span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${availabilityTone(leg2.availability)}`}>{readableRailStatus(leg2.availability) || "Check seats"}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setRouteTrain(leg2)} className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">Route</button>
            <Link href={`/coach?class=${encodeURIComponent(leg2.classType || "3A")}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-200">Coach layout</Link>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <CoachPositionStrip train={leg1} />
        <CoachPositionStrip train={leg2} />
      </div>
      {routeTrain && (
        <div className="mt-4 rounded-[28px] border border-cyan-300/30 bg-cyan-50/70 p-3 dark:border-cyan-300/20 dark:bg-cyan-300/10">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="text-xs font-black uppercase text-cyan-800 dark:text-cyan-100">Selected leg route</div>
            <button type="button" onClick={() => setRouteTrain(null)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-100">Hide</button>
          </div>
          <InlineRoutePanel trainNo={routeTrain.trainNo} train={routeTrain} />
        </div>
      )}
    </article>
  );
}

function MultiSplitJourneyCard({ split }: { split: any }) {
  const legs = split.legs || [];
  const [routeTrain, setRouteTrain] = useState<any | null>(null);
  const path = legs.length
    ? [legs[0]?.source, ...split.interchangeStations, legs[legs.length - 1]?.destination].filter(Boolean)
    : split.interchangeStations || [];

  return (
    <article className={softPanel("rounded-[30px] p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">Reliable multi-split route</span>
          <h3 className="mt-3 text-2xl font-black">
            {path.map((code: string) => fullStationLabelFromCode(code, false)).join(" → ")}
          </h3>
          <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400">
            Uses smaller-station gateway junctions first, then long-distance IRCTC-compatible legs.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm font-black dark:bg-black/20">
          <div className="text-[11px] uppercase text-slate-400">Total</div>
          <div className="text-xl">{formatFare(split.totalFare)} · {split.totalDuration || "--"}</div>
          <div className="mt-1 text-[11px] font-black text-slate-400">Score {split.score || "--"} · {split.combinedConfirmationChance || "--"}% chance</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(split.layovers || []).map((layover: any) => (
          <span key={layover.station} className="rounded-full bg-violet-100 px-3 py-2 text-xs font-black text-violet-800 dark:bg-violet-300/12 dark:text-violet-100">
            {fullStationLabelFromCode(layover.station, false)} layover: {layover.duration}
          </span>
        ))}
        <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-black text-amber-900 dark:bg-amber-300/12 dark:text-amber-100">
          Expected platforms can change; verify before boarding
        </span>
        <a href={IRCTC_TRAIN_SEARCH_URL} target="_blank" rel="noreferrer" className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white dark:bg-white dark:text-slate-950">Verify each leg on IRCTC</a>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {legs.map((leg: any, index: number) => (
          <div key={`${leg.trainNo}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-500">Journey {index + 1}</div>
                <h4 className="mt-1 text-lg font-black">{trainNumberName(leg, `Leg ${index + 1} train`)}</h4>
                <div className="mt-1 text-xs font-black text-slate-400">{fullStationLabelFromCode(leg.source, false)} → {fullStationLabelFromCode(leg.destination, false)}</div>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">{liveFareText(leg)}</span>
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-black dark:bg-black/20">
              {leg.departureTime || "--:--"} → {leg.arrivalTime || "--:--"} · {leg.duration || "--"}
            </div>
            <div className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              Expected platform: start PF {expectedPlatformNumber(leg.source, leg.trainNo)} · end PF {expectedPlatformNumber(leg.destination, leg.trainNo)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${availabilityTone(leg.availability)}`}>{readableRailStatus(leg.availability) || "Check seats"}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-slate-200">{leg.classType || "3A"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setRouteTrain(leg)} className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">Route</button>
              <Link href={`/coach?class=${encodeURIComponent(leg.classType || "3A")}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-200">Coach layout</Link>
            </div>
          </div>
        ))}
      </div>

      {routeTrain && (
        <div className="mt-4 rounded-[28px] border border-cyan-300/30 bg-cyan-50/70 p-3 dark:border-cyan-300/20 dark:bg-cyan-300/10">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="text-xs font-black uppercase text-cyan-800 dark:text-cyan-100">Selected leg route</div>
            <button type="button" onClick={() => setRouteTrain(null)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-100">Hide</button>
          </div>
          <InlineRoutePanel trainNo={routeTrain.trainNo} train={routeTrain} />
        </div>
      )}
    </article>
  );
}

function CoachExplorer({ initialClass = "3A", embedded = false, train }: { initialClass?: string; embedded?: boolean; train?: any }) {
  const [classType, setClassType] = useState(initialClass);
  const [coach, setCoach] = useState(() => defaultCoachFor(initialClass));
  const [selected, setSelected] = useState<string[]>([]);
  const seats = useMemo(() => buildCoachSeats(classType, coach), [classType, coach]);
  const coachOptions = compatibleCoaches(classType);
  const seatGroups = useMemo(() => groupSeatsForClass(classType, seats), [classType, seats]);
  const seatTile = (seat: ReturnType<typeof buildCoachSeats>[number], compact = false) => {
    const isSelected = selected.includes(seat.id);
    return (
      <button key={seat.id} type="button" disabled={seat.state === "booked"} onClick={() => setSelected((items) => items.includes(seat.id) ? items.filter((id) => id !== seat.id) : [...items, seat.id])} className={`${compact ? "h-12" : "h-14"} rounded-xl border text-xs font-black transition ${
        isSelected ? "border-cyan-500 bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20" :
        seat.state === "available" ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100" :
        seat.state === "RAC" ? "border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-300/12 dark:text-amber-100" :
        seat.state === "WL" ? "border-rose-300 bg-rose-100 text-rose-800 dark:bg-rose-300/12 dark:text-rose-100" :
        "border-slate-200 bg-slate-200 text-slate-400 dark:border-white/10 dark:bg-white/8"
      }`}>
        <span className="block leading-none">{seat.number}</span>
        <span className="mt-1 block text-[10px] leading-none">{seat.berth}</span>
      </button>
    );
  };

  return (
    <div className={embedded ? "" : softPanel("rounded-[32px] p-5")}>
      {train && (
        <div className="mb-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/20">
          <div className="text-[11px] font-black uppercase text-slate-400">Current train coach explorer</div>
          <div className="mt-1 text-lg font-black">{trainNumberName(train)}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${availabilityTone(train.availability)}`}>Seats: {liveSeatText(train)}</span>
            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-300/12 dark:text-emerald-100">Rate: {liveFareText(train)}</span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {classOptions.map((item) => <button key={item} onClick={() => { setClassType(item); setCoach(defaultCoachFor(item)); setSelected([]); }} className={`rounded-full border px-3 py-2 text-xs font-black ${classType === item ? "border-cyan-400 bg-cyan-100 text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100" : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/6"}`}>{item}</button>)}
      </div>
      <div className="mt-4 flex gap-2 overflow-auto pb-2">
        {coachOptions.map((item) => <button key={item} onClick={() => { setCoach(item); setSelected([]); }} className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-black ${coach === item ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/6"}`}>{item}</button>)}
      </div>
      <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/20">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-black">{classType === "1A" ? `${coach} cabin / coupe map` : `${coach} coach berth map`}</h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {classType === "1A" ? "1AC cabins/coupes use LB/UB berths, not 3-tier bays" : classType === "2A" ? "2AC bays use LB/UB plus side lower/upper, no middle berth" : ["3A", "3E", "SL"].includes(classType) ? "Each bay shows 6 main berths + 2 side berths" : "Chair car row layout"}
            </p>
            <p className="mt-1 text-xs font-black text-cyan-700 dark:text-cyan-200">Exploring all {seatGroups.length} {["CC", "EC"].includes(classType) ? "rows" : classType === "1A" ? "cabins/coupes" : "bays"} in {coach}</p>
          </div>
          <Train className="h-5 w-5 text-cyan-600 dark:text-cyan-200" />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">Available/selectable</span>
          <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800 dark:bg-amber-300/12 dark:text-amber-100">RAC/WL</span>
          <span className="rounded-full border border-slate-300 bg-slate-200 px-3 py-1 text-[11px] font-black text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">Occupied/blocked layout</span>
          <span className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">Exact berth numbers are post-booking/chart only</span>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {seatGroups.map((group) => (
            <div key={group.label} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase text-slate-400">{group.label}</div>
                <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500 dark:bg-black/20 dark:text-slate-300">
                  {classType === "1A" ? "Cabin/Coupe" : ["CC", "EC"].includes(classType) ? "Chair row" : "Bay + side"}
                </div>
              </div>
              {classType === "1A" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black/20">
                  <div className="mb-2 text-center text-[10px] font-black uppercase text-slate-400">Private cabin area</div>
                  <div className="grid grid-cols-2 gap-2">{group.seats.map((seat) => seatTile(seat))}</div>
                </div>
              ) : ["CC", "EC"].includes(classType) ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black/20">
                  <div className="mb-2 text-center text-[10px] font-black uppercase text-slate-400">Window · Aisle · Aisle · Window</div>
                  <div className="grid grid-cols-4 gap-2">{group.seats.map((seat) => seatTile(seat, true))}</div>
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_42px_84px] gap-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-black/20">
                    <div className={`grid gap-2 ${classType === "2A" ? "grid-cols-2" : "grid-cols-3"}`}>
                      {group.seats.slice(0, classType === "2A" ? 4 : 6).map((seat) => seatTile(seat, true))}
                    </div>
                    <div className="mt-2 text-center text-[10px] font-black uppercase text-slate-400">Main bay</div>
                  </div>
                  <div className="flex items-center justify-center rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-wide text-slate-400 [writing-mode:vertical-rl] dark:bg-black/20">
                    aisle
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-black/20">
                    <div className="grid gap-2">{group.seats.slice(classType === "2A" ? 4 : 6).map((seat) => seatTile(seat, true))}</div>
                    <div className="mt-2 text-center text-[10px] font-black uppercase text-slate-400">Side</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PnrTool() {
  const [pnr, setPnr] = useState("");
  const [state, setState] = useState<{ loading: boolean; error: string; data: any | null }>({ loading: false, error: "", data: null });
  async function check() {
    if (!/^\d{10}$/.test(pnr)) return setState({ loading: false, error: "Enter a 10-digit PNR.", data: null });
    setState({ loading: true, error: "", data: null });
    try { setState({ loading: false, error: "", data: await postJson("/api/pnr", { pnr }) }); } catch (error) { setState({ loading: false, error: error instanceof Error ? error.message : "PNR failed.", data: null }); }
  }
  return <UtilityCard icon={ShieldCheck} title="PNR Status" input={pnr} setInput={(value: string) => setPnr(value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit PNR" action="Check PNR" loading={state.loading} onAction={check} result={state.data ? "PNR response received from provider." : ""} error={state.error} />;
}

function FareTool() {
  const [trainNo, setTrainNo] = useState("12395");
  const [state, setState] = useState<{ loading: boolean; error: string; data: any | null }>({ loading: false, error: "", data: null });
  async function check() {
    setState({ loading: true, error: "", data: null });
    try { setState({ loading: false, error: "", data: await postJson("/api/fare", { trainNo, source: "PNBE", destination: "JP", date: todayIso(), classType: "3A" }) }); } catch (error) { setState({ loading: false, error: error instanceof Error ? error.message : "Fare failed.", data: null }); }
  }
  return <UtilityCard icon={IndianRupee} title="Fare Enquiry" input={trainNo} setInput={(value: string) => setTrainNo(value.replace(/\D/g, "").slice(0, 5))} placeholder="Train number" action="Check Fare" loading={state.loading} onAction={check} result={state.data?.fare ? `Fare: ₹${String(state.data.fare).replace(/^₹/, "")}` : ""} error={state.error} />;
}

function UtilityCard({ icon: Icon, title, input, setInput, placeholder, action, loading, onAction, result, error }: any) {
  return (
    <div className={softPanel("mx-auto max-w-3xl rounded-[32px] p-5")}>
      <Icon className="h-7 w-7 text-cyan-600 dark:text-cyan-200" />
      <h2 className="mt-4 text-3xl font-black">{title}</h2>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} className="h-13 flex-1 rounded-2xl border border-slate-200 bg-white px-4 font-bold dark:border-white/10 dark:bg-white/8 dark:text-white" /><button onClick={onAction} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white dark:bg-white dark:text-slate-950"><span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}</span><span>{loading ? "Checking" : action}</span></button></div>
      {result && <div className="mt-5 rounded-2xl bg-emerald-50 p-4 font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">{result}</div>}
      {error && <div className="mt-5 rounded-2xl bg-rose-50 p-4 font-black text-rose-700 dark:bg-rose-300/12 dark:text-rose-100">{error}</div>}
    </div>
  );
}

export function RailRouteToolPage({ tool }: { tool: ToolKind }) {
  return (
    <ProductShell active={tool}>
      <ToolHeader tool={tool} />
      {tool === "trains" && (
        <>
          <TrainResultsWorkspace />
          <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6"><TrainSearchPanel compact /></section>
        </>
      )}
      {tool === "train-search" && <section className="px-4 pb-16 sm:px-6"><TrainSearchPanel /></section>}
      {tool === "pnr" && <section className="px-4 pb-16 sm:px-6"><PnrTool /></section>}
      {tool === "fare" && <section className="px-4 pb-16 sm:px-6"><FareTool /></section>}
      {tool === "map" && <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6"><IndiaMapShowcase /></section>}
      {tool === "route" && <section className="px-4 pb-16 sm:px-6"><TrainSearchPanel /></section>}
      {tool === "coach" && <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6"><CoachExplorer /></section>}
    </ProductShell>
  );
}
