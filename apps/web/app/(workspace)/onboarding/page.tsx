"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setCsrfToken } from "@/lib/api";
import {
  Compass,
  ArrowRight,
  ShieldCheck,
  Building2,
  Factory,
  Globe2,
  CheckCircle2,
  Loader2,
  Ship,
  PackageCheck,
  Sparkles,
  Layers,
} from "lucide-react";
import { INDIAN_PORTS_REGISTRY, validateIEC } from "@/lib/exim-validators";

export default function OnboardingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Role Selection
  const [tradeRole, setTradeRole] = useState<"exporter" | "importer" | "both">("exporter");

  // Common Fields
  const [companyName, setCompanyName] = useState("");

  // Exporter Fields
  const [capacityTons, setCapacityTons] = useState(100);
  const [originPort, setOriginPort] = useState("INNSA - Nhava Sheva (JNPT), Maharashtra");
  const [iecCode, setIecCode] = useState("");
  const [categories, setCategories] = useState<string[]>(["textiles", "apparel"]);
  const [targetCountries, setTargetCountries] = useState<string[]>(["US", "AE", "GB"]);
  const [certifications, setCertifications] = useState<string[]>(["ISO 9001"]);

  // Importer Fields
  const [importerCountry, setImporterCountry] = useState("US");
  const [importerCity, setImporterCity] = useState("Los Angeles");
  const [dischargePort, setDischargePort] = useState("USLAX");
  const [taxIdentifierType, setTaxIdentifierType] = useState("EIN");
  const [taxIdentifierValue, setTaxIdentifierValue] = useState("12-3456789");
  const [primarySector, setPrimarySector] = useState("Textiles & Apparel");
  const [sourcingBudgetUsd, setSourcingBudgetUsd] = useState(5000000);
  const [preferredIncoterm, setPreferredIncoterm] = useState("CIF");

  useEffect(() => {
    if (importerCountry === "US") setTaxIdentifierType("EIN");
    else if (["DE", "FR", "NL", "IT", "ES", "BE", "PL"].includes(importerCountry)) setTaxIdentifierType("EORI");
    else if (importerCountry === "GB") setTaxIdentifierType("UK_EORI");
    else if (importerCountry === "AE") setTaxIdentifierType("TRN");
    else if (importerCountry === "AU") setTaxIdentifierType("ABN");
  }, [importerCountry]);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);

        // 0. Extract cross-domain tokens from OAuth redirect if present
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const st = params.get("session_token");
          const ct = params.get("csrf_token");
          if (st) {
            document.cookie = `foretrade_session=${encodeURIComponent(st)}; path=/; max-age=${7 * 86400}; SameSite=Lax; Secure`;
            if (ct) {
              document.cookie = `foretrade_csrf=${encodeURIComponent(ct)}; path=/; max-age=${7 * 86400}; SameSite=Lax; Secure`;
              setCsrfToken(ct);
            }
            window.history.replaceState({}, "", window.location.pathname);
          }
        }

        // 1. Ensure user is authenticated & restore CSRF
        try {
          await api.me();
        } catch (authErr: any) {
          if (authErr?.status === 401) {
            window.location.href = "/sign-in";
            return;
          }
        }

        // 2. Resolve workspaces
        const res = await api.listWorkspaces();
        if (res.items && res.items.length > 0) {
          setWorkspaceId(res.items[0].id);
          // Check if exporter or importer profile already exists
          const existingExp = await api.getExporterProfile(res.items[0].id).catch(() => null);
          const existingImp = await api.getImporterProfile(res.items[0].id).catch(() => null);

          if (existingExp?.payload?.company_name) {
            window.location.href = `/workspace/${res.items[0].id}`;
            return;
          } else if (existingImp?.company_name) {
            window.location.href = `/workspace/${res.items[0].id}/importer`;
            return;
          }
        } else {
          const newWs = await api.createWorkspace("My Trade Operations");
          setWorkspaceId(newWs.id);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let targetWsId = workspaceId;
      if (!targetWsId) {
        const wsRes = await api.listWorkspaces();
        if (wsRes.items && wsRes.items.length > 0) {
          targetWsId = wsRes.items[0].id;
        } else {
          const newWs = await api.createWorkspace("My Trade Operations");
          targetWsId = newWs.id;
        }
        setWorkspaceId(targetWsId);
      }

      if (tradeRole === "exporter" || tradeRole === "both") {
        await api.saveExporterProfile(targetWsId, {
          company_name: companyName || "My Export Enterprise",
          capacity_tons: capacityTons,
          product_categories: categories,
          target_countries: targetCountries,
          certifications: certifications,
          origin_port: originPort,
          iec_code: iecCode ? iecCode.trim().toUpperCase() : undefined,
        });
      }

      if (tradeRole === "importer" || tradeRole === "both") {
        await api.saveImporterProfile(targetWsId, {
          company_name: companyName || "My Import Enterprise",
          country_code: importerCountry,
          city: importerCity || "Los Angeles",
          primary_discharge_port: dischargePort.toUpperCase(),
          tax_identifier_type: taxIdentifierType,
          tax_identifier_value: taxIdentifierValue.trim(),
          contact_name: companyName ? `${companyName} Sourcing` : "Procurement Director",
          contact_email: "sourcing@enterprise.com",
          primary_sector: primarySector,
          annual_sourcing_budget_usd: Number(sourcingBudgetUsd),
          preferred_incoterm: preferredIncoterm,
          preferred_container_type: "40ft_hc",
          order_cycle_days: 30,
          min_order_quantity_mt: 20.0,
          payment_terms: "letter_of_credit",
        });
      }

      // Route to destination desk
      if (tradeRole === "importer") {
        window.location.href = `/workspace/${targetWsId}/importer`;
      } else {
        window.location.href = `/workspace/${targetWsId}`;
      }
    } catch (err: any) {
      console.error("Failed to save profile:", err);
      const msg = err?.message || err?.detail || "Failed to configure trade workspace. Please try again.";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function toggleCountry(country: string) {
    setTargetCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span>Setting up trade workspace...</span>
        </div>
      </div>
    );
  }

  const availableCategories = [
    "textiles",
    "apparel",
    "machinery",
    "electronics",
    "chemicals",
    "pharmaceuticals",
    "solar",
    "auto_parts",
    "engineering",
    "medical_devices",
  ];

  const availableCountries = [
    { code: "US", label: "United States" },
    { code: "AE", label: "United Arab Emirates" },
    { code: "DE", label: "Germany" },
    { code: "GB", label: "United Kingdom" },
    { code: "FR", label: "France" },
    { code: "JP", label: "Japan" },
    { code: "SG", label: "Singapore" },
    { code: "AU", label: "Australia" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto w-full bg-white border border-slate-200/90 rounded-3xl p-8 shadow-xs space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-blue-600 text-white shadow-2xs mb-2">
            <Compass className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Configure Your Trade Workspace
          </h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            ForeTrade powers bilateral cross-border trade. Choose whether you're exporting from India, sourcing internationally, or operating both.
          </p>
        </div>

        {/* Step 1: Select Trade Role */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Select Your Primary Operation
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setTradeRole("exporter")}
              className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-3 cursor-pointer ${
                tradeRole === "exporter"
                  ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-100 shadow-xs"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <Factory className={`w-5 h-5 ${tradeRole === "exporter" ? "text-blue-600" : "text-slate-500"}`} />
                {tradeRole === "exporter" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Indian Exporter</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Manufacture & export to global corridors</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTradeRole("importer")}
              className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-3 cursor-pointer ${
                tradeRole === "importer"
                  ? "bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-100 shadow-xs"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <PackageCheck className={`w-5 h-5 ${tradeRole === "importer" ? "text-indigo-600" : "text-slate-500"}`} />
                {tradeRole === "importer" && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Global Importer</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Source wholesale goods & publish RFQs</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTradeRole("both")}
              className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-3 cursor-pointer ${
                tradeRole === "both"
                  ? "bg-purple-50/70 border-purple-500 ring-2 ring-purple-100 shadow-xs"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <Layers className={`w-5 h-5 ${tradeRole === "both" ? "text-purple-600" : "text-slate-500"}`} />
                {tradeRole === "both" && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Bilateral Both</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Two-way trading house & merchant</p>
              </div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Legal Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Legal Enterprise Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={
                tradeRole === "importer"
                  ? "e.g., Pacific Global Sourcing LLC"
                  : "e.g., Bharat Textile & Garment Industries Ltd"
              }
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
            />
          </div>

          {/* Importer Section */}
          {(tradeRole === "importer" || tradeRole === "both") && (
            <div className="space-y-4 p-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs pb-2 border-b border-indigo-100">
                <PackageCheck className="w-4 h-4 text-indigo-600" />
                <span>Importer Procurement Coordinates</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Country Jurisdiction
                  </label>
                  <select
                    value={importerCountry}
                    onChange={(e) => setImporterCountry(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="US">🇺🇸 United States (US)</option>
                    <option value="DE">🇩🇪 Germany (DE)</option>
                    <option value="GB">🇬🇧 United Kingdom (GB)</option>
                    <option value="AE">🇦🇪 United Arab Emirates (AE)</option>
                    <option value="AU">🇦🇺 Australia (AU)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Primary Discharge Port (UN/LOCODE)
                  </label>
                  <input
                    type="text"
                    value={dischargePort}
                    onChange={(e) => setDischargePort(e.target.value.toUpperCase())}
                    placeholder="USLAX"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Statutory Tax Credential ({taxIdentifierType})
                  </label>
                  <input
                    type="text"
                    value={taxIdentifierValue}
                    onChange={(e) => setTaxIdentifierValue(e.target.value)}
                    placeholder="12-3456789"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Annual Sourcing Budget (USD)
                  </label>
                  <input
                    type="number"
                    value={sourcingBudgetUsd}
                    onChange={(e) => setSourcingBudgetUsd(Number(e.target.value))}
                    min={10000}
                    step={100000}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Exporter Section */}
          {(tradeRole === "exporter" || tradeRole === "both") && (
            <div className="space-y-4 p-5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs pb-2 border-b border-slate-200">
                <Factory className="w-4 h-4 text-blue-600" />
                <span>Exporter Manufacturing Coordinates</span>
              </div>

              {/* Annual Capacity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Annual Manufacturing Capacity (MT)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50000}
                  value={capacityTons}
                  onChange={(e) => setCapacityTons(parseInt(e.target.value) || 0)}
                  className="w-36 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                />
              </div>

              {/* Port of Loading */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Primary Port of Loading (POL)
                </label>
                <select
                  value={originPort}
                  onChange={(e) => setOriginPort(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                >
                  {INDIAN_PORTS_REGISTRY.map((p) => (
                    <option key={p.locode} value={`${p.locode} - ${p.name}, ${p.state}`}>
                      {p.locode} — {p.name} ({p.state}) [{p.type}]
                    </option>
                  ))}
                </select>
              </div>

              {/* DGFT IEC Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  DGFT IEC Code (Optional)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={iecCode}
                  onChange={(e) => setIecCode(e.target.value.toUpperCase().trim())}
                  placeholder="0311029481 or PAN"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                />
              </div>

              {/* Product Categories */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Product Categories
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableCategories.map((cat) => {
                    const selected = categories.includes(cat);
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition capitalize cursor-pointer ${
                          selected
                            ? "bg-blue-600 text-white font-bold"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {selected ? "✓ " : "+ "}
                        {cat.replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={submitting || !companyName.trim()}
              className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Configuring Trade Operations...</span>
                </>
              ) : (
                <>
                  <span>
                    {tradeRole === "importer"
                      ? "Enter Importer Procurement Desk"
                      : tradeRole === "both"
                      ? "Enter Bilateral Trade OS"
                      : "Enter Exporter Cockpit"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
