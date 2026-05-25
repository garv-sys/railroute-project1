"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  IndianRupee,
  MapPin,
  Radio,
  Route,
  Search,
  ShieldCheck,
  Train,
  Wallet,
} from "lucide-react";

import { GoogleMapView } from "@/components/google-map";

const CAPABILITIES = [
  { label: "PNR status", icon: ShieldCheck, tone: "text-teal-700 bg-teal-50 border-teal-200" },
  { label: "Live train status", icon: Radio, tone: "text-blue-700 bg-blue-50 border-blue-200" },
  { label: "Seat availability", icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { label: "Fare enquiry", icon: IndianRupee, tone: "text-amber-700 bg-amber-50 border-amber-200" },
];

const ROUTES = [
  { from: "PNBE", to: "NDLS", train: "Rajdhani Express", time: "12h 15m", fare: "₹1,320", status: "AVL 42" },
  { from: "HWH", to: "NJP", train: "Darjeeling Mail", time: "10h 05m", fare: "₹870", status: "RAC 8" },
  { from: "NDLS", to: "KLK", train: "Shatabdi Express", time: "4h 00m", fare: "₹795", status: "AVL 18" },
];

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-slate-950">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <button onClick={() => router.push("/")} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-700 text-white shadow-sm">
              <Train className="h-5 w-5" />
            </span>
            <span className="text-lg font-black tracking-tight">RailRoute</span>
          </button>
          <div className="hidden items-center gap-1 md:flex">
            {["Trains", "PNR", "Live", "Seats", "Fare"].map((item) => (
              <button
                key={item}
                onClick={() => router.push("/book")}
                className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {item}
              </button>
            ))}
          </div>
          <button
            onClick={() => router.push("/book")}
            className="flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-teal-800"
          >
            Open Search
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </nav>

      <section className="relative min-h-[76vh] overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0">
          <GoogleMapView interactive={false} showLabels={false} overlayGradient className="h-full w-full" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(247,248,244,0.96)_0%,rgba(247,248,244,0.84)_42%,rgba(247,248,244,0.36)_100%)]" />

        <div className="relative z-10 mx-auto grid min-h-[76vh] max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-3xl"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-teal-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              IRCTC-compatible live railway intelligence
            </div>
            <h1 className="text-5xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
              RailRoute
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-700 sm:text-xl">
              Search trains between any Indian Railways stations, check PNR status, track live running, compare seats, and verify fares from one fast workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => router.push("/book")}
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-teal-700 px-6 text-sm font-black text-white shadow-lg shadow-teal-900/10 transition hover:bg-teal-800"
              >
                <Search className="h-4 w-4" />
                Start Live Search
              </button>
              <button
                onClick={() => router.push("/book")}
                className="flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white/80 px-6 text-sm font-black text-slate-900 shadow-sm transition hover:border-slate-500"
              >
                <Route className="h-4 w-4" />
                Train Between Stations
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="rounded-lg border border-slate-200 bg-white/95 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-500">Today&apos;s Desk</div>
                <div className="mt-1 text-lg font-black text-slate-950">Fast railway checks</div>
              </div>
              <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-800">LIVE</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {CAPABILITIES.map(({ label, icon: Icon, tone }) => (
                <button
                  key={label}
                  onClick={() => router.push("/book")}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm font-black transition hover:-translate-y-0.5 ${tone}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {ROUTES.map((route) => (
                <button
                  key={`${route.from}-${route.to}`}
                  onClick={() => router.push("/book")}
                  className="grid w-full grid-cols-[1fr_auto] gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-teal-300 hover:bg-white"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                      <span>{route.from}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      <span>{route.to}</span>
                    </div>
                    <div className="mt-1 truncate text-xs font-bold text-slate-500">{route.train}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-slate-950">{route.status}</div>
                    <div className="mt-1 text-xs font-bold text-slate-500">{route.fare}</div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 md:grid-cols-3">
        {[
          { icon: MapPin, title: "Complete station search", body: "8,990 stations ranked by exact code, prefix, and station-name matches." },
          { icon: Wallet, title: "Seats and fares together", body: "Availability and fare enquiry stay linked to train, route, class, quota, and date." },
          { icon: Clock, title: "Live-first responses", body: "Primary IRCTC-compatible calls with optional IndianRailAPI fallback for supported endpoints." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <Icon className="h-5 w-5 text-teal-700" />
            <h2 className="mt-4 text-lg font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
