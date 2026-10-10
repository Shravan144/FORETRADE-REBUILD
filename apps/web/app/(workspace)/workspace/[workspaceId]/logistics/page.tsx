"use client";

import { use, useEffect, useState } from "react";
import {
  Ship,
  DollarSign,
  Clock,
  Sparkles,
  RefreshCw,
  Anchor,
  FileText,
  BadgeCheck,
  Layers,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";

export default function LandedCostPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  // Routes catalog & calculation state
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [routes, setRoutes] = useState<any | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  // Form input state
  const [factoryPrice, setFactoryPrice] = useState<number>(50000);
  const [cargoUnits, setCargoUnits] = useState<number>(10000);
  const [originPort, setOriginPort] = useState<string>("IN_NSA");
  const [destinationPort, setDestinationPort] = useState<string>("US_LAX");
  const [containerType, setContainerType] = useState<string>("20ft");
  const [containerCount, setContainerCount] = useState<number>(1);
  const [hsCode, setHsCode] = useState<string>("6109.10");
  const [applyFta, setApplyFta] = useState<boolean>(false);
  const [targetMargin, setTargetMargin] = useState<number>(15);
  const [cbmVolume, setCbmVolume] = useState<number>(15.0);

  // Load available shipping lanes on mount
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const catalog = await api.getShippingRoutes();
        setRoutes(catalog);
        await performCalculation(catalog);
      } catch (err) {
        console.error("Failed to load shipping routes:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [workspaceId]);

  async function performCalculation(currentCatalog?: any) {
    try {
      setCalculating(true);
      const res = await api.calculateLandedCost({
        factory_price_usd: Number(factoryPrice) || 50000,
        cargo_units: Number(cargoUnits) || 10000,
        origin_port: originPort,
        destination_port: destinationPort,
        container_type: containerType,
        container_count: Number(containerCount) || 1,
        hs_code: hsCode,
        apply_fta: applyFta,
        target_margin_pct: Number(targetMargin) || 15,
        cbm_volume: Number(cbmVolume) || 15.0,
      });
      setResult(res);
    } catch (err) {
      console.error("Landed cost calculation failed:", err);
    } finally {
      setCalculating(false);
    }
  }

  function handlePreset(preset: {
    origin: string;
    dest: string;
    hs: string;
    price: number;
    units: number;
    container: string;
    fta: boolean;
  }) {
    setOriginPort(preset.origin);
    setDestinationPort(preset.dest);
    setHsCode(preset.hs);
    setFactoryPrice(preset.price);
    setCargoUnits(preset.units);
    setContainerType(preset.container);
    setApplyFta(preset.fta);
  }

  function copyQuotation() {
    if (!result) return;
    const b = result.breakdown;
    const inc = result.incoterms;
    const quoteText = `======================================================
EXPORT COMMERCIAL QUOTATION SUMMARY
ForeTrade Intelligent Landed Cost Engine
======================================================
Commodity HS Code   : ${result.hs_code}
Origin Seaport      : ${result.origin_port.name} (${result.origin_port.city})
Destination Seaport : ${result.destination_port.name} (${result.destination_port.city})
Carrier & Transit   : ${result.primary_carrier} (~${result.transit_days} days)
Container Specs     : ${result.container_count}x ${result.container_type.toUpperCase()} (${b.units} total units)

INCOTERMS 2020 WATERFALL SUMMARY:
1. EXW (Factory Gate)          : $${b.factory_gate_price_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD ($${b.unit_factory_cost_usd}/unit)
2. FOB (Free on Board)         : $${b.fob_value_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD ($${b.unit_fob_cost_usd}/unit)
3. CIF (Cost, Insurance & Frt) : $${b.cif_value_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD ($${b.unit_cif_cost_usd}/unit)
4. Customs Duty (${b.tariff_rate_applied_pct}%)       : $${b.customs_import_duty_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
5. DDP (Delivered Duty Paid)     : $${b.total_landed_cost_ddp_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD ($${b.unit_landed_cost_usd}/unit)

OFFICIAL CIF BUYER QUOTE (${inc.margin_percentage}% Margin):
Total CIF Value : $${inc.suggested_cif_quote_with_margin_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
CIF Unit Price  : $${(inc.suggested_cif_quote_with_margin_usd / b.units).toFixed(2)} USD / unit
Applicable Duty : ${b.tariff_rate_applied_pct}% (${b.is_fta_rate_applied ? "Preferential FTA Applied: " + (result.applied_tariff_agreement || "FTA") : "WTO MFN Standard"})
======================================================`;

    navigator.clipboard.writeText(quoteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
          <p className="text-sm font-medium">Loading Maritime Routes & WTO Tariff Matrix...</p>
        </div>
      </div>
    );
  }

  const b = result?.breakdown;
  const inc = result?.incoterms;

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-[1440px] mx-auto text-slate-900">
      {/* Page Title & Preset Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl">
              <Ship className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Landed Cost & Logistics Estimator
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Incoterms 2020 Waterfall Engine: Compute factory gate, ocean freight, marine insurance, and customs tariffs to quote overseas buyers with confidence.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Presets:</span>
          <button
            onClick={() => {
              handlePreset({
                origin: "IN_NSA",
                dest: "US_LAX",
                hs: "6109.10",
                price: 52000,
                units: 12000,
                container: "20ft",
                fta: false,
              });
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg shadow-2xs transition cursor-pointer"
          >
            US Cotton Apparel (6109)
          </button>
          <button
            onClick={() => {
              handlePreset({
                origin: "IN_NSA",
                dest: "AE_DXB",
                hs: "1006.30",
                price: 38000,
                units: 25000,
                container: "40ft_hc",
                fta: true,
              });
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition cursor-pointer"
          >
            UAE Rice (CEPA 0%)
          </button>
          <button
            onClick={() => {
              handlePreset({
                origin: "IN_NSA",
                dest: "DE_HAM",
                hs: "2902.11",
                price: 65000,
                units: 8000,
                container: "20ft",
                fta: false,
              });
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg shadow-2xs transition cursor-pointer"
          >
            Germany Chemicals (2902)
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Interactive Inputs (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Anchor className="h-4 w-4 text-blue-600" />
                <span>Shipment & Maritime Parameters</span>
              </h2>
              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold px-2 py-0.5 rounded-full">
                Incoterms 2020
              </span>
            </div>

            {/* Factory Economics */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Factory Gate Price (EXW $)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    value={factoryPrice}
                    onChange={(e) => setFactoryPrice(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 text-xs font-mono font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                    placeholder="50000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cargo Units / Quantity
                </label>
                <input
                  type="number"
                  value={cargoUnits}
                  onChange={(e) => setCargoUnits(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  placeholder="10000"
                />
              </div>
            </div>

            {/* Maritime Ports */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Origin Port of Loading (India)
                </label>
                <select
                  value={originPort}
                  onChange={(e) => setOriginPort(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                >
                  {routes?.origin_ports.map((p: any) => (
                    <option key={p.code} value={p.code}>
                      {p.name} — {p.city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Destination Port of Discharge
                </label>
                <select
                  value={destinationPort}
                  onChange={(e) => setDestinationPort(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                >
                  {routes?.destination_ports.map((p: any) => (
                    <option key={p.code} value={p.code}>
                      {p.name} ({p.country_code}) — {p.city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Container Type & Count */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Container Specification
                </label>
                <select
                  value={containerType}
                  onChange={(e) => setContainerType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="20ft">20ft Standard Dry (TEU)</option>
                  <option value="40ft_hc">40ft High Cube (FEU HC)</option>
                  <option value="lcl">Less than Container (LCL)</option>
                </select>
              </div>

              {containerType === "lcl" ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Cargo Volume (CBM)
                  </label>
                  <input
                    type="number"
                    value={cbmVolume}
                    onChange={(e) => setCbmVolume(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                    placeholder="15.0"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Container Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={containerCount}
                    onChange={(e) => setContainerCount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            {/* Product HS Code & Tariff Selection */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Product HS Code (6-Digit Harmonized System)
                </label>
                <input
                  type="text"
                  value={hsCode}
                  onChange={(e) => setHsCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-900 font-mono font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  placeholder="e.g. 6109.10"
                />
              </div>

              {/* Preferential FTA Checkbox */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="fta_toggle"
                    checked={applyFta}
                    onChange={(e) => setApplyFta(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="fta_toggle" className="text-xs text-slate-700 font-semibold cursor-pointer">
                    Apply Preferential FTA Tariff Rate
                  </label>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
                  Duty Reducer
                </span>
              </div>
            </div>

            {/* Target Margin Slider */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-600">
                  Target Profit Margin on Quotation:
                </label>
                <span className="text-xs font-bold font-mono text-blue-600">{targetMargin}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="40"
                step="1"
                value={targetMargin}
                onChange={(e) => setTargetMargin(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 font-medium">
                <span>5% (Volume thin)</span>
                <span>15% (Standard)</span>
                <span>40% (Premium)</span>
              </div>
            </div>

            {/* Calculate Button */}
            <button
              onClick={() => performCalculation()}
              disabled={calculating}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {calculating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Calculating Marine Waterfall...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Recalculate Landed Cost Breakdown</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Intelligence Results & Waterfall (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {result && b && inc && (
            <>
              {/* 4 KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Total Landed (DDP)
                  </p>
                  <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                    ${b.total_landed_cost_ddp_usd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    ${b.unit_landed_cost_usd} / unit
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    CIF Port Value
                  </p>
                  <p className="text-xl font-bold font-mono text-blue-700 mt-1">
                    ${b.cif_value_usd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    ${b.unit_cif_cost_usd} / unit
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Transit Lead Time
                  </p>
                  <p className="text-xl font-bold font-mono text-amber-700 mt-1 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span>~{result.transit_days} Days</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate font-medium" title={result.primary_carrier}>
                    {result.primary_carrier}
                  </p>
                </div>

                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/90 shadow-xs">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    Buyer CIF Quote
                  </p>
                  <p className="text-xl font-bold font-mono text-emerald-800 mt-1">
                    ${inc.suggested_cif_quote_with_margin_usd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[11px] font-mono font-semibold text-emerald-700 mt-0.5">
                    ${(inc.suggested_cif_quote_with_margin_usd / b.units).toFixed(2)}/u (+{inc.margin_percentage}%)
                  </p>
                </div>
              </div>

              {/* Tariff & FTA Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 shadow-xs ${
                b.is_fta_rate_applied
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-blue-50/70 border-blue-200 text-blue-900"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${b.is_fta_rate_applied ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      {b.is_fta_rate_applied
                        ? `Preferential Tariff Applied: ${result.applied_tariff_agreement || "FTA Rate"}`
                        : `Standard WTO MFN Tariff Applied (${b.tariff_rate_applied_pct}%)`}
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 font-mono">
                      Destination customs duty calculated at {b.tariff_rate_applied_pct}% on CIF value (${b.customs_import_duty_usd.toLocaleString()} USD).
                    </p>
                  </div>
                </div>

                {b.is_fta_rate_applied && b.tariff_savings_usd > 0 && (
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">FTA Savings</span>
                    <p className="text-sm font-bold font-mono text-emerald-700">+${b.tariff_savings_usd.toLocaleString()} USD</p>
                  </div>
                )}
              </div>

              {/* Incoterms 2020 Waterfall Table */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <span>Incoterms 2020 Cost Component Waterfall</span>
                  </h3>
                  <span className="text-xs text-slate-600 font-mono font-medium">
                    {result.origin_port.code} → {result.destination_port.code}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {/* EXW */}
                  <div className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md font-mono border border-slate-200">
                        EXW
                      </span>
                      <span className="text-slate-800 font-semibold">Factory Gate Goods Price</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-slate-900">
                        ${b.factory_gate_price_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="block text-[10px] text-slate-500">${b.unit_factory_cost_usd}/unit</span>
                    </div>
                  </div>

                  {/* Inland */}
                  <div className="p-3 pl-8 flex items-center justify-between text-slate-600 hover:bg-slate-50/40">
                    <span>+ Inland Drayage (Factory to Port)</span>
                    <span className="font-mono font-medium text-slate-800">${b.inland_trucking_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="p-3 pl-8 flex items-center justify-between text-slate-600 hover:bg-slate-50/40">
                    <span>+ Origin Terminal Handling (THC) & Documentation</span>
                    <span className="font-mono font-medium text-slate-800">${b.origin_terminal_handling_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="p-3 pl-8 flex items-center justify-between text-slate-600 hover:bg-slate-50/40">
                    <span>+ Export Customs Clearance & Shipping Bill</span>
                    <span className="font-mono font-medium text-slate-800">${b.export_customs_clearance_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* FOB */}
                  <div className="p-3.5 flex items-center justify-between bg-blue-50/40 border-y border-blue-100/60 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-md font-mono border border-blue-200">
                        FOB
                      </span>
                      <span className="text-slate-900 font-bold">Free on Board (Loaded on Vessel)</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-slate-900">
                        ${b.fob_value_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="block text-[10px] text-blue-700 font-semibold">${b.unit_fob_cost_usd}/unit</span>
                    </div>
                  </div>

                  {/* Ocean Freight */}
                  <div className="p-3 pl-8 flex items-center justify-between text-slate-600 hover:bg-slate-50/40">
                    <span>+ Ocean Maritime Freight ({result.container_count}x {result.container_type.toUpperCase()})</span>
                    <span className="font-mono font-medium text-slate-800">${b.ocean_freight_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Insurance */}
                  <div className="p-3 pl-8 flex items-center justify-between text-slate-600 hover:bg-slate-50/40">
                    <span>+ Marine Cargo Insurance (ICC-A All Risks, 110%)</span>
                    <span className="font-mono font-medium text-slate-800">${b.marine_insurance_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* CIF */}
                  <div className="p-3.5 flex items-center justify-between bg-blue-100/40 border-y border-blue-200/60 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-md font-mono">
                        CIF
                      </span>
                      <span className="text-blue-900 font-bold">Cost, Insurance & Freight (Discharge Port)</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-blue-800">
                        ${b.cif_value_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="block text-[10px] text-blue-700 font-semibold">${b.unit_cif_cost_usd}/unit</span>
                    </div>
                  </div>

                  {/* Destination Charges */}
                  <div className="p-3 pl-8 flex items-center justify-between text-slate-600 hover:bg-slate-50/40">
                    <span>+ Destination Terminal Handling (DTHC)</span>
                    <span className="font-mono font-medium text-slate-800">${b.destination_port_handling_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="p-3 pl-8 flex items-center justify-between text-slate-600 hover:bg-slate-50/40">
                    <span>+ Customs Import Duty ({b.tariff_rate_applied_pct}% on CIF)</span>
                    <span className="font-mono font-bold text-amber-700">${b.customs_import_duty_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="p-3 pl-8 flex items-center justify-between text-slate-600 hover:bg-slate-50/40">
                    <span>+ Import Brokerage & Final Delivery Drayage</span>
                    <span className="font-mono font-medium text-slate-800">${(b.customs_brokerage_usd + b.destination_inland_delivery_usd).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* DDP */}
                  <div className="p-3.5 flex items-center justify-between bg-emerald-50/60 border-t border-emerald-200 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-md font-mono">
                        DDP
                      </span>
                      <span className="font-bold text-slate-900">Delivered Duty Paid (Total Landed Cost)</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-emerald-800 text-sm">
                        ${b.total_landed_cost_ddp_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="block text-[10px] text-slate-600 font-semibold">${b.unit_landed_cost_usd}/unit</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Commercial Quotation Action Sheet */}
              <div className="bg-white text-slate-900 p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold flex items-center gap-2 text-slate-900">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span>Ready-to-Send Export Quotation Sheet</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-lg leading-relaxed">
                    Copy a clean quotation sheet formatted with CIF price, shipping schedule, container specifications, and tariff breakdown to paste directly into your buyer communication.
                  </p>
                </div>

                <button
                  onClick={copyQuotation}
                  className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      <span>Quotation Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy Quotation Sheet</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
