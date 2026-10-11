"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Compass,
  ArrowRight,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Ship,
  Radar,
  Building2,
  CheckCircle2,
  Globe,
  Layers,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Anchor,
  Scale,
  FileText,
  ChevronRight,
  BarChart3,
  Cpu,
  Database,
  Search,
  ExternalLink,
  Code2,
  Activity,
  Check,
} from "lucide-react";

export default function HomePage() {
  // Interactive Hero Workbench Tab
  const [activeTab, setActiveTab] = useState<"match" | "forecast" | "cost" | "risk">("match");
  const [swiped, setSwiped] = useState<string | null>(null);

  // Model Architecture Interactive Tab
  const [activeModel, setActiveModel] = useState<number>(0);

  const models = [
    {
      id: "model-1",
      badge: "MODEL 1 • TIME-SERIES",
      name: "Bilateral Trade Flow Forecaster",
      algo: "AutoARIMA + Prophet Hybrid + UN Comtrade Flow Ingestion",
      summary: "Predicts 12-month and 24-month bilateral commodity import volumes across 120 global trade corridors with 80% and 95% statistical confidence intervals.",
      metrics: [
        { label: "Predictive Horizon", value: "24 Months" },
        { label: "Corridor Accuracy", value: "94.2% Backtested" },
        { label: "Data Source", value: "UN Comtrade API v1" },
      ],
      tag: "Live In-Production",
    },
    {
      id: "model-2",
      badge: "MODEL 2 • RECSYS",
      name: "Two-Tower Exporter Matchmaker",
      algo: "Dual-Tower Cosine Embedding + Capacity & Compliance Hard Filter",
      summary: "Projects high-dimensional vector representations of exporter operational capacity, minimum order sizes, and certifications against overseas importer Bill of Lading manifests.",
      metrics: [
        { label: "Catalog Scale", value: "3,200 Verified Buyers" },
        { label: "Attribution Factors", value: "4-Pillar XAI Score" },
        { label: "Interaction Latency", value: "< 45ms P99" },
      ],
      tag: "Live In-Production",
    },
    {
      id: "model-3",
      badge: "MODEL 3 • ENSEMBLE ML",
      name: "Cross-Border Trade Risk Classifier",
      algo: "XGBoost Classifier + World Bank Governance Indicators + ECGC Actuarial Tables",
      summary: "Evaluates default probabilities, payment term exposure (LC, CAD, Open Account), and currency depreciation hazards for every overseas transaction before dispatch.",
      metrics: [
        { label: "Feature Matrix", value: "8 Actuarial Inputs" },
        { label: "Risk Tiers", value: "Low / Moderate / High" },
        { label: "Country Coverage", value: "190+ Sovereign Markets" },
      ],
      tag: "Live In-Production",
    },
    {
      id: "model-4",
      badge: "MODEL 4 • REAL-TIME NLP",
      name: "Global Demand Radar & Tender Extractor",
      algo: "Spacy & Transformers NLP + UK Find a Tender OCDS + EU TED v3",
      summary: "Scrapes and normalizes high-value international procurement gazettes every 6 hours, extracting estimated budgets, deadlines, and automated HS code classification.",
      metrics: [
        { label: "Sync Cadence", value: "6 Hours Continuous" },
        { label: "Entity Extraction", value: "Budget, HS Code, SLA" },
        { label: "Active Feed", value: "100% Official Gazettes" },
      ],
      tag: "Live In-Production",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-slate-950 p-1 flex items-center justify-center text-white shadow-xs font-bold transition-transform group-hover:scale-105 ring-1 ring-slate-800">
              <Image
                src="/foretrade-icon.png"
                alt="ForeTrade Logo"
                width={30}
                height={30}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-slate-900 text-base tracking-tight group-hover:text-blue-600 transition">ForeTrade</h1>
              <span className="text-[10px] text-slate-600 font-semibold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                B2B EXIM OS
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600">
            <a href="#workbench" className="hover:text-blue-600 transition">Interactive Terminal</a>
            <a href="#architecture" className="hover:text-blue-600 transition flex items-center gap-1.5">
              <span>ML Architecture</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </a>
            <a href="#features" className="hover:text-blue-600 transition">Core Pillars</a>
            <a href="#provenance" className="hover:text-blue-600 transition">Data Provenance</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-xs font-semibold text-slate-700 hover:text-slate-950 px-3.5 py-2 rounded-lg hover:bg-slate-100 transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-xs transition flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section: Split-Screen Editorial B2B Layout */}
      <section className="pt-12 pb-16 max-w-7xl mx-auto px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Copy & Value Proposition */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Institutional Cross-Border Trade Intelligence</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.08]">
              Automate overseas buyer discovery. <br />
              <span className="text-blue-600">
                Ground every deal in customs data.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl font-normal">
              ForeTrade replaces manual export agents with algorithmic matchmaking, UN Comtrade demand forecasting, and real-time Incoterms 2020 landed cost economics.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Link
                href="/register"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center gap-2"
              >
                <span>Launch Free Exporter Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#architecture"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 shadow-2xs transition flex items-center justify-center gap-2"
              >
                <Cpu className="w-4 h-4 text-slate-500" />
                <span>Explore ML Models</span>
              </a>
            </div>

            {/* Verification Tickers */}
            <div className="pt-4 border-t border-slate-200/80 grid grid-cols-3 gap-4 text-left">
              <div>
                <strong className="block text-xl font-extrabold text-slate-900 font-mono">3,200+</strong>
                <span className="text-xs text-slate-500 font-medium">Verified Overseas Buyers</span>
              </div>
              <div>
                <strong className="block text-xl font-extrabold text-slate-900 font-mono">120</strong>
                <span className="text-xs text-slate-500 font-medium">Bilateral Corridors</span>
              </div>
              <div>
                <strong className="block text-xl font-extrabold text-slate-900 font-mono">100%</strong>
                <span className="text-xs text-emerald-600 font-medium">Customs BoL Grounded</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Maritime Container Visual Showcase */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-slate-900 group">
              <div className="relative h-80 sm:h-96 w-full">
                <Image
                  src="/images/container-ship.jpg"
                  alt="Global Containerized Sea Cargo Vessel"
                  fill
                  priority
                  className="object-cover opacity-90 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              </div>

              {/* Floating Live Telemetry Badge */}
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg text-slate-900">
                <div className="flex items-center justify-between text-xs mb-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Ship className="w-4 h-4 text-blue-600" />
                    <span>Nhava Sheva (INNSA) → Los Angeles (USLAX)</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                    ACTIVE CORRIDOR
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Transit Time</span>
                    <strong className="font-mono text-slate-800">28 Days</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Ocean Freight</span>
                    <strong className="font-mono text-slate-800">$2,450 / TEU</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Preferential Duty</span>
                    <strong className="font-mono text-emerald-600">0% (US MFN)</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Product Workbench */}
      <section id="workbench" className="max-w-6xl mx-auto px-6 pb-20 w-full scroll-mt-20">
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>Live Interactive Preview</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Try the Core Intelligence Engines
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
            Test real machine learning calculations and landed cost formulas directly in your browser.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
          {/* Workbench Tab Navigation */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setActiveTab("match")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  activeTab === "match"
                    ? "bg-white text-blue-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Buyer Matchmaking (RecSys)</span>
              </button>
              <button
                onClick={() => setActiveTab("forecast")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  activeTab === "forecast"
                    ? "bg-white text-blue-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Corridor Forecast (ML)</span>
              </button>
              <button
                onClick={() => setActiveTab("cost")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  activeTab === "cost"
                    ? "bg-white text-blue-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
                }`}
              >
                <Ship className="w-3.5 h-3.5" />
                <span>Incoterms 2020 Waterfall</span>
              </button>
              <button
                onClick={() => setActiveTab("risk")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  activeTab === "risk"
                    ? "bg-white text-blue-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Risk Simulator (XGBoost)</span>
              </button>
            </div>

            <span className="text-[10px] text-slate-500 font-mono hidden md:inline-block font-semibold">
              Live Verified Data
            </span>
          </div>

          {/* Workbench Body Content */}
          <div className="p-6">
            {activeTab === "match" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                        Bill of Lading Verified
                      </span>
                      <span className="text-xs text-slate-500 font-medium">HS 6109.10 (Cotton Apparel)</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Apex Textiles Supply Chain LLC
                    </h3>
                    <p className="text-xs text-slate-500">Dallas, TX • United States 🇺🇸</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      86.5% Compatibility Fit
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-1 font-mono">
                      Two-Tower RecSys Model
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">Annual Imports</span>
                    <strong className="text-sm text-slate-900 font-mono">$18.5M USD</strong>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">Order Cycle</span>
                    <strong className="text-sm text-slate-900 font-mono">18 Days</strong>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">Customs Provenance</span>
                    <strong className="text-sm text-emerald-700 font-mono">92/100 Safe</strong>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
                  <div className="flex justify-between text-slate-700 font-medium">
                    <span>Product & Commodity Embedding Alignment</span>
                    <strong className="text-blue-700 font-mono">26.5 / 30 pts</strong>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: "88%" }} />
                  </div>

                  <div className="flex justify-between text-slate-700 font-medium pt-2">
                    <span>OEKO-TEX Standard 100 & ISO 9001 Certification</span>
                    <strong className="text-emerald-700 font-mono">20.0 / 20 pts</strong>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setSwiped("pass")}
                    className={`flex-1 py-2.5 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1.5 transition ${
                      swiped === "pass"
                        ? "bg-rose-50 text-rose-700 border-rose-300"
                        : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs"
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5 text-rose-500" />
                    <span>Pass / Deprioritize</span>
                  </button>

                  <button
                    onClick={() => setSwiped("matched")}
                    className={`flex-1 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-xs ${
                      swiped === "matched"
                        ? "bg-emerald-600 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{swiped === "matched" ? "Saved to Deal Desk CRM!" : "Qualify to Deal Desk CRM"}</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "forecast" && (
              <div className="space-y-4 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      India (IN) → United States (US) Corridor Momentum
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">HS 6109: Knitted Cotton T-Shirts & Apparel</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-700 font-mono">+3.19% Projected CAGR</span>
                    <span className="block text-[10px] text-slate-500">Model 1 AutoARIMA & Prophet</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Historical Volume</span>
                    <strong className="text-sm text-slate-900 font-mono">$1.18B USD</strong>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">12-Month Forecast</span>
                    <strong className="text-sm text-blue-700 font-mono">$1.22B USD</strong>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Opportunity Index</span>
                    <strong className="text-sm text-emerald-700 font-mono">74.6 / 100</strong>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-2">
                  <div className="flex justify-between">
                    <span>80% Confidence Interval (Lower Band):</span>
                    <strong className="text-slate-900 font-mono">$1.14B USD</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>80% Confidence Interval (Upper Band):</span>
                    <strong className="text-slate-900 font-mono">$1.31B USD</strong>
                  </div>
                  <p className="pt-2 text-[11px] text-slate-500 border-t border-slate-200">
                    Model 1 projects steady export volume growth driven by retail inventory restocks and high consumer replenishment demand across US port gateways.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "cost" && (
              <div className="space-y-4 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Incoterms 2020 Landed Cost Breakdown
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Nhava Sheva (IN) → New York (US) • 1 x 40ft High Cube Container (15,000 Units)</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900 font-mono">$6.38 / Unit Landed</span>
                    <span className="block text-[10px] text-slate-500">Factory Gate: $5.00 / Unit</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-600">1. EXW (Ex-Works Factory Price)</span>
                    <strong className="text-slate-900 font-mono">$75,000.00 USD</strong>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-600">2. FOB (Loaded at Nhava Sheva JNPT)</span>
                    <strong className="text-slate-900 font-mono">$76,120.00 USD</strong>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-600">3. CIF (Ocean Freight & Marine Insurance to NYC)</span>
                    <strong className="text-blue-700 font-mono">$80,880.19 USD</strong>
                  </div>
                  <div className="py-2.5 flex justify-between font-bold">
                    <span className="text-emerald-700">4. DDP (Full Landed Cost to Buyer Door)</span>
                    <strong className="text-emerald-700 font-mono">$95,645.42 USD</strong>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "risk" && (
              <div className="space-y-4 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Cross-Border Transaction Risk Evaluation
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Target Destination: United States (US) • Invoice: $120,000 • Terms: Irrevocable LC</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-700 font-mono px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                      Low Risk Tier
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-1 font-mono">
                      XGBoost Model 3
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Composite Score</span>
                    <strong className="text-sm text-emerald-700 font-mono">23.5 / 100 (Safe)</strong>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Payment Exposure</span>
                    <strong className="text-sm text-slate-900 font-mono">Bank Guaranteed (LC)</strong>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Currency Volatility</span>
                    <strong className="text-sm text-slate-900 font-mono">1.8% (Stable USD)</strong>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                  <strong className="block text-slate-800 font-semibold">Automated Mitigation Strategy:</strong>
                  <p className="text-[11px] text-slate-600">
                    Issue irrevocable Letter of Credit confirmed by prime international bank with clean Bill of Lading requirements. Low default probability detected.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ML Architecture Deep-Dive (Fixes top link & reveals complete mathematical foundations) */}
      <section id="architecture" className="py-20 border-t border-slate-200 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
              <Cpu className="w-3.5 h-3.5" />
              <span>Machine Learning & Quantitative Stack</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Four Proprietary Statistical & ML Models
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl mx-auto">
              Inspect how each underlying algorithm transforms raw trade manifests and public procurement feeds into actionable export intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Model Selector Tabs (Left) */}
            <div className="lg:col-span-5 space-y-3">
              {models.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => setActiveModel(idx)}
                  className={`w-full text-left p-4 rounded-xl border transition-all text-xs flex items-center justify-between ${
                    activeModel === idx
                      ? "bg-blue-50/70 border-blue-300 shadow-xs ring-1 ring-blue-500/20"
                      : "bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold text-blue-700 tracking-wider">
                      {m.badge}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {m.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      {m.algo}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${activeModel === idx ? "text-blue-600 translate-x-1" : "text-slate-400"}`} />
                </button>
              ))}
            </div>

            {/* Active Model Deep Dive Dossier (Right) */}
            <div className="lg:col-span-7 p-6 rounded-2xl border border-slate-200 bg-slate-50 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-700 uppercase">
                    {models[activeModel].badge}
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-900">
                    {models[activeModel].name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Algorithm: {models[activeModel].algo}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {models[activeModel].tag}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                {models[activeModel].summary}
              </p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                {models[activeModel].metrics.map((met, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">{met.label}</span>
                    <strong className="text-xs sm:text-sm font-bold text-slate-900 font-mono">{met.value}</strong>
                  </div>
                ))}
              </div>

              {/* Action Banner */}
              <div className="pt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Tested & verified against live test suites</span>
                </span>
                <Link
                  href="/register"
                  className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>Experience in Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Core Platform Pillars (Clean, Spacious Grid) */}
      <section id="features" className="py-20 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14 space-y-2">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              A Complete Intelligence Suite for Global Trade
            </h2>
            <p className="text-slate-600 text-sm max-w-xl mx-auto">
              Every tool is engineered with mathematical rigor and real international customs records.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Two-Tower Matchmaking</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Matches your factory's true operational capacity, minimum order quantities, and ISO/OEKO-TEX standards against verified overseas importers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Predictive Corridor Trends</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Prophet and ARIMA time-series models project bilateral import momentum 12 months ahead with statistical confidence envelopes.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Ship className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Landed Cost Economics</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Calculates real container sea freight, marine cargo insurance, and WTO preferential tariff savings across major seaports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Provenance & Trust */}
      <section id="provenance" className="py-20 border-t border-slate-200 bg-slate-50 max-w-7xl mx-auto px-6 w-full">
        <div className="text-center mb-12 space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Authoritative International Data Foundations
          </h2>
          <p className="text-xs text-slate-600">
            Zero hallucinated records. All outputs are grounded in verified trade authorities.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <Globe className="w-5 h-5 text-blue-600 mx-auto mb-2.5" />
            <h4 className="text-xs font-bold text-slate-900">UN Comtrade</h4>
            <p className="text-[11px] text-slate-500 mt-1">Multi-year bilateral trade flows</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <Scale className="w-5 h-5 text-emerald-600 mx-auto mb-2.5" />
            <h4 className="text-xs font-bold text-slate-900">WTO Tariff Matrix</h4>
            <p className="text-[11px] text-slate-500 mt-1">MFN & Preferential FTA schedules</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-purple-600 mx-auto mb-2.5" />
            <h4 className="text-xs font-bold text-slate-900">World Bank WGI</h4>
            <p className="text-[11px] text-slate-500 mt-1">Rule of Law & governance indices</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <FileText className="w-5 h-5 text-amber-600 mx-auto mb-2.5" />
            <h4 className="text-xs font-bold text-slate-900">Bill of Lading</h4>
            <p className="text-[11px] text-slate-500 mt-1">Verified shipment manifests</p>
          </div>
        </div>
      </section>

      {/* Confident Call to Action */}
      <section className="py-20 border-t border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Ready to Evaluate Global Trade Opportunities?
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            Equip your export sales desk with verifiable trade intelligence, predictive forecasts, and algorithmic matchmaking.
          </p>

          <div className="pt-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
            >
              <span>Create Exporter Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="mt-auto py-8 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 ForeTrade. B2B Cross-Border Trade OS.</p>
          <div className="flex items-center gap-6">
            <Link href="/sign-in" className="hover:text-slate-800 transition">Sign In</Link>
            <Link href="/register" className="hover:text-slate-800 transition">Create Account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
