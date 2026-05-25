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
  Radio,
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
  { href: "/live", label: "Live", tool: "live" },
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
  if (/live fetch failed/i.test(text)) return "Live quota unavailable";
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

function trainRouteHref(trainNo: unknown) {
  return `/route?query=${encodeURIComponent(String(trainNo || ""))}`;
}

function routeLinkProps(trainNo: unknown) {
  return {
    href: trainRouteHref(trainNo),
    target: "_blank",
    rel: "noreferrer",
  };
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

function fullStationLabelFromCode(code: unknown, withCode = true) {
  const cleanCode = String(code || "").toUpperCase();
  const station = stationByCode(cleanCode);
  if (!station) return cleanCode || "--";
  const overrides: Record<string, string> = {
    ALD: "Prayagraj Junction",
    DDU: "Pt Deen Dayal Upadhyaya Junction",
    PRYJ: "Prayagraj Junction",
  };
  const name = overrides[cleanCode] || titleCase(station.name.replace(/\bRAILWAY STATION\b/gi, "").trim());
  const state = stationState(cleanCode);
  const label = state === "India" ? name : `${name} (${state})`;
  return withCode ? `${label} — ${cleanCode}` : label;
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
    <main className={productBg()}>
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
        <MapPin className={`pointer-events-none absolute left-4 top-4 h-4 w-4 ${label === "From" ? "text-emerald-500" : "text-rose-500"}`} />
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
  const [sourceQuery, setSourceQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
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

    if (!resolvedSource || !resolvedDestination) {
      setError("Select both Starting Point and End Point from station search.");
      return;
    }
    if (resolvedSource === resolvedDestination) {
      setError("Starting Point and End Point cannot be the same.");
      return;
    }
    router.push(`/trains?source=${resolvedSource}&destination=${resolvedDestination}&date=${date}&classType=${classType}`);
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
      className={softPanel(`w-full rounded-[32px] p-4 sm:p-5 ${compact ? "" : "mx-auto max-w-5xl"}`)}
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
          <h3 className="mt-4 text-2xl font-black tracking-tight">Pan, zoom, and inspect the actual India map with station markers and a live route path.</h3>
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
      <section className="relative overflow-hidden px-4 py-10 sm:px-6 lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-100 px-4 py-2 text-xs font-black uppercase text-cyan-800 dark:bg-cyan-300/10 dark:text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Indian Railways intelligence platform
            </span>
            <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl">
              PLAN SMARTER RAILWAY JOURNEYS
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-slate-600 dark:text-slate-300">
              Live train tracking, route intelligence, seat maps, split journeys, fare comparison and platform insights.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                ["Search Trains", "/trains", Search],
                ["Live Tracking", "/live", Radio],
                ["PNR Status", "/pnr", ShieldCheck],
                ["Coach Layouts", "/coach", Train],
              ].map(([label, href, Icon], index) => {
                const I = Icon as typeof Search;
                return (
                  <Link key={String(label)} href={String(href)} className={`flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-black transition ${index === 0 ? "bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950" : "border border-slate-200 bg-white/70 text-slate-800 hover:bg-white dark:border-white/10 dark:bg-white/8 dark:text-white"}`}>
                    <I className="h-4 w-4" />
                    {String(label)}
                  </Link>
                );
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.97, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} className="relative min-h-[520px] overflow-hidden rounded-[36px] border border-slate-200 bg-slate-950 shadow-2xl shadow-slate-400/30 dark:border-white/10 dark:shadow-black/40">
            <Image src="/vande-bharat-hero.jpg" alt="Vande Bharat Express" fill priority sizes="(min-width: 1024px) 56vw, 100vw" className="object-cover opacity-80" />
            <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(3,7,18,0.92)_0%,rgba(3,7,18,0.45)_48%,rgba(3,7,18,0.08)_100%)]" />
            <motion.div className="absolute left-10 right-10 top-16 h-px bg-gradient-to-r from-transparent via-cyan-200 to-transparent" animate={{ opacity: [0.2, 1, 0.2], x: [-40, 40, -40] }} transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }} />
            <motion.div className="absolute bottom-9 left-7 right-7 rounded-[28px] border border-white/12 bg-white/12 p-4 text-white backdrop-blur-2xl" animate={{ y: [0, -7, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-200 text-slate-950"><Activity className="h-5 w-5" /></span>
                <div>
                  <div className="font-black">Vande Bharat corridor scan</div>
                  <div className="text-sm font-semibold text-slate-300">ETA, fare layers, seat intelligence, transfer risk</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <QuickSearch />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <IndiaMapShowcase />
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Live Train", Radio],
            ["PNR", ShieldCheck],
            ["Route Explorer", Route],
            ["Coach Explorer", Train],
            ["Seat Intelligence", WalletCards],
            ["Platform Change Intelligence", Compass],
            ["Split Journey Planner", ArrowDownUp],
          ].map(([title, Icon]) => {
            const I = Icon as typeof Radio;
            return (
              <div key={String(title)} className={softPanel("rounded-[26px] p-5")}>
                <I className="h-5 w-5 text-cyan-600 dark:text-cyan-200" />
                <h3 className="mt-4 text-lg font-black">{String(title)}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">Production-ready module with loading, fallback and premium interaction states.</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className={softPanel("grid gap-4 rounded-[34px] p-6 md:grid-cols-4")}>
          {[
            ["8,990", "station search index"],
            ["Live", "IRCTC-compatible APIs"],
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
    trains: ["Train Search", "Search by stations, train number, or train name with live railway intelligence."],
    "train-search": ["Train Number Search", "Full train details, running days, route and complete timetable."],
    live: ["Live Tracking", "Flight-tracker style live station, ETA, delay and progress intelligence."],
    pnr: ["PNR Status", "Passenger status, chart state and journey summary."],
    fare: ["Fare Enquiry", "Live fare estimate by train, class, quota and route."],
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
          {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search Train
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
          <Link {...routeLinkProps(train.trainNo)} className="flex items-center justify-center rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800 transition hover:bg-cyan-100 dark:bg-cyan-300/12 dark:text-cyan-100">
            Check this route
          </Link>
          <a href={IRCTC_TRAIN_SEARCH_URL} target="_blank" rel="noreferrer" className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/8 dark:text-slate-100">
            Verify on IRCTC
          </a>
        </div>
      </div>
      <div className="border-t border-slate-200 p-5 dark:border-white/10">
        <div className="space-y-0">
          {route.map((stop: any, index: number) => (
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
                    <div className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{stop.state || "India"} · Platform {stop.platform || "TBA"} · {stop.distance} km</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><div className="text-[10px] font-black uppercase text-slate-400">Arr</div><div className="font-black">{stop.arrival}</div></div>
                    <div><div className="text-[10px] font-black uppercase text-slate-400">Dep</div><div className="font-black">{stop.departure}</div></div>
                    <div><div className="text-[10px] font-black uppercase text-slate-400">Halt</div><div className="font-black">{stop.halt}</div></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function TrainResultsWorkspace() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [date, setDate] = useState(todayIso());
  const [classType, setClassType] = useState("3A");
  const [allowSplit, setAllowSplit] = useState(true);
  const [resultMode, setResultMode] = useState<"all" | "direct" | "split">("all");
  const [state, setState] = useState<{ loading: boolean; splitLoading: boolean; error: string; trains: any[]; splits: any[] }>({ loading: false, splitLoading: false, error: "", trains: [], splits: [] });
  const [classView, setClassView] = useState<{ train: any; classCode: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialSource = params.get("source") || "";
    const initialDestination = params.get("destination") || "";
    const initialDate = params.get("date") || todayIso();
    const initialClass = params.get("classType") || "3A";
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
    setDate(initialDate);
    setClassType(initialClass);
    if (initialSource && initialDestination) {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (navigation?.type === "back_forward") return;
      window.setTimeout(() => runSearch(undefined, { source: initialSource, destination: initialDestination, date: initialDate, classType: initialClass }), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(event?: FormEvent, override?: { source: string; destination: string; date: string; classType: string }) {
    event?.preventDefault();
    const payload = override || {
      source: resolveStationInput(source, sourceQuery),
      destination: resolveStationInput(destination, destinationQuery),
      date,
      classType,
    };
    if (!payload.source || !payload.destination) {
      setState({ loading: false, splitLoading: false, error: "Choose Starting Point and End Point.", trains: [], splits: [] });
      return;
    }
    setState({ loading: true, splitLoading: allowSplit, error: "", trains: [], splits: [] });
    try {
      const direct = await postJson<any>("/api/train-between", payload);
      const trains = direct.trains || [];
      setState({ loading: false, splitLoading: allowSplit, error: "", trains, splits: [] });

      if (allowSplit) {
        postJson<any>("/api/search-split", { ...payload, directTrains: trains })
          .then((splitData) => {
            const liveSplits = splitData.splitRoutes || [];
            setState((current) => ({ ...current, splitLoading: false, splits: liveSplits }));
          })
          .catch(() => setState((current) => ({ ...current, splitLoading: false })));
      }
    } catch (error) {
      setState({ loading: false, splitLoading: false, error: error instanceof Error ? error.message : "Train search failed.", trains: [], splits: [] });
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <div className={softPanel("rounded-[32px] p-5")}>
        <form onSubmit={runSearch}>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
            <StationAutocomplete label="From" placeholder="Starting Point" example="Patna (Bihar)" value={source} setValue={setSource} query={sourceQuery} setQuery={setSourceQuery} />
            <button type="button" onClick={() => { const a = source; const aq = sourceQuery; setSource(destination); setSourceQuery(destinationQuery); setDestination(a); setDestinationQuery(aq); }} className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-cyan-700 dark:border-white/10 dark:bg-white/8 dark:text-cyan-100"><ArrowDownUp className="h-5 w-5" /></button>
            <StationAutocomplete label="To" placeholder="End Point" example="Jaipur (Rajasthan)" value={destination} setValue={setDestination} query={destinationQuery} setQuery={setDestinationQuery} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <DateQuickField date={date} setDate={setDate} />
            <select value={classType} onChange={(event) => setClassType(event.target.value)} className="h-13 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold dark:border-white/10 dark:bg-[#111827] dark:text-white">{["Any", ...classOptions].map((item) => <option key={item}>{item}</option>)}</select>
            <button className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-black text-white dark:bg-white dark:text-slate-950">{state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["direct", "Direct trains only"],
              ["split", "Allow split journeys"],
            ].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setAllowSplit(key === "split")} className={`rounded-full border px-3 py-2 text-xs font-black ${allowSplit === (key === "split") ? "border-cyan-300 bg-cyan-100 text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100" : "border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/6 dark:text-slate-400"}`}>{label}</button>
            ))}
          </div>
        </form>
      </div>
      {state.error && <div className="mt-5 rounded-3xl border border-rose-300/40 bg-rose-50 p-5 font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-100">{state.error}</div>}
      {state.loading && <LoadingBlock label="Scanning live train inventory..." />}
      {(state.trains.length > 0 || state.splits.length > 0) && (
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            ["all", `All options (${state.trains.length + (allowSplit ? state.splits.length : 0)})`],
            ["direct", `Direct trains (${state.trains.length})`],
            ["split", `Split journeys (${state.splits.length})`],
          ].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setResultMode(key as "all" | "direct" | "split")} className={`rounded-full border px-4 py-2 text-xs font-black ${resultMode === key ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/6 dark:text-slate-300"}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-6 space-y-4">
        {(resultMode === "all" || resultMode === "direct") && state.trains.map((train) => <PremiumTrainCard key={`${train.trainNo}-${train.source}-${train.destination}`} train={train} onClass={(classCode) => setClassView({ train, classCode })} />)}
        {allowSplit && state.splitLoading && (resultMode === "all" || resultMode === "split") && <LoadingBlock label="Finding real split journeys from live train data..." />}
        {allowSplit && (resultMode === "all" || resultMode === "split") && state.splits.map((split, index) => <SplitJourneyCard key={`${split.hubStation}-${index}`} split={split} />)}
        {!state.loading && !state.splitLoading && !state.trains.length && !state.splits.length && (
          <div className={softPanel("rounded-[30px] p-6")}>
            <h3 className="text-2xl font-black">No live train options found for this exact search.</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
              RailRoute checked the IRCTC-compatible train inventory and did not find a direct or valid split route for this date. Try nearby stations, a different date, or verify manually on IRCTC.
            </p>
            <a href={IRCTC_TRAIN_SEARCH_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-950">Open IRCTC train search</a>
          </div>
        )}
      </div>
      <AnimatePresence>
        {classView && <ClassDetailModal train={classView.train} classCode={classView.classCode} journeyDate={date} onClose={() => setClassView(null)} />}
      </AnimatePresence>
      <StationCodeLookup />
    </section>
  );
}

function StationCodeLookup() {
  const [code, setCode] = useState("");
  const normalized = code.trim().toUpperCase();
  const station = normalized ? stationByCode(normalized) : null;
  const stationLookupState = station ? stationState(station.code) : null;

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
              </>
            ) : normalized ? (
              <div className="font-bold text-rose-600 dark:text-rose-200">No station found for {normalized}</div>
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

function PremiumTrainCard({ train, onClass }: { train: any; onClass: (classCode: string) => void }) {
  const classes = train.classes || ["SL", "3A", "2A", "1A"];
  const [routeOpen, setRouteOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  return (
    <article className={softPanel("overflow-hidden rounded-[30px]")}>
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">Direct train</span>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">{train.punctualityScore || "Live ETA ready"}</span>
          </div>
          <h3 className="mt-4 text-2xl font-black">{trainNumberName(train)}</h3>
          <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{train.trainType || "Express"} · {fullStationLabelFromCode(train.source)} to {fullStationLabelFromCode(train.destination)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${availabilityTone(train.availability)}`}>Live IRCTC seats: {liveSeatText(train)}</span>
            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-300/12 dark:text-emerald-100">Rate: {liveFareText(train)}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-white/8 dark:text-slate-300">{train.classType || "3A"} · IRCTC-compatible quota</span>
          </div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-3xl bg-slate-50 p-4 dark:bg-black/20">
            <div><div className="text-3xl font-black">{train.departureTime || "--:--"}</div><div className="mt-1 text-xs font-black text-emerald-600 dark:text-emerald-200">{fullStationLabelFromCode(train.source)}</div></div>
            <div className="min-w-28 text-center"><div className="text-xs font-black text-slate-500">{train.duration || "N/A"}</div><div className="my-2 h-px bg-gradient-to-r from-emerald-400 via-cyan-400 to-rose-400" /><div className="text-[11px] font-bold text-slate-400">route</div></div>
            <div className="text-right"><div className="text-3xl font-black">{train.arrivalTime || "--:--"}</div><div className="mt-1 text-xs font-black text-rose-600 dark:text-rose-200">{fullStationLabelFromCode(train.destination)}</div></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setRouteOpen((value) => !value)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-200">
              {routeOpen ? "Hide route" : `View route · ${train.departureTime || "--"} to ${train.arrivalTime || "--"}`}
            </button>
            <Link {...routeLinkProps(train.trainNo)} className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">
              Open full route
            </Link>
            <button type="button" onClick={() => setCoachOpen((value) => !value)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-200">
              {coachOpen ? "Hide coach position" : "Coach position"}
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
          {routeOpen && <InlineRoutePanel trainNo={train.trainNo} train={train} />}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/8">
          <div className="text-[11px] font-black uppercase text-slate-400">Ticket status</div>
          <div className={`mt-2 rounded-2xl p-3 text-xl font-black ${ticketDecision(train.availability).tone}`}>{ticketDecision(train.availability).label}</div>
          <div className="mt-3 grid gap-2">
            <div className={`rounded-2xl border p-3 text-sm font-black ${availabilityTone(train.availability)}`}>
              <div className="text-[10px] uppercase opacity-70">Live IRCTC seats</div>
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
          <Link {...routeLinkProps(train.trainNo)} className="mt-3 flex items-center justify-center rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800 transition hover:bg-cyan-100 dark:bg-cyan-300/12 dark:text-cyan-100">
            Check full route
          </Link>
          <div className="mt-4 text-xs font-semibold leading-5 text-slate-500">Click any class chip for class-specific availability, berth layout, coach options and confirmation check.</div>
        </div>
      </div>
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

  return (
    <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-slate-400">Route window</div>
          <div className="mt-1 text-lg font-black">{train.departureTime || "--:--"} → {train.arrivalTime || "--:--"}</div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-black/20 dark:text-slate-300">{state.route.length || "Full"} stops</span>
      </div>
      {state.loading && <div className="mt-4 text-sm font-bold text-slate-500">Loading route from train schedule...</div>}
      {state.error && <div className="mt-4 text-sm font-bold text-rose-600">{state.error}</div>}
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {(state.route.length ? state.route.slice(0, 8) : [
          { code: train.source, departure: train.departureTime, arrival: "Start", halt: "-" },
          { code: train.destination, arrival: train.arrivalTime, departure: "End", halt: "-" },
        ]).map((stop: any, index: number) => (
          <div key={`${stop.code}-${index}`} className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-black/20">
            <div className="font-black">{stop.label || stationLabelFromCode(stop.code)}</div>
            <div className="mt-1 text-xs font-bold text-slate-500">Arr {stop.arrival || "--"} · Dep {stop.departure || "--"} · Halt {stop.halt || "-"}</div>
          </div>
        ))}
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
        error: providerError ? "IRCTC returned this class/date as unavailable. Recheck before booking." : "",
        fare: fareValue ? `₹${String(fareValue).replace(/^₹/, "")}` : estimatedClassFare(classCode, train.fare),
        availability: readableRailStatus(providerStatus) || "Check seats",
      });
    }).catch(() => {
      if (!mounted) return;
      setClassState({
        loading: false,
        error: "Live class data unavailable. Showing cached estimate.",
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
              ["Availability", classState.loading ? "Checking live quota..." : classState.availability],
              ["Quota", "GN · Tatkal ready"],
              ["Coach options", classCode === "1A" ? "H1 · HA1 · Cabin/Coupe" : classCode === "2A" ? "A1 · A2 · HA1" : classCode === "SL" ? "S1 · S2 · S3" : "B1 · B2 · B3"],
            ].map(([label, value]) => (
              <div key={label} className={`rounded-3xl border p-4 ${label === "Availability" && !classState.loading ? availabilityTone(value) : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/6"}`}><div className="text-[11px] font-black uppercase text-slate-400">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>
            ))}
            <div className={`rounded-3xl p-4 text-sm font-black ${decision.tone}`}>
              Ticket check: {classState.loading ? "Checking..." : decision.label}
            </div>
            <a href={IRCTC_TRAIN_SEARCH_URL} target="_blank" rel="noreferrer" className="flex items-center justify-center rounded-3xl bg-slate-950 p-4 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
              Book / verify this ticket on IRCTC
            </a>
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
  const leg1Fare = split.leg1Fare || leg1.fare || "₹--";
  const leg2Fare = split.leg2Fare || leg2.fare || "₹--";
  const totalDuration = splitTotalDuration(split);
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
            <Link {...routeLinkProps(leg1.trainNo)} className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">Route</Link>
            <Link href={`/coach?class=${encodeURIComponent(leg1.classType || "3A")}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-200">Coach layout</Link>
          </div>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-300/20 dark:bg-violet-300/10">
          <div className="text-sm text-slate-500">Layover section</div>
          <div className="mt-1 text-3xl font-black">{split.layoverDuration || "--"}</div>
          <div className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Connection at {fullStationLabelFromCode(split.hubStation || leg1.destination || leg2.source || "CNB")}</div>
          <div className="mt-3 text-xs font-black text-violet-700 dark:text-violet-100">Layover window: {leg1.arrivalTime || "--:--"} to {leg2.departureTime || "--:--"}</div>
          <div className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-300">Platform change: 5 → 10 · walking estimate 8 minutes · use foot overbridge</div>
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
            <Link {...routeLinkProps(leg2.trainNo)} className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">Route</Link>
            <Link href={`/coach?class=${encodeURIComponent(leg2.classType || "3A")}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-200">Coach layout</Link>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <CoachPositionStrip train={leg1} />
        <CoachPositionStrip train={leg2} />
      </div>
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

  return (
    <div className={embedded ? "" : softPanel("rounded-[32px] p-5")}>
      {train && (
        <div className="mb-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/20">
          <div className="text-[11px] font-black uppercase text-slate-400">Current train coach explorer</div>
          <div className="mt-1 text-lg font-black">{trainNumberName(train)}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${availabilityTone(train.availability)}`}>Live seats: {liveSeatText(train)}</span>
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {seatGroups.map((group) => (
            <div key={group.label} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/6">
              <div className="mb-2 text-[11px] font-black uppercase text-slate-400">{group.label}</div>
              <div className={`grid gap-2 ${classType === "1A" ? "grid-cols-2" : classType === "2A" ? "grid-cols-3" : ["CC", "EC"].includes(classType) ? "grid-cols-4" : "grid-cols-4"}`}>
                {group.seats.map((seat) => {
                  const isSelected = selected.includes(seat.id);
                  return (
                    <button key={seat.id} type="button" disabled={seat.state === "booked"} onClick={() => setSelected((items) => items.includes(seat.id) ? items.filter((id) => id !== seat.id) : [...items, seat.id])} className={`h-14 rounded-xl border text-xs font-black transition ${
                      isSelected ? "border-cyan-500 bg-cyan-400 text-slate-950" :
                      seat.state === "available" ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100" :
                      seat.state === "RAC" ? "border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-300/12 dark:text-amber-100" :
                      seat.state === "WL" ? "border-violet-300 bg-violet-100 text-violet-800 dark:bg-violet-300/12 dark:text-violet-100" :
                      "border-slate-200 bg-slate-200 text-slate-400 dark:border-white/10 dark:bg-white/8"
                    }`}>
                      <span className="block">{seat.number}</span>
                      <span>{seat.berth}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LiveTrackingTool() {
  const [trainNo, setTrainNo] = useState("12395");
  const [state, setState] = useState<{ loading: boolean; error: string; data: any | null }>({ loading: false, error: "", data: null });
  async function track() {
    setState({ loading: true, error: "", data: null });
    try {
      setState({ loading: false, error: "", data: await postJson("/api/live", { trainNo, date: todayIso(0) }) });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Live tracking failed.", data: null });
    }
  }
  return (
    <div className={softPanel("mx-auto max-w-7xl rounded-[32px] p-5")}>
      <div className="flex flex-col gap-3 sm:flex-row"><input value={trainNo} onChange={(e) => setTrainNo(e.target.value.replace(/\D/g, "").slice(0, 5))} className="h-13 flex-1 rounded-2xl border border-slate-200 bg-white px-4 font-bold dark:border-white/10 dark:bg-white/8 dark:text-white" /><button onClick={track} className="rounded-2xl bg-slate-950 px-6 font-black text-white dark:bg-white dark:text-slate-950">{state.loading ? "Tracking..." : "Track Live"}</button></div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-3xl bg-slate-50 p-5 dark:bg-black/20"><h3 className="text-2xl font-black">Current station</h3><p className="mt-2 text-slate-500 dark:text-slate-400">Live provider data appears here with graceful fallback.</p><div className="mt-5 text-4xl font-black">On route</div><div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full w-[58%] rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" /></div></div>
        <IndiaMapShowcase source="PNBE" destination="JP" via={["NDLS"]} />
      </div>
      {state.error && <p className="mt-4 font-bold text-rose-600">{state.error}</p>}
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
      <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} className="h-13 flex-1 rounded-2xl border border-slate-200 bg-white px-4 font-bold dark:border-white/10 dark:bg-white/8 dark:text-white" /><button onClick={onAction} className="rounded-2xl bg-slate-950 px-6 font-black text-white dark:bg-white dark:text-slate-950">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : action}</button></div>
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
      {tool === "live" && <section className="px-4 pb-16 sm:px-6"><LiveTrackingTool /></section>}
      {tool === "pnr" && <section className="px-4 pb-16 sm:px-6"><PnrTool /></section>}
      {tool === "fare" && <section className="px-4 pb-16 sm:px-6"><FareTool /></section>}
      {tool === "map" && <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6"><IndiaMapShowcase /></section>}
      {tool === "route" && <section className="px-4 pb-16 sm:px-6"><TrainSearchPanel /></section>}
      {tool === "coach" && <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6"><CoachExplorer /></section>}
    </ProductShell>
  );
}
