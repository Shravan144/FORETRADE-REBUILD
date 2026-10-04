"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Globe,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Loader2,
  DollarSign,
  Percent,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Boxes,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface CorridorItem {
  id: string;
  origin_country: string;
  destination_country: string;
  hs_code: string;
  year: number;
  trade_value_usd: number;
  net_weight_kg?: number;
  unit_value_usd_per_kg?: number;
  yoy_growth_pct?: number;
  source_dataset: string;
}

interface ForecastData {
  origin_country: string;
  destination_country: string;
  hs_code: string;
  historical_years: number[];
  historical_values_usd: number[];
  forecast_12m: {
    year: number;
    projected_usd: number;
    ci_80_lower: number;
    ci_80_upper: number;
    ci_95_lower: number;
    ci_95_upper: number;
  };
  forecast_24m: {
    year: number;
    projected_usd: number;
    ci_80_lower: number;
    ci_80_upper: number;
    ci_95_lower: number;
    ci_95_upper: number;
  };
  projected_cagr_pct: number;
  opportunity_index: number;
  opportunity_tier: string;
  unit_value_trend: string;
  risk_adjusted_rating: string;
  explanation_factors: string[];
}

interface TariffData {
  exporter_country: string;
  importer_country: string;
  hs_code: string;
  shipment_value_usd: number;
  mfn_applied_rate_pct: number;
  preferential_rate_pct: number;
  tariff_savings_pct: number;
  duty_under_mfn_usd: number;
  duty_under_fta_usd: number;
  duty_savings_usd: number;
  agreement_name: string;
  rules_of_origin?: string;
}

interface CountryRiskData {
  country_code: string;
  country_name: string;
  political_stability_score: number;
  rule_of_law_score: number;
  regulatory_quality_score: number;
  composite_risk_score: number;
  risk_tier: string;
  currency_code: string;
  fx_volatility_pct: number;
}

interface ComplianceMatrixData {
  destination_country: string;
  destination_country_name: string;
  hs_code: string;
  sector_name: string;
  customs_entry_clearance_complexity: string;
  mandatory_certificates: Array<{
    certificate_name: string;
    issuing_authority_agency: string;
    is_mandatory: boolean;
    purpose: string;
    estimated_lead_time_days: number;
    testing_or_audit_requirement: string;
    penalties_or_consequences: string;
  }>;
  recommended_commercial_standards: Array<{
    certificate_name: string;
    issuing_authority_agency: string;
    is_mandatory: boolean;
    purpose: string;
    estimated_lead_time_days: number;
    testing_or_audit_requirement: string;
    penalties_or_consequences: string;
  }>;
  customs_declaration_documents: string[];
  border_inspection_protocols: string;
}

const DESTINATION_OPTIONS = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
];

const HS_OPTIONS = [
  { code: "6109", label: "HS 6109 - Cotton T-Shirts & Knitted Apparel", sector: "Textiles" },
  { code: "8541", label: "HS 8541 - Solar Cells & Photovoltaic Modules", sector: "Clean Energy" },
  { code: "3004", label: "HS 3004 - Packaged Medicaments & Pharma", sector: "Pharma" },
  { code: "8708", label: "HS 8708 - Commercial Motor Vehicle Parts", sector: "Automotive" },
  { code: "8471", label: "HS 8471 - Data Processing & Electronics", sector: "Tech" },
  { code: "8483", label: "HS 8483 - Transmission Shafts & Gears", sector: "Engineering" },
  { code: "2902", label: "HS 2902 - Cyclic Hydrocarbons & Chemicals", sector: "Chemicals" },
  { code: "1006", label: "HS 1006 - Semi-Milled / Basmati Rice", sector: "Agri-Food" },
  { code: "9018", label: "HS 9018 - Medical & Diagnostic Instruments", sector: "Healthcare" },
];

