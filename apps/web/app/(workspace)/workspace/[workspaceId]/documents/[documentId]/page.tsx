"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  Printer,
  Download,
  Save,
  Trash2,
  Plus,
  FileText,
  Ship,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
  Building2,
  Compass,
  Layers,
  Sparkles,
} from "lucide-react";

export default function DocumentStudioPage({
  params,
}: {
  params: Promise<{ workspaceId: string; documentId: string }>;
}) {
  const { workspaceId, documentId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadDocument();
  }, [workspaceId, documentId]);

  async function loadDocument() {
    try {
      setLoading(true);
      const data = await api.getDocument(workspaceId, documentId);
      setDoc(data);
    } catch (err: any) {
      console.error("Failed to load document:", err);
      setErrorMsg(err.message || "Failed to load document");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setSaveSuccess(false);

      // Re-calculate totals before save
      const updatedDoc = recalculateTotals({ ...doc });
      const saved = await api.updateDocument(workspaceId, documentId, updatedDoc);
      setDoc(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert("Failed to save document: " + (err.message || "Error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await api.deleteDocument(workspaceId, documentId);
      if (doc?.lead_id) {
        router.push(`/workspace/${workspaceId}/leads/${doc.lead_id}`);
      } else {
        router.push(`/workspace/${workspaceId}/leads`);
      }
    } catch (err) {
      alert("Failed to delete document.");
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleDownloadPdf() {
    const url = api.getDocumentPdfUrl(workspaceId, documentId);
    window.open(url, "_blank");
  }

  function recalculateTotals(currentDoc: any) {
    const items = currentDoc.line_items || [];
    let netKg = 0;
    let grossKg = 0;
    let cbm = 0;
    let pkgs = 0;

    items.forEach((it: any) => {
      it.total_amount = Number((Number(it.quantity || 0) * Number(it.unit_price || 0)).toFixed(2));
      netKg += Number(it.net_weight_kg || 0);
      grossKg += Number(it.gross_weight_kg || 0);
      cbm += Number(it.cbm || 0);
      pkgs += Number(it.package_count || 0);
    });

    const logistics = { ...(currentDoc.logistics_details || {}) };
    logistics.total_net_weight_kg = Number(netKg.toFixed(1));
    logistics.total_gross_weight_kg = Number(grossKg.toFixed(1));
    logistics.total_cbm = Number(cbm.toFixed(2));
    logistics.total_packages = pkgs;

    // Recalculate container TEU
    const tons = grossKg / 1000.0;
    if (tons <= 22 && cbm <= 28) {
      logistics.container_type = "1 x 20' FCL (Standard Container)";
      logistics.teu_equivalent = 1.0;
    } else if (tons <= 26.5 && cbm <= 68) {
      logistics.container_type = "1 x 40' HC (High Cube Container)";
      logistics.teu_equivalent = 2.0;
    } else {
      const num40 = Math.floor(tons / 25);
      const rem = tons % 25;
      const num20 = rem > 0 ? 1 : 0;
      logistics.container_type = `${num40} x 40' HC${num20 > 0 ? " + 1 x 20' FCL" : ""}`;
      logistics.teu_equivalent = num40 * 2.0 + num20 * 1.0;
    }

    currentDoc.logistics_details = logistics;
    return currentDoc;
  }

  function updateField(path: string[], value: any) {
    setDoc((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) {
        if (!cur[path[i]]) cur[path[i]] = {};
        cur = cur[path[i]];
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  }

  function updateLineItem(index: number, key: string, value: any) {
    setDoc((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      const items = next.line_items || [];
      if (items[index]) {
        items[index][key] = value;
        if (key === "quantity" || key === "unit_price") {
          const q = Number(key === "quantity" ? value : items[index].quantity || 0);
          const p = Number(key === "unit_price" ? value : items[index].unit_price || 0);
          items[index].total_amount = Number((q * p).toFixed(2));
        }
      }
      return recalculateTotals(next);
    });
  }

  function addLineItem() {
    setDoc((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      const items = next.line_items || [];
      const newItem = {
        item_no: items.length + 1,
        hs_code: "7210.49",
        description: "Standard Export Quality Cargo Item",
        quantity: 10,
        unit: "MT",
        unit_price: 1150,
        total_amount: 11500,
        package_type: "Export Pallets",
        package_count: 20,
        net_weight_kg: 10000,
        gross_weight_kg: 10450,
        cbm: 11.5,
        dimensions: "120cm x 100cm x 95cm",
      };
      items.push(newItem);
      next.line_items = items;
      return recalculateTotals(next);
    });
  }

  function removeLineItem(index: number) {
    setDoc((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      const items = next.line_items || [];
      items.splice(index, 1);
      items.forEach((it: any, i: number) => {
        it.item_no = i + 1;
      });
      next.line_items = items;
      return recalculateTotals(next);
    });
  }

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="text-sm font-medium">Loading export documentation suite...</span>
      </div>
    );
  }

  if (errorMsg || !doc) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <div className="p-4 bg-red-950/40 border border-red-800 text-red-300 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg || "Document not found"}</span>
        </div>
        <Link
          href={`/workspace/${workspaceId}/leads`}
          className="text-xs text-blue-400 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Pipeline
        </Link>
      </div>
    );
  }

  const isPI = doc.document_type === "proforma_invoice";
  const lineItems = doc.line_items || [];
  const subtotal = lineItems.reduce((acc: number, it: any) => acc + (Number(it.total_amount) || 0), 0);
  const totalNet = lineItems.reduce((acc: number, it: any) => acc + (Number(it.net_weight_kg) || 0), 0);
  const totalGross = lineItems.reduce((acc: number, it: any) => acc + (Number(it.gross_weight_kg) || 0), 0);
  const totalPkgs = lineItems.reduce((acc: number, it: any) => acc + (Number(it.package_count) || 0), 0);
  const totalCbm = lineItems.reduce((acc: number, it: any) => acc + (Number(it.cbm) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900 p-6 print:p-0 print:bg-white print:text-black">
      {/* Non-print Top Controls Bar */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href={doc.lead_id ? `/workspace/${workspaceId}/leads/${doc.lead_id}` : `/workspace/${workspaceId}/leads`}
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Back to Deal"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isPI ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}>
                {isPI ? "Proforma Invoice" : "Packing List"}
              </span>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {doc.document_number}
              </h1>
            </div>
            <p className="text-xs text-slate-500">
              Buyer: <strong className="text-slate-800">{doc.buyer_details?.company_name || "Consignee"}</strong> ({doc.buyer_details?.country_code}) • Incoterm: <strong className="text-blue-700">{doc.incoterm}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons & Tabs */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tab Switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "preview" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Official View
            </button>
            <button
              onClick={() => setActiveTab("edit")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "edit" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Document Studio
            </button>
          </div>

          {activeTab === "edit" && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-300 transition-colors cursor-pointer shadow-xs"
            title="Browser Print (Ctrl+P)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print (A4)</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Download Vector PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={handleDelete}
            className="p-2 rounded-xl bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-300 hover:border-red-200 transition-colors cursor-pointer"
            title="Delete Document"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="max-w-6xl mx-auto mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 print:hidden">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Document updated and saved successfully! Ready for commercial issuance.</span>
        </div>
      )}

      {/* ===================== VIEW MODE 1: OFFICIAL A4 PAPER VIEW ===================== */}
      {activeTab === "preview" && (
        <div className="max-w-4xl mx-auto bg-white text-slate-900 border border-slate-200 shadow-2xl p-10 rounded-2xl print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-full">
          {/* Header row */}
          <div className="flex justify-between items-start border-b-2 pb-6 border-slate-900">
            {/* Exporter Block */}
            <div className="space-y-1 max-w-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Exporter / Manufacturer</span>
              <h2 className="text-xl font-black text-slate-950 leading-tight">
                {doc.exporter_details?.company_name || "ForeTrade Global Exports Ltd."}
              </h2>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                {doc.exporter_details?.address || "Export Industrial Park, Navi Mumbai, India"}
              </p>
              <div className="text-[11px] text-slate-600 pt-1 space-y-0.5 font-medium">
                <div>Tax ID / GSTIN: <strong className="text-slate-900">{doc.exporter_details?.tax_id || "27AABCF1234F1Z5"}</strong></div>
                <div>IEC Code: <strong className="text-slate-900">{doc.exporter_details?.iec_code || "0311029481"}</strong></div>
                <div>Email: {doc.exporter_details?.email} | Tel: {doc.exporter_details?.phone}</div>
              </div>
            </div>

            {/* Document Meta Block */}
            <div className="text-right space-y-1">
              <span className={`inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider text-white ${
                isPI ? "bg-blue-800" : "bg-emerald-800"
              }`}>
                {isPI ? "Proforma Invoice" : "Commercial Packing List"}
              </span>
              <div className="text-lg font-bold text-slate-950 pt-1">
                Ref: {doc.document_number}
              </div>
              <div className="text-xs text-slate-600">
                Date: <strong className="text-slate-900">{doc.issue_date}</strong>
              </div>
              <div className="text-xs text-slate-600">
                Validity: <strong className="text-slate-900">{doc.validity_date || "30 Days from Issue"}</strong>
              </div>
              <div className="text-xs text-slate-600">
                Incoterm: <strong className="text-blue-700 font-bold">{doc.incoterm}</strong> ({doc.port_of_discharge})
              </div>
              <div className="text-xs text-slate-600">
                Currency: <strong className="text-slate-900">{doc.currency}</strong> | Status: <strong className="uppercase text-slate-900">{doc.status}</strong>
              </div>
            </div>
          </div>

          {/* Consignee & Routing Section */}
          <div className="grid grid-cols-2 gap-6 my-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            {/* Buyer / Consignee */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Consignee / Foreign Buyer
              </span>
              <div className="text-sm font-bold text-slate-950">
                {doc.buyer_details?.company_name || "Buyer Corporation"}
              </div>
              <p className="text-slate-600 whitespace-pre-line">
                Billing: {doc.buyer_details?.billing_address || "Free Trade Zone, Destination Port"}
              </p>
              <p className="text-slate-600">
                Shipping Hub: {doc.buyer_details?.shipping_address}
              </p>
              <div className="text-slate-600 pt-1">
                Attn: <strong>{doc.buyer_details?.contact_name}</strong> ({doc.buyer_details?.email})
              </div>
              <div className="text-slate-600">Tel: {doc.buyer_details?.phone}</div>
            </div>

            {/* Shipment Routing */}
            <div className="space-y-1.5 border-l border-slate-200 pl-6">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Logistics & Dispatch Routing
              </span>
              <div>
                Port of Loading: <strong className="text-slate-900">{doc.port_of_loading}</strong>
              </div>
              <div>
                Port of Discharge: <strong className="text-slate-900">{doc.port_of_discharge}</strong>
              </div>
              <div>
                Payment Terms: <strong className="text-slate-900">{doc.payment_terms}</strong>
              </div>
              <div className="p-2 rounded bg-white border border-slate-200 mt-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Container Allocation</span>
                <span className="text-xs font-bold text-blue-800">
                  {doc.logistics_details?.container_type || "1 x 20' FCL"}
                </span>
                <span className="text-[11px] text-slate-500 ml-1">
                  ({doc.logistics_details?.teu_equivalent || 1.0} TEU)
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="my-6">
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className={`text-white text-[11px] uppercase tracking-wider ${isPI ? "bg-slate-900" : "bg-emerald-950"}`}>
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">HS Code</th>
                  <th className="p-2.5">Description of Merchandise</th>
                  <th className="p-2.5 text-right">Quantity</th>
                  {isPI ? (
                    <>
                      <th className="p-2.5 text-right">Unit Price ({doc.currency})</th>
                      <th className="p-2.5 text-right">Total ({doc.currency})</th>
                    </>
                  ) : (
                    <>
                      <th className="p-2.5 text-right">Packages</th>
                      <th className="p-2.5 text-right">Net Wt (Kg)</th>
                      <th className="p-2.5 text-right">Gross Wt (Kg)</th>
                      <th className="p-2.5 text-right">CBM</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lineItems.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-2.5 font-bold text-slate-500">{item.item_no || idx + 1}</td>
                    <td className="p-2.5 font-mono font-semibold text-slate-800">{item.hs_code}</td>
                    <td className="p-2.5 font-medium text-slate-900 max-w-xs">
                      <div>{item.description}</div>
                      {!isPI && item.dimensions && (
                        <div className="text-[10px] text-slate-500">
                          Package: {item.package_type} • Dim: {item.dimensions}
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-medium text-slate-900">
                      {Number(item.quantity).toLocaleString()} {item.unit}
                    </td>
                    {isPI ? (
                      <>
                        <td className="p-2.5 text-right font-medium text-slate-700">
                          {Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-950">
                          {Number(item.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-2.5 text-right font-medium text-slate-700">
                          {item.package_count} pkgs
                        </td>
                        <td className="p-2.5 text-right font-medium text-slate-700">
                          {Number(item.net_weight_kg).toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-950">
                          {Number(item.gross_weight_kg).toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right font-medium text-slate-700">
                          {Number(item.cbm).toFixed(2)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                {isPI ? (
                  <tr>
                    <td colSpan={3} className="p-3 uppercase text-slate-700 text-xs tracking-wider">
                      Total Commercial Value ({doc.incoterm} terms)
                    </td>
                    <td className="p-3 text-right">
                      {lineItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0).toLocaleString()} MT
                    </td>
                    <td className="p-3 text-right text-slate-500">—</td>
                    <td className="p-3 text-right text-sm text-blue-900 font-black">
                      {doc.currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={3} className="p-3 uppercase text-slate-700 text-xs tracking-wider">
                      Total Logistics Weight & Volume
                    </td>
                    <td className="p-3 text-right text-slate-500">—</td>
                    <td className="p-3 text-right">{totalPkgs} pkgs</td>
                    <td className="p-3 text-right">{totalNet.toLocaleString()} kg</td>
                    <td className="p-3 text-right text-emerald-950 font-black">{totalGross.toLocaleString()} kg</td>
                    <td className="p-3 text-right">{totalCbm.toFixed(2)} m³</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* Bank Coordinates (for PI) or Shipping Marks (for Packing List) */}
          {isPI && doc.bank_details && (
            <div className="my-6 p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-xs space-y-2">
              <div className="flex items-center gap-2 text-blue-900 font-bold uppercase tracking-wider text-[11px]">
                <CreditCard className="w-3.5 h-3.5 text-blue-700" />
                <span>Beneficiary Bank Remittance Coordinates (Wire Transfer / SWIFT)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-slate-700 pt-1">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Beneficiary Name</span>
                  <span className="font-bold text-slate-900">{doc.bank_details.beneficiary_name}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Bank Name</span>
                  <span className="font-bold text-slate-900">{doc.bank_details.bank_name}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Account Number</span>
                  <span className="font-mono font-bold text-slate-900">{doc.bank_details.account_number}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">SWIFT / BIC Code</span>
                  <span className="font-mono font-bold text-blue-800">{doc.bank_details.swift_code}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">IBAN / IFSC</span>
                  <span className="font-mono font-bold text-slate-900">{doc.bank_details.iban || doc.bank_details.ifsc_code}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Branch Location</span>
                  <span className="text-slate-700">{doc.bank_details.branch}</span>
                </div>
              </div>
            </div>
          )}

          {/* Shipping Marks block for Packing List */}
          {!isPI && (
            <div className="my-6 p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-950 font-bold uppercase tracking-wider text-[11px]">
                <Ship className="w-3.5 h-3.5 text-emerald-700" />
                <span>Cargo Shipping Marks & Container Load Manifest</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-slate-700 pt-1">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Shipping Marks</span>
                  <span className="font-mono font-bold text-slate-900">{doc.logistics_details?.shipping_marks || "N/M"}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Container Allocation</span>
                  <span className="font-bold text-slate-900">
                    {doc.logistics_details?.container_type} ({doc.logistics_details?.teu_equivalent} TEU)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes & Authorized Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200 text-xs items-start">
            <div className="col-span-2 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Statutory Export Declarations & Terms
              </span>
              <p className="text-slate-600 whitespace-pre-line text-[11px] leading-relaxed">
                {doc.notes ||
                  "We hereby certify that this invoice is true and correct and the goods are of declared origin under WTO standards."}
              </p>
            </div>

            <div className="space-y-8 text-right">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">For Exporter</span>
                <span className="font-bold text-slate-900 text-xs">
                  {doc.exporter_details?.company_name || "ForeTrade Global"}
                </span>
              </div>
              <div className="border-t border-slate-400 pt-1 inline-block w-48 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Authorized Signatory & Stamp</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== VIEW MODE 2: INTERACTIVE DOCUMENT STUDIO (EDITOR) ===================== */}
      {activeTab === "edit" && (
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                Commercial Value
              </span>
              <span className="text-xl font-bold text-slate-900">
                {doc.currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-blue-700 font-semibold block mt-0.5">{doc.incoterm} terms</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                Gross Freight Weight
              </span>
              <span className="text-xl font-bold text-slate-900">
                {totalGross.toLocaleString()} kg
              </span>
              <span className="text-xs text-emerald-700 font-semibold block mt-0.5">{totalNet.toLocaleString()} kg Net</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                TEU Allocation
              </span>
              <span className="text-lg font-bold text-slate-900 truncate block">
                {doc.logistics_details?.container_type || "1 x 20' FCL"}
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">{totalCbm.toFixed(1)} m³ total CBM</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                Status & Number
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={doc.status}
                  onChange={(e) => updateField(["status"], e.target.value)}
                  className="bg-slate-50 text-slate-800 text-xs font-bold px-2.5 py-1 rounded border border-slate-300"
                >
                  <option value="draft">Draft</option>
                  <option value="issued">Issued</option>
                  <option value="accepted">Accepted</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <span className="text-[11px] text-slate-500 font-mono block mt-1">{doc.document_number}</span>
            </div>
          </div>

          {/* Form Section 1: Header & Commercial Terms */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-600" />
              <span>Commercial Terms, Currency & Incoterms</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Document Type</label>
                <select
                  value={doc.document_type}
                  onChange={(e) => updateField(["document_type"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="proforma_invoice">Proforma Invoice (P/I)</option>
                  <option value="packing_list">Commercial Packing List (CPL)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Currency</label>
                <select
                  value={doc.currency}
                  onChange={(e) => updateField(["currency"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="USD">USD ($ - US Dollar)</option>
                  <option value="EUR">EUR (€ - Euro)</option>
                  <option value="AED">AED (د.إ - UAE Dirham)</option>
                  <option value="GBP">GBP (£ - British Pound)</option>
                  <option value="INR">INR (₹ - Indian Rupee)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Incoterm (ICC 2020)</label>
                <select
                  value={doc.incoterm}
                  onChange={(e) => updateField(["incoterm"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                  <option value="FOB">FOB (Free On Board)</option>
                  <option value="CFR">CFR (Cost & Freight)</option>
                  <option value="EXW">EXW (Ex Works)</option>
                  <option value="DDP">DDP (Delivered Duty Paid)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Document Issue Date</label>
                <input
                  type="date"
                  value={doc.issue_date || ""}
                  onChange={(e) => updateField(["issue_date"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Port of Loading (Origin)</label>
                <input
                  type="text"
                  value={doc.port_of_loading || ""}
                  onChange={(e) => updateField(["port_of_loading"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Port of Discharge (Destination)</label>
                <input
                  type="text"
                  value={doc.port_of_discharge || ""}
                  onChange={(e) => updateField(["port_of_discharge"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-slate-600 block mb-1 font-semibold">Payment Terms</label>
                <input
                  type="text"
                  value={doc.payment_terms || ""}
                  onChange={(e) => updateField(["payment_terms"], e.target.value)}
                  placeholder="e.g. 30% Advance T/T, 70% against B/L copy"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Form Section 2: Consignee & Exporter Coordinates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Exporter Block */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 text-xs">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Exporter Entity (Seller)</span>
              </h2>

              <div>
                <label className="text-slate-600 block mb-1">Company Name</label>
                <input
                  type="text"
                  value={doc.exporter_details?.company_name || ""}
                  onChange={(e) => updateField(["exporter_details", "company_name"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Address</label>
                <textarea
                  rows={2}
                  value={doc.exporter_details?.address || ""}
                  onChange={(e) => updateField(["exporter_details", "address"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1">Tax ID / GSTIN</label>
                  <input
                    type="text"
                    value={doc.exporter_details?.tax_id || ""}
                    onChange={(e) => updateField(["exporter_details", "tax_id"], e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">IEC Code</label>
                  <input
                    type="text"
                    value={doc.exporter_details?.iec_code || ""}
                    onChange={(e) => updateField(["exporter_details", "iec_code"], e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Buyer Block */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 text-xs">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Consignee Details (Buyer)</span>
              </h2>

              <div>
                <label className="text-slate-600 block mb-1">Buyer Company</label>
                <input
                  type="text"
                  value={doc.buyer_details?.company_name || ""}
                  onChange={(e) => updateField(["buyer_details", "company_name"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Billing & Shipping Address</label>
                <textarea
                  rows={2}
                  value={doc.buyer_details?.billing_address || ""}
                  onChange={(e) => updateField(["buyer_details", "billing_address"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1">Attn Contact</label>
                  <input
                    type="text"
                    value={doc.buyer_details?.contact_name || ""}
                    onChange={(e) => updateField(["buyer_details", "contact_name"], e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">Buyer Email</label>
                  <input
                    type="text"
                    value={doc.buyer_details?.email || ""}
                    onChange={(e) => updateField(["buyer_details", "email"], e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form Section 3: Line Items Editor */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Merchandise Line Items & Freight Manifest ({lineItems.length})</span>
              </h2>
              <button
                type="button"
                onClick={addLineItem}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-700 text-xs">Item #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeLineItem(idx)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                      title="Remove Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">HS Code</label>
                      <input
                        type="text"
                        value={item.hs_code || ""}
                        onChange={(e) => updateLineItem(idx, "hs_code", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-mono focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="text-slate-600 block mb-1 font-medium">Cargo Description</label>
                      <input
                        type="text"
                        value={item.description || ""}
                        onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">Qty</label>
                      <input
                        type="number"
                        value={item.quantity || 0}
                        onChange={(e) => updateLineItem(idx, "quantity", Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-bold focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">Unit</label>
                      <input
                        type="text"
                        value={item.unit || "MT"}
                        onChange={(e) => updateLineItem(idx, "unit", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Commercial & Logistics sub-row */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="text-slate-600 block mb-1">Unit Price ({doc.currency})</label>
                      <input
                        type="number"
                        value={item.unit_price || 0}
                        onChange={(e) => updateLineItem(idx, "unit_price", Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1">Item Total ({doc.currency})</label>
                      <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 font-bold text-slate-900 text-xs">
                        {Number(item.total_amount || 0).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1">Packages</label>
                      <input
                        type="number"
                        value={item.package_count || 0}
                        onChange={(e) => updateLineItem(idx, "package_count", Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1">Net Wt (Kg)</label>
                      <input
                        type="number"
                        value={item.net_weight_kg || 0}
                        onChange={(e) => updateLineItem(idx, "net_weight_kg", Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1">Gross Wt (Kg)</label>
                      <input
                        type="number"
                        value={item.gross_weight_kg || 0}
                        onChange={(e) => updateLineItem(idx, "gross_weight_kg", Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1">CBM (m³)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.cbm || 0}
                        onChange={(e) => updateLineItem(idx, "cbm", Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Section 4: Bank Remittance Coordinates */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Remittance Bank Account & SWIFT Routing</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-slate-600 block mb-1">Beneficiary Account Name</label>
                <input
                  type="text"
                  value={doc.bank_details?.beneficiary_name || ""}
                  onChange={(e) => updateField(["bank_details", "beneficiary_name"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={doc.bank_details?.bank_name || ""}
                  onChange={(e) => updateField(["bank_details", "bank_name"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Account Number</label>
                <input
                  type="text"
                  value={doc.bank_details?.account_number || ""}
                  onChange={(e) => updateField(["bank_details", "account_number"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">SWIFT / BIC Code</label>
                <input
                  type="text"
                  value={doc.bank_details?.swift_code || ""}
                  onChange={(e) => updateField(["bank_details", "swift_code"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">IBAN / IFSC Code</label>
                <input
                  type="text"
                  value={doc.bank_details?.iban || doc.bank_details?.ifsc_code || ""}
                  onChange={(e) => updateField(["bank_details", "iban"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Branch Name</label>
                <input
                  type="text"
                  value={doc.bank_details?.branch || ""}
                  onChange={(e) => updateField(["bank_details", "branch"], e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Form Section 5: Statutory Declarations & Notes */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 text-xs">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Statutory Notes & Legal Terms
            </h2>
            <textarea
              rows={4}
              value={doc.notes || ""}
              onChange={(e) => updateField(["notes"], e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 font-mono text-xs leading-relaxed focus:bg-white focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Bottom Save Action */}
          <div className="flex justify-end gap-3 pb-8">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Document Changes</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
