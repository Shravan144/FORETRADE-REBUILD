"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, InboundProposal, NegotiationMessage } from "@/lib/api";
import {
  Mail,
  CheckCircle2,
  XCircle,
  Package,
  FileText,
  Clock,
  Sparkles,
  Ship,
  TrendingDown,
  Building2,
  Loader2,
  ArrowLeft,
  Filter,
  Check,
  X,
  MessageSquare,
  AlertCircle,
  ExternalLink,
  Send,
  DollarSign,
  Tag,
  Paperclip,
} from "lucide-react";

export default function ImporterInboxPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<InboundProposal[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [selectedProposal, setSelectedProposal] = useState<InboundProposal | null>(null);

  // Active view tab in right pane
  const [activeTab, setActiveTab] = useState<"offer" | "deal_room">("offer");

  // Negotiation Deal Room state
  const [messages, setMessages] = useState<NegotiationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Counter offer modal state
  const [showCounterBox, setShowCounterBox] = useState(false);
  const [counterPrice, setCounterPrice] = useState<number>(5800);
  const [counterIncoterm, setCounterIncoterm] = useState("CIF");

  // Response action state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadProposals() {
      try {
        setLoading(true);
        const res = await api.listInboundProposals(workspaceId).catch(() => ({ items: [], total: 0 }));
        setProposals(res.items || []);
        if (res.items?.length > 0 && !selectedProposal) {
          setSelectedProposal(res.items[0]);
        }
      } catch {
        setProposals([]);
      } finally {
        setLoading(false);
      }
    }
    loadProposals();
  }, [workspaceId]);

  // Load negotiation messages and poll live updates when selected proposal changes
  useEffect(() => {
    if (!selectedProposal) return;
    let isMounted = true;

    async function loadThread(isBackground = false) {
      try {
        if (!isBackground) setLoadingMessages(true);
        const res = await api.getNegotiationMessages(workspaceId, selectedProposal!.id).catch(() => ({ items: [], total: 0 }));
        if (isMounted && res.items) {
          setMessages(res.items);
        }
      } catch {
        if (isMounted && !isBackground) {
          setMessages([]);
        }
      } finally {
        if (isMounted && !isBackground) {
          setLoadingMessages(false);
        }
      }
    }

    loadThread();
    const timer = setInterval(() => {
      loadThread(true);
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [workspaceId, selectedProposal?.id]);

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !selectedProposal) return;

    try {
      setSendingMessage(true);
      const newMsg = await api.sendNegotiationMessage(workspaceId, selectedProposal.id, {
        message_text: chatInput.trim(),
        message_type: "text",
      });
      setMessages((prev) => [...prev, newMsg]);
      setChatInput("");
    } catch (err: any) {
      alert("Failed to send message: " + (err.message || "Error"));
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleSendCounterOffer() {
    if (!selectedProposal) return;
    try {
      setSendingMessage(true);
      const text = `Commercial Counter-Offer: $${counterPrice}/MT (${counterIncoterm} ${selectedProposal.exporter_origin_port || "Discharge Port"}). Awaiting revised commercial proforma.`;
      const newMsg = await api.sendNegotiationMessage(workspaceId, selectedProposal.id, {
        message_text: text,
        message_type: "counter_offer",
        payload: {
          counter_unit_price_usd: counterPrice,
          incoterm: counterIncoterm,
        },
      });
      setMessages((prev) => [...prev, newMsg]);
      setSelectedProposal({
        ...selectedProposal,
        offered_unit_price_usd: counterPrice,
        offered_incoterm: counterIncoterm,
      });
      setShowCounterBox(false);
      setActionSuccessMsg("Counter-offer transmitted to factory!");
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      alert("Failed to send counter-offer: " + (err.message || "Error"));
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleRespond(proposalId: string, status: "accepted" | "sample_requested" | "declined") {
    try {
      setActionLoadingId(proposalId);
      const updated = await api.respondToProposal(workspaceId, proposalId, {
        status,
        feedback_notes: feedbackNotes.trim() || undefined,
      });

      setProposals((prev) => prev.map((p) => (p.id === proposalId ? updated : p)));
      setSelectedProposal(updated);
      setFeedbackNotes("");

      // Also append an event into the deal room messages
      const statusLabels: Record<string, string> = {
        accepted: "Proposal accepted! Factory notified to issue final Commercial Proforma Invoice.",
        sample_requested: "Physical pre-shipment sample requested.",
        declined: "Proposal declined.",
      };

      try {
        const autoMsg = await api.sendNegotiationMessage(workspaceId, proposalId, {
          message_text: `Status Update: ${statusLabels[status]}${feedbackNotes ? ` Note: "${feedbackNotes}"` : ""}`,
          message_type: status === "sample_requested" ? "sample_request" : "text",
        });
        setMessages((prev) => [...prev, autoMsg]);
      } catch {
        // silent
      }

      setActionSuccessMsg(statusLabels[status]);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      alert("Failed to respond to proposal: " + (err.message || "Error"));
    } finally {
      setActionLoadingId(null);
    }
  }

  const filteredProposals = proposals.filter((p) => {
    if (filterStatus === "ALL") return true;
    return p.status === filterStatus.toLowerCase();
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Accepted</span>;
      case "sample_requested":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">Sample Requested</span>;
      case "declined":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">Declined</span>;
      case "reviewed":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">Reviewed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">Pending Review</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
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
                Direct Inbound Proposals & Deal Room
              </span>
              <span className="text-xs text-slate-400 font-medium">Bilateral Factory Quotes</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Factory Proposals & Quotes Inbox
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-semibold">Filter:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-hidden"
          >
            <option value="ALL">All Proposals ({proposals.length})</option>
            <option value="PENDING">Pending Review</option>
            <option value="SAMPLE_REQUESTED">Sample Requested</option>
            <option value="ACCEPTED">Accepted Deals</option>
            <option value="DECLINED">Declined</option>
          </select>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2.5 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="p-20 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Loading inbound factory proposals...</span>
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="p-20 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">No factory proposals in inbox</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Commercial offers generated by Indian exporters through ForeTrade Pitch Studio or RFQ tender responses will arrive here automatically.
          </p>
        </div>
      ) : (
        /* Split-Pane Inbox */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Proposals List */}
          <div className="lg:col-span-5 space-y-3">
            {filteredProposals.map((prop) => {
              const isSelected = selectedProposal?.id === prop.id;
              return (
                <div
                  key={prop.id}
                  onClick={() => {
                    setSelectedProposal(prop);
                    setActiveTab("offer");
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? "bg-white border-indigo-500 ring-2 ring-indigo-100 shadow-xs"
                      : "bg-white border-slate-200/90 hover:border-indigo-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          🇮🇳 {prop.exporter_origin_port || "INNSA"}
                        </span>
                        <h2 className="text-xs font-bold text-slate-900 truncate">
                          {prop.exporter_company_name}
                        </h2>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium truncate">{prop.subject}</p>
                    </div>

                    {statusBadge(prop.status)}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono pt-1 text-slate-500 border-t border-slate-100">
                    <div>
                      {prop.offered_unit_price_usd ? (
                        <span className="font-bold text-indigo-700">
                          ${prop.offered_unit_price_usd}/MT ({prop.offered_incoterm || "CIF"})
                        </span>
                      ) : (
                        <span>Custom Proposal</span>
                      )}
                    </div>
                    {prop.duty_savings_usd ? (
                      <span className="text-emerald-600 font-bold">
                        Save ${prop.duty_savings_usd.toLocaleString()}
                      </span>
                    ) : (
                      <span>Transit: {prop.estimated_transit_days || 18}d</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Selected Proposal Detail & Bilateral Deal Room */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            {selectedProposal ? (
              <>
                {/* Detail Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                        Origin: {selectedProposal.exporter_origin_port || "Port of Nhava Sheva (INNSA)"}
                      </span>
                      {selectedProposal.exporter_readiness_score && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {selectedProposal.exporter_readiness_score}% Factory Readiness
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-black text-slate-900">
                      {selectedProposal.exporter_company_name}
                    </h2>
                    <p className="text-xs font-semibold text-slate-600">{selectedProposal.subject}</p>
                  </div>

                  {statusBadge(selectedProposal.status)}
                </div>

                {/* Tab Switcher: Commercial Offer vs. Deal Room Chat */}
                <div className="flex border-b border-slate-100 gap-4">
                  <button
                    onClick={() => setActiveTab("offer")}
                    className={`pb-2.5 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 ${
                      activeTab === "offer"
                        ? "border-indigo-600 text-indigo-700"
                        : "border-transparent text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Commercial Offer & Specs</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("deal_room")}
                    className={`pb-2.5 text-xs font-bold transition flex items-center gap-2 cursor-pointer border-b-2 ${
                      activeTab === "deal_room"
                        ? "border-indigo-600 text-indigo-700"
                        : "border-transparent text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Bilateral Deal Room</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      activeTab === "deal_room"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {messages.length}
                    </span>
                    {messages.length > 0 && activeTab !== "deal_room" && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" title="Active conversation thread" />
                    )}
                  </button>
                </div>

                {activeTab === "offer" ? (
                  <>
                    {/* Key Terms Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Offered Price:</span>
                        <strong className="text-indigo-700 font-bold text-sm">
                          {selectedProposal.offered_unit_price_usd ? `$${selectedProposal.offered_unit_price_usd}/MT` : "Negotiable"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Incoterm:</span>
                        <strong className="text-slate-800">{selectedProposal.offered_incoterm || "CIF"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Transit Time:</span>
                        <strong className="text-slate-800">{selectedProposal.estimated_transit_days || 18} Days</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">FTA Duty Savings:</span>
                        <strong className="text-emerald-600 font-bold">
                          {selectedProposal.duty_savings_usd ? `$${selectedProposal.duty_savings_usd.toLocaleString()}` : "Zero Tariff"}
                        </strong>
                      </div>
                    </div>

                    {/* Proposal Message Body */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Commercial Cover Letter & Technical Offer
                      </h3>
                      <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-line">
                        {selectedProposal.proposal_body}
                      </div>
                    </div>

                    {/* Attached Commercial Document */}
                    {selectedProposal.commercial_document_id && (
                      <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-blue-900 font-semibold">
                          <Paperclip className="w-4 h-4 text-blue-600" />
                          <span>Formal Proforma Invoice (PI) Attached</span>
                        </div>
                        <a
                          href={`/api/v1/workspaces/${selectedProposal.exporter_workspace_id}/documents/${selectedProposal.commercial_document_id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition flex items-center gap-1"
                        >
                          <span>View Official PI</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Decision & Action Bar */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-900">
                          Importer Procurement Actions
                        </h3>
                        <button
                          onClick={() => {
                            setActiveTab("deal_room");
                            setShowCounterBox(true);
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Tag className="w-3 h-3" />
                          <span>Make Counter-Offer</span>
                        </button>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={feedbackNotes}
                          onChange={(e) => setFeedbackNotes(e.target.value)}
                          placeholder="Add procurement notes (e.g. 'Please send 200g lab dip before PO', 'Quote accepted subject to SGS inspection')..."
                          className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          onClick={() => handleRespond(selectedProposal.id, "accepted")}
                          disabled={actionLoadingId === selectedProposal.id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Accept Commercial Quote</span>
                        </button>

                        <button
                          onClick={() => handleRespond(selectedProposal.id, "sample_requested")}
                          disabled={actionLoadingId === selectedProposal.id}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Package className="w-4 h-4" />
                          <span>Request Physical Sample</span>
                        </button>

                        <button
                          onClick={() => handleRespond(selectedProposal.id, "declined")}
                          disabled={actionLoadingId === selectedProposal.id}
                          className="px-4 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>Decline Quote</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Bilateral Deal Room & Live Negotiation Chat */
                  <div className="space-y-4">
                    {/* Counter Offer Box (Expandable) */}
                    {showCounterBox && (
                      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                            <Tag className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Submit Formal Commercial Counter-Offer</span>
                          </div>
                          <button
                            onClick={() => setShowCounterBox(false)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Target Price (USD/MT)
                            </label>
                            <input
                              type="number"
                              value={counterPrice}
                              onChange={(e) => setCounterPrice(Number(e.target.value))}
                              className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl border border-indigo-200 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Incoterm Term
                            </label>
                            <select
                              value={counterIncoterm}
                              onChange={(e) => setCounterIncoterm(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl border border-indigo-200 bg-white"
                            >
                              <option value="CIF">CIF</option>
                              <option value="FOB">FOB</option>
                              <option value="CFR">CFR</option>
                              <option value="DDP">DDP</option>
                            </select>
                          </div>
                        </div>

                        <button
                          onClick={handleSendCounterOffer}
                          disabled={sendingMessage}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Transmit Counter-Offer to Factory</span>
                        </button>
                      </div>
                    )}

                    {/* Messages Scroll Area */}
                    <div className="h-80 overflow-y-auto space-y-3 p-4 bg-slate-50/70 border border-slate-200 rounded-2xl">
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                          <MessageSquare className="w-8 h-8 text-slate-300" />
                          <p className="text-xs font-semibold text-slate-600">
                            Deal Room Conversation Ready
                          </p>
                          <p className="text-[11px] text-slate-400 max-w-xs">
                            Start negotiating shipping deadlines, container configurations, or counter-offers directly with the manufacturer.
                          </p>
                        </div>
                      ) : (
                        messages.map((m) => {
                          const isImporter = m.sender_role === "importer";
                          return (
                            <div
                              key={m.id}
                              className={`flex flex-col ${isImporter ? "items-end" : "items-start"}`}
                            >
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                                <span className="font-bold text-slate-700">{m.sender_name}</span>
                                <span>({isImporter ? "Buyer" : "Factory"})</span>
                                <span>•</span>
                                <span>
                                  {m.created_at
                                    ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                    : "Now"}
                                </span>
                              </div>

                              <div
                                className={`p-3.5 rounded-2xl max-w-md text-xs leading-relaxed shadow-2xs ${
                                  isImporter
                                    ? "bg-indigo-600 text-white rounded-br-xs"
                                    : "bg-white text-slate-800 border border-slate-200 rounded-bl-xs"
                                }`}
                              >
                                {m.message_type === "counter_offer" ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                                      <Tag className="w-3 h-3" />
                                      <span>Counter-Offer</span>
                                    </div>
                                    <p className="font-mono font-bold text-sm">{m.message_text}</p>
                                  </div>
                                ) : m.message_type === "sample_request" ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-blue-200">
                                      <Package className="w-3 h-3" />
                                      <span>Sample Request</span>
                                    </div>
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

                    {/* Chat Input Bar */}
                    <form onSubmit={handleSendMessage} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCounterBox(!showCounterBox)}
                          className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Tag className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Counter</span>
                        </button>

                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Type message to Indian factory dispatch desk..."
                          className="flex-1 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                        />

                        <button
                          type="submit"
                          disabled={sendingMessage || !chatInput.trim()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send</span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <div className="p-12 text-center text-slate-400">
                Select a proposal on the left to inspect commercial terms.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
