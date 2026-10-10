"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Radar,
  Radio,
  Sparkles,
  Search,
  Filter,
  DollarSign,
  Calendar,
  AlertCircle,
  Clock,
  ArrowUpRight,
  PlusCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Building2,
  TrendingUp,
  FileText,
  Send,
  Zap,
} from "lucide-react";

interface DemandSignal {
  id: string;
  title: string;
  raw_text: string;
  source_channel: string;
  signal_type: string;
  target_country: string;
  product_category: string;
  hs_code: string;
  estimated_budget_usd: number | null;
  deadline_date: string | null;
  intent_score: number;
  urgency_level: string;
  extracted_entities: Record<string, any>;
  external_id?: string | null;
  source_url?: string | null;
  buyer_name?: string | null;
  status?: string;
  expires_at?: string | null;
  published_at: string | null;
  created_at: string | null;
}

export default function RealTimeDemandRadarPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [signals, setSignals] = useState<DemandSignal[]>([]);
  const [targetCountryFilter, setTargetCountryFilter] = useState("");
  const [signalTypeFilter, setSignalTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "CLOSING_SOON" | "EXPIRED" | "ALL">("ACTIVE");

  // Quick NLP Parser Input state
  const [showExtractorModal, setShowExtractorModal] = useState(false);
  const [extractText, setExtractText] = useState("");
  const [extractSource, setExtractSource] = useState("Custom Bulletin / RSS");
  const [extracting, setExtracting] = useState(false);
  const [extractedResult, setExtractedResult] = useState<any | null>(null);

  // Lead Conversion state
  const [savingSignalId, setSavingSignalId] = useState<string | null>(null);
  const [savedSignalSuccess, setSavedSignalSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSignals();
  }, [targetCountryFilter, signalTypeFilter, statusFilter]);

  async function loadSignals() {
    try {
      setLoading(true);
      const res = await api.getDemandSignals({
        target_country: targetCountryFilter || undefined,
        signal_type: signalTypeFilter || undefined,
        status: statusFilter === "ALL" ? "ALL" : statusFilter,
      }).catch(() => ({ items: [], total: 0 }));
      setSignals(res.items || []);
    } catch (err) {
      console.warn("Could not load demand signals:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncLiveFeeds() {
    try {
      setSyncing(true);
      setSyncFeedback(null);
      const res = await api.syncDemandSignals(false);
      const totalNew = res.sources.reduce((acc, s) => acc + (s.new || 0), 0);
      const totalUpdated = res.sources.reduce((acc, s) => acc + (s.updated || 0), 0);
      setSyncFeedback(`Successfully synchronized live feeds! Added ${totalNew} new and refreshed ${totalUpdated} public tenders.`);
      await loadSignals();
      setTimeout(() => setSyncFeedback(null), 6000);
    } catch (err) {
      console.error("Failed to sync live feeds:", err);
      setSyncFeedback("Sync failed. Check network connectivity.");
    } finally {
      setSyncing(false);
    }
  }

  async function handlePurgeExpired() {
    if (!confirm("Are you sure you want to clean out expired and closed notices from the radar?")) return;
    try {
      setLoading(true);
      const res = await api.purgeExpiredSignals();
      setSyncFeedback(`Cleaned out ${res.purged_count} expired notices.`);
      await loadSignals();
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err) {
      console.error("Failed to purge expired notices:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExtractOnDemand(e: React.FormEvent) {
    e.preventDefault();
    if (!extractText.trim()) return;

    setExtracting(true);
    setExtractedResult(null);
    try {
      const res = await api.extractSignal({
        text: extractText.trim(),
        source_channel: extractSource,
      });
      setExtractedResult(res);
      await loadSignals();
    } catch (err) {
      console.error("Failed to extract signal on demand:", err);
    } finally {
      setExtracting(false);
    }
  }

  async function handleCreateLeadFromSignal(signal: DemandSignal) {
    setSavingSignalId(signal.id);
    try {
      const compList = await api.listCompanies(workspaceId);
      let companyId = compList.items?.[0]?.id;
      if (!companyId) {
        const globalBuyers = await api.getGlobalBuyers();
        const firstBuyer = globalBuyers.items?.[0];
        if (firstBuyer) {
          await api.swipeRecommendation(workspaceId, firstBuyer.id, "right");
          setSavedSignalSuccess(signal.id);
          setTimeout(() => setSavedSignalSuccess(null), 3000);
          return;
        }
      }
      if (companyId) {
        await api.createLead(
          workspaceId,
          companyId,
          `Converted from Live Demand Signal: ${signal.title}\nSource: ${signal.source_channel}\nOriginal Text: ${signal.raw_text}`
        );
        setSavedSignalSuccess(signal.id);
        setTimeout(() => setSavedSignalSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Failed to convert signal to lead:", err);
    } finally {
      setSavingSignalId(null);
    }
  }

  const countries = [
    { code: "", label: "All Target Destinations" },
    { code: "GB", label: "🇬🇧 United Kingdom (FTS / Contracts)" },
    { code: "DE", label: "🇩🇪 Germany (TED / Bundesnetzagentur)" },
    { code: "FR", label: "🇫🇷 France (TED Directives)" },
    { code: "NL", label: "🇳🇱 Netherlands (TED Gazettes)" },
    { code: "US", label: "🇺🇸 United States (SAM.gov / DOT)" },
    { code: "AE", label: "🇦🇪 UAE (Dubai Health Authority)" },
    { code: "EG", label: "🇪🇬 Egypt (GASC Cairo)" },
    { code: "KE", label: "🇰🇪 Kenya (Ministry of Ed)" },
    { code: "AU", label: "🇦🇺 Australia (Clean Energy)" },
    { code: "JP", label: "🇯🇵 Japan (METI / JETRO)" },
  ];

  const signalTypes = [
    { code: "", label: "All Signal Types" },
    { code: "Procurement Tender", label: "Government Procurement Tender" },
    { code: "Government Quota Opening", label: "Duty-Free Quota Opening" },
    { code: "Sudden Demand Surge", label: "Sudden Demand Surge / Shortage" },
  ];

  const totalValue = signals.reduce((acc, s) => acc + (s.estimated_budget_usd || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>Real-Time Demand Radar</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Live Global Feeds & NLP Model 4
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Live Global Procurement & Tender Radar
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitors real-time public procurement tenders from the UK Find a Tender Service, EU Tenders Electronic Daily (TED), and multilateral ministries with automated expiration lifecycles.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSyncLiveFeeds}
            disabled={syncing || loading}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            title="Poll UK FTS & EU TED APIs for new public tenders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing Global Feeds..." : "Sync Live Tenders"}</span>
          </button>

          <button
            onClick={handlePurgeExpired}
            disabled={loading || syncing}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
            title="Clean closed and expired tenders past their deadline"
          >
            Clean Expired
          </button>

          <button
            onClick={() => setShowExtractorModal(!showExtractorModal)}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-blue-600" />
            <span>Parse Notice</span>
          </button>

          <button
            onClick={loadSignals}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition cursor-pointer"
            title="Refresh Feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading && !syncing ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncFeedback && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-900 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="text-blue-500 hover:text-blue-800 text-[11px] font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Tracked Pipeline Budget
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              ${(totalValue / 1_000_000).toFixed(1)}M USD
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Across active international tenders
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Active Trade Signals
            </div>
            <div className="text-2xl font-bold font-mono text-blue-700 mt-1">
              {signals.length} Live Alerts
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
              UK FTS, EU TED, GASC & SAM.gov feeds
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
            <Radar className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Avg Buying Intent Score
            </div>
            <div className="text-2xl font-bold font-mono text-amber-700 mt-1">
              {signals.length > 0
                ? `${Math.round((signals.reduce((acc, s) => acc + s.intent_score, 0) / signals.length) * 100)}%`
                : "92.0%"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Verified high-urgency commercial intent
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* On-Demand NLP Extractor Modal */}
      {showExtractorModal && (
        <form
          onSubmit={handleExtractOnDemand}
          className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                On-Demand NLP Tender Notice Parser
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowExtractorModal(false)}
              className="text-slate-500 hover:text-slate-800 text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Paste any unstructured press release, embassy trade notification, or procurement RFP. The NLP parser will extract budget, destination market, deadline, and link canonical HS codes.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Raw Announcement Text
              </label>
              <textarea
                rows={3}
                value={extractText}
                onChange={(e) => setExtractText(e.target.value)}
                placeholder="e.g. Egypt GASC announces $40M emergency international tender for wheat and grain packaging, closing in 30 days..."
                className="w-full text-xs font-medium p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="w-full sm:w-1/2">
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Source Attribution
                </label>
                <input
                  type="text"
                  value={extractSource}
                  onChange={(e) => setExtractSource(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={extracting || !extractText.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 self-end disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Extract Entities & Link HS Code</span>
              </button>
            </div>
          </div>

          {/* Extracted Preview Result */}
          {extractedResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2 mt-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Successfully Extracted Signal!</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">Country</span>
                  <div className="font-bold text-slate-900">{extractedResult.target_country}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">Estimated Budget</span>
                  <div className="font-bold text-slate-900">
                    ${extractedResult.estimated_budget_usd ? (extractedResult.estimated_budget_usd / 1_000_000).toFixed(1) + "M USD" : "Not specified"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">Deadline</span>
                  <div className="font-bold text-slate-900">{extractedResult.deadline_text || "Open"}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">Linked HS Code</span>
                  <div className="font-bold text-blue-700">HS {extractedResult.hs_code} ({extractedResult.product_category})</div>
                </div>
              </div>
            </div>
          )}
        </form>
      )}

      {/* Lifecycle Status Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
        {(
          [
            { id: "ACTIVE", label: "Active (Open)" },
            { id: "CLOSING_SOON", label: "Closing Soon (≤7d)" },
            { id: "EXPIRED", label: "Closed / Expired" },
            { id: "ALL", label: "All Records" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              statusFilter === tab.id
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="min-w-64">
            <select
              value={targetCountryFilter}
              onChange={(e) => setTargetCountryFilter(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-60">
            <select
              value={signalTypeFilter}
              onChange={(e) => setSignalTypeFilter(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            >
              {signalTypes.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono font-medium">
          <span>{signals.length} notices displayed</span>
        </div>
      </div>

      {/* Live Signals Feed */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Scanning trade ministry bulletins & procurement feeds...</span>
        </div>
      ) : signals.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
          No notices match the selected filters. Click &ldquo;Sync Live Tenders&rdquo; above to fetch current public contracts from UK and EU portals.
        </div>
      ) : (
        <div className="space-y-4">
          {signals.map((signal) => {
            const isSaving = savingSignalId === signal.id;
            const isSuccess = savedSignalSuccess === signal.id;
            const isClosingSoon = signal.status === "CLOSING_SOON" || signal.urgency_level === "Critical";
            const isExpired = signal.status === "EXPIRED";

            return (
              <div
                key={signal.id}
                className="p-6 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition shadow-xs space-y-4"
              >
                {/* Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-bold text-xs border border-slate-200">
                      {signal.target_country}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        signal.signal_type === "Government Quota Opening"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : signal.signal_type === "Sudden Demand Surge"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {signal.signal_type}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-50 text-slate-700 border border-slate-200">
                      HS {signal.hs_code} ({signal.product_category})
                    </span>
                    {signal.status && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                          isExpired
                            ? "bg-slate-100 text-slate-500 border-slate-300"
                            : isClosingSoon
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {isExpired ? "Closed" : isClosingSoon ? "Closing Soon" : "Open & Active"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        signal.urgency_level === "Critical"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      {signal.urgency_level} Urgency
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {Math.round(signal.intent_score * 100)}% Intent
                    </span>
                  </div>
                </div>

                {/* Title & Raw Announcement */}
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {signal.title}
                  </h3>
                  {signal.buyer_name && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{signal.buyer_name}</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-700 mt-2 leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70 italic">
                    &ldquo;{signal.raw_text}&rdquo;
                  </p>
                </div>

                {/* Bottom Metadata & Lead Conversion Action */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-500">
                    <span className="flex items-center gap-1 font-bold text-slate-900">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      Budget: {signal.estimated_budget_usd ? `$${(signal.estimated_budget_usd / 1_000_000).toFixed(1)}M USD` : "Undisclosed"}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1 text-slate-700 font-medium">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Deadline: {signal.deadline_date || "Open / Ongoing"}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500">
                      Source: {signal.source_channel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {signal.source_url && (
                      <a
                        href={signal.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-blue-600 hover:text-blue-700 transition flex items-center gap-1 shadow-2xs"
                      >
                        <span>Official Gazette</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    <button
                      onClick={() => handleCreateLeadFromSignal(signal)}
                      disabled={isSaving || isSuccess || isExpired}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
                        isSuccess
                          ? "bg-emerald-600 text-white"
                          : isExpired
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                    >
                      {isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isSuccess ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Added to CRM Pipeline!</span>
                        </>
                      ) : isExpired ? (
                        <span>Tender Closed</span>
                      ) : (
                        <>
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Convert to Opportunity</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
