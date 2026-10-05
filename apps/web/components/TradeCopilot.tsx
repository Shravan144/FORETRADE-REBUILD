"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Sparkles,
  X,
  Send,
  RefreshCw,
  Copy,
  Check,
  Loader2,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Bot,
  Globe,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelUsed?: string;
  timestamp: string;
}

const STARTER_PROMPTS = [
  { label: "UAE CEPA Tariff Savings", query: "What are the preferential tariff savings under the India-UAE CEPA for cotton apparel (HS 6109)?" },
  { label: "Draft 60-Day LC Clause", query: "Draft an irrevocable, non-negotiable 60-day Letter of Credit (LC) clause for export payment security." },
  { label: "CIF vs FOB Incoterms", query: "Compare CIF vs FOB Incoterms for Indian container exports to Europe. Who bears transit and port demurrage risk?" },
  { label: "US Customs Compliance", query: "What mandatory quality certifications and customs documents are required for US customs clearance of Indian textiles?" },
];

export default function TradeCopilot({ workspaceId }: { workspaceId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isOpen]);

  async function handleSend(queryText?: string) {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: "u-" + Date.now(),
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Build conversation history for context
      const historyPayload = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.copilotChat(workspaceId, {
        message: textToSend,
        conversation_history: historyPayload.slice(-6),
      });

      const assistantMsg: Message = {
        id: "a-" + Date.now(),
        role: "assistant",
        content: res.response,
        modelUsed: res.model_used,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setSuggestedQuestions(res.suggested_questions || []);
    } catch (err) {
      console.error("Copilot error:", err);
      const errorMsg: Message = {
        id: "err-" + Date.now(),
        role: "assistant",
        content: "I encountered an issue connecting to the trade advisory service. Please check your network or try again in a moment.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  function handleClear() {
    setMessages([]);
    setSuggestedQuestions([]);
  }

  return (
    <>
      {/* Floating Action Bubble */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Open ForeTrade AI Copilot"
          className="relative group p-4 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-600/30 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-400/30"
        >
          {isOpen ? (
            <X className="w-6 h-6 transition-transform duration-200" />
          ) : (
            <div className="relative">
              <Sparkles className="w-6 h-6 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
          )}

          {/* Hover Tooltip */}
          {!isOpen && (
            <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-slate-800">
              ⚡ ForeTrade Copilot (NVIDIA Nemotron)
            </div>
          )}
        </button>
      </div>

      {/* Floating Chat Modal / Drawer */}
      {isOpen && (
        <div className="fixed bottom-22 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-7rem)] flex flex-col bg-white border border-slate-200/90 rounded-2xl shadow-2xl shadow-slate-900/20 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xs">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-tight">ForeTrade Copilot</h3>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                    AI Active
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 truncate max-w-[200px]">
                  NVIDIA Nemotron 3 Ultra (550B)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  title="Clear conversation"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize Copilot"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Stream Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-between py-2">
                {/* Welcome Info */}
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 text-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Cross-Border Trade Intelligence</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Ask me anything about bilateral FTAs (India-UAE CEPA, ECTA), duty savings, Incoterms liability, payment security (LC clauses), or destination port regulations.
                    </p>
                  </div>

                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    Quick Inquiries:
                  </span>

                  <div className="grid grid-cols-1 gap-2">
                    {STARTER_PROMPTS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(p.query)}
                        className="text-left p-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/50 transition-all text-xs group cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 group-hover:text-blue-700 text-xs">
                            {p.label}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5" />
                        </div>
                        <span className="text-[10.5px] text-slate-500 line-clamp-1 mt-0.5">
                          {p.query}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-400 pt-2">
                  🔒 Grounded in institutional WTO, UN Comtrade & WCO datasets
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  const isCopied = copiedId === m.id;

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                          isUser
                            ? "bg-blue-600 text-white rounded-br-xs"
                            : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
                        }`}
                      >
                        {/* Message content formatted */}
                        <div className="whitespace-pre-wrap font-sans text-xs select-text">
                          {m.content}
                        </div>

                        {/* Assistant message footer */}
                        {!isUser && (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="truncate max-w-[170px]">
                              {m.modelUsed ? `via ${m.modelUsed}` : "ForeTrade AI"}
                            </span>
                            <button
                              onClick={() => handleCopy(m.id, m.content)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition-colors ml-2"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      <span className="text-[9.5px] text-slate-400 mt-1 px-1">
                        {m.timestamp}
                      </span>
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {loading && (
                  <div className="flex items-start gap-2">
                    <div className="p-3 rounded-2xl rounded-bl-xs bg-white border border-slate-200 text-slate-600 text-xs flex items-center gap-2 shadow-2xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span className="text-[11px] text-slate-500">
                        NVIDIA Nemotron reasoning through trade data...
                      </span>
                    </div>
                  </div>
                )}

                {/* Follow-up Question Chips */}
                {!loading && suggestedQuestions.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Suggested Follow-Ups:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(q)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10.5px] font-medium border border-blue-200/80 transition-colors text-left"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Box Footer */}
          <div className="p-3 bg-white border-t border-slate-200/90 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative flex items-end gap-2"
            >
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about tariffs, FTAs, Incoterms, LC clauses..."
                disabled={loading}
                className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none font-medium leading-relaxed"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="h-10 w-10 shrink-0 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
            <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1.5 px-0.5">
              <span>Press <strong>Enter</strong> to send, <strong>Shift+Enter</strong> for newline</span>
              <span className="flex items-center gap-1 font-semibold text-slate-500">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                WTO / FTA Grounded
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
