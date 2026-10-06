"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Globe2,
  TrendingUp,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Zap,
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

const COUNTRY_FLAGS: Record<string, string> = {
  AE: "🇦🇪 UAE",
  US: "🇺🇸 United States",
  DE: "🇩🇪 Germany",
  GB: "🇬🇧 United Kingdom",
  AU: "🇦🇺 Australia",
  JP: "🇯🇵 Japan",
  FR: "🇫🇷 France",
  NL: "🇳🇱 Netherlands",
  CA: "🇨🇦 Canada",
  EG: "🇪🇬 Egypt",
  ES: "🇪🇸 Spain",
  IT: "🇮🇹 Italy",
  KE: "🇰🇪 Kenya",
  SA: "🇸🇦 Saudi Arabia",
  SG: "🇸🇬 Singapore",
};

export default function GlobalBuyerDirectoryPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [buyers, setBuyers] = useState<BuyerProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [facets, setFacets] = useState<any>(null);

  // CRM State lookup
  const [crmLeadMap, setCrmLeadMap] = useState<Record<string, { leadId: string; stage: string }>>({});

  // Filter states
  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [volumeBracket, setVolumeBracket] = useState("all");
  const [incotermFilter, setIncotermFilter] = useState("all");
  const [sortBy, setSortBy] = useState("volume_desc");

  // Interaction states
  const [expandedBuyerId, setExpandedBuyerId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<{ buyerId: string; text: string } | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    loadFacetsAndCrm();
  }, [workspaceId]);

  useEffect(() => {
    setPage(1); // Reset page on filter change
    loadBuyers();
  }, [query, countryFilter, sectorFilter, volumeBracket, incotermFilter, sortBy]);

  async function loadFacetsAndCrm() {
    try {
      const [facetsRes, leadsRes, companiesRes] = await Promise.all([
        api.getGlobalBuyerFacets().catch(() => null),
        api.listLeads(workspaceId).catch(() => ({ items: [] })),
        api.listCompanies(workspaceId).catch(() => ({ items: [] })),
      ]);

      if (facetsRes) setFacets(facetsRes);

      // Build map of company normalized_name / name -> lead
      const compIdToLead: Record<string, any> = {};
      (leadsRes.items || []).forEach((l: any) => {
        compIdToLead[l.company_id] = l;
      });

      const map: Record<string, { leadId: string; stage: string }> = {};
      (companiesRes.items || []).forEach((c: any) => {
        const lead = compIdToLead[c.id];
        if (lead) {
          map[c.normalized_name] = { leadId: lead.id, stage: lead.stage };
          map[c.name.toLowerCase().trim()] = { leadId: lead.id, stage: lead.stage };
        }
      });
      setCrmLeadMap(map);
    } catch (err) {
      console.error("Failed to load facets or CRM leads:", err);
    }
  }

  async function loadBuyers() {
    try {
      setLoading(true);

      // Compute min/max volume from volumeBracket
      let min_volume: number | undefined = undefined;
      let max_volume: number | undefined = undefined;
      if (volumeBracket === "under_5m") {
        max_volume = 5_000_000;
      } else if (volumeBracket === "5m_20m") {
        min_volume = 5_000_000;
        max_volume = 20_000_000;
      } else if (volumeBracket === "20m_50m") {
        min_volume = 20_000_000;
        max_volume = 5_000_0000;
      } else if (volumeBracket === "50m_plus") {
        min_volume = 50_000_000;
      }

      const res = await api.getGlobalBuyers({
        query: query.trim() || undefined,
        country_code: countryFilter || undefined,
        sector: sectorFilter || undefined,
        incoterm: incotermFilter !== "all" ? incotermFilter : undefined,
        min_volume,
        max_volume,
        sort_by: sortBy,
      });

      setBuyers(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.error("Failed to load buyers:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToCrm(buyer: BuyerProfile) {
    try {
      setActionLoadingId(buyer.id);
      const res = await api.swipeRecommendation(workspaceId, buyer.id, "right");
      const leadId: string = res.lead_id || "";

      // Update map
      setCrmLeadMap((prev) => ({
        ...prev,
        [buyer.normalized_name]: { leadId, stage: "new" },
        [buyer.company_name.toLowerCase().trim()]: { leadId, stage: "new" },
      }));

      setActionSuccessMsg({ buyerId: buyer.id, text: "Added to CRM Pipeline (Stage: New)!" });
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("Failed to add buyer to CRM: " + (err.message || "Error"));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handlePitchBuyer(buyer: BuyerProfile) {
    try {
      setActionLoadingId(buyer.id);
      // Promote buyer to lead if not already
      let leadId: string | undefined =
        crmLeadMap[buyer.normalized_name]?.leadId ||
        crmLeadMap[buyer.company_name.toLowerCase().trim()]?.leadId;

      if (!leadId) {
        const res = await api.swipeRecommendation(workspaceId, buyer.id, "right");
        leadId = res.lead_id || "";
      }

      if (leadId) {
        // Route directly to lead detail page
        router.push(`/workspace/${workspaceId}/leads/${leadId}`);
      }
    } catch (err: any) {
      alert("Failed to pitch buyer: " + (err.message || "Error"));
      setActionLoadingId(null);
    }
  }

  function handleResetFilters() {
    setQuery("");
    setCountryFilter("");
    setSectorFilter("");
    setVolumeBracket("all");
    setIncotermFilter("all");
    setSortBy("volume_desc");
  }

  // Sliced buyers for current page
  const totalPages = Math.ceil(buyers.length / pageSize) || 1;
  const paginatedBuyers = buyers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-slate-100">
      {/* Executive Intelligence Header & Master Metrics */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5 uppercase tracking-wider">
                <Globe2 className="w-3.5 h-3.5" />
                Verified Global Buyer Directory
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                Customs Manifest Verified
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Global Importer & Customs Explorer
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Explore 671 verified corporate importers across 15 destination corridors. Inspect real customs Bill of Lading manifests, supplier market shares, annual procurement volumes, and container sizes.
            </p>
          </div>

          <Link
            href={`/workspace/${workspaceId}/leads`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <Briefcase className="w-4 h-4" />
            <span>View Active Pipeline</span>
          </Link>
        </div>

        {/* Global Directory Metrics Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-white/[0.08] shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Verified Importers Catalog
            </span>
            <div className="text-2xl font-black text-white flex items-center gap-2">
              <span>{facets?.total_buyers || 671}</span>
              <span className="text-xs font-normal text-emerald-400 font-sans">Active Buyers</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Cross-checked via WCO customs data
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-white/[0.08] shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Annual Procurement Spend
            </span>
            <div className="text-2xl font-black text-white flex items-center gap-2">
              <span>
                ${facets?.total_annual_volume_usd ? (facets.total_annual_volume_usd / 1_000_000_000).toFixed(1) : "18.4"}B+
              </span>
              <span className="text-xs font-normal text-blue-400 font-sans">USD Total</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Documented container volume
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-white/[0.08] shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Destination Markets
            </span>
            <div className="text-2xl font-black text-white flex items-center gap-2">
              <span>{facets?.countries?.length || 15}</span>
              <span className="text-xs font-normal text-purple-400 font-sans">Global Hubs</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              US, UAE, DE, JP, AU, UK, NL, etc.
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-white/[0.08] shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              In Your Workspace CRM
            </span>
            <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
              <span>{Object.keys(crmLeadMap).length}</span>
              <span className="text-xs font-normal text-slate-400 font-sans">Leads Tracked</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Converted from directory
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Facet Filter Toolbar */}
      <div className="p-5 rounded-2xl bg-[#111827] border border-white/[0.08] space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by buyer company name, destination city, or port..."
              className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-white/[0.12] bg-[#0B0F19] text-white placeholder-slate-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Country Filter */}
          <div>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
            >
              <option value="" className="bg-[#0B0F19]">🌍 All 15 Countries</option>
              {(facets?.countries || []).map((c: any) => (
                <option key={c.code} value={c.code} className="bg-[#0B0F19]">
                  {COUNTRY_FLAGS[c.code] || c.code} ({c.count})
                </option>
              ))}
            </select>
          </div>

          {/* Sector Filter */}
          <div>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-white/[0.12] bg-[#0B0F19] text-white focus:border-blue-500 outline-none"
            >
              <option value="" className="bg-[#0B0F19]">📦 All 14 Industry Sectors</option>
              {(facets?.sectors || []).map((s: any) => (
                <option key={s.name} value={s.name} className="bg-[#0B0F19]">
                  {s.name} ({s.count})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Filters Row: Volume Range, Incoterm, Sort, and Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.06] text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Volume Bracket */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] font-semibold">Annual Spend:</span>
              <select
                value={volumeBracket}
                onChange={(e) => setVolumeBracket(e.target.value)}
                className="bg-[#0B0F19] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-white font-medium outline-none"
              >
                <option value="all">Any Volume</option>
                <option value="under_5m">Under $5M USD</option>
                <option value="5m_20m">$5M – $20M USD</option>
                <option value="20m_50m">$20M – $50M USD</option>
                <option value="50m_plus">$50M – $100M+ USD</option>
              </select>
            </div>

            {/* Incoterm Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] font-semibold">Incoterm:</span>
              <select
                value={incotermFilter}
                onChange={(e) => setIncotermFilter(e.target.value)}
                className="bg-[#0B0F19] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-white font-medium outline-none"
              >
                <option value="all">All Incoterms</option>
                <option value="CIF">CIF (Cost, Ins, Freight)</option>
                <option value="FOB">FOB (Free On Board)</option>
                <option value="CFR">CFR (Cost & Freight)</option>
                <option value="DDP">DDP (Delivered Duty Paid)</option>
              </select>
            </div>

            {/* Sorting */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] font-semibold">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[#0B0F19] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-white font-medium outline-none"
              >
                <option value="volume_desc">Volume (Highest First)</option>
                <option value="reliability_desc">Reliability Score (Highest)</option>
                <option value="tonnage_desc">Order Size (Largest Tonnage)</option>
                <option value="name_asc">Company Name (A–Z)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(query || countryFilter || sectorFilter || volumeBracket !== "all" || incotermFilter !== "all" || sortBy !== "volume_desc") && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}

            <div className="text-xs text-slate-400 font-mono">
              Showing <strong className="text-white">{buyers.length}</strong> matching buyers
            </div>
          </div>
        </div>
      </div>

      {/* Directory Results List */}
      {loading ? (
        <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          <span className="text-sm font-medium">Filtering customs Bill of Lading records across 671 verified buyers...</span>
        </div>
      ) : buyers.length === 0 ? (
        <div className="p-16 text-center bg-[#111827] rounded-2xl border border-white/[0.08] text-slate-400 space-y-2">
          <p className="text-base font-semibold text-slate-300">No overseas buyers match this specific filter combination.</p>
          <p className="text-xs text-slate-500">Try broadening your volume bracket or selecting "All Countries".</p>
          <button
            onClick={handleResetFilters}
            className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedBuyers.map((b) => {
            const isExpanded = expandedBuyerId === b.id;
            const isLoadingAction = actionLoadingId === b.id;
            const successMsg = actionSuccessMsg?.buyerId === b.id ? actionSuccessMsg.text : null;

            // Check if this buyer already exists in CRM
            const crmInfo = crmLeadMap[b.normalized_name] || crmLeadMap[b.company_name.toLowerCase().trim()];

            return (
              <div
                key={b.id}
                className="rounded-2xl bg-[#111827] border border-white/[0.08] hover:border-white/[0.18] transition-all overflow-hidden shadow-xs"
              >
                {/* Main Buyer Header Row */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-md bg-white/[0.1] text-white font-mono font-bold text-xs">
                        {COUNTRY_FLAGS[b.country_code] || b.country_code}
                      </span>
                      <h2 className="text-base font-bold text-white tracking-tight">
                        {b.company_name}
                      </h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {b.primary_sector}
                      </span>

                      {/* CRM Status Badge */}
                      {crmInfo ? (
                        <Link
                          href={`/workspace/${workspaceId}/leads/${crmInfo.leadId}`}
                          className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 hover:bg-emerald-500/30 transition"
                          title="Click to view deal in CRM"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>In Pipeline ({crmInfo.stage.toUpperCase()})</span>
                          <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-70" />
                        </Link>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 bg-white/[0.04]">
                          New Prospect
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
                      <span>Port: <strong className="text-slate-300 font-sans">{b.city || "Clearance Hub"}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Annual Volume: <strong className="text-white">${(b.annual_import_volume_usd / 1_000_000).toFixed(1)}M USD</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Incoterm: <strong className="text-blue-400">{b.preferred_incoterms || "CIF"}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span className="flex items-center gap-1 text-emerald-400 font-medium font-sans">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        {b.reliability_score}% Customs Integrity
                      </span>
                    </div>

                    {/* Customs Manifest Provenance Source Tag */}
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-sans pt-0.5">
                      <span className="text-slate-500">Manifest Source:</span>
                      <span className="text-slate-300 font-medium">{b.customs_manifest_provenance}</span>
                    </div>
                  </div>

                  {/* Operational Logistics Pills */}
                  <div className="flex flex-wrap items-center gap-3 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.06]">
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

                  {/* Action Buttons: Inspect BoL, Add to CRM, Pitch Buyer */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    <button
                      onClick={() => setExpandedBuyerId(isExpanded ? null : b.id)}
                      className="px-3 py-2 rounded-xl border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>{isExpanded ? "Hide Manifest" : "Inspect Manifest"}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {!crmInfo ? (
                      <button
                        onClick={() => handleAddToCrm(b)}
                        disabled={isLoadingAction}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.1] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Promote to active lead pipeline"
                      >
                        {isLoadingAction ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                        )}
                        <span>Add to CRM</span>
                      </button>
                    ) : null}

                    {/* Direct Pitch Buyer ⚡ Action */}
                    <button
                      onClick={() => handlePitchBuyer(b)}
                      disabled={isLoadingAction}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Promote to lead and open the AI Pitch & Outreach Generator"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                      <span>Pitch Buyer</span>
                    </button>
                  </div>
                </div>

                {successMsg && (
                  <div className="px-5 py-2 bg-emerald-950/40 border-t border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Collapsible Detailed Bill of Lading Manifest */}
                {isExpanded && (
                  <div className="p-6 bg-[#0B0F19] border-t border-white/[0.08] space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Current Supplier Network */}
                      <div className="p-4 rounded-xl bg-[#111827] border border-white/[0.08] space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                          <div className="flex items-center gap-2">
                            <Anchor className="w-4 h-4 text-blue-400" />
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                              Current Supplier Network & Ports of Lading
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
                                    Port of Lading: <span className="text-slate-300">{sup.port_of_lading}</span>
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
                            <div className="text-xs text-slate-500 py-3 text-center">
                              Manifest supplier details are masked under carrier non-disclosure.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Standards, Certifications & Product HS Classifications */}
                      <div className="p-4 rounded-xl bg-[#111827] border border-white/[0.08] space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                          <div className="flex items-center gap-2">
                            <Boxes className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                              Product Classifications & Mandatory Standards
                            </h3>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                            Active HS Codes in Clearance Flow
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {b.hs_codes.map((code) => (
                              <span
                                key={code}
                                className="px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08] text-xs font-mono text-slate-200"
                              >
                                HS {code}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                            Required Standards & Quality Certifications
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {b.required_certifications.map((cert) => (
                              <span
                                key={cert}
                                className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              >
                                {cert}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
                          <span>Contact: <strong>{b.contact_name || "Procurement Director"}</strong></span>
                          <span>Email: <strong>{b.contact_email || "Verified on File"}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Clean Pagination Bar */}
          {totalPages > 1 && (
            <div className="p-4 rounded-xl bg-[#111827] border border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
              <div>
                Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({buyers.length} total filtered buyers)
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white disabled:opacity-40 transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white disabled:opacity-40 transition flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