export default function MarketExplorerPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  // Selected Corridor State
  const [selectedCountry, setSelectedCountry] = useState<string>("US");
  const [selectedHs, setSelectedHs] = useState<string>("6109");
  const [shipmentValue, setShipmentValue] = useState<number>(100000);

  // Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [corridorFlows, setCorridorFlows] = useState<CorridorItem[]>([]);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [tariff, setTariff] = useState<TariffData | null>(null);
  const [countryRisk, setCountryRisk] = useState<CountryRiskData | null>(null);
  const [complianceMatrix, setComplianceMatrix] = useState<ComplianceMatrixData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Corridor Intelligence Data
  useEffect(() => {
    async function loadCorridorIntelligence() {
      try {
        setLoading(true);
        setErrorMessage(null);

        const [corridorsRes, forecastRes, tariffRes, riskRes, complianceRes] = await Promise.all([
          api.getCorridors({
            origin_country: "IN",
            destination_country: selectedCountry,
            hs_code: selectedHs,
          }),
          api.getForecast({
            origin_country: "IN",
            destination_country: selectedCountry,
            hs_code: selectedHs,
          }).catch((err) => {
            console.warn("Forecast unavailable for this pair:", err);
            return null;
          }),
          api.getTariffs({
            importer_country: selectedCountry,
            hs_code: selectedHs,
            exporter_country: "IN",
            shipment_value_usd: shipmentValue,
          }).catch(() => null),
          api.getCountryRisk(selectedCountry).catch(() => null),
          api.getComplianceMatrix({
            destination_country: selectedCountry,
            hs_code: selectedHs,
          }).catch(() => null),
        ]);

        setCorridorFlows(corridorsRes.items || []);
        setForecast(forecastRes);
        setTariff(tariffRes);
        setCountryRisk(riskRes);
        setComplianceMatrix(complianceRes);
      } catch (err: any) {
        console.error("Failed to load corridor intelligence:", err);
        setErrorMessage(err.message || "Failed to load corridor intelligence.");
      } finally {
        setLoading(false);
      }
    }

    loadCorridorIntelligence();
  }, [selectedCountry, selectedHs, shipmentValue]);

  // Transform Chart Data
  const chartData = (() => {
    if (!forecast) {
      return [...corridorFlows]
        .sort((a, b) => a.year - b.year)
        .map((f) => ({
          year: f.year.toString(),
          historical: Math.round(f.trade_value_usd),
          historicalMillions: Number((f.trade_value_usd / 1_000_000).toFixed(2)),
        }));
    }

    const points: any[] = [];

    // Historical Points
    forecast.historical_years.forEach((yr, idx) => {
      const val = forecast.historical_values_usd[idx];
      points.push({
        year: yr.toString(),
        historical: Math.round(val),
        historicalMillions: Number((val / 1_000_000).toFixed(2)),
        forecast: null,
        ci80Lower: null,
        ci80Upper: null,
        ci95Lower: null,
        ci95Upper: null,
      });
    });

    // Bridge the last historical point to forecast line
    const lastHistYear = forecast.historical_years[forecast.historical_years.length - 1];
    const lastHistVal = forecast.historical_values_usd[forecast.historical_values_usd.length - 1];
    const lastPoint = points.find((p) => p.year === lastHistYear.toString());
    if (lastPoint) {
      lastPoint.forecast = Math.round(lastHistVal);
      lastPoint.ci80Lower = Math.round(lastHistVal);
      lastPoint.ci80Upper = Math.round(lastHistVal);
    }

    // 12M Forecast Point
    const f12 = forecast.forecast_12m;
    points.push({
      year: `${f12.year} (12M)`,
      historical: null,
      forecast: Math.round(f12.projected_usd),
      forecastMillions: Number((f12.projected_usd / 1_000_000).toFixed(2)),
      ci80Lower: Math.round(f12.ci_80_lower),
      ci80Upper: Math.round(f12.ci_80_upper),
      ci95Lower: Math.round(f12.ci_95_lower),
      ci95Upper: Math.round(f12.ci_95_upper),
    });

    // 24M Forecast Point
    const f24 = forecast.forecast_24m;
    points.push({
      year: `${f24.year} (24M)`,
      historical: null,
      forecast: Math.round(f24.projected_usd),
      forecastMillions: Number((f24.projected_usd / 1_000_000).toFixed(2)),
      ci80Lower: Math.round(f24.ci_80_lower),
      ci80Upper: Math.round(f24.ci_80_upper),
      ci95Lower: Math.round(f24.ci_95_lower),
      ci95Upper: Math.round(f24.ci_95_upper),
    });

    return points;
  })();

  const selectedCountryMeta = DESTINATION_OPTIONS.find((c) => c.code === selectedCountry);
  const selectedHsMeta = HS_OPTIONS.find((h) => h.code === selectedHs);
  const latestFlow = corridorFlows.sort((a, b) => b.year - a.year)[0];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              Corridor Intelligence
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Model 1: Demand Forecaster
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Destination Market Explorer & 12M Forecaster
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real UN Comtrade bilateral trade flows calibrated with Log-Linear OLS forecasting and WTO tariff schedules.
          </p>
        </div>

        {/* Dynamic Selector Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Destination Market
            </span>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
            >
              {DESTINATION_OPTIONS.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#0B0F19]">
                  {c.flag} {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Product / HS Code
            </span>
            <select
              value={selectedHs}
              onChange={(e) => setSelectedHs(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
            >
              {HS_OPTIONS.map((h) => (
                <option key={h.code} value={h.code} className="bg-[#0B0F19]">
                  {h.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Metric Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Latest Flow */}
        <div className="p-5 rounded-xl bg-[#111827] border border-white/[0.08] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Annual Flow ({latestFlow?.year || 2025})</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-white">
              ${latestFlow ? (latestFlow.trade_value_usd / 1_000_000).toFixed(1) : "—"}M USD
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
              <span className="text-slate-300">
                {latestFlow?.unit_value_usd_per_kg ? `$${latestFlow.unit_value_usd_per_kg.toFixed(2)}/kg` : "Verified flow"}
              </span>
              <span>• UN Comtrade</span>
            </div>
          </div>
        </div>

        {/* 12M Forecast */}
        <div className="p-5 rounded-xl bg-[#111827] border border-white/[0.08] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>12-Month Forecast ({forecast?.forecast_12m.year || 2026})</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-emerald-400">
              ${forecast ? (forecast.forecast_12m.projected_usd / 1_000_000).toFixed(1) : "—"}M USD
            </div>
            <div className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
              <span>CAGR: {forecast ? (forecast.projected_cagr_pct > 0 ? `+${forecast.projected_cagr_pct}%` : `${forecast.projected_cagr_pct}%`) : "—"}</span>
              <span className="text-slate-500 font-sans">• Log-Linear</span>
            </div>
          </div>
        </div>

        {/* Opportunity Score */}
        <div className="p-5 rounded-xl bg-[#111827] border border-white/[0.08] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Opportunity Score</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">
                {forecast?.opportunity_index || 0}
              </span>
              <span className="text-xs font-mono text-slate-500">/ 100</span>
            </div>
            <div className="text-[11px] mt-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {forecast?.opportunity_tier || "Evaluating"} (Grade {forecast?.risk_adjusted_rating || "B"})
              </span>
            </div>
          </div>
        </div>

        {/* Duty Concession */}
        <div className="p-5 rounded-xl bg-[#111827] border border-white/[0.08] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Duty Concession (FTA)</span>
            <Percent className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-purple-400">
              {tariff ? `${tariff.preferential_rate_pct}% Duty` : "5.0% MFN"}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              {tariff && tariff.tariff_savings_pct > 0 ? (
                <span className="text-emerald-400 font-semibold font-mono">
                  Saves {tariff.tariff_savings_pct}% vs MFN rate
                </span>
              ) : (
                <span>Standard WTO Applied Tariff</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Forecast Chart */}
      <div className="p-6 rounded-xl bg-[#111827] border border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span>UN Comtrade Historical Flow vs. Model 1 ML Forecast</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Log-Linear Time-Series
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Shaded confidence envelopes display the 80% statistical interval representing market demand volatility.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Actual Flow</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>12M / 24M Forecast</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-80 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs">Computing time-series forecasting equations...</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-slate-400 text-sm">
            No historical trade records found for this corridor combination.
          </div>
        ) : (
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 15, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="year"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(val) => `$${(val / 1_000_000).toFixed(0)}M`}
                />
                <Tooltip
                  formatter={(val: any, name: any) => {
                    if (val === null || val === undefined) return ["—", name];
                    const num = Number(val);
                    return [`$${(num / 1_000_000).toFixed(2)}M USD`, name];
                  }}
                  contentStyle={{
                    backgroundColor: "#0b0f19",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "15px", fontSize: "12px" }}
                />

                {/* 80% Confidence Interval Band */}
                <Area
                  type="monotone"
                  dataKey="ci80Upper"
                  name="80% Upper Confidence Bound"
                  stroke="#059669"
                  fill="#059669"
                  fillOpacity={0.15}
                />
                <Area
                  type="monotone"
                  dataKey="ci80Lower"
                  name="80% Lower Confidence Bound"
                  stroke="#059669"
                  fill="#0b0f19"
                  fillOpacity={1}
                />

                {/* Historical Line */}
                <Line
                  type="monotone"
                  dataKey="historical"
                  name="Actual Bilateral Trade (USD)"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#3b82f6" }}
                  activeDot={{ r: 6 }}
                />

                {/* Forecast Line */}
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Projected Forecast Demand"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={{ r: 5, fill: "#10b981" }}
                  activeDot={{ r: 7 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Two Columns: Forecast Attribution & Tariff Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Model 1 Explainability Factors */}
        <div className="p-6 rounded-xl bg-[#111827] border border-white/[0.08] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Model 1: Forecast Attribution & Dynamics
                </h3>
                <p className="text-xs text-slate-400">
                  Key drivers determining the corridor demand momentum score.
                </p>
              </div>
            </div>

            {forecast ? (
              <div className="mt-4 space-y-2.5">
                {forecast.explanation_factors.map((factor, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs text-slate-300 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{factor}</span>
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
                    <span className="text-[10px] uppercase font-semibold text-blue-400 tracking-wider">
                      Pricing Trend
                    </span>
                    <div className="text-sm font-semibold text-white mt-1">
                      {forecast.unit_value_trend}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                    <span className="text-[10px] uppercase font-semibold text-emerald-400 tracking-wider">
                      Corridor Rating
                    </span>
                    <div className="text-sm font-semibold text-white mt-1">
                      Grade {forecast.risk_adjusted_rating}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                Forecast explanations will appear once data loads.
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Model: Log-Linear OLS with Studentized Errors</span>
            <span>Confidence: 80% & 95%</span>
          </div>
        </div>

        {/* Right: Tariff Advantage & Destination Risk */}
        <div className="p-6 rounded-xl bg-[#111827] border border-white/[0.08] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Tariff Advantage & Destination Governance
                </h3>
                <p className="text-xs text-slate-400">
                  Preferential trade treaty benefits and World Bank risk indicators.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {/* Tariff Calculator Card */}
              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      {tariff?.agreement_name || "WTO Most-Favoured-Nation Schedule"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Savings = Shipment Value × (MFN Tariff % − Preferential FTA %)
                    </span>
                  </div>
                  {tariff && tariff.preferential_rate_pct === 0 ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 self-start sm:self-auto">
                      0% Duty Free
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/[0.05] text-slate-300 self-start sm:self-auto">
                      Applied Tariff
                    </span>
                  )}
                </div>

                {/* Shipment Value Input */}
                <div className="p-3 rounded-lg bg-[#0B0F19] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                      Simulated Cargo Value (USD)
                    </label>
                    <div className="text-[11px] text-slate-400">
                      Adjust cargo value to compute customs duty savings
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">$</span>
                    <input
                      type="number"
                      step="5000"
                      min="1000"
                      value={shipmentValue}
                      onChange={(e) => setShipmentValue(Number(e.target.value) || 0)}
                      className="w-32 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-white/[0.12] bg-[#111827] text-white focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Tariff Rates Grid */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                  <div className="bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.06]">
                    <div className="text-[9px] text-slate-400 uppercase font-sans">MFN ({tariff?.mfn_applied_rate_pct ?? 5.0}%)</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      ${tariff?.duty_under_mfn_usd ? tariff.duty_under_mfn_usd.toLocaleString() : "—"}
                    </div>
                    <div className="text-[9px] text-slate-500 font-sans">Standard duty</div>
                  </div>

                  <div className="bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.06]">
                    <div className="text-[9px] text-emerald-400 uppercase font-sans">FTA ({tariff?.preferential_rate_pct ?? 5.0}%)</div>
                    <div className="text-xs font-bold text-emerald-400 mt-0.5">
                      ${tariff?.duty_under_fta_usd !== undefined ? tariff.duty_under_fta_usd.toLocaleString() : "—"}
                    </div>
                    <div className="text-[9px] text-emerald-400/80 font-sans">With cert</div>
                  </div>

                  <div className="bg-purple-500/10 p-2.5 rounded-lg border border-purple-500/20">
                    <div className="text-[9px] text-purple-400 font-bold uppercase font-sans">Savings</div>
                    <div className="text-xs font-bold text-purple-300 mt-0.5">
                      ${tariff?.duty_savings_usd ? tariff.duty_savings_usd.toLocaleString() : "0"}
                    </div>
                    <div className="text-[9px] text-purple-400 font-sans">
                      {tariff?.tariff_savings_pct ?? 0}% margin saved
                    </div>
                  </div>
                </div>
              </div>

              {/* World Bank Governance Tier */}
              {countryRisk && (
                <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white">
                      World Bank Country Risk Profile
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        countryRisk.risk_tier === "Low Risk"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {countryRisk.risk_tier}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                    <div className="bg-white/[0.02] p-2 rounded border border-white/[0.06]">
                      <div className="text-[9px] text-slate-400 uppercase font-sans">Rule of Law</div>
                      <div className="text-xs font-bold text-white mt-0.5">
                        {countryRisk.rule_of_law_score}
                      </div>
                    </div>
                    <div className="bg-white/[0.02] p-2 rounded border border-white/[0.06]">
                      <div className="text-[9px] text-slate-400 uppercase font-sans">Reg. Quality</div>
                      <div className="text-xs font-bold text-white mt-0.5">
                        {countryRisk.regulatory_quality_score}
                      </div>
                    </div>
                    <div className="bg-white/[0.02] p-2 rounded border border-white/[0.06]">
                      <div className="text-[9px] text-slate-400 uppercase font-sans">FX Volatility</div>
                      <div className="text-xs font-bold text-white mt-0.5">
                        {countryRisk.fx_volatility_pct}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>WTO Tariff Facility & World Bank WGI</span>
            <span>Currency: {countryRisk?.currency_code || "USD"}</span>
          </div>
        </div>
      </div>

      {/* Automated Compliance & Certification Matrix Section */}
      <div className="p-6 rounded-xl bg-[#111827] border border-white/[0.08] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Customs Compliance Matrix
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                  complianceMatrix?.customs_entry_clearance_complexity === "High Risk / Stringent"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : complianceMatrix?.customs_entry_clearance_complexity === "Strict / Document-Heavy"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                Clearance: {complianceMatrix?.customs_entry_clearance_complexity || "Standard"}
              </span>
            </div>
            <h2 className="text-base font-semibold text-white">
              Mandatory Customs Certificates & Compliance Protocols ({selectedCountryMeta?.name || selectedCountry})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Official regulatory certificates required to prevent cargo detention, port seizure, or fines for {selectedHsMeta?.label}.
            </p>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2 font-mono">
            <span>Destination: <strong className="text-white">{complianceMatrix?.destination_country_name || selectedCountry}</strong></span>
            <span>•</span>
            <span>Sector: <strong className="text-white">{complianceMatrix?.sector_name || "General Goods"}</strong></span>
          </div>
        </div>

        {/* Mandatory Certificates Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Mandatory Customs Entry Certificates (Non-Negotiable)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complianceMatrix?.mandatory_certificates.map((cert, ci) => (
              <div
                key={ci}
                className="p-4 rounded-xl bg-white/[0.02] border border-rose-500/20 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                    <span>{cert.certificate_name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                    ~{cert.estimated_lead_time_days} Days Lead
                  </span>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed">
                  <span className="text-slate-400">Purpose:</span> {cert.purpose}
                </div>

                <div className="p-2.5 rounded-lg bg-[#0B0F19] border border-white/[0.06] text-[11px] text-slate-400 space-y-1">
                  <div>
                    <span className="text-slate-300">Issuing Body:</span> {cert.issuing_authority_agency}
                  </div>
                  <div>
                    <span className="text-slate-300">Testing / Audit:</span> {cert.testing_or_audit_requirement}
                  </div>
                  <div className="text-rose-400">
                    <span>Non-Compliance:</span> {cert.penalties_or_consequences}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Standards & Documents */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Recommended Commercial Standards */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Recommended Commercial Quality & ESG Standards</span>
            </h3>

            <div className="space-y-3">
              {complianceMatrix?.recommended_commercial_standards.map((rec, ri) => (
                <div
                  key={ri}
                  className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{rec.certificate_name}</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {rec.issuing_authority_agency}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">{rec.purpose}</p>
                  <div className="text-[11px] text-amber-400">
                    Commercial Impact: {rec.penalties_or_consequences}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Border Declaration Pack */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-blue-400" />
              <span>Customs Entry Declaration Pack</span>
            </h3>

            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1.5">
                  Required Documents for Clearance Broker
                </span>
                <ul className="space-y-1.5">
                  {complianceMatrix?.customs_declaration_documents.map((doc, di) => (
                    <li key={di} className="flex items-center gap-2 text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-white/[0.06]">
                <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Destination Port Inspection Protocol
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {complianceMatrix?.border_inspection_protocols}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
