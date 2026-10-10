"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Building2,
  Briefcase,
  TrendingUp,
  Globe,
  UploadCloud,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Radar,
  Ship,
  Sparkles,
} from "lucide-react";

export default function WorkspaceDashboard({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentCompanies, setRecentCompanies] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [profData, analyticsData, compData] = await Promise.all([
          api.getExporterProfile(workspaceId).catch(() => null),
          api.getAnalytics(workspaceId).catch(() => null),
          api.listCompanies(workspaceId).catch(() => ({ items: [] })),
        ]);
        setProfile(profData?.payload || null);
        setAnalytics(analyticsData || null);
        setRecentCompanies(compData?.items?.slice(0, 5) || []);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh] text-slate-400">
        <div className="flex items-center gap-2.5 text-sm font-medium">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></span>
          <span>Loading trade cockpit...</span>
        </div>
      </div>
    );
  }

  const pipeline = analytics?.pipeline || {};
  const totalLeads = Object.values(pipeline).reduce((acc: number, val: any) => acc + (val || 0), 0);
  const scoreDist = analytics?.score_distribution || {};

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-slate-900">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {profile?.company_name || "Exporter Dashboard"}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              India Origin
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Algorithmic EXIM matchmaking, UN Comtrade demand forecasts, and landed cost intelligence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/workspace/${workspaceId}/imports/new`}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition flex items-center gap-1.5"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Import Data</span>
          </Link>
          <Link
            href={`/workspace/${workspaceId}/swipe`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Swipe to Export</span>
          </Link>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Verified Buyers</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {analytics?.companies || 0}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Curated prospective buyers</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Pipeline Leads</span>
            <Briefcase className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {totalLeads}
          </div>
          <div className="text-[11px] text-slate-500">
            Across 6 stage verification gates
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>High-Fit Matches</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {scoreDist["high"] || 0}
          </div>
          <div className="text-[11px] text-slate-500">
            Score ≥ 70 with capacity fit
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Annual Capacity</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {profile?.capacity_tons ? `${profile.capacity_tons} T` : "Configured"}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {profile?.product_categories?.join(", ") || "Manufacturing capability"}
          </div>
        </div>
      </div>

      {/* Pipeline Funnel Section */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Pipeline Stage Distribution
            </h2>
            <p className="text-xs text-slate-500">
              Stages strictly verified by required interaction events with zero synthetic mock entries.
            </p>
          </div>
          <Link
            href={`/workspace/${workspaceId}/leads`}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
          >
            <span>View Kanban Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          {[
            { key: "new", label: "New Leads", color: "text-slate-800 border-slate-200 bg-slate-50" },
            { key: "qualified", label: "Qualified", color: "text-blue-700 border-blue-200 bg-blue-50/60" },
            { key: "contacted", label: "Contacted", color: "text-indigo-700 border-indigo-200 bg-indigo-50/60" },
            { key: "replied", label: "Replied", color: "text-amber-800 border-amber-200 bg-amber-50/60" },
            { key: "meeting", label: "Meeting Set", color: "text-emerald-800 border-emerald-200 bg-emerald-50/60" },
            { key: "won", label: "Deal Won", color: "text-teal-800 border-teal-200 bg-teal-50/60" },
          ].map((stage) => {
            const count = pipeline[stage.key] || 0;
            return (
              <div
                key={stage.key}
                className={`p-3.5 rounded-xl border ${stage.color} flex flex-col justify-between`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                  {stage.label}
                </div>
                <div className="text-xl font-bold font-mono mt-2">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Section: Recent Companies & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Companies (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Recently Sourced Prospective Buyers
            </h2>
            <Link
              href={`/workspace/${workspaceId}/companies`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
            >
              <span>View Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentCompanies.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No companies sourced yet. Use the Import Wizard to load prospective buyers.
              </div>
            ) : (
              recentCompanies.map((c) => (
                <div
                  key={c.id}
                  className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/70 px-2.5 rounded-xl transition"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/workspace/${workspaceId}/companies/${c.id}`}
                      className="font-semibold text-sm text-slate-900 hover:text-blue-600 truncate block transition"
                    >
                      {c.name}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="font-mono font-medium text-slate-700">{c.country_code}</span>
                      <span>•</span>
                      <span className="truncate">{c.product_or_industry}</span>
                    </div>
                  </div>

                  <Link
                    href={`/workspace/${workspaceId}/companies/${c.id}`}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                  >
                    View Score
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions (1 col) */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Operational Engines
          </h2>

          <div className="space-y-2.5">
            <Link
              href={`/workspace/${workspaceId}/swipe`}
              className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300 transition flex items-start gap-3 group"
            >
              <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">
                  Swipe to Export
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Two-Tower operational matchmaking deck with XAI attribution.
                </div>
              </div>
            </Link>

            <Link
              href={`/workspace/${workspaceId}/radar`}
              className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300 transition flex items-start gap-3 group"
            >
              <Radar className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition">
                  Demand Radar
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Live government procurement tender notice scanner.
                </div>
              </div>
            </Link>

            <Link
              href={`/workspace/${workspaceId}/logistics`}
              className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300 transition flex items-start gap-3 group"
            >
              <Ship className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">
                  Landed Cost Waterfall
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Incoterms 2020 container logistics, freight, and tariff engine.
                </div>
              </div>
            </Link>

            <Link
              href={`/workspace/${workspaceId}/markets`}
              className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300 transition flex items-start gap-3 group"
            >
              <Globe className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition">
                  Market Explorer
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  12-month ARIMA trade corridor projections across 220+ markets.
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
