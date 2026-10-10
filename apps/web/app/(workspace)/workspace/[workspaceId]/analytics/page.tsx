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
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-slate-800">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Trade Analytics & Data Export
            </h1>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Verifiable Metrics
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real SQL-aggregated funnel statistics, quality distributions, and auditable exports.
          </p>
        </div>

        <button
          onClick={handleExportCompanies}
          disabled={exporting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs hover:shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
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
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4 text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Company export generated with full trade provenance columns.</span>
          </div>
          <a
            href={downloadUrl}
            download="foretrade-companies.csv"
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs transition shrink-0"
          >
            Download CSV File
          </a>
        </div>
      )}

      {/* Top High-Level Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">Total Directory Entities</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mb-2">{analytics?.companies || 0}</div>
          <p className="text-[11px] text-slate-500">Cleaned & deduplicated prospective buyers</p>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">Active CRM Deals</div>
          <div className="text-2xl font-bold font-mono text-indigo-700 mb-2">
            {Object.values(pipeline).reduce((a: number, b: any) => a + (b || 0), 0)}
          </div>
          <p className="text-[11px] text-slate-500">Verified through event progression gates</p>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">High-Fit Opportunity Ratio</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mb-2">
            {analytics?.companies ? Math.round(((scoreDist["high"] || 0) / analytics.companies) * 100) : 0}%
          </div>
          <p className="text-[11px] text-slate-500 font-mono">{scoreDist["high"] || 0} companies with score ≥ 70</p>
        </div>
      </div>

      {/* Two Column Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              Pipeline Stage Breakdown
            </h2>
            <span className="text-xs text-slate-500 font-mono font-semibold">Real Deals</span>
          </div>

          <div className="space-y-3.5">
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
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>{stage.label}</span>
                    <span className="font-mono text-slate-900 font-bold">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Import Quality & Score Tiers */}
        <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Data Ingestion Integrity
            </h2>
            <p className="text-xs text-slate-500">
              Audit metrics for raw CSV/XLSX imports into this workspace.
            </p>

            <div className="grid grid-cols-3 gap-3 mt-4 text-center font-mono">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-bold uppercase font-sans">Jobs Ran</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{importQuality.jobs}</div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 shadow-2xs">
                <div className="text-[10px] text-emerald-700 font-bold uppercase font-sans">Total Rows</div>
                <div className="text-lg font-bold text-emerald-800 mt-0.5">{importQuality.rows}</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 shadow-2xs">
                <div className="text-[10px] text-amber-700 font-bold uppercase font-sans">Rejected</div>
                <div className="text-lg font-bold text-amber-800 mt-0.5">{importQuality.invalid_rows}</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">
              Opportunity Score Distribution
            </h3>

            <div className="grid grid-cols-3 gap-3 text-center font-mono">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 shadow-2xs">
                <div className="text-[10px] text-emerald-700 font-sans font-bold uppercase">High (≥70)</div>
                <div className="text-xl font-bold text-emerald-800 mt-0.5">{scoreDist["high"] || 0}</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 shadow-2xs">
                <div className="text-[10px] text-amber-700 font-sans font-bold uppercase">Medium (45-69)</div>
                <div className="text-xl font-bold text-amber-800 mt-0.5">{scoreDist["medium"] || 0}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-sans font-bold uppercase">Low (&lt;45)</div>
                <div className="text-xl font-bold text-slate-700 mt-0.5">{scoreDist["low"] || 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
