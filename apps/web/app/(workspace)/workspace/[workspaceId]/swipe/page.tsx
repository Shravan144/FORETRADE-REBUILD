"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Sparkles,
  CheckCircle2,
  Building2,
  Globe,
  ShieldCheck,
  Ship,
  Container,
  DollarSign,
  ArrowRight,
  RotateCcw,
  Sliders,
  Check,
  X,
  Loader2,
  Award,
} from "lucide-react";

interface BuyerRecommendation {
  buyer_id: string;
  company_name: string;
  country_code: string;
  city?: string;
  website?: string;
  contact_name?: string;
  contact_email?: string;
  primary_sector: string;
  hs_codes: string[];
  annual_import_volume_usd: number;
  avg_order_tons: number;
  required_certifications: string[];
  preferred_incoterms: string;
  customs_manifest_provenance: string;
  reliability_score: number;
  compatibility_score: number;
  match_tier: string;
  factor_breakdown: {
    product_similarity_pts: number;
    capacity_alignment_pts: number;
    compliance_match_pts: number;
    corridor_alignment_pts: number;
  };
  reasons: string[];
}

export default function SwipeToExportPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<BuyerRecommendation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [lastAction, setLastAction] = useState<"accepted" | "passed" | null>(null);
  const [stats, setStats] = useState({ savedCount: 0, passedCount: 0 });

  // Exporter Profile Settings
  const [productCategory, setProductCategory] = useState("textiles");
  const [monthlyCapacityTons, setMonthlyCapacityTons] = useState(100);
  const [targetCountries, setTargetCountries] = useState(["US", "DE", "AE"]);
  const [certifications, setCertifications] = useState(["ISO 9001", "OEKO-TEX Standard 100"]);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, [workspaceId]);

  async function loadRecommendations() {
    try {
      setLoading(true);
      const res = await api.getRecommendations(workspaceId, 25).catch(() => ({ items: [], total_recommendations: 0 }));
      setRecommendations(res.items || []);
      setCurrentIndex(0);
      setStats({ savedCount: 0, passedCount: 0 });
    } catch (err) {
      console.warn("Could not load recommendations:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwipe(decision: "accept" | "pass") {
    if (currentIndex >= recommendations.length || swiping) return;

    const currentBuyer = recommendations[currentIndex];
    setSwiping(true);
    setLastAction(decision === "accept" ? "accepted" : "passed");

    try {
      if (decision === "accept") {
        await api.swipeRecommendation(workspaceId, currentBuyer.buyer_id, "right");
        setStats((prev) => ({ ...prev, savedCount: prev.savedCount + 1 }));
      } else {
        await api.swipeRecommendation(workspaceId, currentBuyer.buyer_id, "left");
        setStats((prev) => ({ ...prev, passedCount: prev.passedCount + 1 }));
      }

      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setLastAction(null);
        setSwiping(false);
      }, 250);
    } catch (err) {
      console.error("Failed to record recommendation feedback:", err);
      setLastAction(null);
      setSwiping(false);
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      await api.saveExporterProfile(workspaceId, {
        product_categories: [productCategory],
        capacity_tons: monthlyCapacityTons,
        target_countries: targetCountries,
        certifications: certifications,
      });
      setShowProfileDrawer(false);
      await loadRecommendations();
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setUpdatingProfile(false);
    }
  }

  const currentBuyer = recommendations[currentIndex];
  const nextBuyer = recommendations[currentIndex + 1];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Two-Tower Matchmaking
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Interactive Deck
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            AI Buyer Matchmaking Deck
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked by operational compatibility: Exporter embeddings × Buyer demand embeddings with capacity fit curves and XAI attribution.
          </p>
        </div>

        {/* Top Actions & Profile Tuner */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowProfileDrawer(!showProfileDrawer)}
            className="px-3.5 py-2 rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.08] text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>Tune Exporter Tower</span>
          </button>

          <div className="flex items-center gap-2 bg-[#111827] border border-white/[0.08] px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300">
            <span className="text-emerald-400 font-semibold">+{stats.savedCount} Saved</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">{stats.passedCount} Passed</span>
          </div>
        </div>
      </div>

      {/* Tuner Drawer */}
      {showProfileDrawer && (
        <form
          onSubmit={handleUpdateProfile}
          className="p-6 rounded-xl bg-[#111827] border border-white/[0.1] space-y-4"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">
                Tower A: Exporter Embedding Calibration
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowProfileDrawer(false)}
              className="text-slate-400 hover:text-white text-xs transition"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                Product Category
              </label>
              <select
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
              >
                <option value="textiles">Textiles & Apparel (HS 6109)</option>
                <option value="solar">Solar Cells & Clean Energy (HS 8541)</option>
                <option value="automotive">Automotive Components (HS 8708)</option>
                <option value="pharma">Pharmaceuticals (HS 3004)</option>
                <option value="machinery">Machinery & Equipment (HS 8471)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                Monthly Capacity (Tons)
              </label>
              <input
                type="number"
                min="10"
                max="5000"
                value={monthlyCapacityTons}
                onChange={(e) => setMonthlyCapacityTons(Number(e.target.value))}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                Certifications Held
              </label>
              <input
                type="text"
                value={certifications.join(", ")}
                onChange={(e) =>
                  setCertifications(e.target.value.split(",").map((c) => c.trim()).filter(Boolean))
                }
                placeholder="ISO 9001, OEKO-TEX Standard 100, CE Mark"
                className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={updatingProfile}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
            >
              {updatingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Re-rank Recommendations with AI</span>
            </button>
          </div>
        </form>
      )}

      {/* Main Card Deck */}
      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-sm font-medium">Computing Two-Tower embeddings & capacity fits...</span>
        </div>
      ) : currentIndex >= recommendations.length ? (
        <div className="p-12 text-center bg-[#111827] rounded-2xl border border-white/[0.08] space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">All Candidates Evaluated</h2>
            <p className="text-xs text-slate-400 mt-1">
              You converted {stats.savedCount} prospective buyers into CRM Leads. Review them in your Lead Pipeline.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setCurrentIndex(0);
                setStats({ savedCount: 0, passedCount: 0 });
              }}
              className="px-4 py-2 rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.08] text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Review Deck Again</span>
            </button>
            <Link
              href={`/workspace/${workspaceId}/leads`}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <span>View Lead Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="relative max-w-2xl mx-auto">
          <div className="relative">
            {/* Background Stack Preview */}
            {nextBuyer && (
              <div className="absolute top-2.5 inset-x-2.5 h-full rounded-2xl bg-[#111827]/40 border border-white/[0.05] scale-95 opacity-50 pointer-events-none -z-10" />
            )}

            {/* Active Card */}
            <div
              className={`rounded-2xl bg-[#111827] border border-white/[0.08] shadow-xl overflow-hidden transition-all duration-300 ${
                lastAction === "accepted"
                  ? "translate-x-12 rotate-2 opacity-0 border-emerald-500"
                  : lastAction === "passed"
                  ? "-translate-x-12 -rotate-2 opacity-0 border-rose-500"
                  : ""
              }`}
            >
              {/* Card Banner Header */}
              <div className="p-6 bg-gradient-to-r from-slate-900 to-[#1e293b] border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded bg-white/[0.1] text-white font-mono font-bold text-xs">
                      {currentBuyer.country_code}
                    </span>
                    <span className="text-xs text-slate-400">
                      {currentBuyer.city || "International Direct"}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    {currentBuyer.company_name}
                  </h2>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Sector: <span className="text-slate-200">{currentBuyer.primary_sector}</span>
                  </div>
                </div>

                {/* Match Score Badge */}
                <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center shrink-0">
                  <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                    Compatibility
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                    {Math.round(currentBuyer.compatibility_score)}%
                  </div>
                  <div className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                    {currentBuyer.match_tier}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-5">
                {/* 1. XAI Feature Attribution Breakdown */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Explainable AI (XAI) Attribution Match</span>
                  </div>

                  <div className="space-y-1.5">
                    {currentBuyer.reasons.map((reason, ri) => (
                      <div
                        key={ri}
                        className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>

                  {/* Factor Breakdown Bars */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 border-t border-white/[0.06] text-center">
                    <div>
                      <div className="text-[9px] uppercase font-semibold text-slate-400">Embedding Sim</div>
                      <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                        {currentBuyer.factor_breakdown.product_similarity_pts} pts
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-semibold text-slate-400">Capacity Fit</div>
                      <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                        {currentBuyer.factor_breakdown.capacity_alignment_pts} pts
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-semibold text-slate-400">Compliance</div>
                      <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                        {currentBuyer.factor_breakdown.compliance_match_pts} pts
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-semibold text-slate-400">Corridor</div>
                      <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                        {currentBuyer.factor_breakdown.corridor_alignment_pts} pts
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Operational Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-blue-400" />
                      Annual Demand
                    </div>
                    <div className="text-sm font-bold font-mono text-white mt-1">
                      ${(currentBuyer.annual_import_volume_usd / 1_000_000).toFixed(1)}M USD
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                      <Container className="w-3 h-3 text-emerald-400" />
                      Avg Order Size
                    </div>
                    <div className="text-sm font-bold font-mono text-white mt-1">
                      {currentBuyer.avg_order_tons} Tons
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                      <Ship className="w-3 h-3 text-indigo-400" />
                      Incoterm Preferred
                    </div>
                    <div className="text-sm font-bold font-mono text-white mt-1">
                      {currentBuyer.preferred_incoterms || "CIF"}
                    </div>
                  </div>
                </div>

                {/* 3. Mandatory Certifications Required */}
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1.5">
                    Buyer Mandated Certifications
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentBuyer.required_certifications.map((cert, ci) => (
                      <span
                        key={ci}
                        className="px-2.5 py-1 rounded text-xs font-medium bg-white/[0.04] text-slate-200 border border-white/[0.08]"
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 4. Provenance & Proven Reliability */}
                <div className="pt-3 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{currentBuyer.reliability_score}% Customs Reliability Score</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">
                    {currentBuyer.customs_manifest_provenance}
                  </div>
                </div>
              </div>

              {/* Swipe Control Action Bar */}
              <div className="p-5 bg-white/[0.02] border-t border-white/[0.08] flex items-center justify-center gap-6">
                {/* Dismiss */}
                <button
                  onClick={() => handleSwipe("pass")}
                  disabled={swiping}
                  title="Swipe Left: Pass Candidate"
                  className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.1] hover:border-rose-500/40 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 flex items-center justify-center transition disabled:opacity-50"
                >
                  <X className="w-6 h-6" />
                </button>

                {/* Deck Counter */}
                <div className="text-center px-4 font-mono">
                  <span className="text-xs font-semibold text-slate-300 block">
                    Candidate {currentIndex + 1} / {recommendations.length}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Keyboard or Buttons
                  </span>
                </div>

                {/* Accept */}
                <button
                  onClick={() => handleSwipe("accept")}
                  disabled={swiping}
                  title="Swipe Right: Convert to CRM Lead"
                  className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center justify-center transition disabled:opacity-50"
                >
                  <Check className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
