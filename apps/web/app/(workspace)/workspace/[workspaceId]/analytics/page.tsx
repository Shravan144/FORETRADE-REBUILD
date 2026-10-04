"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  BarChart3,
  TrendingUp,
  DownloadCloud,
  Building2,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export default function AnalyticsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await api.getAnalytics(workspaceId);
        setAnalytics(res);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [workspaceId]);

  async function handleExportCompanies() {
    setExporting(true);
    setDownloadUrl(null);
    try {
      const res = await api.exportCompanies(workspaceId);
      setDownloadUrl(res.download_url);
    } catch (err) {
      alert("Export failed. Please ensure you have editor permissions.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="text-sm font-medium">Calculating workspace analytics...</span>
      </div>
    );
  }

  const pipeline = analytics?.pipeline || {};
  const scoreDist = analytics?.score_distribution || {};
  const importQuality = analytics?.import_quality || { jobs: 0, rows: 0, invalid_rows: 0 };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-slate-100">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Trade Analytics & Data Export
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Verifiable Metrics
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real SQL-aggregated funnel statistics, quality distributions, and auditable exports.
          </p>
        </div>

        <button
          onClick={handleExportCompanies}
          disabled={exporting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
        >
          {exporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating Export...</span>
            </>
          ) : (
            <>
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Export Company CSV</span>
            </>
          )}
        </button>
      </div>

      {/* Download Alert if ready */}
      {downloadUrl && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-4 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Company export generated with full trade provenance columns.</span>
          </div>
          <a
            href={downloadUrl}
            download="foretrade-companies.csv"
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition shrink-0"
          >
            Download CSV File
          </a>
        </div>
      )}

      {/* Top High-Level Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-[#111827] border border-white/[0.08]">
          <div className="text-xs font-medium text-slate-400 mb-1">Total Directory Entities</div>
          <div className="text-2xl font-bold font-mono text-white mb-2">{analytics?.companies || 0}</div>
          <p className="text-[11px] text-slate-400">Cleaned & deduplicated prospective buyers</p>
        </div>

        <div className="p-5 rounded-xl bg-[#111827] border border-white/[0.08]">
          <div className="text-xs font-medium text-slate-400 mb-1">Active CRM Deals</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 mb-2">
            {Object.values(pipeline).reduce((a: number, b: any) => a + (b || 0), 0)}
          </div>
          <p className="text-[11px] text-slate-400">Verified through event progression gates</p>
        </div>

        <div className="p-5 rounded-xl bg-[#111827] border border-white/[0.08]">
          <div className="text-xs font-medium text-slate-400 mb-1">High-Fit Opportunity Ratio</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mb-2">
            {analytics?.companies ? Math.round(((scoreDist["high"] || 0) / analytics.companies) * 100) : 0}%
          </div>
          <p className="text-[11px] text-slate-400 font-mono">{scoreDist["high"] || 0} companies with score ≥ 70</p>
        </div>
      </div>

      {/* Two Column Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <div className="p-6 rounded-xl bg-[#111827] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Pipeline Stage Breakdown
            </h2>
            <span className="text-xs text-slate-400 font-mono">Real Deals</span>
          </div>

          <div className="space-y-3">
            {[
              { key: "new", label: "New Prospects" },
              { key: "qualified", label: "Verified Qualified" },
              { key: "contacted", label: "Outreach Sent" },
              { key: "replied", label: "Reply Received" },
              { key: "meeting", label: "Meetings Conducted" },
              { key: "won", label: "Deals Closed Won" },
            ].map((stage) => {
              const count = pipeline[stage.key] || 0;
              const maxCount = Math.max(...Object.values(pipeline).map((v: any) => v || 0), 1);
              const pct = Math.round((count / maxCount) * 100);

              return (
                <div key={stage.key}>
                  <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                    <span>{stage.label}</span>
                    <span className="font-mono text-white font-semibold">{count}</span>
                  </div>
                  <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Import Quality & Score Tiers */}
        <div className="p-6 rounded-xl bg-[#111827] border border-white/[0.08] space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">
              Data Ingestion Integrity
            </h2>
            <p className="text-xs text-slate-400">
              Audit metrics for raw CSV/XLSX imports into this workspace.
            </p>

            <div className="grid grid-cols-3 gap-3 mt-4 text-center font-mono">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <div className="text-[9px] text-slate-400 uppercase font-sans">Jobs Ran</div>
                <div className="text-lg font-bold text-white mt-0.5">{importQuality.jobs}</div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                <div className="text-[9px] text-emerald-400 uppercase font-sans">Total Rows</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{importQuality.rows}</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <div className="text-[9px] text-amber-400 uppercase font-sans">Rejected</div>
                <div className="text-lg font-bold text-amber-400 mt-0.5">{importQuality.invalid_rows}</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.06]">
            <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-3">
              Opportunity Score Distribution
            </h3>

            <div className="grid grid-cols-3 gap-3 text-center font-mono">
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                <div className="text-[9px] text-emerald-400 font-sans uppercase">High (≥70)</div>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">{scoreDist["high"] || 0}</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <div className="text-[9px] text-amber-400 font-sans uppercase">Medium (45-69)</div>
                <div className="text-xl font-bold text-amber-400 mt-0.5">{scoreDist["medium"] || 0}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <div className="text-[9px] text-slate-400 font-sans uppercase">Low (&lt;45)</div>
                <div className="text-xl font-bold text-slate-300 mt-0.5">{scoreDist["low"] || 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
