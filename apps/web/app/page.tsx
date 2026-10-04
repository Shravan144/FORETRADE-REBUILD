"use client";

import { useState } from "react";
import Link from "next/link";
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
} from "lucide-react";

export default function HomePage() {
  // Interactive Hero Workbench Tab
  const [activeTab, setActiveTab] = useState<"match" | "forecast" | "cost">("match");
  const [swiped, setSwiped] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-white/[0.08] bg-[#0b0f19]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold">
              <Compass className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-white text-base tracking-tight">ForeTrade</h1>
              <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08]">
                B2B EXIM OS
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition">Platform</a>
            <a href="#provenance" className="hover:text-white transition">Data Provenance</a>
            <a href="#architecture" className="hover:text-white transition">ML Models</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-xs font-medium text-slate-300 hover:text-white px-3.5 py-2 rounded-lg hover:bg-white/[0.05] transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 sm:py-28 max-w-5xl mx-auto px-6 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800/60 text-blue-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Cross-Border Trade Intelligence Platform</span>
        </div>

        <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
          Global Trade Intelligence. <br />
          <span className="text-blue-500">
            Engineered for Serious Exporters.
          </span>
        </h2>

        <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto font-normal">
          Connect verified overseas buyers, project 12-month UN Comtrade demand momentum, and compute real-time Incoterms 2020 landed cost waterfalls without blind broker commissions.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/sign-in"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition flex items-center justify-center gap-2"
          >
            <span>Launch Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/register"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-slate-200 font-semibold text-xs border border-white/[0.1] transition flex items-center justify-center"
          >
            <span>Create Account</span>
          </Link>
        </div>

        {/* Global Scale Indicators */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            12,000+ Trade Corridors
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            $4.2B+ Ingested UN Comtrade Data
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            220+ Destination Markets
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            100% Auditable Customs Data
          </span>
        </div>
      </section>

      {/* Interactive Product Workbench (One Focused Clean Preview) */}
      <section className="max-w-4xl mx-auto px-6 pb-24 w-full">
        <div className="rounded-xl border border-white/[0.1] bg-[#111827] shadow-2xl overflow-hidden">
          {/* Workbench Tab Navigation */}
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-slate-900/60 px-4 py-2.5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("match")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  activeTab === "match"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Buyer Matchmaking</span>
              </button>
              <button
                onClick={() => setActiveTab("forecast")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  activeTab === "forecast"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Corridor Forecast</span>
              </button>
              <button
                onClick={() => setActiveTab("cost")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  activeTab === "cost"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Ship className="w-3.5 h-3.5" />
                <span>Landed Cost Waterfall</span>
              </button>
            </div>

            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline-block">
              Interactive Terminal
            </span>
          </div>

          {/* Workbench Body Content */}
          <div className="p-6">
            {activeTab === "match" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-950 text-blue-400 border border-blue-800">
                        Bill of Lading Verified
                      </span>
                      <span className="text-xs text-slate-400">HS 6109.10 (Cotton Apparel)</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      American Apparel Wholesale LLC
                    </h3>
                    <p className="text-xs text-slate-400">Los Angeles, CA • United States 🇺🇸</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-2.5 py-1 rounded text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                      94% Compatibility Fit
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-1 font-mono">
                      Two-Tower RecSys
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-slate-900 border border-white/[0.06]">
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Annual Imports</span>
                    <strong className="text-sm text-white font-mono">$18.5M USD</strong>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-white/[0.06]">
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Order Cycle</span>
                    <strong className="text-sm text-white font-mono">18 Days</strong>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-white/[0.06]">
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Customs Provenance</span>
                    <strong className="text-sm text-emerald-400 font-mono">92/100 Safe</strong>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-900 p-4 rounded-lg border border-white/[0.06] text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Capacity Alignment (Produces 300T/mo vs Buyer's 240T demand)</span>
                    <strong className="text-blue-400 font-mono">95% Fit</strong>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: "95%" }} />
                  </div>

                  <div className="flex justify-between text-slate-300 pt-2">
                    <span>OEKO-TEX Standard 100 & ISO 9001 Certification</span>
                    <strong className="text-emerald-400 font-mono">100% Match</strong>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setSwiped("pass")}
                    className={`flex-1 py-2.5 rounded-lg border font-semibold text-xs flex items-center justify-center gap-1.5 transition ${
                      swiped === "pass"
                        ? "bg-rose-950 text-rose-300 border-rose-800"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/[0.1]"
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5 text-rose-400" />
                    <span>Pass / Deprioritize</span>
                  </button>

                  <button
                    onClick={() => setSwiped("matched")}
                    className={`flex-1 py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition ${
                      swiped === "matched"
                        ? "bg-emerald-600 text-white"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{swiped === "matched" ? "Saved to Lead Pipeline!" : "Swipe to Match"}</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "forecast" && (
              <div className="space-y-4 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      India → United States Corridor Forecast
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">HS 6109.10: Cotton T-Shirts & Knitted Apparel</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-400 font-mono">+14.2% Projected CAGR</span>
                    <span className="block text-[10px] text-slate-500">Model 1 AutoARIMA & Prophet</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-slate-900 border border-white/[0.06]">
                    <span className="text-[10px] text-slate-400 block uppercase">Historical Baseline</span>
                    <strong className="text-sm text-white font-mono">$1.18B USD</strong>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-white/[0.06]">
                    <span className="text-[10px] text-slate-400 block uppercase">12-Month Projected</span>
                    <strong className="text-sm text-blue-400 font-mono">$1.34B USD</strong>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-white/[0.06]">
                    <span className="text-[10px] text-slate-400 block uppercase">Opportunity Index</span>
                    <strong className="text-sm text-emerald-400 font-mono">88 / 100</strong>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-900 border border-white/[0.06] text-xs text-slate-400 space-y-2">
                  <div className="flex justify-between">
                    <span>80% Confidence Lower Band:</span>
                    <strong className="text-slate-300 font-mono">$1.24B USD</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>80% Confidence Upper Band:</span>
                    <strong className="text-slate-300 font-mono">$1.46B USD</strong>
                  </div>
                  <p className="pt-2 text-[11px] text-slate-500 border-t border-white/[0.06]">
                    Model 1 projects robust demand acceleration driven by US retail inventory restocking and preferential corridor tariff advantages.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "cost" && (
              <div className="space-y-4 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Incoterms 2020 Landed Cost Waterfall
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Nhava Sheva (IN) → Los Angeles (US) • 20ft Container (10,000 Units)</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-white font-mono">$5.82 / Unit Landed</span>
                    <span className="block text-[10px] text-slate-500">Factory Gate: $4.20 / Unit</span>
                  </div>
                </div>

                <div className="divide-y divide-white/[0.06] text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-300">1. EXW (Ex-Works / Factory Gate)</span>
                    <strong className="text-white font-mono">$42,000.00 USD</strong>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-300">2. FOB (Loaded at Nhava Sheva JNPT)</span>
                    <strong className="text-white font-mono">$42,780.00 USD</strong>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-300">3. CIF (Ocean Freight & Marine Insurance to LAX)</span>
                    <strong className="text-blue-400 font-mono">$45,410.00 USD</strong>
                  </div>
                  <div className="py-2.5 flex justify-between font-bold">
                    <span className="text-emerald-400">4. DDP (Full Landed Cost including Duties)</span>
                    <strong className="text-emerald-400 font-mono">$58,240.00 USD</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3 Core Platform Pillars (Clean, Spacious Grid) */}
      <section id="features" className="py-24 border-t border-white/[0.08] bg-[#0c101c]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              A Complete Intelligence Suite for Global Trade
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Every tool is engineered with mathematical rigor and real international customs records.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl bg-slate-900/60 border border-white/[0.06] space-y-3">
              <div className="w-9 h-9 rounded-lg bg-blue-900/30 text-blue-400 flex items-center justify-center border border-blue-800/40">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white">Two-Tower Matchmaking</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Matches your factory's true operational capacity, minimum order quantities, and ISO/OEKO-TEX standards against verified overseas importers.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-900/60 border border-white/[0.06] space-y-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-900/30 text-emerald-400 flex items-center justify-center border border-emerald-800/40">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white">Predictive Corridor Trends</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Prophet and ARIMA time-series models project bilateral import momentum 12 months ahead with statistical confidence envelopes.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-900/60 border border-white/[0.06] space-y-3">
              <div className="w-9 h-9 rounded-lg bg-amber-900/30 text-amber-400 flex items-center justify-center border border-amber-800/40">
                <Ship className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white">Landed Cost Economics</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Calculates real container sea freight, marine cargo insurance, and WTO preferential tariff savings across major seaports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Provenance & Trust */}
      <section id="provenance" className="py-20 border-t border-white/[0.08] max-w-6xl mx-auto px-6">
        <div className="text-center mb-12 space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Authoritative International Data Foundations
          </h2>
          <p className="text-xs text-slate-400">
            Zero hallucinated records. All outputs are grounded in verified trade authorities.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-lg bg-slate-900/40 border border-white/[0.06]">
            <Globe className="w-4 h-4 text-blue-400 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-white">UN Comtrade</h4>
            <p className="text-[11px] text-slate-400 mt-1">Multi-year bilateral trade flows</p>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/40 border border-white/[0.06]">
            <Scale className="w-4 h-4 text-emerald-400 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-white">WTO Tariff Matrix</h4>
            <p className="text-[11px] text-slate-400 mt-1">MFN & Preferential FTA schedules</p>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/40 border border-white/[0.06]">
            <ShieldCheck className="w-4 h-4 text-purple-400 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-white">World Bank WGI</h4>
            <p className="text-[11px] text-slate-400 mt-1">Rule of Law & governance indices</p>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/40 border border-white/[0.06]">
            <FileText className="w-4 h-4 text-amber-400 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-white">Bill of Lading</h4>
            <p className="text-[11px] text-slate-400 mt-1">Verified shipment manifests</p>
          </div>
        </div>
      </section>

      {/* Confident Call to Action */}
      <section className="py-20 border-t border-white/[0.08] bg-[#0c101c]">
        <div className="max-w-3xl mx-auto px-6 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Ready to Evaluate Global Trade Opportunities?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Equip your export sales desk with verifiable trade intelligence, predictive forecasts, and algorithmic matchmaking.
          </p>

          <div className="pt-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition"
            >
              <span>Create Exporter Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="mt-auto py-8 border-t border-white/[0.08] bg-[#0b0f19] text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 ForeTrade. B2B Cross-Border Trade OS.</p>
          <div className="flex items-center gap-6">
            <Link href="/sign-in" className="hover:text-slate-300 transition">Sign In</Link>
            <Link href="/register" className="hover:text-slate-300 transition">Create Account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
