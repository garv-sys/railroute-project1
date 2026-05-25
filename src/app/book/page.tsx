"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  IndianRupee,
  Loader2,
  MapPin,
  Radio,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Train,
  Wallet,
} from "lucide-react";

import STATIONS from "../../data/all_stations.json";

type Station = {
  code: string;
  name: string;
};

type ApiState<T> = {
  loading: boolean;
  error: string;
  data: T | null;
};

const stations = STATIONS as Station[];

const CLASSES = [
  { code: "Any", label: "Any class" },
  { code: "SL", label: "Sleeper" },
  { code: "3A", label: "AC 3 Tier" },
  { code: "2A", label: "AC 2 Tier" },
  { code: "1A", label: "First AC" },
  { code: "CC", label: "Chair Car" },
  { code: "EC", label: "Exec. Chair" },
];

const TOOLS = [
  { id: "journey", label: "Trains", icon: Route },
  { id: "pnr", label: "PNR", icon: ShieldCheck },
  { id: "live", label: "Live", icon: Radio },
  { id: "availability", label: "Seats + Fare", icon: Wallet },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

function todayIso(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function stationByCode(code: string) {
  return stations.find((station) => station.code === code.toUpperCase());
}

function stationDisplay(code: string) {
  const station = stationByCode(code);
  return station ? `${station.name} (${station.code})` : code;
}

function scoreStation(station: Station, query: string) {
  const code = station.code.toUpperCase();
  const name = station.name.toUpperCase();
  const q = query.toUpperCase().trim();

  if (!q) return code.length <= 4 ? 20 : 0;
  if (code === q) return 1000;
  if (name === q) return 900;
  if (code.startsWith(q)) return 800 - code.length;
  if (name.startsWith(q)) return 700 - name.length / 10;
  if (code.includes(q)) return 500 - code.indexOf(q);
  if (name.includes(q)) return 400 - name.indexOf(q) / 10;
  return 0;
}

function compactDate(date?: string) {
  if (!date) return todayIso();
  return date;
}

function firstAvailability(train: any, classType: string) {
  const preferred = classType !== "Any" ? classType : train.classType || train.classes?.[0];
  const byClass = train.classAvailability?.[preferred]?.[0];
  return byClass || train.classAvailability?.[train.classType]?.[0] || null;
}

function parseError(data: any, fallback: string) {
  return data?.error || data?.message || data?.data?.message || fallback;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data?.success === false) {
    throw new Error(parseError(data, "Request failed"));
  }
  return data;
}

function LoadingRows({ label }: { label: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
        {label}
      </div>
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-28 animate-pulse rounded-lg border border-slate-200 bg-white shadow-sm" />
      ))}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <Sparkles className="mx-auto mb-3 h-6 w-6 text-teal-600" />
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function StationCombobox({
  label,
  value,
  onChange,
  accent = "teal",
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  accent?: "teal" | "blue";
}) {
  const [query, setQuery] = useState(stationDisplay(value));
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.replace(/\([^)]*\)/g, "").trim();
    return stations
      .map((station) => ({ station, score: scoreStation(station, q) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.station.name.localeCompare(b.station.name))
      .slice(0, 40)
      .map((item) => item.station);
  }, [query]);

  const color = accent === "teal" ? "text-teal-700 bg-teal-50 border-teal-200" : "text-blue-700 bg-blue-50 border-blue-200";

  return (
    <div className="relative">
      <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value.toUpperCase());
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          placeholder="Search station name or code"
          className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
        />
      </div>
      {open && (
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-2xl">
          {matches.length === 0 ? (
            <button
              type="button"
              onMouseDown={() => {
                const code = query.trim().toUpperCase();
                onChange(code);
                setQuery(code);
                setOpen(false);
              }}
              className="w-full rounded-md px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Use station code {query.trim().toUpperCase()}
            </button>
          ) : (
            matches.map((station) => (
              <button
                key={station.code}
                type="button"
                onMouseDown={() => {
                  onChange(station.code);
                  setQuery(stationDisplay(station.code));
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left hover:bg-slate-50"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{station.name}</span>
                <span className={`rounded-md border px-2 py-1 text-xs font-black ${color}`}>{station.code}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TrainCard({ train, classType }: { train: any; classType: string }) {
  const availability = firstAvailability(train, classType);
  const status = availability?.text || train.availability || "Check availability";
  const fare = availability?.fare ? `₹${availability.fare}` : train.fare || "Fare on enquiry";
  const statusTone = String(status).toUpperCase().includes("AVAILABLE")
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : String(status).toUpperCase().includes("WL") || String(status).toUpperCase().includes("RAC")
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-black text-slate-950">{train.trainName || train.train_name}</h3>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">#{train.trainNo}</span>
            {train.trainType && <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{train.trainType}</span>}
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div>
              <div className="text-2xl font-black text-slate-950">{train.departureTime || "--:--"}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{stationDisplay(train.source)}</div>
            </div>
            <div className="flex min-w-24 flex-col items-center text-center">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="mt-1 text-xs font-bold text-slate-500">{train.duration || "N/A"}</span>
              <div className="mt-2 h-px w-full border-t border-dashed border-slate-300" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-slate-950">{train.arrivalTime || "--:--"}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{stationDisplay(train.destination)}</div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-row items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 sm:w-48 sm:flex-col sm:items-start">
          <span className={`rounded-md border px-2 py-1 text-xs font-black ${statusTone}`}>{status}</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Fare</div>
            <div className="text-xl font-black text-slate-950">{fare}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {(train.classes || []).slice(0, 7).map((code: string) => (
          <span key={code} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600">{code}</span>
        ))}
      </div>
    </article>
  );
}

export default function BookPage() {
  const [activeTool, setActiveTool] = useState<ToolId>("journey");

  const [source, setSource] = useState("PNBE");
  const [destination, setDestination] = useState("NDLS");
  const [date, setDate] = useState(todayIso(1));
  const [classType, setClassType] = useState("3A");
  const [journey, setJourney] = useState<ApiState<any[]>>({ loading: false, error: "", data: null });

  const [pnr, setPnr] = useState("");
  const [pnrState, setPnrState] = useState<ApiState<any>>({ loading: false, error: "", data: null });

  const [liveTrain, setLiveTrain] = useState("");
  const [liveDate, setLiveDate] = useState(todayIso());
  const [liveState, setLiveState] = useState<ApiState<any>>({ loading: false, error: "", data: null });

  const [lookupTrain, setLookupTrain] = useState("");
  const [lookupSource, setLookupSource] = useState("PNBE");
  const [lookupDestination, setLookupDestination] = useState("NDLS");
  const [lookupDate, setLookupDate] = useState(todayIso(1));
  const [lookupClass, setLookupClass] = useState("3A");
  const [availabilityState, setAvailabilityState] = useState<ApiState<any>>({ loading: false, error: "", data: null });

  async function handleJourney(event: FormEvent) {
    event.preventDefault();
    setJourney({ loading: true, error: "", data: null });
    try {
      const result = await postJson<{ trains: any[] }>("/api/train-between", {
        source,
        destination,
        date: compactDate(date),
        classType,
      });
      setJourney({ loading: false, error: "", data: result.trains || [] });
    } catch (error) {
      setJourney({ loading: false, error: error instanceof Error ? error.message : "Could not search trains", data: null });
    }
  }

  async function handlePnr(event: FormEvent) {
    event.preventDefault();
    const clean = pnr.replace(/\D/g, "");
    if (clean.length !== 10) {
      setPnrState({ loading: false, error: "Enter a valid 10-digit PNR number.", data: null });
      return;
    }
    setPnrState({ loading: true, error: "", data: null });
    try {
      const result = await postJson<any>("/api/pnr", { pnr: clean });
      setPnrState({ loading: false, error: "", data: result });
    } catch (error) {
      setPnrState({ loading: false, error: error instanceof Error ? error.message : "Could not fetch PNR status", data: null });
    }
  }

  async function handleLive(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{5}$/.test(liveTrain)) {
      setLiveState({ loading: false, error: "Enter a valid 5-digit train number.", data: null });
      return;
    }
    setLiveState({ loading: true, error: "", data: null });
    try {
      const result = await postJson<any>("/api/live", { trainNo: liveTrain, date: liveDate || todayIso() });
      setLiveState({ loading: false, error: "", data: result });
    } catch (error) {
      setLiveState({ loading: false, error: error instanceof Error ? error.message : "Could not fetch live train status", data: null });
    }
  }

  async function handleAvailability(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{5}$/.test(lookupTrain)) {
      setAvailabilityState({ loading: false, error: "Enter a valid 5-digit train number.", data: null });
      return;
    }
    setAvailabilityState({ loading: true, error: "", data: null });
    try {
      const [availability, fare] = await Promise.all([
        postJson<any>("/api/availability", {
          trainNo: lookupTrain,
          source: lookupSource,
          destination: lookupDestination,
          date: lookupDate,
          classType: lookupClass,
        }),
        postJson<any>("/api/fare", {
          trainNo: lookupTrain,
          source: lookupSource,
          destination: lookupDestination,
          date: lookupDate,
          classType: lookupClass,
        }),
      ]);
      setAvailabilityState({ loading: false, error: "", data: { availability, fare } });
    } catch (error) {
      setAvailabilityState({ loading: false, error: error instanceof Error ? error.message : "Could not fetch seat and fare data", data: null });
    }
  }

  const pnrData = pnrState.data?.data || pnrState.data;
  const pnrPassengers = pnrData?.passengers || pnrData?.Passangers || [];
  const liveData = liveState.data?.data || liveState.data;
  const liveTimeline = liveData?.timeline || liveData?.TrainRoute || liveData?.route || [];
  const availabilityData = availabilityState.data?.availability?.data || availabilityState.data?.availability;
  const availabilityList = availabilityData?.availability || availabilityData?.data?.availability || [];
  const fareData = availabilityState.data?.fare?.fareEnquiry?.data || availabilityState.data?.fare?.data || {};

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-slate-950">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-700 text-white shadow-sm">
              <Train className="h-5 w-5" />
            </span>
            <div>
              <div className="text-lg font-black tracking-tight">RailRoute</div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Indian Railways search desk</div>
            </div>
          </Link>
          <div className="flex flex-wrap gap-2">
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTool(id)}
                className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition ${
                  activeTool === id
                    ? "border-teal-700 bg-teal-700 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[380px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {activeTool === "journey" && (
            <form onSubmit={handleJourney} className="space-y-5">
              <div>
                <h1 className="text-2xl font-black tracking-tight">Train Between Stations</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">Search the full station catalog, then fetch live train and availability intelligence.</p>
              </div>
              <StationCombobox label="From" value={source} onChange={setSource} />
              <StationCombobox label="To" value={destination} onChange={setDestination} accent="blue" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Journey Date</label>
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-12 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Class</label>
                  <select value={classType} onChange={(event) => setClassType(event.target.value)} className="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100">
                    {CLASSES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
                  </select>
                </div>
              </div>
              <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-60" disabled={journey.loading}>
                {journey.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search Trains
              </button>
            </form>
          )}

          {activeTool === "pnr" && (
            <form onSubmit={handlePnr} className="space-y-5">
              <div>
                <h1 className="text-2xl font-black tracking-tight">PNR Status</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">Check current passenger booking status and chart information.</p>
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">PNR Number</label>
                <input value={pnr} onChange={(event) => setPnr(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit PNR" className="h-12 w-full rounded-lg border border-slate-200 px-3 text-sm font-black tracking-widest shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
              </div>
              <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-60" disabled={pnrState.loading}>
                {pnrState.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Check PNR
              </button>
            </form>
          )}

          {activeTool === "live" && (
            <form onSubmit={handleLive} className="space-y-5">
              <div>
                <h1 className="text-2xl font-black tracking-tight">Live Train Status</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">Track current train progress, delays, and station timeline.</p>
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Train Number</label>
                <input value={liveTrain} onChange={(event) => setLiveTrain(event.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="5-digit train no." className="h-12 w-full rounded-lg border border-slate-200 px-3 text-sm font-black tracking-widest shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Run Date</label>
                <input type="date" value={liveDate} onChange={(event) => setLiveDate(event.target.value)} className="h-12 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
              </div>
              <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-60" disabled={liveState.loading}>
                {liveState.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                Track Train
              </button>
            </form>
          )}

          {activeTool === "availability" && (
            <form onSubmit={handleAvailability} className="space-y-5">
              <div>
                <h1 className="text-2xl font-black tracking-tight">Seat Availability + Fare</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">Fetch class-wise live seats and fare enquiry for a known train.</p>
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Train Number</label>
                <input value={lookupTrain} onChange={(event) => setLookupTrain(event.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="5-digit train no." className="h-12 w-full rounded-lg border border-slate-200 px-3 text-sm font-black tracking-widest shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
              </div>
              <StationCombobox label="From" value={lookupSource} onChange={setLookupSource} />
              <StationCombobox label="To" value={lookupDestination} onChange={setLookupDestination} accent="blue" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Date</label>
                  <input type="date" value={lookupDate} onChange={(event) => setLookupDate(event.target.value)} className="h-12 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Class</label>
                  <select value={lookupClass} onChange={(event) => setLookupClass(event.target.value)} className="h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100">
                    {CLASSES.filter((item) => item.code !== "Any").map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
                  </select>
                </div>
              </div>
              <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-60" disabled={availabilityState.loading}>
                {availabilityState.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
                Check Seats + Fare
              </button>
            </form>
          )}
        </aside>

        <section className="min-h-[520px] space-y-4">
          {activeTool === "journey" && (
            <>
              {journey.loading && <LoadingRows label="Searching live train data..." />}
              {journey.error && <ErrorBox message={journey.error} />}
              {!journey.loading && !journey.error && !journey.data && (
                <EmptyState title="Ready for a live search" body="Pick stations from the full Indian Railways station catalog and run a train-between-stations search." />
              )}
              {journey.data && journey.data.length === 0 && (
                <EmptyState title="No trains returned" body="Try a nearby cluster station or a different travel date. Some upstream providers restrict availability during outages." />
              )}
              {journey.data && journey.data.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                    <div>
                      <div className="text-sm font-black text-slate-950">{stationDisplay(source)} to {stationDisplay(destination)}</div>
                      <div className="text-xs font-semibold text-slate-500">{journey.data.length} train options for {date}</div>
                    </div>
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">Live API result</span>
                  </div>
                  {journey.data.map((train, index) => <TrainCard key={`${train.trainNo}-${index}`} train={train} classType={classType} />)}
                </div>
              )}
            </>
          )}

          {activeTool === "pnr" && (
            <>
              {pnrState.loading && <LoadingRows label="Checking PNR status..." />}
              {pnrState.error && <ErrorBox message={pnrState.error} />}
              {!pnrState.loading && !pnrState.error && !pnrState.data && (
                <EmptyState title="PNR lookup ready" body="Enter a 10-digit PNR to fetch passenger status, train details, and chart state." />
              )}
              {pnrData && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">PNR</div>
                      <h2 className="mt-1 text-2xl font-black text-slate-950">{pnrData.pnr || pnrData.PnrNumber || pnr}</h2>
                      <p className="mt-2 text-sm font-semibold text-slate-600">{pnrData.train?.name || pnrData.TrainName || "Train details returned by provider"}</p>
                    </div>
                    <span className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-black text-teal-800">{pnrData.status || pnrData.Status || "STATUS"}</span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-4">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">Route</div>
                      <div className="mt-1 font-bold text-slate-900">{pnrData.journey?.from?.code || pnrData.From || "--"} <ArrowRight className="mx-1 inline h-4 w-4" /> {pnrData.journey?.to?.code || pnrData.To || "--"}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-4">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">Journey Date</div>
                      <div className="mt-1 font-bold text-slate-900">{pnrData.journey?.departure || pnrData.JourneyDate || "--"}</div>
                    </div>
                  </div>
                  {Array.isArray(pnrPassengers) && pnrPassengers.length > 0 && (
                    <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
                      {pnrPassengers.map((passenger: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                          <span className="text-sm font-bold text-slate-800">{passenger.name || passenger.Passenger || `Passenger ${index + 1}`}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{passenger.status || passenger.CurrentStatus || "--"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTool === "live" && (
            <>
              {liveState.loading && <LoadingRows label="Fetching live running status..." />}
              {liveState.error && <ErrorBox message={liveState.error} />}
              {!liveState.loading && !liveState.error && !liveState.data && (
                <EmptyState title="Live tracker ready" body="Enter a train number and run date to fetch current position and delay context." />
              )}
              {liveData && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">Current Status</div>
                      <h2 className="mt-1 text-xl font-black text-slate-950">{liveData.statusNote || liveData.CurrentPosition || liveData.Message || "Live data returned"}</h2>
                    </div>
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">Refreshed live</span>
                  </div>
                  {liveData.CurrentStation && (
                    <div className="mt-5 rounded-lg bg-slate-50 p-4">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">Current Station</div>
                      <div className="mt-1 text-lg font-black text-slate-950">{liveData.CurrentStation.StationName} ({liveData.CurrentStation.StationCode})</div>
                      <div className="mt-1 text-sm font-semibold text-slate-600">Arrival delay: {liveData.CurrentStation.DelayInArrival || "--"}</div>
                    </div>
                  )}
                  {Array.isArray(liveTimeline) && liveTimeline.length > 0 && (
                    <div className="mt-5 space-y-2">
                      {liveTimeline.slice(0, 12).map((stop: any, index: number) => (
                        <div key={index} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-xs font-black text-teal-800">{index + 1}</span>
                          <div>
                            <div className="text-sm font-black text-slate-900">{stop.stationName || stop.StationName || stop.stnName || "Station"}</div>
                            <div className="text-xs font-semibold text-slate-500">{stop.stationCode || stop.StationCode || stop.stnCode || "--"}</div>
                          </div>
                          <div className="text-right text-xs font-bold text-slate-600">{stop.delay || stop.DelayInArrival || stop.departure || stop.ScheduleDeparture || "--"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTool === "availability" && (
            <>
              {availabilityState.loading && <LoadingRows label="Checking seats and fare..." />}
              {availabilityState.error && <ErrorBox message={availabilityState.error} />}
              {!availabilityState.loading && !availabilityState.error && !availabilityState.data && (
                <EmptyState title="Seat and fare lookup ready" body="Use a known train number to inspect class availability and fare data for a route." />
              )}
              {availabilityState.data && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <div className="text-xs font-black uppercase tracking-widest text-slate-500">Availability</div>
                        <h2 className="mt-1 text-xl font-black text-slate-950">Train #{lookupTrain} in {lookupClass}</h2>
                      </div>
                      <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{stationDisplay(lookupSource)} to {stationDisplay(lookupDestination)}</span>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {(availabilityList.length ? availabilityList : []).map((item: any, index: number) => (
                        <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs font-black uppercase tracking-widest text-slate-500">{item.date || item.JourneyDate || item.dateStr || lookupDate}</div>
                          <div className="mt-2 text-lg font-black text-slate-950">{item.availabilityText || item.status || item.Availability || "Returned"}</div>
                          {(item.predictionPercentage || item.Confirm) && <div className="mt-1 text-sm font-bold text-emerald-700">{item.predictionPercentage || item.Confirm} confirmation</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <IndianRupee className="h-5 w-5 text-teal-700" />
                      <h3 className="text-lg font-black text-slate-950">Fare Enquiry</h3>
                    </div>
                    {Array.isArray(fareData.fares) && fareData.fares.length > 0 ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {fareData.fares.map((fare: any) => (
                          <div key={fare.Code || fare.Name} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="text-xs font-black uppercase tracking-widest text-slate-500">{fare.Name}</div>
                            <div className="mt-1 text-xl font-black text-slate-950">₹{fare.Fare}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm font-semibold text-slate-600">Fare returned through availability: {availabilityState.data?.fare?.fare || "Not available from provider"}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}
