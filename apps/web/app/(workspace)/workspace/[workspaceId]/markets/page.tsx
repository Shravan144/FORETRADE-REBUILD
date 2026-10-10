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
  { code: "6109.10", label: "HS 6109.10 - Cotton T-Shirts, Knitted (6-digit)", sector: "Textiles" },
  { code: "8541", label: "HS 8541 - Solar Cells & Photovoltaic Modules", sector: "Clean Energy" },
  { code: "8541.40", label: "HS 8541.40 - Photovoltaic Solar Modules (6-digit)", sector: "Clean Energy" },
  { code: "3004", label: "HS 3004 - Packaged Medicaments & Pharma", sector: "Pharma" },
  { code: "3004.90", label: "HS 3004.90 - Generic Formulations & APIs (6-digit)", sector: "Pharma" },
  { code: "8708", label: "HS 8708 - Commercial Motor Vehicle Parts", sector: "Automotive" },
  { code: "8708.40", label: "HS 8708.40 - Gear Boxes & Transmissions (6-digit)", sector: "Automotive" },
  { code: "8471", label: "HS 8471 - Data Processing & Electronics", sector: "Tech" },
  { code: "8483", label: "HS 8483 - Transmission Shafts & Gears", sector: "Engineering" },
  { code: "2902", label: "HS 2902 - Cyclic Hydrocarbons & Chemicals", sector: "Chemicals" },
  { code: "1006", label: "HS 1006 - Semi-Milled / Basmati Rice", sector: "Agri-Food" },
  { code: "1006.30", label: "HS 1006.30 - Wholly Milled Basmati Rice (6-digit)", sector: "Agri-Food" },
  { code: "9018", label: "HS 9018 - Medical & Diagnostic Instruments", sector: "Healthcare" },
  { code: "9018.90", label: "HS 9018.90 - Surgical & Diagnostic Instruments (6-digit)", sector: "Healthcare" },
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
  const [customHsInput, setCustomHsInput] = useState<string>("");
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
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-800">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              Corridor Intelligence
            </span>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Model 1: Demand Forecaster
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Destination Market Explorer & 12M Forecaster
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real UN Comtrade bilateral trade flows calibrated with Log-Linear OLS forecasting and WTO tariff schedules.
          </p>
        </div>

        {/* Dynamic Selector Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Destination Market
            </span>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 shadow-2xs focus:border-blue-600 focus:ring-1 focus:ring-blue-500/20 outline-none"
            >
              {DESTINATION_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Product / HS Code
            </span>
            <select
              value={selectedHs}
              onChange={(e) => {
                setSelectedHs(e.target.value);
                setCustomHsInput("");
              }}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 shadow-2xs focus:border-blue-600 focus:ring-1 focus:ring-blue-500/20 outline-none"
            >
              {HS_OPTIONS.map((h) => (
                <option key={h.code} value={h.code}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Custom Code (2/4/6-Digit)
            </span>
            <input
              type="text"
              placeholder="e.g. 6109.10, 87"
              value={customHsInput}
              onChange={(e) => {
                setCustomHsInput(e.target.value);
                const trimmed = e.target.value.trim();
                if (trimmed.length >= 2) {
                  setSelectedHs(trimmed);
                }
              }}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 shadow-2xs focus:border-blue-600 focus:ring-1 focus:ring-blue-500/20 outline-none w-36 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Auto-normalization feedback banner */}
      {forecast && forecast.hs_code !== selectedHs.replace(/[^0-9]/g, "") && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-900 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Hierarchical Auto-Normalizer: Input <strong className="font-mono text-slate-900">{selectedHs}</strong> automatically mapped to primary UN Comtrade flow <strong className="font-mono text-slate-900">HS {forecast.hs_code}</strong>.
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono font-semibold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800">
            Auto-Resolved
          </span>
        </div>
      )}

      {/* KPI Metric Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Latest Flow */}
        <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Annual Flow ({latestFlow?.year || 2025})</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              ${latestFlow ? (latestFlow.trade_value_usd / 1_000_000).toFixed(1) : "—"}M USD
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
              <span className="font-semibold text-slate-700">
                {latestFlow?.unit_value_usd_per_kg ? `$${latestFlow.unit_value_usd_per_kg.toFixed(2)}/kg` : "Verified flow"}
              </span>
              <span>• UN Comtrade</span>
            </div>
          </div>
        </div>

        {/* 12M Forecast */}
        <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>12-Month Forecast ({forecast?.forecast_12m.year || 2026})</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-emerald-700 tracking-tight">
              ${forecast ? (forecast.forecast_12m.projected_usd / 1_000_000).toFixed(1) : "—"}M USD
            </div>
            <div className="text-[11px] text-emerald-700 font-mono mt-1 flex items-center gap-1">
              <span className="font-semibold">CAGR: {forecast ? (forecast.projected_cagr_pct > 0 ? `+${forecast.projected_cagr_pct}%` : `${forecast.projected_cagr_pct}%`) : "—"}</span>
              <span className="text-slate-400 font-sans">• Log-Linear</span>
            </div>
          </div>
        </div>

        {/* Opportunity Score */}
        <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Opportunity Score</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                {forecast?.opportunity_index || 0}
              </span>
              <span className="text-xs font-mono text-slate-400">/ 100</span>
            </div>
            <div className="text-[11px] mt-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                {forecast?.opportunity_tier || "Evaluating"} (Grade {forecast?.risk_adjusted_rating || "B"})
              </span>
            </div>
          </div>
        </div>

        {/* Duty Concession */}
        <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Duty Concession (FTA)</span>
            <Percent className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-purple-700 tracking-tight">
              {tariff ? `${tariff.preferential_rate_pct}% Duty` : "5.0% MFN"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">
              {tariff && tariff.tariff_savings_pct > 0 ? (
                <span className="text-emerald-700 font-semibold font-mono">
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
      <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>UN Comtrade Historical Flow vs. Model 1 ML Forecast</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Log-Linear Time-Series
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Shaded confidence envelopes display the 80% statistical interval representing market demand volatility.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span>Actual Flow</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <span>12M / 24M Forecast</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-80 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
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
                    backgroundColor: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    color: "#0f172a",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
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
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.15}
                />
                <Area
                  type="monotone"
                  dataKey="ci80Lower"
                  name="80% Lower Confidence Bound"
                  stroke="#10b981"
                  fill="#ffffff"
                  fillOpacity={1}
                />

                {/* Historical Line */}
                <Line
                  type="monotone"
                  dataKey="historical"
                  name="Actual Bilateral Trade (USD)"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#2563eb" }}
                  activeDot={{ r: 6 }}
                />

                {/* Forecast Line */}
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Projected Forecast Demand"
                  stroke="#059669"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={{ r: 5, fill: "#059669" }}
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
        <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Model 1: Forecast Attribution & Dynamics
                </h3>
                <p className="text-xs text-slate-500">
                  Key drivers determining the corridor demand momentum score.
                </p>
              </div>
            </div>

            {forecast ? (
              <div className="mt-4 space-y-2.5">
                {forecast.explanation_factors.map((factor, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{factor}</span>
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                      Pricing Trend
                    </span>
                    <div className="text-sm font-bold text-slate-900 mt-1">
                      {forecast.unit_value_trend}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                      Corridor Rating
                    </span>
                    <div className="text-sm font-bold text-slate-900 mt-1">
                      Grade {forecast.risk_adjusted_rating}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Forecast explanations will appear once data loads.
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Model: Log-Linear OLS with Studentized Errors</span>
            <span>Confidence: 80% & 95%</span>
          </div>
        </div>

        {/* Right: Tariff Advantage & Destination Risk */}
        <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Tariff Advantage & Destination Governance
                </h3>
                <p className="text-xs text-slate-500">
                  Preferential trade treaty benefits and World Bank risk indicators.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {/* Tariff Calculator Card */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {tariff?.agreement_name || "WTO Most-Favoured-Nation Schedule"}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Savings = Shipment Value × (MFN Tariff % − Preferential FTA %)
                    </span>
                  </div>
                  {tariff && tariff.preferential_rate_pct === 0 ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
                      0% Duty Free
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-700 self-start sm:self-auto">
                      Applied Tariff
                    </span>
                  )}
                </div>

                {/* Shipment Value Input */}
                <div className="p-3 rounded-lg bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-600 block tracking-wider">
                      Simulated Cargo Value (USD)
                    </label>
                    <div className="text-[11px] text-slate-500">
                      Adjust cargo value to compute customs duty savings
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">$</span>
                    <input
                      type="number"
                      step="5000"
                      min="1000"
                      value={shipmentValue}
                      onChange={(e) => setShipmentValue(Number(e.target.value) || 0)}
                      className="w-32 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white text-slate-900 shadow-2xs focus:border-blue-600 outline-none"
                    />
                  </div>
                </div>

                {/* Tariff Rates Grid */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="text-[9px] text-slate-500 uppercase font-sans font-semibold">MFN ({tariff?.mfn_applied_rate_pct ?? 5.0}%)</div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5">
                      ${tariff?.duty_under_mfn_usd ? tariff.duty_under_mfn_usd.toLocaleString() : "—"}
                    </div>
                    <div className="text-[9px] text-slate-500 font-sans">Standard duty</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="text-[9px] text-emerald-700 uppercase font-sans font-semibold">FTA ({tariff?.preferential_rate_pct ?? 5.0}%)</div>
                    <div className="text-xs font-bold text-emerald-700 mt-0.5">
                      ${tariff?.duty_under_fta_usd !== undefined ? tariff.duty_under_fta_usd.toLocaleString() : "—"}
                    </div>
                    <div className="text-[9px] text-emerald-600 font-sans">With cert</div>
                  </div>

                  <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-200 shadow-2xs">
                    <div className="text-[9px] text-purple-700 font-bold uppercase font-sans">Savings</div>
                    <div className="text-xs font-bold text-purple-800 mt-0.5">
                      ${tariff?.duty_savings_usd ? tariff.duty_savings_usd.toLocaleString() : "0"}
                    </div>
                    <div className="text-[9px] text-purple-700 font-sans font-semibold">
                      {tariff?.tariff_savings_pct ?? 0}% margin saved
                    </div>
                  </div>
                </div>
              </div>

              {/* World Bank Governance Tier */}
              {countryRisk && (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900">
                      World Bank Country Risk Profile
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        countryRisk.risk_tier === "Low Risk"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {countryRisk.risk_tier}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                    <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                      <div className="text-[9px] text-slate-500 uppercase font-sans font-semibold">Rule of Law</div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">
                        {countryRisk.rule_of_law_score}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                      <div className="text-[9px] text-slate-500 uppercase font-sans font-semibold">Reg. Quality</div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">
                        {countryRisk.regulatory_quality_score}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                      <div className="text-[9px] text-slate-500 uppercase font-sans font-semibold">FX Volatility</div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">
                        {countryRisk.fx_volatility_pct}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>WTO Tariff Facility & World Bank WGI</span>
            <span>Currency: {countryRisk?.currency_code || "USD"}</span>
          </div>
        </div>
      </div>

      {/* Automated Compliance & Certification Matrix Section */}
      <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                Customs Compliance Matrix
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  complianceMatrix?.customs_entry_clearance_complexity === "High Risk / Stringent"
                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                    : complianceMatrix?.customs_entry_clearance_complexity === "Strict / Document-Heavy"
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                }`}
              >
                Clearance: {complianceMatrix?.customs_entry_clearance_complexity || "Standard"}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Mandatory Customs Certificates & Compliance Protocols ({selectedCountryMeta?.name || selectedCountry})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Official regulatory certificates required to prevent cargo detention, port seizure, or fines for {selectedHsMeta?.label}.
            </p>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2 font-mono">
            <span>Destination: <strong className="text-slate-900">{complianceMatrix?.destination_country_name || selectedCountry}</strong></span>
            <span>•</span>
            <span>Sector: <strong className="text-slate-900">{complianceMatrix?.sector_name || "General Goods"}</strong></span>
          </div>
        </div>

        {/* Mandatory Certificates Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Mandatory Customs Entry Certificates (Non-Negotiable)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complianceMatrix?.mandatory_certificates.map((cert, ci) => (
              <div
                key={ci}
                className="p-4 rounded-xl bg-rose-50/40 border border-rose-200 space-y-2.5 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0"></span>
                    <span>{cert.certificate_name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                    ~{cert.estimated_lead_time_days} Days Lead
                  </span>
                </div>

                <div className="text-xs text-slate-700 leading-relaxed">
                  <span className="font-semibold text-slate-900">Purpose:</span> {cert.purpose}
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-rose-100 text-[11px] text-slate-600 space-y-1 shadow-2xs">
                  <div>
                    <span className="font-semibold text-slate-800">Issuing Body:</span> {cert.issuing_authority_agency}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Testing / Audit:</span> {cert.testing_or_audit_requirement}
                  </div>
                  <div className="text-rose-700 font-medium">
                    <span className="font-semibold">Non-Compliance:</span> {cert.penalties_or_consequences}
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
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Recommended Commercial Quality & ESG Standards</span>
            </h3>

            <div className="space-y-3">
              {complianceMatrix?.recommended_commercial_standards.map((rec, ri) => (
                <div
                  key={ri}
                  className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{rec.certificate_name}</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {rec.issuing_authority_agency}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">{rec.purpose}</p>
                  <div className="text-[11px] text-amber-800 font-medium">
                    Commercial Impact: {rec.penalties_or_consequences}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Border Declaration Pack */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span>Customs Entry Declaration Pack</span>
            </h3>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs shadow-2xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-600 block mb-1.5">
                  Required Documents for Clearance Broker
                </span>
                <ul className="space-y-1.5">
                  {complianceMatrix?.customs_declaration_documents.map((doc, di) => (
                    <li key={di} className="flex items-center gap-2 text-slate-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-600 block mb-1">
                  Destination Port Inspection Protocol
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
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
