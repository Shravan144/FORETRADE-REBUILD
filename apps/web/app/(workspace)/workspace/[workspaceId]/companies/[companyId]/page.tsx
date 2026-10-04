"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Building2,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  RefreshCw,
  Loader2,
} from "lucide-react";

export default function CompanyDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; companyId: string }>;
}) {
  const { workspaceId, companyId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [latestScore, setLatestScore] = useState<any>(null);
  const [scoring, setScoring] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [leadCreated, setLeadCreated] = useState(false);

  useEffect(() => {
    loadData();
  }, [workspaceId, companyId]);

  async function loadData() {
    try {
      setLoading(true);
      const [compRes, scoreRes] = await Promise.all([
        api.getCompany(workspaceId, companyId),
        api.getCompanyScores(workspaceId, companyId).catch(() => ({ items: [] })),
      ]);
      setCompany(compRes);
      if (scoreRes.items && scoreRes.items.length > 0) {
        setLatestScore(scoreRes.items[0]);
      } else {
        // Auto calculate initial score
        const newScore = await api.calculateScore(workspaceId, companyId).catch(() => null);
        setLatestScore(newScore);
      }
    } catch (err) {
      console.error("Failed to load company detail:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalculate() {
    setScoring(true);
    try {
      const res = await api.calculateScore(workspaceId, companyId);
      setLatestScore(res);
    } catch (err) {
      console.error("Failed to score:", err);
    } finally {
      setScoring(false);
    }
  }

  async function handlePromote() {
    setPromoting(true);
    try {
      await api.createLead(workspaceId, companyId, `Promoted with score ${latestScore?.score || 'N/A'}`);
      setLeadCreated(true);
    } catch (err: any) {
      alert(err.message === "lead_already_exists" ? "This company is already in your lead pipeline." : "Failed to create lead.");
    } finally {
      setPromoting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-sm">Loading company intelligence...</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-slate-500">Company not found.</p>
        <Link href={`/workspace/${workspaceId}/companies`} className="text-blue-600 text-sm mt-2 block">
          ← Return to Directory
        </Link>
      </div>
    );
  }

  const features = latestScore?.feature_values || {};
  const reasons: string[] = latestScore?.reason_codes || [];
  const scoreVal = latestScore?.score || 0;
  const tier = latestScore?.tier || "medium";
  const confidence = features.confidence || "medium";
  const missingInputs = features.missing_inputs || [];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Back button */}
      <div>
        <Link
          href={`/workspace/${workspaceId}/companies`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Company Directory</span>
        </Link>
      </div>

      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {company.name}
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-900 text-white">
              {company.country_code}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span>Sector: <strong className="text-slate-700 font-semibold">{company.product_or_industry}</strong></span>
            <span>•</span>
            <span>Email: <strong className="text-slate-700 font-semibold">{company.contact_email || "Direct Inquiry"}</strong></span>
            {company.website && (
              <>
                <span>•</span>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <span>Website</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRecalculate}
            disabled={scoring}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scoring ? "animate-spin text-blue-600" : ""}`} />
            <span>Recalculate</span>
          </button>

          <button
            onClick={handlePromote}
            disabled={promoting || leadCreated}
            className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 ${
              leadCreated
                ? "bg-emerald-600 text-white"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
            }`}
          >
            {promoting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : leadCreated ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>In Lead Pipeline</span>
              </>
            ) : (
              <>
                <Briefcase className="w-3.5 h-3.5" />
                <span>Promote to Lead</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 6-Factor Explainability Score Card */}
      <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Deterministic 6-Factor Opportunity Score
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Algorithm evaluates verifiable exporter-importer fit signals. No hallucinated attributes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-3xl font-extrabold text-blue-600 leading-none">
                {scoreVal} <span className="text-sm font-medium text-slate-400">/ 100</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Tier: {tier}
              </span>
            </div>
            <span
              className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                confidence === "high"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {confidence} confidence
            </span>
          </div>
        </div>

        {/* Factor Breakdown Bars */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
            Weighted Factor Decomposition
          </h3>

          {[
            { label: "Product Category Fit (30%)", value: features.product_fit ?? 50 },
            { label: "Target Market Corridor (20%)", value: features.target_market_fit ?? 50 },
            { label: "Exporter Capacity Fit (15%)", value: features.capacity_fit ?? 50 },
            { label: "Certification Alignment (15%)", value: features.certification_fit ?? 70 },
            { label: "Data Quality & Completeness (10%)", value: features.data_quality ?? 50 },
            { label: "User Priority Fit (10%)", value: features.user_priority_fit ?? 80 },
          ].map((factor) => (
            <div key={factor.label}>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>{factor.label}</span>
                <span className="font-semibold text-slate-900">{factor.value}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(factor.value, 100)}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* Reason Codes */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
            Algorithmic Reasoning Signals
          </h3>
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <span
                key={r}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
              >
                ✓ {r.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>

        {/* Missing Inputs Callout if any */}
        {missingInputs.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Confidence warning: </span>
              Score confidence is degraded due to missing inputs:{" "}
              <strong>{missingInputs.join(", ")}</strong>. Updating your exporter profile with capacity and certifications will improve evaluation confidence.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
