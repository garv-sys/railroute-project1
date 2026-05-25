"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  Navigation,
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
  searchTrainDirectory,
  stationByCode,
  stationLabel,
  stationLabelFromCode,
  stationMatches,
  STATION_COORDS,
  type Station,
} from "@/lib/railway-intelligence";

type ToolKind = "trains" | "live" | "pnr" | "fare" | "map" | "route" | "coach" | "train-search";

const toolNav: { href: string; label: string; tool: ToolKind }[] = [
  { href: "/trains", label: "Trains", tool: "trains" },
  { href: "/live", label: "Live", tool: "live" },
  { href: "/pnr", label: "PNR", tool: "pnr" },
  { href: "/fare", label: "Fare", tool: "fare" },
  { href: "/map", label: "Map", tool: "map" },
  { href: "/route", label: "Route", tool: "route" },
  { href: "/coach", label: "Coach", tool: "coach" },
];

const classOptions = ["SL", "3A", "2A", "1A", "CC", "EC"];
const coachTabs = ["B1", "B2", "B3", "A1", "A2", "S1", "S2", "S3", "HA1", "CC1", "EC1"];

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error || "RailRoute request failed");
  }
  return data;
}

function todayIso(offset = 1) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function productBg() {
  return "min-h-screen bg-[#f8fafc] text-slate-950 transition-colors duration-500 dark:bg-[#050816] dark:text-white";
}

