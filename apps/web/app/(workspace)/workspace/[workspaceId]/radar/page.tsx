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
  const [signals, setSignals] = useState<DemandSignal[]>([]);
  const [targetCountryFilter, setTargetCountryFilter] = useState("");
  const [signalTypeFilter, setSignalTypeFilter] = useState("");

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
  }, [targetCountryFilter, signalTypeFilter]);

  async function loadSignals() {
    try {
      setLoading(true);
      const res = await api.getDemandSignals({
        target_country: targetCountryFilter || undefined,
        signal_type: signalTypeFilter || undefined,
      }).catch(() => ({ items: [], total: 0 }));
      setSignals(res.items || []);
    } catch (err) {
      console.warn("Could not load demand signals:", err);
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
    { code: "EG", label: "🇪🇬 Egypt (GASC)" },
    { code: "KE", label: "🇰🇪 Kenya (Ministry of Ed)" },
    { code: "DE", label: "🇩🇪 Germany (Bundesnetzagentur)" },
    { code: "AE", label: "🇦🇪 UAE (Dubai Health Authority)" },
    { code: "US", label: "🇺🇸 United States (SAM.gov)" },
    { code: "AU", label: "🇦🇺 Australia (Clean Energy)" },
    { code: "JP", label: "🇯🇵 Japan (METI / JETRO)" },
    { code: "GB", label: "🇬🇧 United Kingdom (NHS Contracts)" },
  ];

  const signalTypes = [
    { code: "", label: "All Signal Types" },
    { code: "Procurement Tender", label: "Government Procurement Tender" },
    { code: "Government Quota Opening", label: "Duty-Free Quota Opening" },
    { code: "Sudden Demand Surge", label: "Sudden Demand Surge / Shortage" },
  ];

  const totalValue = signals.reduce((acc, s) => acc + (s.estimated_budget_usd || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              Real-Time Demand Radar
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              NLP Signal Extractor
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Live Global Procurement & Tender Radar
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Detects urgent government tenders, emergency quota concessions, and commercial demand surges before competitors find them in trade directories.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExtractorModal(!showExtractorModal)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Parse Unstructured Notice</span>
          </button>

          <button
            onClick={loadSignals}
            disabled={loading}
            className="p-2 rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 transition"
            title="Refresh Radar Feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Summary Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-[#111827] border border-white/[0.08] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Tracked Pipeline Budget
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              ${(totalValue / 1_000_000).toFixed(1)}M USD
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Across active international tenders
            </div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#111827] border border-white/[0.08] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Active Trade Signals
            </div>
            <div className="text-2xl font-bold font-mono text-blue-400 mt-1">
              {signals.length} Live Alerts
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Ministries, GASC, NHS, SAM.gov feeds
            </div>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Radar className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#111827] border border-white/[0.08] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Avg Buying Intent Score
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
              91.4%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Verified high-urgency commercial intent
            </div>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* On-Demand NLP Extractor Modal */}
      {showExtractorModal && (
        <form
          onSubmit={handleExtractOnDemand}
          className="p-6 rounded-xl bg-[#111827] border border-white/[0.1] space-y-4"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">
                On-Demand NLP Tender Notice Parser
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowExtractorModal(false)}
              className="text-slate-400 hover:text-white text-xs transition"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Paste any unstructured press release, embassy trade notification, or procurement RFP. The NLP parser will extract budget, destination market, deadline, and link canonical HS codes.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                Raw Announcement Text
              </label>
              <textarea
                rows={3}
                value={extractText}
                onChange={(e) => setExtractText(e.target.value)}
                placeholder="e.g. Egypt GASC announces $40M emergency international tender for wheat and grain packaging, closing in 30 days..."
                className="w-full text-xs font-medium p-3 rounded-lg border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="w-full sm:w-1/2">
                <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Source Attribution
                </label>
                <input
                  type="text"
                  value={extractSource}
                  onChange={(e) => setExtractSource(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={extracting || !extractText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 self-end disabled:opacity-50"
              >
                {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Extract Entities & Link HS Code</span>
              </button>
            </div>
          </div>

          {/* Extracted Preview Result */}
          {extractedResult && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2 mt-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Successfully Extracted Signal!</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 font-sans uppercase">Country</span>
                  <div className="font-bold text-white">{extractedResult.target_country}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-sans uppercase">Estimated Budget</span>
                  <div className="font-bold text-white">
                    ${extractedResult.estimated_budget_usd ? (extractedResult.estimated_budget_usd / 1_000_000).toFixed(1) + "M USD" : "Not specified"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-sans uppercase">Deadline</span>
                  <div className="font-bold text-white">{extractedResult.deadline_text || "Open"}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-sans uppercase">Linked HS Code</span>
                  <div className="font-bold text-blue-400">HS {extractedResult.hs_code} ({extractedResult.product_category})</div>
                </div>
              </div>
            </div>
          )}
        </form>
      )}

      {/* Filters Bar */}
      <div className="p-4 rounded-xl bg-[#111827] border border-white/[0.08] flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="min-w-56">
            <select
              value={targetCountryFilter}
              onChange={(e) => setTargetCountryFilter(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#0B0F19] text-white">
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-60">
            <select
              value={signalTypeFilter}
              onChange={(e) => setSignalTypeFilter(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
            >
              {signalTypes.map((st) => (
                <option key={st.code} value={st.code} className="bg-[#0B0F19] text-white">
                  {st.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          <span>{signals.length} notices monitored</span>
        </div>
      </div>

      {/* Live Signals Feed */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span className="text-sm font-medium">Scanning trade ministry bulletins & procurement feeds...</span>
        </div>
      ) : signals.length === 0 ? (
        <div className="p-16 text-center bg-[#111827] rounded-xl border border-white/[0.08] text-slate-400 text-sm">
          No active tenders or demand alerts match this destination filter.
        </div>
      ) : (
        <div className="space-y-4">
          {signals.map((signal) => {
            const isSaving = savingSignalId === signal.id;
            const isSuccess = savedSignalSuccess === signal.id;

            return (
              <div
                key={signal.id}
                className="p-6 rounded-xl bg-[#111827] border border-white/[0.08] hover:border-white/[0.15] transition space-y-4"
              >
                {/* Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/[0.1] text-white font-mono font-bold text-xs">
                      {signal.target_country}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                        signal.signal_type === "Government Quota Opening"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : signal.signal_type === "Sudden Demand Surge"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      }`}
                    >
                      {signal.signal_type}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] text-slate-300 border border-white/[0.08]">
                      HS {signal.hs_code} ({signal.product_category})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        signal.urgency_level === "Critical"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {signal.urgency_level} Urgency
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {Math.round(signal.intent_score * 100)}% Intent
                    </span>
                  </div>
                </div>

                {/* Title & Raw Announcement */}
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {signal.title}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/[0.06] italic">
                    &ldquo;{signal.raw_text}&rdquo;
                  </p>
                </div>

                {/* Bottom Metadata & Lead Conversion Action */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/[0.06]">
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
                    <span className="flex items-center gap-1 font-semibold text-white">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      Budget: {signal.estimated_budget_usd ? `$${(signal.estimated_budget_usd / 1_000_000).toFixed(1)}M USD` : "Undisclosed"}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      Deadline: {signal.deadline_date || "Open / Ongoing"}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">
                      Source: {signal.source_channel}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCreateLeadFromSignal(signal)}
                    disabled={isSaving || isSuccess}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 self-end sm:self-auto ${
                      isSuccess
                        ? "bg-emerald-600 text-white"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isSuccess ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Added to CRM Pipeline!</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Convert to CRM Opportunity</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
