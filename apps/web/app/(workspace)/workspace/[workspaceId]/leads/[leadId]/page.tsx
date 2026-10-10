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
  Printer,
  Download,
  ExternalLink,
  Ship,
  Mail,
  Phone,
  UserCheck,
  Users,
  Calculator,
  DollarSign,
  Percent,
  ShieldCheck,
  Truck,
  Anchor,
  X,
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
  const [documents, setDocuments] = useState<any[]>([]);
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);
  const [docSuccessMsg, setDocSuccessMsg] = useState<string | null>(null);

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
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<"all" | "outreach" | "stage">("all");

  // AI Generator states
  const [pitchNotes, setPitchNotes] = useState("");
  const [pitchAngle, setPitchAngle] = useState<"cost_duty" | "reliability_compliance" | "speed_trial">("cost_duty");
  const [generatingPitch, setGeneratingPitch] = useState(false);
  const [lastModelUsed, setLastModelUsed] = useState<string | null>(null);
  const [pitchSuccessMsg, setPitchSuccessMsg] = useState<string | null>(null);

  // Decision-Maker Contacts
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Stage change
  const [changingStage, setChangingStage] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  // Commercial Quotation & IncoTerms Deal Calculator Modal States
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteIncoterm, setQuoteIncoterm] = useState<"EXW" | "FOB" | "CFR" | "CIF" | "DDP">("CIF");
  const [quoteBaseFactoryCost, setQuoteBaseFactoryCost] = useState<number>(950.0);
  const [quoteTargetMarginPct, setQuoteTargetMarginPct] = useState<number>(18.0);
  const [quoteQuantity, setQuoteQuantity] = useState<number>(25.0);
  const [quoteUnit, setQuoteUnit] = useState<string>("Metric Tons (MT)");
  const [quoteContainerType, setQuoteContainerType] = useState<"20ft" | "40ft_hc">("40ft_hc");
  const [quotePaymentTerms, setQuotePaymentTerms] = useState<string>("30% Advance T/T, 70% against B/L Copy & Inspection Certificate");
  const [quoteProductDesc, setQuoteProductDesc] = useState<string>("");
  const [quoteDestPort, setQuoteDestPort] = useState<string>("");

  // Bilateral Negotiation Deal Room
  const [proposal, setProposal] = useState<any>(null);
  const [negotiationMessages, setNegotiationMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

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

        const [eventsRes, draftsRes, docsRes, contactsRes, propRes] = await Promise.all([
          api.listLeadEvents(workspaceId, leadId).catch(() => ({ items: [] })),
          api.listDrafts(workspaceId, leadId).catch(() => ({ items: [] })),
          api.listLeadDocuments(workspaceId, leadId).catch(() => ({ items: [] })),
          compRes ? api.getCompanyContacts(workspaceId, compRes.id).catch(() => ({ contacts: [] })) : Promise.resolve({ contacts: [] }),
          api.getLeadProposal(workspaceId, leadId).catch(() => null),
        ]);
        setEvents(eventsRes.items || []);
        setDrafts(draftsRes.items || []);
        setDocuments(docsRes.items || []);
        setProposal(propRes);
        if (propRes) {
          const msgsRes = await api.getNegotiationMessages(workspaceId, propRes.id).catch(() => ({ items: [] }));
          setNegotiationMessages(msgsRes.items || []);
        }

        const loadedContacts = contactsRes.contacts || [];
        setContacts(loadedContacts);
        if (loadedContacts.length > 0) {
          const primary = loadedContacts.find((c: any) => c.is_primary) || loadedContacts[0];
          setSelectedContact(primary);
        }

        if (compRes) {
          const defaultDesc = compRes.product_or_industry || "Cold-Rolled Galvanized Industrial Steel Coils (Grade EN 10346)";
          setQuoteProductDesc(defaultDesc);
          const defaultTons = Number(compRes.attributes?.avg_order_tons) || 25.0;
          setQuoteQuantity(defaultTons);
          setQuoteContainerType(defaultTons <= 22 ? "20ft" : "40ft_hc");
          const defaultPort = compRes.attributes?.preferred_destination_port ||
            (compRes.country_code === "GB" ? "Port of Felixstowe / Southampton, UK" :
             compRes.country_code === "US" ? "Port of Los Angeles / Long Beach, CA, USA" :
             compRes.country_code === "DE" ? "Port of Hamburg, Germany" :
             compRes.country_code === "NL" ? "Port of Rotterdam, Netherlands" :
             compRes.country_code === "AE" ? "Port of Jebel Ali, Dubai, UAE" :
             `Main Seaport, ${compRes.country_code}`);
          setQuoteDestPort(defaultPort);
          if (compRes.attributes?.preferred_incoterms) {
            setQuoteIncoterm(compRes.attributes.preferred_incoterms);
          }
        }

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

  async function handleSendDealRoomMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || !proposal) return;
    try {
      setSendingReply(true);
      const msg = await api.sendNegotiationMessage(workspaceId, proposal.id, {
        message_text: replyText.trim(),
        message_type: "text",
      });
      setNegotiationMessages((prev) => [...prev, msg]);
      setReplyText("");
    } catch (err: any) {
      alert("Failed to send message: " + (err.message || "Error"));
    } finally {
      setSendingReply(false);
    }
  }

  async function handleGenerateDoc(docType: "proforma_invoice" | "packing_list", customOptions?: any) {
    try {
      setGeneratingDoc(docType);
      setDocSuccessMsg(null);
      const options = {
        buyer_contact_name: selectedContact ? `${selectedContact.full_name}${selectedContact.job_title ? ` (${selectedContact.job_title})` : ""}` : undefined,
        buyer_contact_email: selectedContact?.email || undefined,
        buyer_contact_phone: selectedContact?.phone_number || undefined,
        buyer_contact_title: selectedContact?.job_title || undefined,
        ...(customOptions || {}),
      };
      const newDoc = await api.generateLeadDocument(workspaceId, leadId, docType, options);
      setDocuments((prev) => [newDoc, ...prev]);

      // Refresh events timeline
      const ev = await api.listLeadEvents(workspaceId, leadId).catch(() => ({ items: [] }));
      setEvents(ev.items || []);

      const label = docType === "proforma_invoice" ? "Proforma Invoice" : "Packing List";
      setDocSuccessMsg(`Successfully generated official ${label} ${newDoc.document_number}!`);
      setTimeout(() => setDocSuccessMsg(null), 5000);
      return newDoc;
    } catch (err: any) {
      console.error("Document generation failed:", err);
      alert("Failed to generate document: " + (err.message || "Error"));
    } finally {
      setGeneratingDoc(null);
    }
  }

  async function handleIssueCalculatedProforma() {
    // Determine the calculated unit price according to selected Incoterm
    const oceanFreight = quoteContainerType === "20ft" ? 1900 : 2800;
    const inlandTrucking = 350;
    const terminalHandling = 180;
    const insurance = Math.round(quoteBaseFactoryCost * quoteQuantity * 0.0035);

    let unitAddon = 0;
    if (quoteIncoterm === "FOB") {
      unitAddon = (inlandTrucking + terminalHandling) / quoteQuantity;
    } else if (quoteIncoterm === "CFR") {
      unitAddon = (inlandTrucking + terminalHandling + oceanFreight) / quoteQuantity;
    } else if (quoteIncoterm === "CIF") {
      unitAddon = (inlandTrucking + terminalHandling + oceanFreight + insurance) / quoteQuantity;
    } else if (quoteIncoterm === "DDP") {
      unitAddon = (inlandTrucking + terminalHandling + oceanFreight + insurance + 850) / quoteQuantity;
    }

    const priceWithMargin = (quoteBaseFactoryCost * (1 + quoteTargetMarginPct / 100)) + unitAddon;
    const finalUnitPrice = Math.round(priceWithMargin * 100) / 100;

    await handleGenerateDoc("proforma_invoice", {
      incoterm: quoteIncoterm,
      unit_price: finalUnitPrice,
      quantity: quoteQuantity,
      unit: quoteUnit,
      product_description: quoteProductDesc,
      container_type: quoteContainerType,
      destination_port: quoteDestPort,
      payment_terms: quotePaymentTerms,
      buyer_contact_name: selectedContact ? `${selectedContact.full_name}${selectedContact.job_title ? ` (${selectedContact.job_title})` : ""}` : undefined,
      buyer_contact_email: selectedContact?.email || undefined,
      buyer_contact_phone: selectedContact?.phone_number || undefined,
      buyer_contact_title: selectedContact?.job_title || undefined,
      notes: `1. Commercial Terms: ${quoteIncoterm} ${quoteDestPort}.\n2. Payment: ${quotePaymentTerms}.\n3. Target Lead Time: 14–21 business days post L/C confirmation.\n4. Quality Standard: ISO 9001:2015 with Certified Mill Test Report.`
    });

    setQuoteModalOpen(false);
  }

  async function handleGeneratePitch() {
    setGeneratingPitch(true);
    setPitchSuccessMsg(null);
    try {
      const generated = await api.generatePitch(workspaceId, leadId, {
        channel: draftChannel,
        pitch_angle: pitchAngle,
        recipient_name: selectedContact?.full_name || undefined,
        recipient_title: selectedContact?.job_title || undefined,
        recipient_email: selectedContact?.email || undefined,
        custom_notes: pitchNotes || undefined,
      });

      setDraftSubject(generated.subject);
      setDraftBody(generated.body);
      setLastModelUsed(generated.model_used || "foretrade-commercial-engine");
      const angleLabel =
        pitchAngle === "cost_duty"
          ? "Cost & Duty Arbitrage"
          : pitchAngle === "reliability_compliance"
          ? "Quality & Compliance"
          : "Expedited Trial Order";
      setPitchSuccessMsg(
        `Personalized pitch generated for ${selectedContact?.first_name || "Decision-Maker"} (${angleLabel})!`
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

      // Reload proposal in case it was linked or updated
      const propRes = await api.getLeadProposal(workspaceId, leadId).catch(() => null);
      if (propRes) {
        setProposal(propRes);
        const msgsRes = await api.getNegotiationMessages(workspaceId, propRes.id).catch(() => ({ items: [] }));
        setNegotiationMessages(msgsRes.items || []);
      }
    } catch (err) {
      alert("Failed to save draft.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSendDirectProposal() {
    if (!draftSubject.trim() || !draftBody.trim()) {
      alert("Please ensure both subject line and proposal body are filled before sending.");
      return;
    }
    setSavingDraft(true);
    try {
      const newDraft = await api.createDraft(workspaceId, leadId, {
        channel: draftChannel,
        subject: draftSubject,
        body: draftBody,
      });
      setDrafts((prev) => [newDraft, ...prev]);

      const propRes = await api.getLeadProposal(workspaceId, leadId).catch(() => null);
      if (propRes) {
        setProposal(propRes);
        // Also post opening message into the deal room
        await api.sendNegotiationMessage(workspaceId, propRes.id, {
          message_text: `Official Outreach Proposal dispatched:\n\n${draftBody}`,
          message_type: "text",
        }).catch(() => null);

        const msgsRes = await api.getNegotiationMessages(workspaceId, propRes.id).catch(() => ({ items: [] }));
        setNegotiationMessages(msgsRes.items || []);
        alert("Commercial Proposal successfully delivered to the Buyer's Proposal Inbox & Bilateral Deal Room!");
      } else {
        alert("Draft saved to CRM. (Target importer is not yet registered on ForeTrade direct network).");
      }
    } catch (err: any) {
      alert("Failed to send direct proposal: " + (err.message || "Error"));
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

  function handleOpenMailClient() {
    const toEmail = selectedContact?.email || company?.contact_email;
    if (!toEmail) {
      alert("No verified email address on file for this lead.");
      return;
    }
    const mailtoUrl = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(draftSubject)}&body=${encodeURIComponent(draftBody)}`;
    window.open(mailtoUrl, "_blank");
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
        <div className="p-5 rounded-2xl bg-white text-slate-900 shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 uppercase tracking-wider">
                Customs Bill of Lading Verified
              </span>
              <span className="text-xs text-slate-600 font-medium">
                {company.attributes.customs_provenance || "Verified Customs Manifest Flow"}
              </span>
            </div>
            {lead.score && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Fit Score: {lead.score.score?.toFixed(1)}% ({lead.score.tier})
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold mb-1">
                Annual Procurement
              </span>
              <span className="text-base font-bold text-slate-900">
                {company.attributes.annual_import_volume_usd
                  ? `$${(company.attributes.annual_import_volume_usd / 1_000_000).toFixed(1)}M USD`
                  : "Multi-container"}
              </span>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold mb-1">
                Typical Order Size
              </span>
              <span className="text-base font-bold text-slate-900">
                {company.attributes.avg_order_tons ? `${company.attributes.avg_order_tons} Tons` : "Batch"}
                <span className="text-xs font-normal text-slate-500 ml-1">
                  ({company.attributes.preferred_incoterms || "CIF"})
                </span>
              </span>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold mb-1">
                Incoterms & Routing
              </span>
              <span className="text-base font-bold text-slate-900">
                {company.attributes.preferred_incoterms || "CIF"} terms
              </span>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold mb-1">
                Mandatory Standards
              </span>
              <span className="text-xs font-semibold text-emerald-700 truncate block">
                {Array.isArray(company.attributes.required_certifications)
                  ? company.attributes.required_certifications.join(", ")
                  : "ISO 9001"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Export Documentation Suite (Proforma Invoices & Commercial Packing Lists) */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Export Documentation Suite
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                Commercial EXIM Suite
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Synthesizes buyer billing/shipping addresses, Incoterms, container TEU weights, HS classifications, and bank remittance coordinates into official executable paperwork.
            </p>
          </div>

          {/* 1-Click Generation Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQuoteModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Quote & Calculate IncoTerms</span>
            </button>

            <button
              type="button"
              disabled={generatingDoc !== null}
              onClick={() => handleGenerateDoc("proforma_invoice")}
              className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              {generatingDoc === "proforma_invoice" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>Quick Auto-Fill P/I</span>
            </button>

            <button
              type="button"
              disabled={generatingDoc !== null}
              onClick={() => handleGenerateDoc("packing_list")}
              className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              {generatingDoc === "packing_list" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Ship className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>Quick Packing List</span>
            </button>
          </div>
        </div>

        {/* Stage High Priority Banner */}
        {(lead.stage === "meeting" || lead.stage === "won") && (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Deal Status ({lead.stage.toUpperCase()}):</strong> Buyer is in active commercial closure. Issuing official proforma invoice and container packing documentation will enable the buyer to open their Letter of Credit (L/C) or initiate wire transfer.
              </span>
            </div>
          </div>
        )}

        {docSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{docSuccessMsg}</span>
          </div>
        )}

        {/* Document Cards List */}
        {documents.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            <FileText className="w-6 h-6 mx-auto mb-2 text-slate-300" />
            <p className="font-medium text-slate-600">No export documents generated yet for this deal.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Click either button above to auto-synthesize buyer addresses, HS codes, Incoterms, and bank routing.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((d: any) => {
              const isPI = d.document_type === "proforma_invoice";
              const subtotalVal = (d.line_items || []).reduce(
                (acc: number, it: any) => acc + (Number(it.total_amount) || 0),
                0
              );
              const grossWt = (d.line_items || []).reduce(
                (acc: number, it: any) => acc + (Number(it.gross_weight_kg) || 0),
                0
              );

              return (
                <div
                  key={d.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isPI
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {isPI ? "Proforma Invoice" : "Packing List"}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{d.document_number}</span>
                    </div>

                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      {d.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Incoterm & Port</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {d.incoterm} • {d.port_of_discharge || "Discharge Port"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">
                        {isPI ? "Commercial Value" : "Gross Freight Weight"}
                      </span>
                      <span className="font-bold text-slate-900">
                        {isPI
                          ? `${d.currency} ${subtotalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : `${grossWt.toLocaleString()} kg`}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                    <span>Issued: <strong>{d.issue_date || "Today"}</strong></span>
                    <span>TEU: <strong>{d.logistics_details?.container_type || "1 x 20' FCL"}</strong></span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/workspace/${workspaceId}/documents/${d.id}`}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Open in Studio</span>
                    </Link>

                    <a
                      href={api.getDocumentPdfUrl(workspaceId, d.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-blue-600 hover:border-blue-400 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Download Vector PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bilateral Trade Deal Room (Live Buyer Negotiation) */}
      {proposal && (
        <div className="p-6 rounded-2xl bg-white border border-indigo-200/90 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Bilateral Trade Deal Room (Live Buyer Negotiation)
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  proposal.status === "accepted" ? "bg-emerald-100 text-emerald-800" :
                  proposal.status === "sample_requested" ? "bg-blue-100 text-blue-800" :
                  proposal.status === "declined" ? "bg-rose-100 text-rose-800" :
                  "bg-amber-100 text-amber-800"
                }`}>
                  Buyer Status: {proposal.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Direct bilateral communication thread between your export dispatch desk and the overseas importer.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span>Offered: <strong>${proposal.offered_unit_price_usd || "N/A"}/MT ({proposal.offered_incoterm || "CIF"})</strong></span>
              <span>•</span>
              <span className="text-emerald-600 font-bold">Duty Savings: ${proposal.duty_savings_usd?.toLocaleString() || 0}</span>
            </div>
          </div>

          {/* Importer Feedback Note if available */}
          {proposal.importer_feedback_notes && (
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900">
              <span className="font-bold block mb-0.5">Buyer Requirements Note:</span>
              <span>"{proposal.importer_feedback_notes}"</span>
            </div>
          )}

          {/* Deal Room Messages Scroll Area */}
          <div className="h-64 overflow-y-auto space-y-3 p-4 bg-slate-50/70 border border-slate-200 rounded-2xl">
            {negotiationMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-1">
                <MessageSquare className="w-7 h-7 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No negotiation messages yet</p>
                <p className="text-[11px] text-slate-400 max-w-sm">
                  Send a message to the buyer regarding sampling, batch dates, or technical certifications.
                </p>
              </div>
            ) : (
              negotiationMessages.map((m: any) => {
                const isExporter = m.sender_role === "exporter";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isExporter ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                      <span className="font-bold text-slate-700">{m.sender_name}</span>
                      <span>({isExporter ? "You / Exporter" : "Overseas Importer"})</span>
                      <span>•</span>
                      <span>
                        {m.created_at
                          ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "Now"}
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl max-w-md text-xs leading-relaxed shadow-2xs ${
                        isExporter
                          ? "bg-blue-600 text-white rounded-br-xs"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-xs"
                      }`}
                    >
                      {m.message_type === "counter_offer" ? (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">Buyer Counter-Offer</span>
                          <p className="font-mono font-bold">{m.message_text}</p>
                        </div>
                      ) : m.message_type === "sample_request" ? (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">Sample Dispatch Request</span>
                          <p>{m.message_text}</p>
                        </div>
                      ) : (
                        <p>{m.message_text}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Exporter Reply Bar */}
          <form onSubmit={handleSendDealRoomMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Reply to overseas procurement desk (e.g. 'Lab dip dispatched via DHL tracking #994821')..."
              className="flex-1 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={sendingReply || !replyText.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Reply</span>
            </button>
          </form>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Interaction Timeline
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                  {events.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTimelineFilter("all")}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition ${timelineFilter === "all" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineFilter("outreach")}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition ${timelineFilter === "outreach" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}
                >
                  Pitches
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineFilter("stage")}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition ${timelineFilter === "stage" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}
                >
                  Stages
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {(() => {
                const filtered = events.filter((ev) => {
                  if (timelineFilter === "outreach") return ev.event_type.includes("outreach") || ev.payload?.channel;
                  if (timelineFilter === "stage") return ev.event_type.includes("stage");
                  return true;
                });
                if (filtered.length === 0) {
                  return (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No activity events found in this view.
                    </div>
                  );
                }
                return filtered.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-start gap-3"
                  >
                    <div className="p-1 rounded-lg bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-900 capitalize">
                          {ev.event_type.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ev.occurred_at ? new Date(ev.occurred_at).toLocaleDateString() : ""}
                        </span>
                      </div>
                      {ev.payload?.notes && (
                        <p className="text-xs text-slate-600 line-clamp-2">{ev.payload.notes}</p>
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
                ));
              })()}
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

            {/* Strategic Pitch Angle Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Strategic Commercial Focus
                </label>
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                  {pitchAngle === "cost_duty"
                    ? "💰 Tariff & Landed Cost"
                    : pitchAngle === "reliability_compliance"
                    ? "🛡️ Zero-Defect QA & Specs"
                    : "⚡ 1-Container Pilot Trial"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPitchAngle("cost_duty")}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    pitchAngle === "cost_duty"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1">
                    <span>💰</span> Cost & Duty
                  </div>
                  <p className={`text-[10px] mt-0.5 line-clamp-1 ${pitchAngle === "cost_duty" ? "text-blue-100" : "text-slate-400"}`}>
                    FTA savings & CIF price
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPitchAngle("reliability_compliance")}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    pitchAngle === "reliability_compliance"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1">
                    <span>🛡️</span> Compliance
                  </div>
                  <p className={`text-[10px] mt-0.5 line-clamp-1 ${pitchAngle === "reliability_compliance" ? "text-blue-100" : "text-slate-400"}`}>
                    Lab assays & standards
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPitchAngle("speed_trial")}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    pitchAngle === "speed_trial"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1">
                    <span>⚡</span> Trial Order
                  </div>
                  <p className={`text-[10px] mt-0.5 line-clamp-1 ${pitchAngle === "speed_trial" ? "text-blue-100" : "text-slate-400"}`}>
                    1-TEU pilot & CAD terms
                  </p>
                </button>
              </div>
            </div>

            {/* Target Recipient Indicator */}
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider shrink-0">Target:</span>
                <span className="font-bold text-slate-900 truncate">
                  {selectedContact ? selectedContact.full_name : "Procurement Director"}
                </span>
                {selectedContact?.job_title && (
                  <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                    ({selectedContact.job_title})
                  </span>
                )}
              </div>
              {selectedContact?.email ? (
                <span className="text-[10px] font-mono text-emerald-800 font-semibold bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                  {selectedContact.email}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 italic">Generic inquiry</span>
              )}
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
                  <span>
                    Generate {pitchAngle === "cost_duty" ? "Cost & Duty" : pitchAngle === "reliability_compliance" ? "Compliance" : "Trial"} Pitch for {selectedContact ? selectedContact.first_name : company?.name || "Buyer"}
                  </span>
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
              {/* Target Decision-Maker Recipient Panel */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>Target Decision-Maker</span>
                  </div>
                  {contacts.length > 1 && (
                    <select
                      value={selectedContact?.id || ""}
                      onChange={(e) => {
                        const c = contacts.find((item: any) => item.id === e.target.value);
                        if (c) {
                          const prevName = selectedContact?.full_name || selectedContact?.first_name || "Laura Schneider";
                          setSelectedContact(c);
                          // Auto-replace the salutation in the active draft body
                          setDraftBody((prev) => {
                            if (!prev) return prev;
                            const prevRegex = new RegExp(`Dear\\s+${prevName}(\\s*\\([^)]*\\))?`, "i");
                            if (prevRegex.test(prev)) {
                              return prev.replace(prevRegex, `Dear ${c.full_name}${c.job_title ? ` (${c.job_title})` : ""}`);
                            }
                            // Fallback replace any initial "Dear ...," line
                            if (prev.startsWith("Dear ")) {
                              const lines = prev.split("\n");
                              lines[0] = `Dear ${c.full_name}${c.job_title ? ` (${c.job_title})` : ""},`;
                              return lines.join("\n");
                            }
                            return prev;
                          });
                        }
                      }}
                      className="text-[11px] font-medium px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 outline-none"
                    >
                      {contacts.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} ({c.job_title})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedContact ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-1">
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span>{selectedContact.full_name}</span>
                        <span className="text-slate-500 font-normal">({selectedContact.job_title})</span>
                        {selectedContact.is_primary && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-blue-100 text-blue-800">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                        <span className="font-mono text-blue-600 font-medium">{selectedContact.email || "No email"}</span>
                        {selectedContact.phone_number && (
                          <span className="font-mono text-slate-600">{selectedContact.phone_number}</span>
                        )}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 self-start sm:self-auto">
                      {selectedContact.deliverability_score || 96}% Verified
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    Recipient: <strong className="text-slate-700">{company?.contact_name || "Procurement Director"}</strong> ({company?.contact_email || "Direct Inquiry"})
                  </div>
                )}
              </div>

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

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingDraft}
                  className="w-full sm:flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingDraft ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Save CRM Draft</span>
                  )}
                </button>

                <button
                  type="button"
                  disabled={savingDraft}
                  onClick={handleSendDirectProposal}
                  className="w-full sm:flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Deliver this proposal directly into the Importer's Factory Proposal Inbox and Bilateral Deal Room"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send to Buyer Inbox & Deal Room</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenMailClient}
                  className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Open draft directly in default desktop email client (Outlook, Apple Mail, Gmail)"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>External Email</span>
                </button>
              </div>
            </form>
          </div>

          {/* Saved Drafts */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Saved Drafts
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                {drafts.length}
              </span>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {drafts.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No drafts saved for this deal. Click "Generate Tailored Pitch" above!
                </div>
              ) : (
                drafts.map((d) => {
                  const isCopied = copiedDraftId === d.id;
                  const isExpanded = expandedDraftId === d.id;

                  return (
                    <div
                      key={d.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-2.5"
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

                      {/* Accordion or preview */}
                      <div className="relative">
                        <p className={`text-xs text-slate-600 font-mono text-[11px] whitespace-pre-wrap bg-white p-2.5 rounded border border-slate-200 transition-all ${
                          isExpanded ? "max-h-96 overflow-y-auto" : "max-h-24 overflow-hidden"
                        }`}>
                          {d.body}
                        </p>
                        {!isExpanded && d.body?.length > 180 && (
                          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none rounded-b" />
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedDraftId(isExpanded ? null : d.id)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          {isExpanded ? "Collapse Text" : "View Full Pitch"}
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDraftSubject(d.subject || "");
                              setDraftBody(d.body || "");
                              if (d.channel) setDraftChannel(d.channel as any);
                            }}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                          >
                            Load into Editor
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyDraft(d.id, `${d.subject}\n\n${d.body}`)}
                            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1 transition"
                          >
                            {isCopied ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Export</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Commercial Quotation & IncoTerms Deal Calculator Modal */}
      {quoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Commercial IncoTerms & Landed Price Quotation Engine
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live pricing build-up for <strong>{company?.name || "Target Importer"}</strong> ({quoteDestPort})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setQuoteModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 flex-1">
              {/* IncoTerms Selection Waterfall Bar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Target Commercial IncoTerm (Incoterms 2020)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(["EXW", "FOB", "CFR", "CIF", "DDP"] as const).map((inc) => {
                    const isSelected = quoteIncoterm === inc;
                    return (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => setQuoteIncoterm(inc)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-600/30"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="block text-sm font-extrabold">{inc}</span>
                        <span
                          className={`text-[10px] block mt-0.5 line-clamp-1 ${
                            isSelected ? "text-blue-100" : "text-slate-400"
                          }`}
                        >
                          {inc === "EXW" && "Factory Gate"}
                          {inc === "FOB" && "Loaded on Vessel"}
                          {inc === "CFR" && "Sea Freight Paid"}
                          {inc === "CIF" && "Freight + Marine Ins."}
                          {inc === "DDP" && "Landed & Cleared"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Decision-Maker Recipient in Modal */}
              <div className="px-4 py-2.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Attention:</span>
                  <strong className="text-slate-900 font-bold">
                    {selectedContact ? `${selectedContact.full_name} (${selectedContact.job_title})` : (company?.contact_name || "Procurement Director")}
                  </strong>
                </div>
                {selectedContact?.email && (
                  <span className="font-mono text-[11px] text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                    {selectedContact.email}
                  </span>
                )}
              </div>

              {/* Calculator Input Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Base Factory Cost per MT (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      min={10}
                      step={10}
                      value={quoteBaseFactoryCost}
                      onChange={(e) => setQuoteBaseFactoryCost(Number(e.target.value) || 0)}
                      className="w-full text-xs pl-7 pr-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Target Exporter Margin (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={quoteTargetMarginPct}
                      onChange={(e) => setQuoteTargetMarginPct(Number(e.target.value) || 0)}
                      className="w-full text-xs pl-3 pr-7 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Order Quantity ({quoteUnit})
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={quoteQuantity}
                    onChange={(e) => {
                      const q = Number(e.target.value) || 1;
                      setQuoteQuantity(q);
                      setQuoteContainerType(q <= 22 ? "20ft" : "40ft_hc");
                    }}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Merchandise / Cargo Description
                  </label>
                  <input
                    type="text"
                    value={quoteProductDesc}
                    onChange={(e) => setQuoteProductDesc(e.target.value)}
                    placeholder="e.g. 100% Combed Cotton Single Jersey Fabric (180 GSM)"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Container Configuration
                  </label>
                  <select
                    value={quoteContainerType}
                    onChange={(e) => setQuoteContainerType(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="20ft">1 x 20' FCL (Standard Container ~22 MT)</option>
                    <option value="40ft_hc">1 x 40' HC (High Cube Container ~26.5 MT)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Port of Discharge (Destination Seaport)
                  </label>
                  <div className="flex items-center gap-2">
                    <Anchor className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={quoteDestPort}
                      onChange={(e) => setQuoteDestPort(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Commercial Payment Terms
                  </label>
                  <select
                    value={quotePaymentTerms}
                    onChange={(e) => setQuotePaymentTerms(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="30% Advance T/T, 70% against B/L Copy & Inspection Certificate">
                      30% T/T Advance + 70% against B/L copy
                    </option>
                    <option value="100% Confirmed Irrevocable Letter of Credit (L/C at Sight)">
                      100% Confirmed Irrevocable L/C at Sight
                    </option>
                    <option value="Cash Against Documents (CAD) via Prime International Bank">
                      Cash Against Documents (CAD)
                    </option>
                    <option value="20% Advance T/T, 80% Net 30 Days (Credit Insured)">
                      20% Advance, 80% Net 30 Days (Insured)
                    </option>
                  </select>
                </div>
              </div>

              {/* Dynamic Cost Waterfall Calculations */}
              {(() => {
                const totalFactoryCost = quoteBaseFactoryCost * quoteQuantity;
                const marginAmount = totalFactoryCost * (quoteTargetMarginPct / 100);
                const exwTotal = totalFactoryCost + marginAmount;

                const inlandTrucking = 350;
                const originTHC = 180;
                const fobTotal = exwTotal + inlandTrucking + originTHC;

                const oceanFreight = quoteContainerType === "20ft" ? 1900 : 2800;
                const cfrTotal = fobTotal + oceanFreight;

                const marineInsurance = Math.round(exwTotal * 0.0035);
                const cifTotal = cfrTotal + marineInsurance;

                const ddpEstTotal = cifTotal + 850;

                const activeTotal =
                  quoteIncoterm === "EXW"
                    ? exwTotal
                    : quoteIncoterm === "FOB"
                    ? fobTotal
                    : quoteIncoterm === "CFR"
                    ? cfrTotal
                    : quoteIncoterm === "CIF"
                    ? cifTotal
                    : ddpEstTotal;

                const activeUnitPrice = Math.round((activeTotal / quoteQuantity) * 100) / 100;

                return (
                  <div className="space-y-4">
                    {/* Visual Comparison Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div
                        className={`p-3 rounded-xl border ${
                          quoteIncoterm === "EXW"
                            ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-600/20"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                          EXW Factory
                        </span>
                        <span className="text-base font-bold text-slate-900 block mt-0.5">
                          ${(exwTotal / quoteQuantity).toFixed(2)}
                          <span className="text-[10px] text-slate-500 font-normal ml-0.5">/MT</span>
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-1">
                          Total: ${exwTotal.toLocaleString()}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-xl border ${
                          quoteIncoterm === "FOB"
                            ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-600/20"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                          FOB Port of Lading
                        </span>
                        <span className="text-base font-bold text-slate-900 block mt-0.5">
                          ${(fobTotal / quoteQuantity).toFixed(2)}
                          <span className="text-[10px] text-slate-500 font-normal ml-0.5">/MT</span>
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-1">
                          Total: ${fobTotal.toLocaleString()}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-xl border ${
                          quoteIncoterm === "CIF"
                            ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-600/20"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                          CIF Landed (Recommended)
                        </span>
                        <span className="text-base font-bold text-blue-700 block mt-0.5">
                          ${(cifTotal / quoteQuantity).toFixed(2)}
                          <span className="text-[10px] text-slate-500 font-normal ml-0.5">/MT</span>
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-1">
                          Total: ${cifTotal.toLocaleString()}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-xl border ${
                          quoteIncoterm === "DDP"
                            ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-600/20"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">
                          DDP Door Delivery
                        </span>
                        <span className="text-base font-bold text-slate-900 block mt-0.5">
                          ${(ddpEstTotal / quoteQuantity).toFixed(2)}
                          <span className="text-[10px] text-slate-500 font-normal ml-0.5">/MT</span>
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-1">
                          Total: ${ddpEstTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Summary Banner for Selected Incoterm */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500 text-white">
                            Quotation Ready: {quoteIncoterm}
                          </span>
                          <span className="text-xs text-slate-300">
                            {quoteQuantity} MT to {quoteDestPort}
                          </span>
                        </div>
                        <div className="text-xl font-bold mt-1 text-white flex items-baseline gap-2">
                          <span>
                            Total: ${activeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                          </span>
                          <span className="text-xs text-emerald-400 font-medium">
                            (${activeUnitPrice.toFixed(2)} / MT • Margin ${marginAmount.toLocaleString()})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuoteModalOpen(false)}
                          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          disabled={generatingDoc !== null}
                          onClick={handleIssueCalculatedProforma}
                          className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                          {generatingDoc ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                          <span>Issue Official Proforma Invoice</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
