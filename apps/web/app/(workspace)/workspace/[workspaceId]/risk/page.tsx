"use client";

import { use, useEffect, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Info,
  CheckCircle2,
  Sliders,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";

interface BuyerItem {
  id: string;
  company_name: string;
  country_code: string;
  annual_import_volume_usd: number;
  reliability_score: number;
  preferred_incoterms: string | null;
}

export default function TradeRiskSimulatorPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  // Loading & Data State
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [buyers, setBuyers] = useState<BuyerItem[]>([]);
  const [countryRisk, setCountryRisk] = useState<any | null>(null);
  const [assessment, setAssessment] = useState<any | null>(null);

  // Form Inputs
  const [destinationCountry, setDestinationCountry] = useState<string>("US");
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>("");
  const [customBuyerName, setCustomBuyerName] = useState<string>("");
  const [invoiceAmount, setInvoiceAmount] = useState<number>(75000);
  const [paymentTerms, setPaymentTerms] = useState<string>("open_account");

  // Load buyers and initial risk profile
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const buyerData = await api.getGlobalBuyers().catch(() => ({ total: 0, items: [] }));
        setBuyers(buyerData.items || []);
        if (buyerData.items && buyerData.items.length > 0) {
          setSelectedBuyerId(buyerData.items[0].id);
          setDestinationCountry(buyerData.items[0].country_code);
        }
      } catch (err) {
        console.warn("Could not load global buyers:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [workspaceId]);

  // Whenever country or payment terms change, load country risk & evaluate
  useEffect(() => {
    if (!destinationCountry) return;
    loadCountryRiskAndAssess();
  }, [destinationCountry, selectedBuyerId, customBuyerName, invoiceAmount, paymentTerms]);

  async function loadCountryRiskAndAssess() {
    try {
      setEvaluating(true);
      // 1. Fetch World Bank Country Risk
      const cr = await api.getCountryRisk(destinationCountry).catch(() => null);
      if (cr) setCountryRisk(cr);

      // 2. Assess Transaction Risk with Model 3 XGBoost
      const activeBuyer = buyers.find((b) => b.id === selectedBuyerId);
      const res = await api.assessTransactionRisk({
        destination_country: destinationCountry,
        invoice_amount_usd: Number(invoiceAmount) || 50000,
        payment_terms: paymentTerms,
        buyer_id: activeBuyer ? activeBuyer.id : undefined,
        buyer_name: activeBuyer ? activeBuyer.company_name : (customBuyerName || undefined),
      }).catch(() => null);
      if (res) setAssessment(res);
    } catch (err) {
      console.warn("Risk assessment error:", err);
    } finally {
      setEvaluating(false);
    }
  }

  const selectedBuyer = buyers.find((b) => b.id === selectedBuyerId);

  const countries = [
    { code: "US", label: "United States (US)" },
    { code: "DE", label: "Germany (DE)" },
    { code: "AE", label: "United Arab Emirates (AE)" },
    { code: "GB", label: "United Kingdom (GB)" },
    { code: "EG", label: "Egypt (EG)" },
    { code: "KE", label: "Kenya (KE)" },
    { code: "JP", label: "Japan (JP)" },
    { code: "AU", label: "Australia (AU)" },
    { code: "TR", label: "Turkey (TR)" },
    { code: "NG", label: "Nigeria (NG)" },
    { code: "BD", label: "Bangladesh (BD)" },
  ];

  const paymentTermOptions = [
    {
      key: "advance",
      label: "100% Cash in Advance",
      desc: "Zero default exposure. Payment confirmed prior to cargo dispatch.",
      badge: "Safest",
      color: "emerald",
    },
    {
      key: "lc",
      label: "Confirmed Irrevocable Letter of Credit (ILC)",
      desc: "Payment guaranteed by issuing & confirming international banks.",
      badge: "Bank Backed",
      color: "blue",
    },
    {
      key: "cad",
      label: "Cash Against Documents (CAD / DP)",
      desc: "Buyer receives shipping documents & BoL only upon bank payment.",
      badge: "Moderate",
      color: "amber",
    },
    {
      key: "open_account",
      label: "Open Account (Net 30/60/90 Days)",
      desc: "Goods released on commercial trust; maximum exporter default risk.",
      badge: "High Risk",
      color: "rose",
    },
  ];

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
          <p className="text-sm font-medium">Loading World Bank Indicators & XGBoost Risk Classifier...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-[1440px] mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Cross-Border Trade Risk Simulator
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Model 3 XGBoost Classifier: Commercial default probability, currency devaluation volatility, and terms risk attribution.
          </p>
        </div>

        {/* Quick Scenario Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Quick What-If:</span>
          <button
            onClick={() => setPaymentTerms("lc")}
            className="px-3 py-1 text-xs font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded transition"
          >
            Switch to Confirmed LC
          </button>
          <button
            onClick={() => setPaymentTerms("open_account")}
            className="px-3 py-1 text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded transition"
          >
            Stress Test Open Account
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Interactive Scenario Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#111827] rounded-xl border border-white/[0.08] p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-rose-400" />
                Transaction Parameters
              </h2>
              {evaluating && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Live Scoring
                </span>
              )}
            </div>

            {/* Buyer Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Overseas Counterparty / Importer
              </label>
              <select
                value={selectedBuyerId}
                onChange={(e) => {
                  const bId = e.target.value;
                  setSelectedBuyerId(bId);
                  const found = buyers.find((b) => b.id === bId);
                  if (found) {
                    setDestinationCountry(found.country_code);
                  }
                }}
                className="w-full px-3 py-2 text-xs border border-white/[0.12] rounded-lg bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
              >
                <option value="" className="bg-[#0B0F19]">-- Custom / Prospective Buyer --</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id} className="bg-[#0B0F19]">
                    {b.company_name} ({b.country_code}) — Vol: ${(b.annual_import_volume_usd / 1_000_000).toFixed(1)}M/yr
                  </option>
                ))}
              </select>

              {!selectedBuyerId && (
                <input
                  type="text"
                  placeholder="Enter Prospective Buyer Name..."
                  value={customBuyerName}
                  onChange={(e) => setCustomBuyerName(e.target.value)}
                  className="mt-2 w-full px-3 py-2 text-xs border border-white/[0.12] rounded-lg bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
                />
              )}

              {selectedBuyer && (
                <div className="mt-2 p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span>Customs Reliability: <strong className="text-white">{selectedBuyer.reliability_score}/100</strong></span>
                  <span>Annual Import: <strong className="text-white">${(selectedBuyer.annual_import_volume_usd / 1_000_000).toFixed(1)}M USD</strong></span>
                </div>
              )}
            </div>

            {/* Destination Country */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Destination Market / Jurisdiction
              </label>
              <select
                value={destinationCountry}
                onChange={(e) => setDestinationCountry(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-white/[0.12] rounded-lg bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code} className="bg-[#0B0F19]">
                    {c.label}
                  </option>
                ))}
              </select>

              {countryRisk && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-mono">
                  <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded">
                    <span className="text-slate-500 block">Rule of Law</span>
                    <strong className="text-white">{countryRisk.rule_of_law_score > 0 ? "+" : ""}{countryRisk.rule_of_law_score.toFixed(2)}</strong>
                  </div>
                  <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded">
                    <span className="text-slate-500 block">FX Volatility</span>
                    <strong className="text-white">{countryRisk.fx_volatility_pct}%</strong>
                  </div>
                  <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded">
                    <span className="text-slate-500 block">Risk Tier</span>
                    <strong className="text-white">{countryRisk.risk_tier}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Invoice Amount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-400">
                  Transaction Invoice Value (USD)
                </label>
                <span className="text-xs font-bold font-mono text-white">
                  ${Number(invoiceAmount).toLocaleString()} USD
                </span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                  $
                </span>
                <input
                  type="number"
                  min="1000"
                  step="5000"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 text-xs font-mono border border-white/[0.12] rounded-lg bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
                  placeholder="75000"
                />
              </div>

              {/* Quick scale chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[25000, 50000, 100000, 250000, 500000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setInvoiceAmount(amt)}
                    className={`px-2 py-0.5 text-[10px] rounded transition font-mono ${
                      invoiceAmount === amt
                        ? "bg-rose-600 text-white font-semibold"
                        : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                    }`}
                  >
                    ${amt >= 1000000 ? amt / 1000000 + "M" : amt / 1000 + "k"}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Terms */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Payment & Financing Terms
              </label>
              <div className="space-y-2">
                {paymentTermOptions.map((opt) => (
                  <label
                    key={opt.key}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      paymentTerms === opt.key
                        ? "border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/30"
                        : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_term"
                      value={opt.key}
                      checked={paymentTerms === opt.key}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="mt-0.5 text-blue-600 focus:ring-0 bg-[#0B0F19]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{opt.label}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono ${
                            opt.color === "emerald"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : opt.color === "blue"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : opt.color === "amber"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Model 3 Risk Visuals (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {assessment && (
            <>
              {/* Main Rating Banner */}
              <div className="p-6 rounded-xl border border-white/[0.08] bg-[#111827] flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-white/[0.1] text-white uppercase tracking-wider">
                      Model 3 XGBoost Output
                    </span>
                    <span className="text-[11px] text-slate-400">ECGC / Berne Union Calibrated</span>
                  </div>
                  <h3 className={`text-2xl font-bold tracking-tight ${
                    assessment.risk_tier === "High Risk"
                      ? "text-rose-400"
                      : assessment.risk_tier === "Moderate Risk"
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}>
                    {assessment.risk_tier.toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md">
                    Assessed for {assessment.buyer_name} in {assessment.destination_country} under{" "}
                    {assessment.payment_terms.replace("_", " ")} terms (${assessment.invoice_amount_usd.toLocaleString()} USD).
                  </p>
                </div>

                <div className="bg-white/[0.04] p-4 rounded-xl text-center shrink-0 border border-white/[0.08] min-w-[130px]">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                    Risk Score
                  </span>
                  <p className="text-3xl font-bold font-mono text-white mt-0.5">{assessment.composite_risk_score}</p>
                  <span className="text-[10px] text-slate-500">Scale 0 - 100</span>
                </div>
              </div>

              {/* Softmax Probability Distribution */}
              <div className="bg-[#111827] p-5 rounded-xl border border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-blue-400" />
                    XGBoost Multi-Class Softmax Probabilities
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">Tree Depth: 3 | 50 Estimators</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Low Probability */}
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-emerald-400">Low Risk</span>
                      <strong className="font-mono text-emerald-400">
                        {(assessment.class_probabilities.low * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${assessment.class_probabilities.low * 100}%` }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Moderate Probability */}
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-amber-400">Moderate</span>
                      <strong className="font-mono text-amber-400">
                        {(assessment.class_probabilities.moderate * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${assessment.class_probabilities.moderate * 100}%` }}
                        className="h-full bg-amber-500 rounded-full"
                      />
                    </div>
                  </div>

                  {/* High Probability */}
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-rose-400">High Risk</span>
                      <strong className="font-mono text-rose-400">
                        {(assessment.class_probabilities.high * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${assessment.class_probabilities.high * 100}%` }}
                        className="h-full bg-rose-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Explainable AI: Top Risk Factors */}
              <div className="bg-[#111827] rounded-xl border border-white/[0.08] overflow-hidden">
                <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Feature Attribution & Risk Drivers
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">XAI Attribution</span>
                </div>
                <div className="p-4 divide-y divide-white/[0.06]">
                  {assessment.top_risk_factors.map((factor: string, idx: number) => (
                    <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-2.5">
                      <div className="mt-0.5 p-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                        <Info className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{factor}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actionable Risk Mitigation Playbook */}
              <div className="bg-[#111827] rounded-xl border border-white/[0.08] overflow-hidden">
                <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Exporter Protection & Mitigation Playbook
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-mono">Recommended Safeguards</span>
                </div>
                <div className="p-4 divide-y divide-white/[0.06]">
                  {assessment.mitigation_strategies.map((strategy: string, idx: number) => (
                    <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                      <div className="mt-0.5 p-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-white block mb-0.5">
                          Safeguard #{idx + 1}
                        </span>
                        <p className="text-xs text-slate-400 leading-relaxed">{strategy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
