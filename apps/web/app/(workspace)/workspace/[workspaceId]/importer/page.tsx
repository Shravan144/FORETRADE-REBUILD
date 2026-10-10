"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ImporterProfile, SourcingRfq, InboundProposal } from "@/lib/api";
import {
  PackageCheck,
  ShieldCheck,
  FileText,
  Mail,
  Plus,
  ArrowRight,
  TrendingUp,
  Ship,
  Sparkles,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Anchor,
  Globe2,
} from "lucide-react";

export default function ImporterDashboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ImporterProfile | null>(null);
  const [rfqs, setRfqs] = useState<SourcingRfq[]>([]);
  const [proposals, setProposals] = useState<InboundProposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [profRes, rfqsRes, propRes] = await Promise.allSettled([
          api.getImporterProfile(workspaceId),
          api.listRfqs(workspaceId),
          api.listInboundProposals(workspaceId),
        ]);

        if (profRes.status === "fulfilled") {
          setProfile(profRes.value);
        }
        if (rfqsRes.status === "fulfilled") {
          setRfqs(rfqsRes.value.items || []);
        }
        if (propRes.status === "fulfilled") {
          setProposals(propRes.value.items || []);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load procurement desk data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [workspaceId]);

  const activeRfqsCount = rfqs.filter((r) => r.status === "ACTIVE").length;
  const pendingProposalsCount = proposals.filter((p) => p.status === "pending").length;
  const acceptedProposalsCount = proposals.filter((p) => p.status === "accepted").length;

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-500 min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="text-sm font-medium">Loading Procurement Command Center...</span>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header & Bilateral Announcement */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              Global Procurement Desk
            </span>
            <span className="text-xs text-slate-400 font-medium">Bilateral Trade Terminal</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {profile?.company_name || "Importer Procurement Hub"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage international purchase tenders, inspect factory proposals, and orchestrate direct Indian factory supply.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/workspace/${workspaceId}/importer/rfqs`}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Publish Sourcing RFQ</span>
          </Link>
          <Link
            href={`/workspace/${workspaceId}/importer/profile`}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>{profile ? "Edit Compliance Profile" : "Register Tax & Port ID"}</span>
          </Link>
        </div>
      </div>

      {/* Profile Onboarding Callout if incomplete */}
      {!profile && (
        <div className="p-6 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Complete your Statutory Importer Credentials</span>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Register your corporate tax credentials (US EIN, EU/UK EORI, UAE TRN, AU ABN), target UN/LOCODE discharge ports, and container sizing to enable verified matchmaking and receive factory proposals.
            </p>
          </div>
          <Link
            href={`/workspace/${workspaceId}/importer/profile`}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition shrink-0 flex items-center gap-1.5 self-start md:self-auto"
          >
            <span>Complete Profile (3 Mins)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active RFQs */}
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Tenders</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{activeRfqsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 font-bold">{rfqs.length} total</span>
            <span>published tenders</span>
          </div>
        </div>

        {/* Inbound Factory Proposals */}
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Factory Quotes</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{proposals.length}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-indigo-600 font-bold">{pendingProposalsCount} awaiting review</span>
          </div>
        </div>

        {/* Accepted Quotes */}
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Accepted Deals</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">{acceptedProposalsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Ready for Proforma & LC Issuance</div>
        </div>

        {/* Sourcing Budget Allocation */}
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Annual Sourcing</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ${((profile?.annual_sourcing_budget_usd || 0) / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            Discharge: <span className="font-mono font-bold text-slate-700">{profile?.primary_discharge_port || "USLAX"}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Live RFQs and Inbound Proposals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Sourcing RFQs */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Active Procurement Tenders (RFQs)</h2>
            </div>
            <Link
              href={`/workspace/${workspaceId}/importer/rfqs`}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {rfqs.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
                <PackageCheck className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-700">No procurement tenders published yet</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Publish your product requirements, target budget, and delivery ports to broadcast instantly across Indian suppliers.
              </p>
              <Link
                href={`/workspace/${workspaceId}/importer/rfqs`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Tender</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {rfqs.slice(0, 4).map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold">
                        HS {r.hs_code}
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 truncate">{r.title}</h3>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{r.commodity_description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                      <span>
                        Target: <strong>{r.target_quantity} {r.quantity_unit}</strong>
                      </span>
                      <span>•</span>
                      <span>Port: <strong>{r.destination_port || "Discharge"}</strong></span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inbound Factory Proposals */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Recent Factory Proposals & Quotes</h2>
            </div>
            <Link
              href={`/workspace/${workspaceId}/importer/inbox`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>Open Inbox</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {proposals.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-700">Inbox empty</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                When Indian exporters generate commercial pitches and Proforma Invoices for your company, they will appear here with full duty savings and readiness scores.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.slice(0, 4).map((p) => {
                const statusColors: Record<string, string> = {
                  pending: "bg-amber-50 text-amber-700 border-amber-200",
                  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
                  sample_requested: "bg-blue-50 text-blue-700 border-blue-200",
                  declined: "bg-rose-50 text-rose-700 border-rose-200",
                };

                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[10px] font-bold text-slate-800">
                          🇮🇳 {p.exporter_country_code}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900 truncate">
                          {p.exporter_company_name}
                        </h3>
                        {p.exporter_readiness_score && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {p.exporter_readiness_score}% Ready
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium truncate">{p.subject}</p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                        {p.offered_unit_price_usd && (
                          <span>Quote: <strong>${p.offered_unit_price_usd}/MT</strong></span>
                        )}
                        {p.offered_incoterm && (
                          <span>• Terms: <strong>{p.offered_incoterm}</strong></span>
                        )}
                        {p.duty_savings_usd ? (
                          <span className="text-emerald-600 font-bold">
                            Save ${p.duty_savings_usd.toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[p.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                        {p.status.replace("_", " ")}
                      </span>
                      <Link
                        href={`/workspace/${workspaceId}/importer/inbox`}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Inspect →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Compliance & Verified Credentials Banner */}
      {profile && (
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Verified ForeTrade Direct Importer</span>
                <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {profile.tax_identifier_type}: {profile.tax_identifier_value}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Primary Discharge: <strong>{profile.primary_discharge_port}</strong> • Container: <strong>{profile.preferred_container_type.toUpperCase()}</strong> • Bank: <strong>{profile.issuing_bank_name || "Tier-1 International"}</strong> ({profile.issuing_bank_swift || "SWIFT"})
              </p>
            </div>
          </div>

          <Link
            href={`/workspace/${workspaceId}/importer/profile`}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-2xs transition shrink-0"
          >
            Update Credentials
          </Link>
        </div>
      )}
    </div>
  );
}
