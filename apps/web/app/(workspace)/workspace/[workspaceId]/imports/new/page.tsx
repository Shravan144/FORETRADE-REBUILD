"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Database,
} from "lucide-react";

export default function ImportWizardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();

  // Wizard Steps: 1: Upload, 2: Mapping, 3: Validation Preview, 4: Finished
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  // Mapping state
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Preview state
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewSummary, setPreviewSummary] = useState<{ total: number; valid: number; invalid: number }>({
    total: 0,
    valid: 0,
    invalid: 0,
  });
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<any>(null);

  const CANONICAL_TARGETS = [
    { key: "company_name", label: "Company Name (Required)", required: true },
    { key: "country_code", label: "Destination Country Code", required: false },
    { key: "product_or_industry", label: "Product / Industry Category", required: false },
    { key: "website", label: "Corporate Website URL", required: false },
    { key: "contact_email", label: "Contact / Procurement Email", required: false },
    { key: "contact_phone", label: "Contact Phone", required: false },
  ];

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      const res = await api.uploadImport(workspaceId, file);
      setJobId(res.id);

      // Fetch preview to obtain column headers
      const preview = await api.getImportPreview(res.id);
      setSourceColumns(preview.columns || []);
      setPreviewRows(preview.rows || []);

      // Auto-detect mappings
      const autoMap: Record<string, string> = {};
      (preview.columns || []).forEach((col) => {
        const lower = col.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (lower.includes("company") || lower.includes("name") || lower.includes("buyer")) {
          autoMap[col] = "company_name";
        } else if (lower.includes("country")) {
          autoMap[col] = "country_code";
        } else if (lower.includes("product") || lower.includes("industry") || lower.includes("hs")) {
          autoMap[col] = "product_or_industry";
        } else if (lower.includes("web") || lower.includes("site") || lower.includes("url")) {
          autoMap[col] = "website";
        } else if (lower.includes("email") || lower.includes("mail")) {
          autoMap[col] = "contact_email";
        } else if (lower.includes("phone") || lower.includes("tel")) {
          autoMap[col] = "contact_phone";
        }
      });
      setMapping(autoMap);
      setStep(2);
    } catch (err: any) {
      alert(err.message || "Upload failed. Please ensure file is valid CSV or XLSX.");
    } finally {
      setUploading(false);
    }
  }

  function handleProceedToPreview() {
    const hasCompanyName = Object.values(mapping).includes("company_name");
    if (!hasCompanyName) {
      alert("Please map at least one column to 'Company Name'.");
      return;
    }

    const total = previewRows.length;
    let invalid = 0;
    previewRows.forEach((r) => {
      if (r.issues && r.issues.length > 0) invalid++;
    });

    setPreviewSummary({
      total,
      valid: total - invalid,
      invalid,
    });
    setStep(3);
  }

  async function handleCommit() {
    if (!jobId) return;
    setCommitting(true);
    try {
      const res = await api.commitImport(jobId, mapping);
      setCommitResult(res.summary);
      setStep(4);
    } catch (err: any) {
      alert(err.message || "Failed to commit import.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              4-Step Data Ingestion Wizard
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Step {step} of 4
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Ingest buyer directories with formula injection protection, canonical mapping, and deduplication.
          </p>
        </div>

        <Link
          href={`/workspace/${workspaceId}/companies`}
          className="text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          Cancel & Exit
        </Link>
      </div>

      {/* Stepper Wizard Bar */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
        {[
          { num: 1, label: "Upload File" },
          { num: 2, label: "Column Mapping" },
          { num: 3, label: "Integrity Review" },
          { num: 4, label: "Commit & Ingest" },
        ].map((s) => (
          <div
            key={s.num}
            className={`py-2 px-3 rounded-lg border transition-all ${
              step === s.num
                ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                : step > s.num
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-white/[0.02] text-slate-500 border-white/[0.06]"
            }`}
          >
            <span>{s.num}. {s.label}</span>
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="p-8 rounded-xl bg-[#111827] border border-white/[0.08] space-y-6">
          <div className="text-center max-w-md mx-auto space-y-2">
            <div className="inline-flex p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-white">
              Upload Buyer Directory (CSV or XLSX)
            </h2>
            <p className="text-xs text-slate-400">
              Upload up to 25MB. ForeTrade automatically scans rows for formula injection
              (cells starting with <code className="bg-white/[0.08] px-1 py-0.5 rounded text-white">=</code>) to prevent spreadsheet security vulnerabilities.
            </p>
          </div>

          <form onSubmit={handleUpload} className="max-w-md mx-auto space-y-4">
            <div className="border-2 border-dashed border-white/[0.12] rounded-xl p-8 text-center hover:border-blue-500 transition-colors bg-[#0B0F19]">
              <input
                type="file"
                id="file-upload"
                accept=".csv, .xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <FileSpreadsheet className="w-8 h-8 text-slate-500" />
                <span className="text-sm font-semibold text-blue-400 hover:underline">
                  {file ? file.name : "Choose CSV or XLSX file"}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : "Drag and drop or browse"}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Staging File & Scanning...</span>
                </>
              ) : (
                <>
                  <span>Upload & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === 2 && (
        <div className="p-8 rounded-xl bg-[#111827] border border-white/[0.08] space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white">
              Map File Columns to Canonical Fields
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Match the detected columns from your file with ForeTrade trade intelligence fields.
            </p>
          </div>

          <div className="space-y-3">
            {sourceColumns.map((sourceCol) => (
              <div
                key={sourceCol}
                className="p-3 rounded-lg border border-white/[0.08] bg-[#0B0F19] flex items-center justify-between gap-4"
              >
                <div className="text-xs font-semibold text-slate-200 min-w-48 truncate">
                  {sourceCol}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                <select
                  value={mapping[sourceCol] || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMapping((prev) => ({ ...prev, [sourceCol]: val }));
                  }}
                  className="flex-1 text-xs font-medium px-3 py-2 rounded-lg border border-white/[0.12] bg-[#111827] text-white focus:border-blue-500 outline-none"
                >
                  <option value="" className="bg-[#111827]">-- Ignore this column --</option>
                  {CANONICAL_TARGETS.map((target) => (
                    <option key={target.key} value={target.key} className="bg-[#111827]">
                      {target.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {!Object.values(mapping).includes("company_name") && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Company name is required. Map at least one source column to Company Name.</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-lg border border-white/[0.1] text-xs font-semibold text-slate-300 hover:bg-white/[0.05] transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              onClick={handleProceedToPreview}
              disabled={!Object.values(mapping).includes("company_name")}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>Review Row Validation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Integrity Review */}
      {step === 3 && (
        <div className="p-8 rounded-xl bg-[#111827] border border-white/[0.08] space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white">
              Data Validation & Integrity Inspection
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Reviewing the first 50 rows staged for ingestion. Formula injection checks are enforced.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 font-mono">
            <div className="p-4 rounded-xl border border-white/[0.08] bg-[#0B0F19]">
              <div className="text-[10px] text-slate-400 font-sans uppercase">Total Rows Scanned</div>
              <div className="text-2xl font-bold text-white mt-1">{previewSummary.total}</div>
            </div>
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-[10px] text-emerald-400 font-sans uppercase">Valid Rows</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{previewSummary.valid}</div>
            </div>
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div className="text-[10px] text-amber-400 font-sans uppercase">Issues Detected</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">{previewSummary.invalid}</div>
            </div>
          </div>

          {/* Sample Table Preview */}
          <div className="border border-white/[0.08] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#0B0F19] font-semibold text-slate-300 border-b border-white/[0.08]">
                <tr>
                  <th className="px-4 py-2 font-mono">Row #</th>
                  <th className="px-4 py-2">Company Name</th>
                  <th className="px-4 py-2">Issues / Security Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {previewRows.slice(0, 10).map((r) => (
                  <tr key={r.row_number} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2 text-slate-500 font-mono">{r.row_number}</td>
                    <td className="px-4 py-2 font-medium text-white">
                      {r.data?.company_name || Object.values(r.data || {})[0] || "—"}
                    </td>
                    <td className="px-4 py-2">
                      {r.issues && r.issues.length > 0 ? (
                        <span className="text-amber-400 font-medium">{r.issues.join(", ")}</span>
                      ) : (
                        <span className="text-emerald-400 font-medium">✓ Clean</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-lg border border-white/[0.1] text-xs font-semibold text-slate-300 hover:bg-white/[0.05] transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Mapping</span>
            </button>

            <button
              onClick={handleCommit}
              disabled={committing}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {committing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deduplicating & Ingesting...</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  <span>Commit Import to Workspace</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Finished */}
      {step === 4 && (
        <div className="p-8 rounded-xl bg-[#111827] border border-white/[0.08] text-center space-y-6">
          <div className="inline-flex p-4 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">
              Import Completed Successfully!
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Your buyer records have been deduplicated, scored, and mapped with source-row provenance.
            </p>
          </div>

          <div className="max-w-md mx-auto grid grid-cols-3 gap-3 p-4 rounded-xl bg-[#0B0F19] border border-white/[0.08] font-mono">
            <div>
              <div className="text-[10px] text-slate-400 font-sans uppercase">Created</div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">{commitResult?.created || 0}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-sans uppercase">Updated</div>
              <div className="text-xl font-bold text-blue-400 mt-0.5">{commitResult?.updated || 0}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-sans uppercase">Invalid</div>
              <div className="text-xl font-bold text-slate-500 mt-0.5">{commitResult?.invalid || 0}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              href={`/workspace/${workspaceId}/companies`}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <span>View Imported Companies</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
