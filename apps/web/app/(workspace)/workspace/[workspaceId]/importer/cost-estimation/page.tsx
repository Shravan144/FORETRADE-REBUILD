"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
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
  Building2,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  Calculator,
  Container,
} from "lucide-react";
import { api, ImporterProfile } from "@/lib/api";

export default function ImporterLandedCostPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [profile, setProfile] = useState<ImporterProfile | null>(null);
  const [routes, setRoutes] = useState<any | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  // Form input state
  const [factoryPrice, setFactoryPrice] = useState<number>(65000);
  const [cargoUnits, setCargoUnits] = useState<number>(1000);
  const [originPort, setOriginPort] = useState<string>("IN_NSA");
  const [destinationPort, setDestinationPort] = useState<string>("DE_HAM");
  const [containerType, setContainerType] = useState<string>("40ft");
  const [containerCount, setContainerCount] = useState<number>(1);
  const [hsCode, setHsCode] = useState<string>("6109.10");
  const [applyFta, setApplyFta] = useState<boolean>(true);
  const [cbmVolume, setCbmVolume] = useState<number>(28.0);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const [profData, catalog] = await Promise.allSettled([
          api.getImporterProfile(workspaceId),
          api.getShippingRoutes(),
        ]);

        if (profData.status === "fulfilled" && profData.value) {
          setProfile(profData.value);
          // Set destination port based on profile discharge port if valid
          if (profData.value.primary_discharge_port === "DEHAM") {
            setDestinationPort("DE_HAM");
          } else if (profData.value.primary_discharge_port === "JPTYO") {
            setDestinationPort("JP_TYO");
          } else if (profData.value.primary_discharge_port === "USLAX") {
            setDestinationPort("US_LAX");
          }
          if (profData.value.preferred_container_type) {
            setContainerType(profData.value.preferred_container_type.includes("40") ? "40ft" : "20ft");
          }
        }

        if (catalog.status === "fulfilled" && catalog.value) {
          setRoutes(catalog.value);
          await performCalculation(catalog.value);
        }
      } catch (err) {
        console.error("Failed to load importer logistics data:", err);
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
        factory_price_usd: Number(factoryPrice) || 65000,
        cargo_units: Number(cargoUnits) || 1000,
        origin_port: originPort,
        destination_port: destinationPort,
        container_type: containerType,
        container_count: Number(containerCount) || 1,
        hs_code: hsCode,
        apply_fta: applyFta,
        target_margin_pct: 0,
        cbm_volume: Number(cbmVolume) || 28.0,
      });
      setResult(res);
    } catch (err) {
      console.error("Importer landed cost calculation failed:", err);
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
    const quoteText = `======================================================
IMPORT TOTAL LANDED COST ANALYSIS
Buyer Desk: ${profile?.company_name || "Direct Importer"}
Destination Port: ${result.destination_port.name} (${result.destination_port.city})
======================================================
Commodity HS Code   : ${result.hs_code}
Origin Port (India) : ${result.origin_port.name} (${result.origin_port.city})
Primary Ocean Line  : ${result.primary_carrier} (~${result.transit_days} transit days)
Container Specs     : ${result.container_count}x ${result.container_type.toUpperCase()} (${b.units} units)

LANDED COST BREAKDOWN (USD):
1. Ex-Factory / Invoice Price : $${b.factory_gate_price_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} ($${b.unit_factory_cost_usd}/unit)
2. FOB Port Gateway Value     : $${b.fob_value_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
3. Ocean Freight & Surcharges : $${b.ocean_freight_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
4. Marine Cargo Insurance     : $${b.marine_insurance_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
5. CIF Destination Value      : $${b.cif_value_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} ($${b.unit_cif_cost_usd}/unit)
6. Destination Import Tariff  : $${b.customs_duty_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${applyFta ? "(Preferential FTA Applied)" : "(Standard MFN Rate)"}
7. Port Handling & Drayage    : $${b.port_handling_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
------------------------------------------------------
TOTAL FINAL LANDED COST       : $${b.landed_cost_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
UNIT LANDED COST AT DOCK      : $${b.unit_landed_cost_usd} USD / unit
${result.duty_savings_usd ? `FTA TARIFF ARBITRAGE SAVINGS: $${result.duty_savings_usd.toLocaleString()} USD` : ""}
======================================================`;

    navigator.clipboard.writeText(quoteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
              <Calculator className="w-3 h-3 text-indigo-600" />
              Import Landed Cost Simulator
            </span>
            <span className="text-xs text-slate-400 font-medium">Port-to-Dock Financial Clearance</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Total Landed Cost & Tariff Calculator
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Simulate full import economics for Indian supply shipments — including ocean freight, terminal handling (THC), import duties, and FTA trade treaty savings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={copyQuotation}
            disabled={!result}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Landed Sheet Copied!" : "Export Landed Cost Sheet"}</span>
          </button>
          <Link
            href={`/workspace/${workspaceId}/importer/inbox`}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
          >
            <span>Back to Proposals</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Profile Defaults Banner */}
      {profile && (
        <div className="p-4 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Pre-Configured for {profile.company_name}</span>
                <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-white text-indigo-700 border border-indigo-200">
                  {profile.country_code} • {profile.tax_identifier_type}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Target Discharge Port: <strong>{profile.primary_discharge_port}</strong> • Preferred Container: <strong>{profile.preferred_container_type.toUpperCase()}</strong> • Currency: <strong>{profile.currency || "USD"}</strong>
              </p>
            </div>
          </div>
          <Link
            href={`/workspace/${workspaceId}/importer/profile`}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition shrink-0"
          >
            Edit Profile Defaults →
          </Link>
        </div>
      )}

      {/* Quick Presets */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quick Import Presets:</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handlePreset({
              origin: "IN_NSA",
              dest: "DE_HAM",
              hs: "6109.10",
              price: 65000,
              units: 2000,
              container: "40ft",
              fta: true,
            })}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            🇩🇪 Hamburg Textile Consignment (40ft HC)
          </button>
          <button
            onClick={() => handlePreset({
              origin: "IN_NSA",
              dest: "JP_TYO",
              hs: "8483.40",
              price: 95000,
              units: 500,
              container: "20ft",
              fta: true,
            })}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            🇯🇵 Tokyo Precision Engineering (India-Japan CEPA)
          </button>
          <button
            onClick={() => handlePreset({
              origin: "IN_MUN",
              dest: "AE_DXB",
              hs: "8504.40",
              price: 45000,
              units: 1200,
              container: "20ft",
              fta: true,
            })}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            🇦🇪 Dubai Jebel Ali Power Hardware (India-UAE CEPA)
          </button>
        </div>
      </div>

      {/* Main Grid: Parameters Form & Results Waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Container className="w-4 h-4 text-indigo-600" />
              <span>Consignment Parameters</span>
            </h2>
            <button
              onClick={() => performCalculation()}
              disabled={calculating}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${calculating ? "animate-spin" : ""}`} />
              <span>Recalculate</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Purchase Order Value (USD)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  value={factoryPrice}
                  onChange={(e) => setFactoryPrice(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-500 font-mono font-bold text-slate-900 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Order Quantity (Units)</label>
                <input
                  type="number"
                  value={cargoUnits}
                  onChange={(e) => setCargoUnits(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-500 font-mono font-bold text-slate-900 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">CBM Volume (m³)</label>
                <input
                  type="number"
                  step="0.5"
                  value={cbmVolume}
                  onChange={(e) => setCbmVolume(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-500 font-mono font-bold text-slate-900 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Origin Port (India)</label>
                <select
                  value={originPort}
                  onChange={(e) => setOriginPort(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-500 font-bold text-slate-900 text-xs"
                >
                  <option value="IN_NSA">Nhava Sheva (JNPT Mumbai)</option>
                  <option value="IN_MUN">Mundra Port (Gujarat)</option>
                  <option value="IN_MAA">Chennai Port (Tamil Nadu)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Destination Discharge Port</label>
                <select
                  value={destinationPort}
                  onChange={(e) => setDestinationPort(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-500 font-bold text-slate-900 text-xs"
                >
                  <option value="DE_HAM">DEHAM - Hamburg (Germany)</option>
                  <option value="JP_TYO">JPTYO - Tokyo (Japan)</option>
                  <option value="AE_JEA">AEJEA - Jebel Ali (UAE)</option>
                  <option value="US_LAX">USLAX - Los Angeles (USA)</option>
                  <option value="US_NYC">USNYC - New York / NJ (USA)</option>
                  <option value="GB_FXT">GBFXT - Felixstowe (UK)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Container Size</label>
                <select
                  value={containerType}
                  onChange={(e) => setContainerType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-500 font-bold text-slate-900 text-xs"
                >
                  <option value="20ft">20ft Standard GP</option>
                  <option value="40ft">40ft High Cube (HC)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Commodity HS Code</label>
                <input
                  type="text"
                  value={hsCode}
                  onChange={(e) => setHsCode(e.target.value)}
                  placeholder="e.g. 6109.10"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-500 font-mono font-bold text-slate-900 text-xs"
                />
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block text-xs">Apply Free Trade Agreement (FTA)</span>
                <span className="text-[10px] text-slate-500">Calculate preferential bilateral duty discount</span>
              </div>
              <input
                type="checkbox"
                checked={applyFta}
                onChange={(e) => setApplyFta(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded-sm focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            <button
              onClick={() => performCalculation()}
              disabled={calculating}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer text-xs"
            >
              <Calculator className="w-4 h-4" />
              <span>{calculating ? "Calculating Route Economics..." : "Simulate Landed Cost"}</span>
            </button>
          </div>
        </div>

        {/* Right Results Breakdown (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {result ? (
            <>
              {/* Highlight Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Landed Cost</span>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    ${(result.breakdown.total_landed_cost_ddp_usd ?? result.breakdown.cif_value_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">All tariffs, freight & fees paid</span>
                </div>

                <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Unit Landed Price</span>
                  <div className="text-xl font-black text-indigo-600 mt-1">
                    ${result.breakdown.unit_landed_cost_usd} <span className="text-xs text-slate-400 font-normal">/ unit</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">At your destination port dock</span>
                </div>

                <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">FTA Duty Savings</span>
                  <div className="text-xl font-black text-emerald-600 mt-1">
                    ${(result.breakdown.tariff_savings_usd ?? result.duty_savings_usd ?? 0).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium">Under Bilateral Trade Treaty</span>
                </div>
              </div>

              {/* Transit & Carrier Info */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Ship className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Carrier: {result.primary_carrier}</span>
                    <span className="text-slate-400 block text-[11px]">Direct ocean route via {result.origin_port.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 font-mono font-bold text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>~{result.transit_days} Days Transit</span>
                </div>
              </div>

              {/* Cost Waterfall Breakdown Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Import Landed Cost Waterfall
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">1. Commercial Purchase Invoice (FOB India)</span>
                    <span className="font-mono font-bold text-slate-900">
                      ${result.breakdown.fob_value_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">2. Marine Ocean Freight ({result.container_type.toUpperCase()})</span>
                    <span className="font-mono font-bold text-slate-900">
                      +${result.breakdown.ocean_freight_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">3. Marine Cargo Insurance (All-Risk)</span>
                    <span className="font-mono font-bold text-slate-900">
                      +${result.breakdown.marine_insurance_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 bg-slate-50 px-3 rounded-lg font-bold text-slate-900">
                    <span>CIF Value at Destination Seaport</span>
                    <span className="font-mono">
                      =${result.breakdown.cif_value_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-slate-600 block">4. Destination Customs Import Tariff</span>
                      {applyFta && (
                        <span className="text-[10px] text-emerald-600 font-bold">
                          ✓ FTA Preferential Tariff Applied ({result.breakdown.tariff_rate_applied_pct ?? 0}%)
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      +${(result.breakdown.customs_import_duty_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">5. Port Terminal Handling Charges (THC) & Clearance</span>
                    <span className="font-mono font-bold text-slate-900">
                      +${(result.breakdown.destination_port_handling_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 text-sm font-black text-indigo-700 bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200/80">
                    <span>Total Landed Cost into Warehouse</span>
                    <span className="font-mono text-base">
                      ${(result.breakdown.total_landed_cost_ddp_usd ?? result.breakdown.cif_value_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-16 bg-white border border-slate-200 rounded-2xl text-center text-slate-400">
              Configure parameters on the left to simulate import economics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
