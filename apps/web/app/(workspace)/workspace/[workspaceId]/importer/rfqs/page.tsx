"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, SourcingRfq, ImporterProfile } from "@/lib/api";
import {
  PackageCheck,
  Plus,
  Radar,
  Calendar,
  Anchor,
  Ship,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileText,
  DollarSign,
  Boxes,
  ArrowLeft,
  Search,
  Filter,
} from "lucide-react";

export default function ImporterRfqsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  const [loading, setLoading] = useState(true);
  const [rfqs, setRfqs] = useState<SourcingRfq[]>([]);
  const [profile, setProfile] = useState<ImporterProfile | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [commodityDescription, setCommodityDescription] = useState("");
  const [productCategory, setProductCategory] = useState("Textiles & Apparel");
  const [hsCode, setHsCode] = useState("6109.10");
  const [targetQuantity, setTargetQuantity] = useState<number>(50);
  const [quantityUnit, setQuantityUnit] = useState("Metric Tons (MT)");
  const [targetBudgetUsd, setTargetBudgetUsd] = useState<number>(250000);
  const [targetUnitPriceUsd, setTargetUnitPriceUsd] = useState<number>(5000);
  const [destinationPort, setDestinationPort] = useState("USLAX");
  const [preferredIncoterm, setPreferredIncoterm] = useState("CIF");
  const [preferredContainerType, setPreferredContainerType] = useState("40ft_hc");
  const [inspectionAgency, setInspectionAgency] = useState("SGS / Bureau Veritas");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [targetDeliveryDate, setTargetDeliveryDate] = useState("");
  const [specialClauses, setSpecialClauses] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [pRes, rfqsRes] = await Promise.allSettled([
          api.getImporterProfile(workspaceId),
          api.listRfqs(workspaceId),
        ]);

        if (pRes.status === "fulfilled") {
          setProfile(pRes.value);
          if (pRes.value.primary_discharge_port) {
            setDestinationPort(pRes.value.primary_discharge_port);
          }
          if (pRes.value.preferred_incoterm) {
            setPreferredIncoterm(pRes.value.preferred_incoterm);
          }
        }
        if (rfqsRes.status === "fulfilled") {
          setRfqs(rfqsRes.value.items || []);
        }
      } catch (err: any) {
        console.error("Failed to load RFQs:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [workspaceId]);

  async function handlePublishRfq(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!profile) {
      setFormError("Please complete your Importer Compliance Profile first so Indian exporters can verify your company.");
      return;
    }

    if (!title.trim() || !commodityDescription.trim() || !hsCode.trim()) {
      setFormError("Title, Commodity Description, and HS Code are required.");
      return;
    }

    try {
      setPublishing(true);
      const res = await api.publishRfq(workspaceId, {
        title: title.trim(),
        commodity_description: commodityDescription.trim(),
        product_category: productCategory,
        hs_code: hsCode.trim(),
        target_quantity: Number(targetQuantity),
        quantity_unit: quantityUnit,
        target_budget_usd: Number(targetBudgetUsd) || undefined,
        target_unit_price_usd: Number(targetUnitPriceUsd) || undefined,
        destination_country: profile.country_code,
        destination_port: destinationPort.trim().toUpperCase(),
        preferred_incoterm: preferredIncoterm,
        preferred_container_type: preferredContainerType,
        inspection_agency_allowed: inspectionAgency,
        special_technical_clauses: specialClauses.trim() || undefined,
        deadline_date: deadlineDate || undefined,
        target_delivery_date: targetDeliveryDate || undefined,
      });

      setRfqs([res, ...rfqs]);
      setShowModal(false);
      setSuccessBanner(
        `Tender "${res.title}" published! It is now live on ForeTrade Demand Radar across Indian factories.`
      );
      setTimeout(() => setSuccessBanner(null), 6000);

      // Reset form
      setTitle("");
      setCommodityDescription("");
    } catch (err: any) {
      setFormError(err.message || "Failed to publish RFQ");
    } finally {
      setPublishing(false);
    }
  }

  const filteredRfqs = rfqs.filter((r) => {
    if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.hs_code.toLowerCase().includes(q) ||
        r.commodity_description.toLowerCase().includes(q) ||
        r.product_category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href={`/workspace/${workspaceId}/importer`}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                Direct Procurement Tenders
              </span>
              <span className="text-xs text-slate-400 font-medium">Bilateral Demand Sync</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Sourcing RFQs & Factory Tenders
            </h1>
          </div>
        </div>

        <button
          onClick={() => {
            if (!profile) {
              alert("Please complete your Importer Compliance Profile before posting an RFQ.");
              return;
            }
            setShowModal(true);
          }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Publish New Sourcing RFQ</span>
        </button>
      </div>

      {/* Broadcast Notification Alert */}
      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2.5 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Demand Radar Broadcast Card */}
      <div className="p-5 bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-slate-50 border border-indigo-200/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Radar className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900">
              Instant Demand Radar Broadcasting Active
            </h2>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Every RFQ you publish is automatically synchronized to ForeTrade Demand Radar. Verified Indian manufacturers see your tender specifications and submit commercial offers directly to your inbox.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-700 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shrink-0">
          <span>{rfqs.length} Active Tenders</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tenders by commodity, HS code, or title..."
            className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-semibold">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="IN_NEGOTIATION">IN NEGOTIATION</option>
            <option value="FULFILLED">FULFILLED</option>
          </select>
        </div>
      </div>

      {/* RFQ Cards Grid */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-500 min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Fetching active procurement tenders...</span>
        </div>
      ) : filteredRfqs.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
            <PackageCheck className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">No tenders match your filter</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery ? "Try refining your search keyword." : "Publish your first international procurement RFQ to start receiving verified manufacturer offers."}
          </p>
          {!searchQuery && profile && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              Post First RFQ
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRfqs.map((rfq) => (
            <div
              key={rfq.id}
              className="p-6 bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl shadow-xs transition space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                        HS {rfq.hs_code}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {rfq.product_category}
                      </span>
                    </div>
                    <h2 className="text-sm font-bold text-slate-900 leading-snug">
                      {rfq.title}
                    </h2>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    {rfq.status}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                  {rfq.commodity_description}
                </p>

                {/* Key Spec Badges */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Target Volume:</span>
                    <strong className="text-slate-800">{rfq.target_quantity} {rfq.quantity_unit}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Target Budget:</span>
                    <strong className="text-indigo-700 font-bold">
                      {rfq.target_budget_usd ? `$${rfq.target_budget_usd.toLocaleString()}` : "Market Negotiable"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Discharge Port:</span>
                    <strong className="text-slate-800">{rfq.destination_port || "USLAX"} ({rfq.preferred_incoterm || "CIF"})</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Container Spec:</span>
                    <strong className="text-slate-800">{rfq.preferred_container_type?.toUpperCase()}</strong>
                  </div>
                </div>

                {rfq.inspection_agency_allowed && (
                  <div className="text-[11px] text-slate-500">
                    Pre-shipment Inspection: <strong>{rfq.inspection_agency_allowed}</strong>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 text-[11px]">
                  <Radar className="w-3.5 h-3.5 text-indigo-500" />
                  Synced to Demand Radar
                </span>
                <span className="font-mono text-[10px]">
                  {rfq.created_at ? new Date(rfq.created_at).toLocaleDateString() : "Active"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publish RFQ Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Publish Sourcing RFQ Tender</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tender will immediately broadcast to Indian manufacturers in ForeTrade Demand Radar.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handlePublishRfq} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tender Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Sourcing 50 MT 100% Combed Cotton Single Jersey Fabric"
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="Textiles & Apparel">Textiles & Apparel</option>
                    <option value="Agro & Spices">Agro & Spices</option>
                    <option value="Solar & Renewable">Solar & Renewable</option>
                    <option value="Engineering & Machining">Engineering & Machining</option>
                    <option value="Chemicals & Minerals">Chemicals & Minerals</option>
                    <option value="Leather & Footwear">Leather & Footwear</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    HS Code (4 to 8 Digits) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={hsCode}
                    onChange={(e) => setHsCode(e.target.value)}
                    placeholder="6109.10"
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Detailed Commodity & Technical Specifications <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={commodityDescription}
                  onChange={(e) => setCommodityDescription(e.target.value)}
                  rows={3}
                  placeholder="Specify yarn count, GSM, packaging specs, allowable moisture content, or tolerances..."
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(Number(e.target.value))}
                    min={1}
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quantity Unit
                  </label>
                  <select
                    value={quantityUnit}
                    onChange={(e) => setQuantityUnit(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="Metric Tons (MT)">Metric Tons (MT)</option>
                    <option value="FCL 40ft Containers">FCL 40ft Containers</option>
                    <option value="Pieces / Units">Pieces / Units</option>
                    <option value="Kilograms (KG)">Kilograms (KG)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Budget (USD)
                  </label>
                  <input
                    type="number"
                    value={targetBudgetUsd}
                    onChange={(e) => setTargetBudgetUsd(Number(e.target.value))}
                    placeholder="250000"
                    className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Unit Price (USD)
                  </label>
                  <input
                    type="number"
                    value={targetUnitPriceUsd}
                    onChange={(e) => setTargetUnitPriceUsd(Number(e.target.value))}
                    placeholder="5000"
                    className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Destination Port
                  </label>
                  <input
                    type="text"
                    value={destinationPort}
                    onChange={(e) => setDestinationPort(e.target.value.toUpperCase())}
                    placeholder="USLAX"
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Incoterm
                  </label>
                  <select
                    value={preferredIncoterm}
                    onChange={(e) => setPreferredIncoterm(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="CIF">CIF</option>
                    <option value="FOB">FOB</option>
                    <option value="CFR">CFR</option>
                    <option value="DDP">DDP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Container Type
                  </label>
                  <select
                    value={preferredContainerType}
                    onChange={(e) => setPreferredContainerType(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="40ft_hc">40ft High Cube</option>
                    <option value="40ft_fcl">40ft Standard</option>
                    <option value="20ft_fcl">20ft Heavy</option>
                    <option value="reefer">40ft Reefer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Inspection Agency Allowed
                  </label>
                  <input
                    type="text"
                    value={inspectionAgency}
                    onChange={(e) => setInspectionAgency(e.target.value)}
                    placeholder="SGS / Bureau Veritas"
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quote Deadline Date
                  </label>
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishing}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                  <span>{publishing ? "Broadcasting..." : "Broadcast to Demand Radar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
