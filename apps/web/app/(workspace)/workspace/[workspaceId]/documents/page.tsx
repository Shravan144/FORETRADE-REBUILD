"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  FileText,
  Package,
  Plus,
  Search,
  Filter,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  Ship,
  Building2,
  Calendar,
  DollarSign,
  Briefcase,
  Layers,
  ArrowRight,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

interface DocumentItem {
  id: string;
  workspace_id: string;
  lead_id: string;
  company_id: string;
  document_type: "proforma_invoice" | "packing_list";
  document_number: string;
  status: string;
  currency: string;
  incoterm: string;
  issue_date: string | null;
  validity_date: string | null;
  port_of_loading: string;
  port_of_discharge: string;
  exporter_details: Record<string, any>;
  buyer_details: Record<string, any>;
  bank_details: Record<string, any>;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    hs_code?: string;
  }>;
  logistics_details: Record<string, any>;
  created_at: string;
}

interface LeadOption {
  id: string;
  company_name: string;
  country_code: string;
  stage: string;
}

export default function DocumentStudioDashboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | "proforma_invoice" | "packing_list">("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Quick Generate Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [generatingLeadId, setGeneratingLeadId] = useState<string | null>(null);
  const [newDocType, setNewDocType] = useState<"proforma_invoice" | "packing_list">("proforma_invoice");

  useEffect(() => {
    loadDocuments();
  }, [workspaceId]);

  async function loadDocuments() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listWorkspaceDocuments(workspaceId);
      setDocuments(res.items || []);
    } catch (err: any) {
      console.error("Failed to load commercial documents:", err);
      setError(err.message || "Failed to load commercial documents");
    } finally {
      setLoading(false);
    }
  }

  async function openQuickGenerateModal() {
    setIsModalOpen(true);
    setLoadingLeads(true);
    try {
      const [leadsRes, companiesRes] = await Promise.all([
        api.listLeads(workspaceId),
        api.listCompanies(workspaceId),
      ]);
      const compMap = new Map((companiesRes.items || []).map((c: any) => [c.id, c]));
      const formatted: LeadOption[] = (leadsRes.items || []).map((lead: any) => {
        const comp = compMap.get(lead.company_id);
        return {
          id: lead.id,
          company_name: comp?.name || "Overseas Buyer",
          country_code: comp?.country_code || "AE",
          stage: lead.stage,
        };
      });
      setLeads(formatted);
    } catch (err) {
      console.error("Failed to load leads for generation:", err);
    } finally {
      setLoadingLeads(false);
    }
  }

  async function handleGenerateFromLead(leadId: string) {
    setGeneratingLeadId(leadId);
    try {
      const newDoc = await api.generateLeadDocument(workspaceId, leadId, newDocType);
      setIsModalOpen(false);
      router.push(`/workspace/${workspaceId}/documents/${newDoc.id}`);
    } catch (err: any) {
      alert("Failed to generate document: " + (err.message || "Error"));
    } finally {
      setGeneratingLeadId(null);
    }
  }

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    if (selectedType !== "all" && doc.document_type !== selectedType) return false;
    if (selectedStatus !== "all" && doc.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const buyerName = doc.buyer_details?.company_name?.toLowerCase() || "";
      const docNum = doc.document_number?.toLowerCase() || "";
      const port = doc.port_of_discharge?.toLowerCase() || "";
      if (!buyerName.includes(q) && !docNum.includes(q) && !port.includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Summary Metrics
  const totalCount = documents.length;
  const piCount = documents.filter((d) => d.document_type === "proforma_invoice").length;
  const pklCount = documents.filter((d) => d.document_type === "packing_list").length;
  const totalOrderValue = documents.reduce((sum, d) => {
    const docTotal = (d.line_items || []).reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
    return sum + docTotal;
  }, 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 text-slate-800">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase font-bold tracking-widest text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Documentation</span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Customs Ready
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5 mt-1.5">
            <FileText className="w-6 h-6 text-blue-600" />
            <span>Export Document Studio</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Generate, customize, and issue official Proforma Invoices (P/I) and Commercial Packing Lists (CPL) with automated Incoterms, container TEUs, and bank wire remittance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/workspace/${workspaceId}/settings`}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg shadow-2xs transition"
          >
            <Settings className="w-3.5 h-3.5 text-blue-600" />
            <span>Bank & EXIM Settings</span>
          </Link>

          <button
            onClick={openQuickGenerateModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs hover:shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Document</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Total Documents</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Across all trade leads</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Proforma Invoices</span>
            <FileText className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">{piCount}</div>
          <div className="text-[11px] text-emerald-700 mt-1 font-medium">Commercial quotes issued</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Packing Lists</span>
            <Package className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">{pklCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Container manifests</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Cumulative Value</span>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            ${totalOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Documented export volume</div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-100/70 border border-slate-200/90 shadow-2xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Document #, Buyer, or Destination Port..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Document Type Filter */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs shadow-2xs">
            <button
              onClick={() => setSelectedType("all")}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                selectedType === "all" ? "bg-blue-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setSelectedType("proforma_invoice")}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                selectedType === "proforma_invoice" ? "bg-blue-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Invoices (P/I)
            </button>
            <button
              onClick={() => setSelectedType("packing_list")}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                selectedType === "packing_list" ? "bg-blue-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Packing Lists
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 shadow-2xs focus:outline-none focus:border-blue-600"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-6 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
          <p className="text-sm">Loading commercial export documents...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-900">Failed to load documents</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">No commercial documents found</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {documents.length === 0
                ? "You haven't generated any export paperwork yet. Click 'Generate Document' or navigate to your Lead Pipeline to issue your first Proforma Invoice!"
                : "No documents matched your current search or filter criteria. Try clearing filters."}
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={openQuickGenerateModal}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Document</span>
            </button>
            <Link
              href={`/workspace/${workspaceId}/leads`}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition flex items-center gap-1.5"
            >
              <Briefcase className="w-3.5 h-3.5 text-blue-600" />
              <span>Go to Lead Pipeline</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((doc) => {
            const isPI = doc.document_type === "proforma_invoice";
            const docValue = (doc.line_items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            const buyerName = doc.buyer_details?.company_name || "Overseas Buyer";
            const buyerCountry = doc.buyer_details?.country || "International";

            return (
              <div
                key={doc.id}
                className="bg-white border border-slate-200/90 hover:border-blue-400 hover:shadow-xs rounded-xl p-5 shadow-2xs transition flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          isPI
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : "bg-amber-50 border border-amber-200 text-amber-700"
                        }`}
                      >
                        {isPI ? <FileText className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-mono text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">
                          {doc.document_number}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                          {isPI ? "Proforma Invoice" : "Packing List"}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        doc.status === "paid"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : doc.status === "issued"
                          ? "bg-blue-50 border-blue-200 text-blue-800"
                          : "bg-slate-100 border-slate-200 text-slate-700"
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>

                  {/* Buyer & Route */}
                  <div className="space-y-2 py-3 border-y border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" /> Buyer:
                      </span>
                      <span className="font-semibold text-slate-900 truncate max-w-[180px] text-right">
                        {buyerName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Ship className="w-3.5 h-3.5 text-slate-400" /> Route & Port:
                      </span>
                      <span className="font-medium text-slate-700 truncate max-w-[180px] text-right text-[11px]">
                        {doc.port_of_discharge || buyerCountry}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-slate-400" /> Incoterm:
                      </span>
                      <span className="font-bold text-blue-700 font-mono">
                        {doc.incoterm || "CIF"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-500">Total Valuation:</span>
                      <span className="font-bold text-slate-900 font-mono text-sm">
                        ${docValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                        <span className="text-xs text-slate-500 font-normal">{doc.currency || "USD"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-4 mt-2 flex items-center justify-between gap-2">
                  <a
                    href={api.getDocumentPdfUrl(workspaceId, doc.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>PDF</span>
                  </a>

                  <Link
                    href={`/workspace/${workspaceId}/documents/${doc.id}`}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition flex items-center justify-center gap-1.5"
                  >
                    <span>Open Studio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Generate Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Generate Commercial Document</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a pipeline lead to auto-populate shipping codes, container TEUs, and bank wire terms.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Document Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Document Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewDocType("proforma_invoice")}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                    newDocType === "proforma_invoice"
                      ? "border-blue-600 bg-blue-50/80 text-blue-950 ring-1 ring-blue-500/30"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5 text-slate-900">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Proforma Invoice (P/I)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 leading-tight">
                    Official quote with payment wire terms & Incoterms
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewDocType("packing_list")}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                    newDocType === "packing_list"
                      ? "border-blue-600 bg-blue-50/80 text-blue-950 ring-1 ring-blue-500/30"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5 text-slate-900">
                    <Package className="w-3.5 h-3.5 text-amber-600" />
                    <span>Packing List (CPL)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 leading-tight">
                    Net/Gross weights, CBM volumes & container TEU
                  </span>
                </button>
              </div>
            </div>

            {/* Leads Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Choose Target Pipeline Lead</label>
              {loadingLeads ? (
                <div className="py-8 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-xs">Loading active pipeline leads...</span>
                </div>
              ) : leads.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    No active pipeline leads found. Documents must be attached to an overseas buyer lead.
                  </p>
                  <Link
                    href={`/workspace/${workspaceId}/companies`}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-semibold"
                  >
                    <span>Add verified buyers from Directory</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 flex items-center justify-between gap-3 transition"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {lead.company_name}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono font-semibold text-slate-700">
                            {lead.country_code}
                          </span>
                          <span className="capitalize">{lead.stage} Stage</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleGenerateFromLead(lead.id)}
                        disabled={generatingLeadId === lead.id}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                      >
                        {generatingLeadId === lead.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <span>Generate</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
