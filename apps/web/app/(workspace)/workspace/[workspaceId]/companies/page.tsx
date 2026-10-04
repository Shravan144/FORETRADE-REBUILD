"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Building2,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  Briefcase,
  CheckCircle2,
  Loader2,
  Ship,
  Container,
  Repeat,
  Calendar,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Anchor,
  FileText,
  Boxes,
} from "lucide-react";

interface BuyerProfile {
  id: string;
  company_name: string;
  normalized_name: string;
  country_code: string;
  city: string | null;
  website: string | null;
  contact_name: string | null;
  contact_email: string | null;
  primary_sector: string;
  hs_codes: string[];
  annual_import_volume_usd: number;
  avg_order_tons: number;
  required_certifications: string[];
  preferred_incoterms: string | null;
  customs_manifest_provenance: string;
  reliability_score: number;
  shipment_frequency: string;
  avg_container_teu: number;
  estimated_order_cycle_days: number;
  top_historical_suppliers: Array<{
    supplier_name: string;
    origin_country: string;
    share_pct: number;
    port_of_lading: string;
  }>;
}

export default function CompaniesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  const [loading, setLoading] = useState(true);
  const [buyers, setBuyers] = useState<BuyerProfile[]>([]);
  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [expandedBuyerId, setExpandedBuyerId] = useState<string | null>(null);

  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [leadCreatedSuccess, setLeadCreatedSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadBuyers();
  }, [query, countryFilter, sectorFilter]);

  async function loadBuyers() {
    try {
      setLoading(true);
      const res = await api.getGlobalBuyers({
        query: query.trim() || undefined,
        country_code: countryFilter || undefined,
        sector: sectorFilter || undefined,
      });
      setBuyers(res.items || []);
    } catch (err) {
      console.error("Failed to load buyers:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwipeOrAddLead(buyerId: string) {
    setSavingLeadId(buyerId);
    setLeadCreatedSuccess(null);
    try {
      await api.swipeRecommendation(workspaceId, buyerId, "right");
      setLeadCreatedSuccess(buyerId);
      setTimeout(() => setLeadCreatedSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to add buyer to leads:", err);
    } finally {
      setSavingLeadId(null);
    }
  }

  const countries = [
    { code: "", label: "All Importer Countries" },
    { code: "US", label: "🇺🇸 United States" },
    { code: "DE", label: "🇩🇪 Germany" },
    { code: "AE", label: "🇦🇪 UAE" },
    { code: "GB", label: "🇬🇧 United Kingdom" },
    { code: "AU", label: "🇦🇺 Australia" },
    { code: "JP", label: "🇯🇵 Japan" },
    { code: "FR", label: "🇫🇷 France" },
    { code: "NL", label: "🇳🇱 Netherlands" },
    { code: "CA", label: "🇨🇦 Canada" },
    { code: "EG", label: "🇪🇬 Egypt" },
    { code: "KE", label: "🇰🇪 Kenya" },
  ];

  const sectors = [
    { code: "", label: "All Product Sectors" },
    { code: "Textiles", label: "Textiles & Apparel" },
    { code: "Solar", label: "Renewables & Solar" },
    { code: "Automotive", label: "Automotive Components" },
    { code: "Pharmaceuticals", label: "Pharmaceuticals" },
    { code: "Machinery", label: "Machinery & Equipment" },
    { code: "Agriculture", label: "Agriculture & Spices" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
              <Ship className="w-3.5 h-3.5" />
              Verified Importers Directory
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Customs Bill of Lading Provenance
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Overseas Importer Manifest & Sourcing Directory
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspect verified Bill of Lading manifests: historical suppliers, shipment frequency, container sizing (TEU), and order cycles.
          </p>
        </div>

        <Link
          href={`/workspace/${workspaceId}/imports/new`}
          className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-slate-200 border border-white/[0.1] rounded-lg text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>Upload Custom Manifest</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#111827] border border-white/[0.08] flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="relative min-w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by buyer company or port..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-white/[0.12] bg-[#0B0F19] text-white placeholder-slate-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="min-w-44">
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#0B0F19]">
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-48">
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
            >
              {sectors.map((s) => (
                <option key={s.code} value={s.code} className="bg-[#0B0F19]">
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          <span>{buyers.length} verified buyers loaded</span>
        </div>
      </div>

      {/* Buyer Cards with Bill of Lading Intelligence */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span className="text-sm font-medium">Querying customs Bill of Lading manifests...</span>
        </div>
      ) : buyers.length === 0 ? (
        <div className="p-16 text-center bg-[#111827] rounded-xl border border-white/[0.08] text-slate-400 text-sm">
          No overseas buyers match this search criteria.
        </div>
      ) : (
        <div className="space-y-4">
          {buyers.map((b) => {
            const isExpanded = expandedBuyerId === b.id;
            const isSaving = savingLeadId === b.id;
            const isSuccess = leadCreatedSuccess === b.id;

            return (
              <div
                key={b.id}
                className="rounded-xl bg-[#111827] border border-white/[0.08] hover:border-white/[0.15] transition overflow-hidden"
              >
                {/* Main Row */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-white/[0.1] text-white font-mono font-bold text-xs">
                        {b.country_code}
                      </span>
                      <h2 className="text-base font-semibold text-white">
                        {b.company_name}
                      </h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {b.primary_sector}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
                      <span>Port: <strong className="text-slate-300 font-sans">{b.city || "Direct Clearance"}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Annual Volume: <strong className="text-white">${(b.annual_import_volume_usd / 1_000_000).toFixed(1)}M USD</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Incoterm: <strong className="text-slate-300">{b.preferred_incoterms || "CIF"}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span className="flex items-center gap-1 text-emerald-400 font-medium font-sans">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        {b.reliability_score}% Customs Reliability
                      </span>
                    </div>
                  </div>

                  {/* Operational BoL Summary Pills */}
                  <div className="flex flex-wrap items-center gap-3 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.06]">
                    <div className="text-center px-3 font-mono">
                      <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 justify-center font-sans">
                        <Repeat className="w-3 h-3 text-blue-400" />
                        Frequency
                      </div>
                      <div className="text-xs font-semibold text-white mt-0.5">
                        {b.shipment_frequency}
                      </div>
                    </div>

                    <div className="h-6 w-px bg-white/[0.08] hidden sm:block"></div>

                    <div className="text-center px-3 font-mono">
                      <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 justify-center font-sans">
                        <Container className="w-3 h-3 text-emerald-400" />
                        Avg Container
                      </div>
                      <div className="text-xs font-semibold text-white mt-0.5">
                        {b.avg_container_teu} TEU ({b.avg_order_tons}T)
                      </div>
                    </div>

                    <div className="h-6 w-px bg-white/[0.08] hidden sm:block"></div>

                    <div className="text-center px-3 font-mono">
                      <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 justify-center font-sans">
                        <Calendar className="w-3 h-3 text-purple-400" />
                        Order Cycle
                      </div>
                      <div className="text-xs font-semibold text-white mt-0.5">
                        ~{b.estimated_order_cycle_days} Days
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    <button
                      onClick={() => setExpandedBuyerId(isExpanded ? null : b.id)}
                      className="px-3 py-2 rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>{isExpanded ? "Hide BoL" : "Inspect BoL"}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => handleSwipeOrAddLead(b.id)}
                      disabled={isSaving || isSuccess}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
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
                          <span>Added to CRM</span>
                        </>
                      ) : (
                        <>
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>Add to Pipeline</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsible Detailed BoL Manifest */}
                {isExpanded && (
                  <div className="p-6 bg-[#0B0F19] border-t border-white/[0.08] space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Current Supplier Network */}
                      <div className="p-4 rounded-xl bg-[#111827] border border-white/[0.08] space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                          <div className="flex items-center gap-2">
                            <Anchor className="w-4 h-4 text-blue-400" />
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                              Current Supplier Network & Port of Lading
                            </h3>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            3-Year Analysis
                          </span>
                        </div>

                        <div className="space-y-2">
                          {b.top_historical_suppliers && b.top_historical_suppliers.length > 0 ? (
                            b.top_historical_suppliers.map((sup, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="font-medium text-white flex items-center gap-1.5">
                                    <span>{sup.supplier_name}</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.08] text-slate-300">
                                      {sup.origin_country}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    Loading Port: <span className="text-slate-300">{sup.port_of_lading}</span>
                                  </div>
                                </div>
                                <div className="text-right font-mono">
                                  <div className="font-bold text-blue-400 text-sm">
                                    {sup.share_pct}%
                                  </div>
                                  <div className="text-[9px] text-slate-500 uppercase font-sans">
                                    Procurement Share
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-500 p-3">
                              No historical supplier manifests recorded.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Manifest Specifications */}
                      <div className="p-4 rounded-xl bg-[#111827] border border-white/[0.08] space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                          <div className="flex items-center gap-2">
                            <Boxes className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                              Bill of Lading Customs Provenance
                            </h3>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Clearance Records
                          </span>
                        </div>

                        <div className="space-y-2.5 text-xs text-slate-300">
                          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                            <span className="block text-[10px] uppercase text-slate-500 mb-0.5">
                              Manifest Provenance
                            </span>
                            <span className="font-mono text-slate-200">
                              {b.customs_manifest_provenance}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                              <span className="block text-[10px] uppercase text-slate-500">
                                Required Certifications
                              </span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {b.required_certifications.map((cert, ci) => (
                                  <span
                                    key={ci}
                                    className="px-2 py-0.5 rounded text-[10px] bg-white/[0.04] text-slate-300 border border-white/[0.08]"
                                  >
                                    {cert}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                              <span className="block text-[10px] uppercase text-slate-500">
                                Target HS Codes
                              </span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {b.hs_codes.map((code, hi) => (
                                  <span
                                    key={hi}
                                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  >
                                    HS {code}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-between text-xs">
                            <span className="font-medium">Direct Buyer Contact:</span>
                            <span>{b.contact_name || "Procurement Department"} ({b.contact_email || "Direct Inquiry"})</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
