"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import {
  Briefcase,
  ArrowLeft,
  Clock,
  MessageSquare,
  Calendar,
  Send,
  Copy,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; leadId: string }>;
}) {
  const { workspaceId, leadId } = use(params);

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);

  // Form states
  const [selectedEventType, setSelectedEventType] = useState("contact_attempt");
  const [eventNotes, setEventNotes] = useState("");
  const [loggingEvent, setLoggingEvent] = useState(false);

  // Draft form
  const [draftChannel, setDraftChannel] = useState<"email" | "linkedin" | "proposal">("email");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);

  // AI Generator states
  const [pitchNotes, setPitchNotes] = useState("");
  const [generatingPitch, setGeneratingPitch] = useState(false);
  const [lastModelUsed, setLastModelUsed] = useState<string | null>(null);
  const [pitchSuccessMsg, setPitchSuccessMsg] = useState<string | null>(null);

  // Stage change
  const [changingStage, setChangingStage] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  useEffect(() => {
    loadLead();
  }, [workspaceId, leadId]);

  async function loadLead() {
    try {
      setLoading(true);
      // Attempt to load full lead detail directly
      let target: any = null;
      let compRes: any = null;

      try {
        const leadRes = await api.getLead(workspaceId, leadId);
        target = leadRes;
        compRes = leadRes.company;
      } catch {
        const leadsRes = await api.listLeads(workspaceId);
        target = (leadsRes.items || []).find((l: any) => l.id === leadId);
        if (target) {
          compRes = await api.getCompany(workspaceId, target.company_id).catch(() => null);
        }
      }

      if (target) {
        setLead(target);
        setCompany(compRes);

        const [eventsRes, draftsRes] = await Promise.all([
          api.listLeadEvents(workspaceId, leadId).catch(() => ({ items: [] })),
          api.listDrafts(workspaceId, leadId).catch(() => ({ items: [] })),
        ]);
        setEvents(eventsRes.items || []);
        setDrafts(draftsRes.items || []);

        if (compRes && !draftSubject) {
          setDraftSubject(`Partnership Inquiry: Certified Indian Exports for ${compRes.name}`);
          setDraftBody(
            `Dear Procurement Director,\n\nWe would like to introduce our certified export manufacturing operations. Given your recent trade activity in ${compRes.country_code}, we believe our high-grade materials and ISO-certified capacity match your supply requirements.\n\nBest regards,\nExport Team`
          );
        }
      }
    } catch (err) {
      console.error("Failed to load lead:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGeneratePitch() {
    setGeneratingPitch(true);
    setPitchSuccessMsg(null);
    try {
      const generated = await api.generatePitch(workspaceId, leadId, {
        channel: draftChannel,
        custom_notes: pitchNotes || undefined,
      });

      setDraftSubject(generated.subject);
      setDraftBody(generated.body);
      setLastModelUsed(generated.model_used || "foretrade-commercial-engine");
      setPitchSuccessMsg(
        generated.model_used === "gemini-2.0-flash"
          ? "AI Pitch Synthesized via Gemini 2.0 Flash!"
          : "Tailored Pitch Synthesized via ForeTrade Commercial Rules Engine!"
      );

      // Append to drafts list
      setDrafts((prev) => [generated, ...prev]);

      // Refresh events
      const ev = await api.listLeadEvents(workspaceId, leadId);
      setEvents(ev.items || []);

      setTimeout(() => setPitchSuccessMsg(null), 5000);
    } catch (err) {
      console.error("Pitch generation failed:", err);
      alert("Failed to generate outreach pitch. Please try again.");
    } finally {
      setGeneratingPitch(false);
    }
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    setLoggingEvent(true);
    try {
      const newEvent = await api.addLeadEvent(workspaceId, leadId, selectedEventType, {
        notes: eventNotes || undefined,
      });
      setEvents((prev) => [newEvent, ...prev]);
      setEventNotes("");
    } catch (err) {
      alert("Failed to record event.");
    } finally {
      setLoggingEvent(false);
    }
  }

  async function handleSaveDraft(e: React.FormEvent) {
    e.preventDefault();
    setSavingDraft(true);
    try {
      const newDraft = await api.createDraft(workspaceId, leadId, {
        channel: draftChannel,
        subject: draftSubject,
        body: draftBody,
      });
      setDrafts((prev) => [newDraft, ...prev]);
    } catch (err) {
      alert("Failed to save draft.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleStageChange(targetStage: string) {
    setStageError(null);
    setChangingStage(true);
    try {
      const updated = await api.changeLeadStage(workspaceId, leadId, targetStage);
      setLead((prev: any) => ({ ...prev, stage: updated.stage }));
      // Reload events to show stage_changed event
      const ev = await api.listLeadEvents(workspaceId, leadId);
      setEvents(ev.items || []);
    } catch (err) {
      if (err instanceof ApiError && err.message === "required_event_missing") {
        setStageError(
          targetStage === "replied"
            ? "Record a reply received event first."
            : `Transition to ${targetStage} requires a corresponding event recorded on the timeline.`
        );
      } else {
        setStageError("Failed to update stage.");
      }
    } finally {
      setChangingStage(false);
    }
  }

  function handleCopyDraft(draftId: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedDraftId(draftId);
    setTimeout(() => setCopiedDraftId(null), 3000);
  }

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-sm">Loading deal timeline...</span>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-slate-500">Lead not found.</p>
        <Link href={`/workspace/${workspaceId}/leads`} className="text-blue-600 text-sm mt-2 block">
          ← Return to Pipeline
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Back button */}
      <div>
        <Link
          href={`/workspace/${workspaceId}/leads`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Lead Pipeline</span>
        </Link>
      </div>

      {/* Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {company?.name || "Target Exporter"}
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 uppercase">
              Stage: {lead.stage}
            </span>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-3">
            <span>Country: <strong>{company?.country_code}</strong></span>
            <span>•</span>
            <span>Sector: <strong>{company?.product_or_industry}</strong></span>
            {company?.contact_name && (
              <>
                <span>•</span>
                <span>Contact: <strong>{company.contact_name}</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Stage Changer */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Advance Stage:</span>
            <select
              value={lead.stage}
              onChange={(e) => handleStageChange(e.target.value)}
              disabled={changingStage}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="new">New</option>
              <option value="qualified">Qualified</option>
              <option value="contacted">Contacted</option>
              <option value="replied">Replied</option>
              <option value="meeting">Meeting</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          {stageError && (
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
              {stageError}
            </span>
          )}
        </div>
      </div>

      {/* Verified Customs & Buyer Intelligence Banner */}
      {company?.attributes && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-sm border border-slate-800">
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                Customs Bill of Lading Verified
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {company.attributes.customs_provenance || "Verified Customs Manifest Flow"}
              </span>
            </div>
            {lead.score && (
              <span className="text-xs font-semibold text-amber-300">
                Fit Score: {lead.score.score?.toFixed(1)}% ({lead.score.tier})
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold mb-0.5">
                Annual Procurement
              </span>
              <span className="text-base font-bold text-white">
                {company.attributes.annual_import_volume_usd
                  ? `$${(company.attributes.annual_import_volume_usd / 1_000_000).toFixed(1)}M USD`
                  : "Multi-container"}
              </span>
            </div>

            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold mb-0.5">
                Typical Order Size
              </span>
              <span className="text-base font-bold text-white">
                {company.attributes.avg_order_tons ? `${company.attributes.avg_order_tons} Tons` : "Batch"}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  ({company.attributes.preferred_incoterms || "CIF"})
                </span>
              </span>
            </div>

            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold mb-0.5">
                Incoterms & Routing
              </span>
              <span className="text-base font-bold text-white">
                {company.attributes.preferred_incoterms || "CIF"} terms
              </span>
            </div>

            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold mb-0.5">
                Mandatory Standards
              </span>
              <span className="text-xs font-semibold text-emerald-300 truncate block">
                {Array.isArray(company.attributes.required_certifications)
                  ? company.attributes.required_certifications.join(", ")
                  : "ISO 9001"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Section: Timeline (Left) & Outreach Drafts (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Timeline & Event Logger */}
        <div className="space-y-6">
          {/* Add Activity Form */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Record Timeline Activity
            </h2>

            <form onSubmit={handleAddEvent} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Interaction Event Type
                </label>
                <select
                  value={selectedEventType}
                  onChange={(e) => setSelectedEventType(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="contact_attempt">Contact Attempt (Email / Phone)</option>
                  <option value="reply_received">Reply Received (Buyer Responded)</option>
                  <option value="meeting">Meeting Scheduled / Completed</option>
                  <option value="note">Internal Strategy Note</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Activity Notes
                </label>
                <textarea
                  rows={2}
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="Details of the interaction..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={loggingEvent}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                {loggingEvent ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Log Activity to Timeline</span>
                )}
              </button>
            </form>
          </div>

          {/* Timeline Events List */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Interaction Timeline
            </h2>

            <div className="space-y-3">
              {events.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No activity events recorded yet.
                </div>
              ) : (
                events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-start gap-3"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-900 capitalize">
                          {ev.event_type.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {ev.occurred_at ? new Date(ev.occurred_at).toLocaleString() : ""}
                        </span>
                      </div>
                      {ev.payload?.notes && (
                        <p className="text-xs text-slate-600">{ev.payload.notes}</p>
                      )}
                      {ev.payload?.stage && (
                        <p className="text-xs text-blue-600 font-medium">Stage shifted to: {ev.payload.stage}</p>
                      )}
                      {ev.payload?.channel && (
                        <p className="text-xs text-indigo-600 font-medium">
                          Outreach pitch generated for: {ev.payload.channel} ({ev.payload.model_used || "AI Commercial Engine"})
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Outreach Assistant & AI Generator (Right) */}
        <div className="space-y-6">
          {/* AI Tailored Pitch Generator Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 border border-blue-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    AI Export Pitch Generator
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Synthesizes customs volumes, Incoterms & bilateral FTA tariff arbitrage.
                  </p>
                </div>
              </div>

              {lastModelUsed && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  {lastModelUsed}
                </span>
              )}
            </div>

            {/* Channel Selection Tabs */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Outreach Format / Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDraftChannel("email")}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                    draftChannel === "email"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  ✉️ B2B Email
                </button>
                <button
                  type="button"
                  onClick={() => setDraftChannel("linkedin")}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                    draftChannel === "linkedin"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  💼 LinkedIn
                </button>
                <button
                  type="button"
                  onClick={() => setDraftChannel("proposal")}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                    draftChannel === "proposal"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  📄 Formal Brief
                </button>
              </div>
            </div>

            {/* Custom Notes / Angle */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Custom Angle / Exporter Focus (Optional)
              </label>
              <input
                type="text"
                value={pitchNotes}
                onChange={(e) => setPitchNotes(e.target.value)}
                placeholder="e.g. Highlight ISO 9001 cert, 15-day sea transit from Mundra Port"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {/* One-Click Generate Button */}
            <button
              type="button"
              onClick={handleGeneratePitch}
              disabled={generatingPitch}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {generatingPitch ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Customs Data & FTA Savings...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Tailored Pitch for {company?.name || "Buyer"}</span>
                </>
              )}
            </button>

            {pitchSuccessMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{pitchSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Edit & Save Draft Form */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Active Pitch Draft & Fine-Tuning
            </h2>
            <p className="text-xs text-slate-500">
              Review and customize before exporting. ForeTrade keeps all outreach truthful (exporting copies to clipboard, does not auto-send).
            </p>

            <form onSubmit={handleSaveDraft} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  required
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Proposal Body
                </label>
                <textarea
                  rows={8}
                  required
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-[11px] leading-relaxed"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={savingDraft}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                {savingDraft ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Save Outreach Draft</span>
                )}
              </button>
            </form>
          </div>

          {/* Saved Drafts */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Saved Drafts ({drafts.length})
            </h2>

            <div className="space-y-3">
              {drafts.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No drafts saved for this deal. Click "Generate Tailored Pitch" above!
                </div>
              ) : (
                drafts.map((d) => {
                  const isCopied = copiedDraftId === d.id;

                  return (
                    <div
                      key={d.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 shrink-0">
                            {d.channel || "email"}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {d.subject || "No Subject"}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 shrink-0">
                          {d.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 font-mono text-[11px] whitespace-pre-wrap bg-white p-2.5 rounded border border-slate-200 max-h-48 overflow-y-auto">
                        {d.body}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-400">
                          {isCopied ? (
                            <span className="text-emerald-600 font-semibold">
                              Draft exported to clipboard.
                            </span>
                          ) : (
                            "Copy to send via your corporate mail client or CRM."
                          )}
                        </span>

                        <button
                          onClick={() => handleCopyDraft(d.id, `${d.subject}\n\n${d.body}`)}
                          className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          {isCopied ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Export Draft</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