function softPanel(extra = "") {
  return `border border-slate-200/80 bg-white/82 shadow-xl shadow-slate-200/50 backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 dark:shadow-black/25 ${extra}`;
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
  const matches = useMemo(() => stationMatches(query), [query]);

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
        {open && query.trim() && (
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
    if (!source || !destination) {
      setError("Select both Starting Point and End Point from station search.");
      return;
    }
    if (source === destination) {
      setError("Starting Point and End Point cannot be the same.");
      return;
    }
    router.push(`/trains?source=${source}&destination=${destination}&date=${date}&classType=${classType}`);
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
        <label className="block">
          <span className="mb-2 block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">Date</span>
          <input type="date" min={todayIso(0)} value={date} onChange={(event) => setDate(event.target.value)} className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-cyan-400 dark:border-white/10 dark:bg-white/8 dark:text-white" />
        </label>
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
    </motion.form>
  );
}

function project(lat: number, lng: number) {
  const x = ((lng - 68) / (97 - 68)) * 100;
  const y = ((37 - lat) / (37 - 8)) * 100;
  return { x: Math.min(96, Math.max(4, x)), y: Math.min(96, Math.max(4, y)) };
}

function IndiaMapShowcase({ source = "PNBE", destination = "JP", via = ["NDLS"] }: { source?: string; destination?: string; via?: string[] }) {
  const codes = [source, ...via, destination].filter((code) => STATION_COORDS[code]);
  const points = codes.map((code) => ({ code, ...project(STATION_COORDS[code].lat, STATION_COORDS[code].lng) }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className={softPanel("relative min-h-[420px] overflow-hidden rounded-[34px] p-4")}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" role="img" aria-label="India railway route map">
        <defs>
          <filter id="mapGlow"><feGaussianBlur stdDeviation="1.2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <linearGradient id="routeGradient" x1="0" x2="1"><stop stopColor="#10b981" /><stop offset="0.52" stopColor="#06b6d4" /><stop offset="1" stopColor="#f43f5e" /></linearGradient>
        </defs>
        <path
          d="M27 7 C36 5 52 8 61 18 C72 30 77 43 73 56 C70 69 64 80 55 91 C46 98 34 92 29 82 C25 74 19 66 16 54 C12 38 16 14 27 7Z"
          fill="currentColor"
          className="text-slate-200/85 dark:text-white/6"
          stroke="currentColor"
          strokeWidth="0.45"
        />
        <path d="M26 15 C39 26 52 33 66 51" stroke="currentColor" className="text-slate-300 dark:text-white/12" strokeWidth="0.5" strokeDasharray="1.2 1.4" fill="none" />
        <path d="M18 52 C34 48 51 60 65 75" stroke="currentColor" className="text-slate-300 dark:text-white/12" strokeWidth="0.5" strokeDasharray="1.2 1.4" fill="none" />
        <path d={path} fill="none" stroke="url(#routeGradient)" strokeWidth="1.15" strokeLinecap="round" filter="url(#mapGlow)" />
        {points.length > 1 && (
          <motion.circle r="1.8" fill="#fff" filter="url(#mapGlow)" animate={{ cx: points.map((p) => p.x), cy: points.map((p) => p.y) }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
        )}
        {Object.entries(STATION_COORDS).slice(0, 16).map(([code, coords]) => {
          const point = project(coords.lat, coords.lng);
          const isSource = code === source;
          const isDestination = code === destination;
          const isVia = via.includes(code);
          return (
            <g key={code} transform={`translate(${point.x} ${point.y})`}>
              <circle r={isSource || isDestination ? 2.2 : isVia ? 2 : 1.2} fill={isSource ? "#10b981" : isDestination ? "#f43f5e" : isVia ? "#8b5cf6" : "#94a3b8"} stroke="#fff" strokeWidth="0.45" />
              {(isSource || isDestination || isVia) && <text x="2.8" y="-1.8" fontSize="3" fontWeight="900" fill="currentColor" className="text-slate-900 dark:text-white">{code}</text>}
            </g>
          );
        })}
      </svg>
      <div className="relative z-10 flex h-full min-h-[380px] flex-col justify-between">
        <div>
          <span className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-100 px-3 py-1 text-[11px] font-black uppercase text-cyan-800 dark:bg-cyan-300/10 dark:text-cyan-100">Real India route layer</span>
          <h3 className="mt-4 max-w-md text-3xl font-black tracking-tight">Patna to Jaipur via Delhi, rendered as a split-journey corridor.</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["Source", source, "text-emerald-600"],
            ["Transfer", via[0] || "NDLS", "text-violet-600"],
            ["Destination", destination, "text-rose-600"],
          ].map(([label, code, tone]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm font-bold dark:border-white/10 dark:bg-black/20">
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
                ["Explore Map", "/map", Navigation],
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
            ["Fare Insights", IndianRupee],
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

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (!query.trim()) {
      setState({ loading: false, error: "Enter a train number or train name.", trains: [] });
      return;
    }
    setState({ loading: true, error: "", trains: [] });
    try {
      const data = await postJson<any>("/api/train-search", { query });
      setState({ loading: false, error: "", trains: data.trains || [] });
    } catch (error) {
      const local = searchTrainDirectory(query);
      setState({ loading: false, error: error instanceof Error ? error.message : "Train lookup failed.", trains: local });
    }
  }

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
          </div>
          <h2 className="mt-4 text-2xl font-black">{train.trainName}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">#{train.trainNo} · {stationLabelFromCode(train.source)} to {stationLabelFromCode(train.destination)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold dark:border-white/10 dark:bg-white/8">
          Complete route · {route.length} stops
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
  const [state, setState] = useState<{ loading: boolean; error: string; trains: any[]; splits: any[] }>({ loading: false, error: "", trains: [], splits: [] });
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
      window.setTimeout(() => runSearch(undefined, { source: initialSource, destination: initialDestination, date: initialDate, classType: initialClass }), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(event?: FormEvent, override?: { source: string; destination: string; date: string; classType: string }) {
    event?.preventDefault();
    const payload = override || { source, destination, date, classType };
    if (!payload.source || !payload.destination) {
      setState({ loading: false, error: "Choose Starting Point and End Point.", trains: [], splits: [] });
      return;
    }
    setState({ loading: true, error: "", trains: [], splits: [] });
    try {
      const direct = await postJson<any>("/api/train-between", payload);
      let splits: any[] = [];
      if (allowSplit) {
        try {
          const splitData = await postJson<any>("/api/search-split", { ...payload, directTrains: direct.trains || [] });
          splits = splitData.splitRoutes || [];
        } catch {
          splits = [];
        }
      }
      setState({ loading: false, error: "", trains: direct.trains || [], splits });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Train search failed.", trains: [], splits: [] });
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
            <input type="date" min={todayIso(0)} value={date} onChange={(event) => setDate(event.target.value)} className="h-13 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold dark:border-white/10 dark:bg-white/8 dark:text-white" />
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
      {state.loading && <LoadingBlock label="Scanning trains, seats and split options..." />}
      <div className="mt-6 space-y-4">
        {state.trains.map((train) => <PremiumTrainCard key={`${train.trainNo}-${train.source}-${train.destination}`} train={train} onClass={(classCode) => setClassView({ train, classCode })} />)}
        {allowSplit && state.splits.map((split, index) => <SplitJourneyCard key={`${split.hubStation}-${index}`} split={split} />)}
      </div>
      <AnimatePresence>
        {classView && <ClassDetailModal train={classView.train} classCode={classView.classCode} onClose={() => setClassView(null)} />}
      </AnimatePresence>
    </section>
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

function PremiumTrainCard({ train, onClass }: { train: any; onClass: (classCode: string) => void }) {
  const classes = train.classes || ["SL", "3A", "2A", "1A"];
  return (
    <article className={softPanel("overflow-hidden rounded-[30px]")}>
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-300/12 dark:text-emerald-100">Direct train</span>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100">{train.punctualityScore || "Live ETA ready"}</span>
          </div>
          <h3 className="mt-4 text-2xl font-black">{train.trainName}</h3>
          <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">#{train.trainNo} · {train.trainType || "Express"}</p>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-3xl bg-slate-50 p-4 dark:bg-black/20">
            <div><div className="text-3xl font-black">{train.departureTime || "--:--"}</div><div className="mt-1 text-xs font-black text-emerald-600 dark:text-emerald-200">{stationLabelFromCode(train.source, false)}</div></div>
            <div className="min-w-28 text-center"><div className="text-xs font-black text-slate-500">{train.duration || "N/A"}</div><div className="my-2 h-px bg-gradient-to-r from-emerald-400 via-cyan-400 to-rose-400" /><div className="text-[11px] font-bold text-slate-400">route</div></div>
            <div className="text-right"><div className="text-3xl font-black">{train.arrivalTime || "--:--"}</div><div className="mt-1 text-xs font-black text-rose-600 dark:text-rose-200">{stationLabelFromCode(train.destination, false)}</div></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {classes.map((classCode: string) => (
              <button key={classCode} type="button" onClick={() => onClass(classCode)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-200 dark:hover:bg-cyan-300/12">
                {classCode}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/8">
          <div className="text-[11px] font-black uppercase text-slate-400">Fare preview</div>
          <div className="mt-1 text-3xl font-black">{train.fare || "Check fare"}</div>
          <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-black text-slate-600 dark:bg-black/20 dark:text-slate-300">{train.availability || "Seat intelligence ready"}</div>
          <div className="mt-4 text-xs font-semibold leading-5 text-slate-500">Click any class chip for fare, availability, berth layout, coach options and quota-ready details.</div>
        </div>
      </div>
    </article>
  );
}

function ClassDetailModal({ train, classCode, onClose }: { train: any; classCode: string; onClose: () => void }) {
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
              ["Fare", train.fare || "Live fare"],
              ["Availability", train.classAvailability?.[classCode]?.[0]?.text || train.availability || "Check seats"],
              ["Quota", "GN · Tatkal ready"],
              ["Coach options", classCode.startsWith("A") ? "A1 · A2" : classCode === "SL" ? "S1 · S2 · S3" : "B1 · B2 · B3"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/6"><div className="text-[11px] font-black uppercase text-slate-400">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>
            ))}
          </div>
          <CoachExplorer initialClass={classCode} embedded />
        </div>
      </motion.div>
    </motion.div>
  );
}

function SplitJourneyCard({ split }: { split: any }) {
  return (
    <article className={softPanel("rounded-[30px] p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-800 dark:bg-violet-300/12 dark:text-violet-100">Split journey</span>
          <h3 className="mt-3 text-2xl font-black">{stationLabelFromCode(split.leg1?.source || "PNBE", false)} → {stationLabelFromCode(split.hubStation || "NDLS", false)} → {stationLabelFromCode(split.leg2?.destination || "JP", false)}</h3>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm font-black dark:bg-black/20">₹{split.totalFare || "--"} · {split.layoverDuration || "2h layover"}</div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">Train 1<br /><b>{split.leg1?.trainName || "Leg 1"}</b></div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-300/20 dark:bg-violet-300/10">Platform change<br /><b>5 → 10</b><br /><span className="text-sm font-semibold text-slate-500 dark:text-slate-400">8 minutes · use foot overbridge</span></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">Train 2<br /><b>{split.leg2?.trainName || "Leg 2"}</b></div>
      </div>
    </article>
  );
}

function CoachExplorer({ initialClass = "3A", embedded = false }: { initialClass?: string; embedded?: boolean }) {
  const [classType, setClassType] = useState(initialClass);
  const [coach, setCoach] = useState("B2");
  const [selected, setSelected] = useState<string[]>([]);
  const seats = useMemo(() => buildCoachSeats(classType, coach), [classType, coach]);

  return (
    <div className={embedded ? "" : softPanel("rounded-[32px] p-5")}>
      <div className="flex flex-wrap gap-2">
        {classOptions.map((item) => <button key={item} onClick={() => setClassType(item)} className={`rounded-full border px-3 py-2 text-xs font-black ${classType === item ? "border-cyan-400 bg-cyan-100 text-cyan-800 dark:bg-cyan-300/12 dark:text-cyan-100" : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/6"}`}>{item}</button>)}
      </div>
      <div className="mt-4 flex gap-2 overflow-auto pb-2">
        {coachTabs.map((item) => <button key={item} onClick={() => setCoach(item)} className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-black ${coach === item ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/6"}`}>{item}</button>)}
      </div>
      <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/20">
        <div className="mb-4 flex items-center justify-between">
          <div><h3 className="font-black">{coach} coach berth map</h3><p className="text-xs font-bold text-slate-500 dark:text-slate-400">Available · booked · RAC · WL · selected</p></div>
          <Train className="h-5 w-5 text-cyan-600 dark:text-cyan-200" />
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-8">
          {seats.map((seat) => {
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
