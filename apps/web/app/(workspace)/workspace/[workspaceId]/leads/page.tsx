"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import {
  Briefcase,
  Plus,
  ArrowRight,
  AlertCircle,
  Loader2,
  MessageSquare,
} from "lucide-react";

export default function LeadsBoardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Record<string, any>>({});
  const [advancingLeadId, setAdvancingLeadId] = useState<string | null>(null);
  const [gateError, setGateError] = useState<{ leadId: string; message: string; requiredEvent?: string } | null>(null);

  const STAGES = [
    { key: "new", label: "New Leads", color: "text-slate-700 bg-slate-200/70 border-slate-300/80" },
    { key: "qualified", label: "Qualified", color: "text-blue-700 bg-blue-100/80 border-blue-200" },
    { key: "contacted", label: "Contacted", color: "text-indigo-700 bg-indigo-100/80 border-indigo-200" },
    { key: "replied", label: "Replied", color: "text-amber-800 bg-amber-100/80 border-amber-200" },
    { key: "meeting", label: "Meeting Scheduled", color: "text-emerald-800 bg-emerald-100/80 border-emerald-200" },
    { key: "won", label: "Won Deals", color: "text-teal-800 bg-teal-100/80 border-teal-200" },
  ];

  useEffect(() => {
    loadBoard();
  }, [workspaceId]);

  async function loadBoard() {
    try {
      setLoading(true);
      const [leadsRes, compRes] = await Promise.all([
        api.listLeads(workspaceId),
        api.listCompanies(workspaceId).catch(() => ({ items: [] })),
      ]);
      setLeads(leadsRes.items || []);

      const compMap: Record<string, any> = {};
      (compRes.items || []).forEach((c: any) => {
        compMap[c.id] = c;
      });
      setCompanies(compMap);
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdvanceStage(leadId: string, currentStage: string) {
    setGateError(null);
    const order = ["new", "qualified", "contacted", "replied", "meeting", "won"];
    const currIndex = order.indexOf(currentStage);
    if (currIndex >= order.length - 1) return;

    const nextStage = order[currIndex + 1];
    setAdvancingLeadId(leadId);

    try {
      await api.changeLeadStage(workspaceId, leadId, nextStage);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: nextStage } : l))
      );
    } catch (err) {
      if (err instanceof ApiError && err.message === "required_event_missing") {
        const required = nextStage === "replied" ? "reply_received" : "meeting";
        setGateError({
          leadId,
          message: `Stage transition to "${nextStage}" requires a verified "${required}" event on the timeline first.`,
          requiredEvent: required,
        });
      } else {
        alert("Failed to advance stage.");
      }
    } finally {
      setAdvancingLeadId(null);
    }
  }

  async function handleRecordRequiredEvent(leadId: string, eventType: string) {
    try {
      await api.addLeadEvent(workspaceId, leadId, eventType, {
        notes: `Recorded via quick-action to satisfy stage gate.`,
      });
      setGateError(null);
      const targetStage = eventType === "reply_received" ? "replied" : "meeting";
      await api.changeLeadStage(workspaceId, leadId, targetStage);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: targetStage } : l))
      );
    } catch (err) {
      alert("Failed to record event.");
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-800">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Export Lead Pipeline
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {leads.length} Leads
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Event-gated B2B deal progression with append-only interaction audit logs and verification gates.
          </p>
        </div>

        <Link
          href={`/workspace/${workspaceId}/companies`}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs hover:shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Lead from Directory</span>
        </Link>
      </div>

      {/* Stage Gate Error Alert */}
      {gateError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-950">Stage Gate Blocked: </span>
              {gateError.message}
            </div>
          </div>
          {gateError.requiredEvent && (
            <button
              onClick={() => handleRecordRequiredEvent(gateError.leadId, gateError.requiredEvent!)}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 transition shadow-2xs"
            >
              Log {gateError.requiredEvent} & Advance
            </button>
          )}
        </div>
      )}

      {/* Kanban Columns */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-sm">Loading deal board...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3.5 items-start">
          {STAGES.map((col) => {
            const colLeads = leads.filter((l) => l.stage === col.key);

            return (
              <div
                key={col.key}
                className="bg-slate-100/80 rounded-xl p-3 border border-slate-200/90 flex flex-col min-h-[460px] shadow-2xs"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 px-1 border-b border-slate-200 mb-3">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] font-mono font-semibold shadow-2xs">
                    {colLeads.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2.5 flex-1">
                  {colLeads.length === 0 ? (
                    <div className="p-6 text-center text-[11px] text-slate-400 font-medium">
                      No deals in stage
                    </div>
                  ) : (
                    colLeads.map((lead) => {
                      const comp = companies[lead.company_id];
                      const isAdvancing = advancingLeadId === lead.id;

                      return (
                        <div
                          key={lead.id}
                          className="p-3.5 bg-white rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-xs transition flex flex-col justify-between shadow-2xs"
                        >
                          <div>
                            <Link
                              href={`/workspace/${workspaceId}/leads/${lead.id}`}
                              className="font-semibold text-xs text-slate-900 hover:text-blue-600 block line-clamp-1 transition"
                            >
                              {comp?.name || "Target Exporter"}
                            </Link>

                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 mt-1">
                              <span className="font-semibold text-slate-700 bg-slate-100 px-1 py-0.5 rounded">{comp?.country_code || "EX"}</span>
                              <span className="text-slate-300">•</span>
                              <span className="truncate">{comp?.product_or_industry || "General Cargo"}</span>
                            </div>

                            {lead.notes && (
                              <p className="text-[11px] text-slate-600 mt-2 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100 leading-relaxed">
                                {lead.notes}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/workspace/${workspaceId}/leads/${lead.id}`}
                                className="text-[11px] text-slate-500 hover:text-blue-600 font-medium transition"
                              >
                                Details
                              </Link>
                              <Link
                                href={`/workspace/${workspaceId}/leads/${lead.id}`}
                                className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition border border-indigo-200/60"
                              >
                                <MessageSquare className="w-2.5 h-2.5 text-indigo-600" />
                                <span>Deal Room</span>
                              </Link>
                            </div>

                            {col.key !== "won" && (
                              <button
                                onClick={() => handleAdvanceStage(lead.id, lead.stage)}
                                disabled={isAdvancing}
                                title="Advance to next verified stage"
                                className="p-1 rounded bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 transition"
                              >
                                {isAdvancing ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <ArrowRight className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
