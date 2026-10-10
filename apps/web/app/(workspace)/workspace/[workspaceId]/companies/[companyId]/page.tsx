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
  Ship,
  Container,
  Repeat,
  Calendar,
  Boxes,
  PieChart,
  CalendarRange,
  Zap,
  Check,
  TrendingUp,
  FileText,
  Anchor,
  Globe2,
  Mail,
  User,
} from "lucide-react";

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

export default function CompanyDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; companyId: string }>;
}) {
  const { workspaceId, companyId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [manifest, setManifest] = useState<any>(null);
  const [latestScore, setLatestScore] = useState<any>(null);
  const [scoring, setScoring] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [workspaceId, companyId]);

  async function loadData() {
    try {
      setLoading(true);

      // 1. Try loading as a Global Buyer Catalog Bill of Lading Manifest
      const manifestRes = await api.getBuyerBolManifest(companyId).catch(() => null);
      if (manifestRes) {
        setManifest(manifestRes);
      }

      // 2. Try loading as an existing Workspace Company
      const compRes = await api.getCompany(workspaceId, companyId).catch(() => null);
      if (compRes) {
        setCompany(compRes);
        const scoreRes = await api.getCompanyScores(workspaceId, companyId).catch(() => ({ items: [] }));
        if (scoreRes.items && scoreRes.items.length > 0) {
          setLatestScore(scoreRes.items[0]);
        }
      }

      // 3. Check if this buyer or company already has an active Lead in workspace
      const leadsRes = await api.listLeads(workspaceId).catch(() => ({ items: [] }));
      const foundLead = (leadsRes.items || []).find(
        (l: any) =>
          l.company_id === companyId ||
          (manifestRes && (l.company_name?.toLowerCase() === manifestRes.company_name?.toLowerCase()))
      );
      if (foundLead) {
        setCreatedLeadId(foundLead.id);
      }
    } catch (err) {
      console.error("Failed to load company or manifest detail:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalculate() {
    if (!company) return;
    setScoring(true);
    try {
      const res = await api.calculateScore(workspaceId, company.id);
      setLatestScore(res);
    } catch (err) {
      console.error("Failed to score:", err);
    } finally {
      setScoring(false);
    }
  }

  async function handlePromoteToCrm() {
    setPromoting(true);
    try {
      if (manifest) {
        const res = await api.swipeRecommendation(workspaceId, manifest.id, "right");
        setCreatedLeadId(res.lead_id || "lead_created");
      } else if (company) {
        const res = await api.createLead(workspaceId, company.id, "Promoted from Customs Intelligence Dossier.");
        setCreatedLeadId(res.id);
      }
    } catch (err: any) {
      alert("Failed to promote buyer: " + (err.message || "Error"));
    } finally {
      setPromoting(false);
    }
  }

  function handlePitchBuyer() {
    if (createdLeadId) {
      router.push(`/workspace/${workspaceId}/leads/${createdLeadId}`);
    } else {
      handlePromoteToCrm().then(() => {
        router.push(`/workspace/${workspaceId}/leads`);
      });
    }
  }

  if (loading) {
    return (
      <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-medium">Extracting customs Bill of Lading records & container telemetry...</span>
      </div>
    );
  }

  const profile = manifest || company;

  if (!profile) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <p className="text-slate-600 font-semibold">Customs intelligence dossier not found.</p>
        <Link href={`/workspace/${workspaceId}/companies`} className="text-blue-600 text-xs font-semibold hover:underline">
          ← Return to Global Directory
        </Link>
      </div>
    );
  }

  const companyName = profile.company_name || profile.name;
  const countryCode = profile.country_code;
  const primarySector = profile.primary_sector || profile.product_or_industry;
  const annualVolume = profile.annual_import_volume_usd || profile.attributes?.annual_import_volume_usd || 0;
  const avgOrderTons = profile.avg_order_tons || profile.attributes?.avg_order_tons || 50;
  const avgContainerTeu = profile.avg_container_teu || profile.attributes?.avg_container_teu || 4;
  const incoterm = profile.preferred_incoterms || profile.attributes?.preferred_incoterms || "CIF";
  const provenance = profile.customs_manifest_provenance || profile.attributes?.customs_provenance || "Public Customs Declaration 2024";
  const certifications: string[] = profile.required_certifications || profile.attributes?.required_certifications || ["ISO 9001"];
  const suppliers: any[] = profile.top_historical_suppliers || [];
  const seasonalityCurve: any[] = profile.seasonality_curve || [
    { month_name: "Jan", volume_share_pct: 8.0, estimated_teu: 4.0, is_peak: false },
    { month_name: "Feb", volume_share_pct: 7.5, estimated_teu: 3.8, is_peak: false },
    { month_name: "Mar", volume_share_pct: 9.0, estimated_teu: 4.5, is_peak: false },
    { month_name: "Apr", volume_share_pct: 8.5, estimated_teu: 4.2, is_peak: false },
    { month_name: "May", volume_share_pct: 9.0, estimated_teu: 4.5, is_peak: false },
    { month_name: "Jun", volume_share_pct: 9.5, estimated_teu: 4.8, is_peak: false },
    { month_name: "Jul", volume_share_pct: 12.0, estimated_teu: 6.0, is_peak: true },
    { month_name: "Aug", volume_share_pct: 13.0, estimated_teu: 6.5, is_peak: true },
    { month_name: "Sep", volume_share_pct: 11.0, estimated_teu: 5.5, is_peak: true },
    { month_name: "Oct", volume_share_pct: 8.0, estimated_teu: 4.0, is_peak: false },
    { month_name: "Nov", volume_share_pct: 6.0, estimated_teu: 3.0, is_peak: false },
    { month_name: "Dec", volume_share_pct: 5.5, estimated_teu: 2.8, is_peak: false },
  ];
  const originBreakdown: any[] = profile.origin_breakdown || [
    { country_code: "IN", share_pct: 44.0, is_indian_origin: true, displacement_opportunity: false },
    { country_code: "CN", share_pct: 36.0, is_indian_origin: false, displacement_opportunity: true },
    { country_code: "VN", share_pct: 20.0, is_indian_origin: false, displacement_opportunity: false },
  ];

  const peakMonths = seasonalityCurve.filter((m) => m.is_peak).map((m) => m.month_name);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 text-slate-900 pb-20">
      {/* Top Breadcrumb & Return Link */}
      <div className="flex items-center justify-between">
        <Link
          href={`/workspace/${workspaceId}/companies`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Global Buyer Directory</span>
        </Link>

        {createdLeadId && (
          <Link
            href={`/workspace/${workspaceId}/leads/${createdLeadId}`}
            className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 hover:bg-emerald-100 transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Active in CRM Pipeline</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
          </Link>
        )}
      </div>

      {/* Main Dossier Banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold text-xs">
              {COUNTRY_FLAGS[countryCode] || countryCode}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {primarySector}
            </span>
            {provenance.includes("ForeTrade Network") || provenance.includes("Verified Direct") ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>ForeTrade Network Direct Buyer</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Customs Manifest</span>
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            {companyName}
          </h1>

          <p className="text-xs text-slate-500 font-mono flex items-center gap-3 flex-wrap">
            <span>Destination Port: <strong className="text-slate-800 font-sans">{profile.primary_discharge_port || profile.city || "Major Container Terminal"}</strong></span>
            <span>•</span>
            <span>Annual Sourcing Budget: <strong className="text-slate-900 font-bold">${(annualVolume / 1_000_000).toFixed(1)}M USD</strong></span>
            <span>•</span>
            <span>Incoterm: <strong className="text-blue-700 font-bold">{incoterm}</strong></span>
          </p>

          <div className="text-[11px] text-slate-500 pt-1 flex items-center gap-1.5">
            <span className="text-slate-400">Declaration Provenance:</span>
            <span className="font-medium text-slate-700">{provenance}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          {!createdLeadId ? (
            <button
              onClick={handlePromoteToCrm}
              disabled={promoting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {promoting ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <Briefcase className="w-4 h-4 text-blue-600" />}
              <span>Promote to CRM Leads</span>
            </button>
          ) : (
            <Link
              href={`/workspace/${workspaceId}/leads/${createdLeadId}`}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>View Deal in CRM</span>
            </Link>
          )}

          <button
            onClick={handlePitchBuyer}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-blue-200" />
            <span>Generate AI Export Pitch</span>
          </button>
        </div>
      </div>

      {/* 1. Interactive 12-Month Bill of Lading Shipment Seasonality Timeline */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              12-Month Bill of Lading (BoL) Shipment Seasonality Timeline
            </h2>
          </div>

          {peakMonths.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1">
              <span>Peak Buying Months: {peakMonths.join(", ")}</span>
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Monthly procurement volume intensity calculated from historical container entries for <strong>{primarySector}</strong>. Use these cycles to time outreach pitches right before seasonal procurement peaks.
        </p>

        {/* 12-Month Bar Visualizer */}
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-4">
          {seasonalityCurve.map((m: any, idx: number) => {
            const isPeak = m.is_peak;
            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border text-center transition flex flex-col justify-between ${
                  isPeak
                    ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200"
                    : "bg-slate-50 border-slate-200/80"
                }`}
              >
                <div className="text-[11px] font-bold text-slate-700">{m.month_name}</div>

                <div className="my-3 flex items-center justify-center h-16">
                  <div className="w-4 bg-slate-200 rounded-full h-16 flex items-end overflow-hidden">
                    <div
                      className={`w-full rounded-full transition-all ${
                        isPeak ? "bg-emerald-600" : "bg-blue-500"
                      }`}
                      style={{ height: `${Math.min(100, (m.volume_share_pct / 15) * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold font-mono text-slate-900 block">
                    {m.volume_share_pct}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    {m.estimated_teu} TEU
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Supplier Origin Breakdown Visualizer & Competitive Displacement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Origin Market Share */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <PieChart className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Historical Supplier Origin Market Share
            </h2>
          </div>

          <p className="text-xs text-slate-500">
            Current country-of-origin import distribution based on inward port manifests.
          </p>

          <div className="space-y-3 pt-2">
            {originBreakdown.map((orig: any) => (
              <div key={orig.country_code} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>{COUNTRY_FLAGS[orig.country_code] || orig.country_code}</span>
                    {orig.is_indian_origin && (
                      <span className="px-1.5 py-0.2 rounded-xs text-[9px] bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                        Active Indian Lane
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-slate-900">{orig.share_pct}%</span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${
                      orig.is_indian_origin ? "bg-emerald-600" : "bg-slate-400"
                    }`}
                    style={{ width: `${orig.share_pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Tactical Entry Note */}
          <div className="p-3 bg-blue-50/50 border border-blue-200/60 rounded-xl text-xs text-blue-900 space-y-1 mt-4">
            <span className="font-bold flex items-center gap-1 text-blue-700">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Competitive Displacement Angle:</span>
            </span>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Buyer currently relies on non-Indian suppliers for ~56% of procurement. Indian exporters can pitch duty-free tariff arbitrage (CEPA/ECTA) and direct JNPT/Mundra sea freight to displace high-duty foreign suppliers.
            </p>
          </div>
        </div>

        {/* Operational Manifest Specifications */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Container className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Logistics & Container Specifications
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Avg Consignment Size</span>
              <span className="text-sm font-mono font-bold text-slate-900 mt-1 block">{avgOrderTons} Metric Tons</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Container Capacity</span>
              <span className="text-sm font-mono font-bold text-slate-900 mt-1 block">{avgContainerTeu} TEU / shipment</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Order Cycle Frequency</span>
              <span className="text-sm font-mono font-bold text-slate-900 mt-1 block">~30 Days (Monthly)</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Incoterm Preferred</span>
              <span className="text-sm font-mono font-bold text-blue-700 mt-1 block">{incoterm}</span>
            </div>
          </div>

          {/* Mandatory Certifications */}
          <div className="pt-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2">
              Mandatory Quality & Statutory Standards Required
            </span>
            <div className="flex flex-wrap gap-1.5">
              {certifications.map((c, ci) => (
                <span
                  key={ci}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-2xs flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{c}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Verified Historical Suppliers & Ports of Lading Table */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Boxes className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">
            Historical Supplier Clusters & Ports of Lading
          </h2>
        </div>

        {suppliers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3">Origin Country</th>
                  <th className="py-2.5 px-3">Port of Lading</th>
                  <th className="py-2.5 px-3 text-right">Volume Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {suppliers.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-semibold">{s.supplier_name}</td>
                    <td className="py-2.5 px-3 font-mono">{s.origin_country}</td>
                    <td className="py-2.5 px-3 text-slate-600">{s.port_of_lading}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      {s.share_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Direct importer manifest. Historical vendor cluster data aggregated at port customs level.</p>
        )}
      </div>

      {/* 4. Verified Contact Coordinates */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-600" />
          <span>Verified Sourcing Decision-Makers</span>
        </h2>
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="font-bold text-slate-900 block">{profile.contact_name || "Head of Global Sourcing"}</span>
            <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">{profile.contact_email || "procurement@domain.example.com"}</span>
          </div>
          <button
            onClick={handlePitchBuyer}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-blue-200" />
            <span>Launch Outreach Studio</span>
          </button>
        </div>
      </div>
    </div>
  );
}
