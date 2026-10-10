"use client";

import { use, useEffect, useState, useMemo } from "react";
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
  Mail,
  Phone,
  Copy,
  Check,
  Users,
  UserCheck,
  CheckSquare,
  Square,
  Download,
  CalendarRange,
  PieChart,
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

const MONTH_SHORT = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function computeSeasonalityCurve(sector: string) {
  const s = (sector || "").toLowerCase();
  if (s.includes("textile") || s.includes("apparel")) {
    return [6, 5, 7, 8, 9, 10, 14, 13, 11, 8, 5, 4];
  } else if (s.includes("solar") || s.includes("renew")) {
    return [7, 8, 11, 12, 13, 12, 10, 8, 7, 5, 4, 3];
  } else if (s.includes("agri") || s.includes("spice") || s.includes("grain")) {
    return [11, 12, 12, 9, 7, 5, 5, 6, 7, 9, 11, 12];
  } else if (s.includes("gem") || s.includes("jewel")) {
    return [6, 7, 6, 6, 7, 7, 8, 8, 10, 13, 12, 10];
  } else if (s.includes("leather") || s.includes("footwear")) {
    return [6, 6, 7, 8, 9, 10, 12, 12, 11, 8, 6, 5];
  }
  return [8, 8, 9, 9, 9, 9, 8, 7, 9, 9, 8, 7];
}

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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [volumeBracket, setVolumeBracket] = useState("all");
  const [incotermFilter, setIncotermFilter] = useState("all");
  const [sortBy, setSortBy] = useState("volume_desc");

  // Multi-Select Bulk Actions State
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<Set<string>>(new Set());
  const [isBatchPromoting, setIsBatchPromoting] = useState(false);
  const [batchActionMsg, setBatchActionMsg] = useState<string | null>(null);

  // Interaction states
  const [expandedBuyerId, setExpandedBuyerId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<{ buyerId: string; text: string } | null>(null);

  // Decision-Maker Contacts State
  const [buyerContactsMap, setBuyerContactsMap] = useState<Record<string, any[]>>({});
  const [loadingContactsMap, setLoadingContactsMap] = useState<Record<string, boolean>>({});
  const [copiedContactId, setCopiedContactId] = useState<string | null>(null);

  // Debounce search query (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    loadFacetsAndCrm();
  }, [workspaceId]);

  useEffect(() => {
    setPage(1);
    loadBuyers();
  }, [debouncedQuery, countryFilter, sectorFilter, volumeBracket, incotermFilter, sortBy]);

  useEffect(() => {
    if (expandedBuyerId && !buyerContactsMap[expandedBuyerId] && !loadingContactsMap[expandedBuyerId]) {
      loadContacts(expandedBuyerId);
    }
  }, [expandedBuyerId]);

  async function loadContacts(buyerId: string) {
    try {
      setLoadingContactsMap((prev) => ({ ...prev, [buyerId]: true }));
      const res = await api.getBuyerContacts(buyerId);
      setBuyerContactsMap((prev) => ({ ...prev, [buyerId]: res.contacts || [] }));
    } catch (err) {
      console.warn("Could not load contacts:", err);
    } finally {
      setLoadingContactsMap((prev) => ({ ...prev, [buyerId]: false }));
    }
  }

  async function handleEnrichContacts(buyerId: string) {
    try {
      setLoadingContactsMap((prev) => ({ ...prev, [buyerId]: true }));
      const res = await api.enrichBuyerContacts(buyerId);
      setBuyerContactsMap((prev) => ({ ...prev, [buyerId]: res.contacts || [] }));
    } catch (err) {
      console.error("Enrichment failed:", err);
    } finally {
      setLoadingContactsMap((prev) => ({ ...prev, [buyerId]: false }));
    }
  }

  function handleCopyContactInfo(text: string, contactId: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedContactId(contactId);
    setTimeout(() => setCopiedContactId(null), 2500);
  }

  async function loadFacetsAndCrm() {
    try {
      const [facetsRes, leadsRes, companiesRes] = await Promise.all([
        api.getGlobalBuyerFacets().catch(() => null),
        api.listLeads(workspaceId).catch(() => ({ items: [] })),
        api.listCompanies(workspaceId).catch(() => ({ items: [] })),
      ]);

      if (facetsRes) setFacets(facetsRes);

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

      let min_volume: number | undefined = undefined;
      let max_volume: number | undefined = undefined;
      if (volumeBracket === "under_5m") {
        max_volume = 5_000_000;
      } else if (volumeBracket === "5m_20m") {
        min_volume = 5_000_000;
        max_volume = 20_000_000;
      } else if (volumeBracket === "20m_50m") {
        min_volume = 20_000_000;
        max_volume = 50_000_000;
      } else if (volumeBracket === "50m_plus") {
        min_volume = 50_000_000;
      }

      const res = await api.getGlobalBuyers({
        query: debouncedQuery.trim() || undefined,
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

  // Single Add to CRM
  async function handleAddToCrm(buyer: BuyerProfile) {
    try {
      setActionLoadingId(buyer.id);
      const res = await api.swipeRecommendation(workspaceId, buyer.id, "right");
      const leadId: string = res.lead_id || "";

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

  // Pitch Buyer Launcher
  async function handlePitchBuyer(buyer: BuyerProfile) {
    try {
      setActionLoadingId(buyer.id);
      let leadId: string | undefined =
        crmLeadMap[buyer.normalized_name]?.leadId ||
        crmLeadMap[buyer.company_name.toLowerCase().trim()]?.leadId;

      if (!leadId) {
        const res = await api.swipeRecommendation(workspaceId, buyer.id, "right");
        leadId = res.lead_id || "";
      }

      if (leadId) {
        router.push(`/workspace/${workspaceId}/leads/${leadId}`);
      }
    } catch (err: any) {
      alert("Failed to pitch buyer: " + (err.message || "Error"));
      setActionLoadingId(null);
    }
  }

  // Bulk Actions
  function toggleSelectBuyer(id: string) {
    setSelectedBuyerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAllVisible() {
    if (selectedBuyerIds.size === paginatedBuyers.length && paginatedBuyers.length > 0) {
      setSelectedBuyerIds(new Set());
    } else {
      setSelectedBuyerIds(new Set(paginatedBuyers.map((b) => b.id)));
    }
  }

  async function handleBatchPromoteToCrm() {
    if (selectedBuyerIds.size === 0 || isBatchPromoting) return;
    try {
      setIsBatchPromoting(true);
      const ids = Array.from(selectedBuyerIds);
      const res = await api.batchPromoteBuyers(workspaceId, ids);

      // Refresh CRM map
      await loadFacetsAndCrm();
      setBatchActionMsg(`Successfully added ${res.promoted_count} buyers to Deal Desk CRM!`);
      setSelectedBuyerIds(new Set());
      setTimeout(() => setBatchActionMsg(null), 5000);
    } catch (err: any) {
      alert("Failed to batch promote buyers: " + (err.message || "Error"));
    } finally {
      setIsBatchPromoting(false);
    }
  }

  function handleExportCsv() {
    const listToExport = selectedBuyerIds.size > 0
      ? buyers.filter((b) => selectedBuyerIds.has(b.id))
      : buyers;

    if (listToExport.length === 0) return;

    const headers = [
      "Company Name",
      "Country Code",
      "City/Port",
      "Primary Sector",
      "HS Codes",
      "Annual Import Volume USD",
      "Avg Order Tons",
      "Container TEU",
      "Incoterm",
      "Contact Name",
      "Contact Email",
      "Website",
      "Manifest Provenance",
      "Reliability Score",
    ];

    const rows = listToExport.map((b) => [
      `"${b.company_name.replace(/"/g, '""')}"`,
      `"${b.country_code}"`,
      `"${(b.city || "").replace(/"/g, '""')}"`,
      `"${b.primary_sector.replace(/"/g, '""')}"`,
      `"${(b.hs_codes || []).join(", ")}"`,
      b.annual_import_volume_usd,
      b.avg_order_tons,
      b.avg_container_teu,
      `"${b.preferred_incoterms || "CIF"}"`,
      `"${(b.contact_name || "").replace(/"/g, '""')}"`,
      `"${(b.contact_email || "").replace(/"/g, '""')}"`,
      `"${(b.website || "").replace(/"/g, '""')}"`,
      `"${(b.customs_manifest_provenance || "").replace(/"/g, '""')}"`,
      b.reliability_score,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `foretrade_buyers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleResetFilters() {
    setQuery("");
    setDebouncedQuery("");
    setCountryFilter("");
    setSectorFilter("");
    setVolumeBracket("all");
    setIncotermFilter("all");
    setSortBy("volume_desc");
  }

  const totalPages = Math.ceil(buyers.length / pageSize) || 1;
  const paginatedBuyers = buyers.slice((page - 1) * pageSize, page * pageSize);
  const allVisibleSelected = paginatedBuyers.length > 0 && paginatedBuyers.every((b) => selectedBuyerIds.has(b.id));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 text-slate-900 pb-24">
      {/* Header & Stats Banner */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Customs Manifest Directory</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                <span>3,200+ Verified Importers</span>
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Global Buyer Directory & Bill of Lading Dossier
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified overseas importers cross-referenced against public customs manifest declarations, shipment seasonality, container TEU volumes, and historical origin shares.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export to CSV</span>
            </button>
            <Link
              href={`/workspace/${workspaceId}/swipe`}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Two-Tower Match Deck</span>
            </Link>
          </div>
        </div>

        {/* Master Metrics Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-blue-600" />
              <span>Cataloged Buyers</span>
            </span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {facets ? facets.total_buyers.toLocaleString() : "3,200+"}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block font-sans">Across 15 key global corridors</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <Ship className="w-3 h-3 text-emerald-600" />
              <span>Gross Trade Demand</span>
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
              ${facets ? (facets.total_annual_volume_usd / 1_000_000_000).toFixed(1) : "48.2"}B
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block font-sans">Verified annual import purchases</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-indigo-600" />
              <span>Customs Integrity</span>
            </span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              92.4%
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block font-sans">Average port clearance score</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-purple-600" />
              <span>In Deal Pipeline</span>
            </span>
            <div className="text-2xl font-bold font-mono text-purple-700 mt-1">
              {Object.keys(crmLeadMap).length}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block font-sans">Active deals under negotiation</span>
          </div>
        </div>
      </div>

      {/* Batch Action Success Banner */}
      {batchActionMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{batchActionMsg}</span>
        </div>
      )}

      {/* Instant Debounced Search & Facet Filter Bar */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Customs Search & Corridor Filters</h2>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold self-start md:self-auto cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Instant Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company, port, or HS code..."
              className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Country Selector */}
          <div>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            >
              <option value="">All Destination Corridors (15)</option>
              {Object.entries(COUNTRY_FLAGS).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Sector */}
          <div>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            >
              <option value="">All Product Sectors</option>
              {facets &&
                facets.sectors.map((s: any) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.count})
                  </option>
                ))}
            </select>
          </div>

          {/* Volume Bracket */}
          <div>
            <select
              value={volumeBracket}
              onChange={(e) => setVolumeBracket(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            >
              <option value="all">All Import Volumes</option>
              <option value="under_5m">&lt; $5M USD / year</option>
              <option value="5m_20m">$5M – $20M USD / year</option>
              <option value="20m_50m">$20M – $50M USD / year</option>
              <option value="50m_plus">&gt; $50M USD / year</option>
            </select>
          </div>
        </div>

        {/* Incoterms & Sorting Sub-Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-500">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-700">Incoterm:</span>
            {["all", "CIF", "FOB", "DDP", "CFR"].map((inc) => (
              <button
                key={inc}
                onClick={() => setIncotermFilter(inc)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition cursor-pointer ${
                  incotermFilter === inc
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {inc.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-hidden"
            >
              <option value="volume_desc">Annual Volume (High → Low)</option>
              <option value="volume_asc">Annual Volume (Low → High)</option>
              <option value="reliability_desc">Reliability Score</option>
              <option value="tonnage_desc">Order Size (Tonnage)</option>
              <option value="name_asc">Company Name (A → Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Sub-Header & Select All Toolbar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectAllVisible}
            className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            {allVisibleSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>Select All on Page ({paginatedBuyers.length})</span>
          </button>

          {selectedBuyerIds.size > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {selectedBuyerIds.size} selected
            </span>
          )}
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing <strong>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> buyers
        </div>
      </div>

      {/* Directory Results List */}
      {loading ? (
        <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Filtering customs Bill of Lading records across verified buyers...</span>
        </div>
      ) : buyers.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-2">
          <p className="text-base font-semibold text-slate-800">No overseas buyers match this specific filter combination.</p>
          <p className="text-xs text-slate-500">Try broadening your volume bracket or selecting "All Countries".</p>
          <button
            onClick={handleResetFilters}
            className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedBuyers.map((b) => {
            const isExpanded = expandedBuyerId === b.id;
            const isLoadingAction = actionLoadingId === b.id;
            const isSelected = selectedBuyerIds.has(b.id);
            const successMsg = actionSuccessMsg?.buyerId === b.id ? actionSuccessMsg.text : null;
            const crmInfo = crmLeadMap[b.normalized_name] || crmLeadMap[b.company_name.toLowerCase().trim()];
            const seasonality = computeSeasonalityCurve(b.primary_sector);

            // Compute supplier origin breakdown
            const originMap: Record<string, number> = {};
            (b.top_historical_suppliers || []).forEach((s) => {
              originMap[s.origin_country] = (originMap[s.origin_country] || 0) + s.share_pct;
            });
            const originEntries = Object.entries(originMap).sort((a, b) => b[1] - a[1]);

            return (
              <div
                key={b.id}
                className={`rounded-2xl bg-white border transition-all overflow-hidden shadow-xs ${
                  isSelected ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200/90 hover:border-blue-300"
                }`}
              >
                {/* Main Buyer Header Row */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelectBuyer(b.id)}
                        className="text-slate-400 hover:text-blue-600 transition cursor-pointer"
                        title={isSelected ? "Deselect buyer" : "Select buyer for batch action"}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold text-xs">
                        {COUNTRY_FLAGS[b.country_code] || b.country_code}
                      </span>
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">
                        {b.company_name}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {b.primary_sector}
                      </span>

                      {/* CRM Status Badge */}
                      {crmInfo ? (
                        <Link
                          href={`/workspace/${workspaceId}/leads/${crmInfo.leadId}`}
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 hover:bg-emerald-100 transition"
                          title="Click to view deal in CRM"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>In Pipeline ({crmInfo.stage.toUpperCase()})</span>
                          <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-70" />
                        </Link>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-100">
                          New Prospect
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono">
                      <span>Port: <strong className="text-slate-800 font-sans">{b.city || "Clearance Hub"}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Annual Volume: <strong className="text-slate-900 font-bold">${(b.annual_import_volume_usd / 1_000_000).toFixed(1)}M USD</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Incoterm: <strong className="text-blue-700 font-bold">{b.preferred_incoterms || "CIF"}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold font-sans">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        {b.reliability_score}% Customs Integrity
                      </span>
                    </div>

                    {/* Customs Manifest Provenance */}
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-sans pt-0.5">
                      <span className="text-slate-400">Manifest Source:</span>
                      <span className="text-slate-700 font-medium">{b.customs_manifest_provenance}</span>
                    </div>
                  </div>

                  {/* Operational Logistics & Mini-Seasonality Gauge */}
                  <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    {/* Mini Seasonality Bars */}
                    <div className="px-2 font-mono">
                      <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1 font-sans mb-1">
                        <CalendarRange className="w-3 h-3 text-blue-600" />
                        <span>Seasonality</span>
                      </div>
                      <div className="flex items-end gap-0.5 h-6">
                        {seasonality.map((val, mi) => (
                          <div
                            key={mi}
                            title={`${MONTH_SHORT[mi]}: ${val}% volume`}
                            className={`w-1.5 rounded-xs transition-all ${
                              val >= 11 ? "bg-emerald-600" : val >= 8 ? "bg-blue-500" : "bg-slate-300"
                            }`}
                            style={{ height: `${Math.max(4, (val / 14) * 24)}px` }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

                    {/* Supplier Origin Shares */}
                    <div className="px-2 font-mono">
                      <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1 font-sans mb-1">
                        <PieChart className="w-3 h-3 text-purple-600" />
                        <span>Origins</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-bold">
                        {originEntries.slice(0, 3).map(([c, pct], oi) => (
                          <span
                            key={c}
                            className={`px-1.5 py-0.2 rounded-xs text-[10px] ${
                              c === "IN"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {c} {Math.round(pct)}%
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

                    <div className="text-center px-2 font-mono">
                      <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1 justify-center font-sans">
                        <Container className="w-3 h-3 text-emerald-600" />
                        <span>Container</span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">
                        {b.avg_container_teu} TEU
                      </div>
                    </div>
                  </div>

                  {/* Actions: View Dossier, Inspect Manifest, Add to CRM */}
                  <div className="flex items-center gap-2 self-end lg:self-center flex-wrap">
                    <Link
                      href={`/workspace/${workspaceId}/companies/${b.id}`}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition flex items-center gap-1"
                      title="View full Bill of Lading dossier & seasonality"
                    >
                      <span>BoL Dossier</span>
                      <ArrowRight className="w-3 h-3 text-blue-600" />
                    </Link>

                    <button
                      onClick={() => setExpandedBuyerId(isExpanded ? null : b.id)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isExpanded ? "Hide" : "Inspect"}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {!crmInfo ? (
                      <button
                        onClick={() => handleAddToCrm(b)}
                        disabled={isLoadingAction}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Promote to active lead pipeline"
                      >
                        {isLoadingAction ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                        )}
                        <span>Add to CRM</span>
                      </button>
                    ) : null}

                    <button
                      onClick={() => handlePitchBuyer(b)}
                      disabled={isLoadingAction}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Launch Deal Studio & generate tailored export pitch"
                    >
                      <Zap className="w-3.5 h-3.5 text-blue-200" />
                      <span>Pitch Buyer</span>
                    </button>
                  </div>
                </div>

                {/* Success feedback pill */}
                {successMsg && (
                  <div className="px-5 py-2 bg-emerald-50 border-t border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Expanded Customs Bill of Lading Manifest Drawer */}
                {isExpanded && (
                  <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-5 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Left: Manifest Specifications */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Ship className="w-3.5 h-3.5 text-blue-600" />
                          <span>Customs Bill of Lading Parameters</span>
                        </h3>

                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Official Customs Registration:</span>
                            <span className="font-semibold text-slate-800 font-mono">{b.company_name}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Manifest Declaration Code:</span>
                            <span className="font-mono text-slate-700 text-[11px]">{b.customs_manifest_provenance}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Inward Port of Discharge:</span>
                            <span className="font-semibold text-slate-800">{b.city || "Major Container Terminal"}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Declared HS Chapters:</span>
                            <span className="font-mono font-bold text-blue-700">{b.hs_codes.join(", ") || "General"}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">Average Shipment Weight:</span>
                            <span className="font-semibold text-slate-800 font-mono">{b.avg_order_tons} Metric Tons / consignment</span>
                          </div>
                        </div>

                        {/* Mandatory Quality & Statutory Standards */}
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
                            Mandated Statutory Certifications
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {b.required_certifications.map((cert, ci) => (
                              <span
                                key={ci}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 shadow-2xs"
                              >
                                {cert}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: Historical Supplier Clusters */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Historical Suppliers & Ports of Lading</span>
                        </h3>

                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5">
                          {b.top_historical_suppliers && b.top_historical_suppliers.length > 0 ? (
                            b.top_historical_suppliers.map((supp, si) => (
                              <div key={si} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-xs">
                                <div>
                                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                    <span>{supp.supplier_name}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xs bg-slate-100 text-slate-600 border border-slate-200">
                                      {supp.origin_country}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    Port of Lading: <span className="font-medium text-slate-700">{supp.port_of_lading}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold font-mono text-emerald-700">
                                    {supp.share_pct}%
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">volume share</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-500">Direct inward manifest. No third-party supplier aggregation available.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Verified Decision-Maker Contacts */}
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Verified Procurement Decision-Makers
                          </h3>
                        </div>
                        <button
                          onClick={() => handleEnrichContacts(b.id)}
                          disabled={loadingContactsMap[b.id]}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {loadingContactsMap[b.id] ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-blue-600" />
                          )}
                          <span>Live Re-Enrich</span>
                        </button>
                      </div>

                      {loadingContactsMap[b.id] ? (
                        <div className="p-4 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Querying corporate domains & Hunter.io intelligence...</span>
                        </div>
                      ) : (buyerContactsMap[b.id] || []).length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {(buyerContactsMap[b.id] || []).map((c, ci) => (
                            <div key={ci} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-900">{c.full_name}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                                  {c.confidence || "95%"} match
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">{c.job_title}</p>
                              {c.email && (
                                <div className="flex items-center justify-between text-[11px] font-mono text-slate-700 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                  <span className="truncate">{c.email}</span>
                                  <button
                                    onClick={() => handleCopyContactInfo(c.email, `${b.id}-${ci}`)}
                                    className="text-slate-400 hover:text-slate-700 transition ml-1"
                                    title="Copy email"
                                  >
                                    {copiedContactId === `${b.id}-${ci}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                          <span>Primary manifest officer: <strong>{b.contact_name || "Head of Sourcing"}</strong> ({b.contact_email || "procurement@domain.com"})</span>
                          <button
                            onClick={() => handleEnrichContacts(b.id)}
                            className="text-blue-600 hover:underline font-semibold text-[11px]"
                          >
                            Find more executives →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-600">
          <div>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 transition cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Floating Sticky Bulk Actions Bar */}
      {selectedBuyerIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 text-xs font-medium border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono font-bold text-xs flex items-center justify-center">
              {selectedBuyerIds.size}
            </span>
            <span className="font-semibold">Buyers Selected</span>
          </div>

          <div className="h-4 w-px bg-slate-700"></div>

          <button
            onClick={handleBatchPromoteToCrm}
            disabled={isBatchPromoting}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isBatchPromoting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Briefcase className="w-3.5 h-3.5" />
            )}
            <span>Add All to Deal Desk CRM</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Selected to CSV</span>
          </button>

          <button
            onClick={() => setSelectedBuyerIds(new Set())}
            className="text-slate-400 hover:text-white transition text-xs font-semibold cursor-pointer"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
}
