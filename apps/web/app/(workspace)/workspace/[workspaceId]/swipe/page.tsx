"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Sparkles,
  CheckCircle2,
  Building2,
  Globe,
  ShieldCheck,
  Ship,
  Container,
  DollarSign,
  ArrowRight,
  RotateCcw,
  Sliders,
  Check,
  X,
  Loader2,
  Award,
  RefreshCw,
  Layers,
  Bookmark,
  Undo2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  TrendingUp,
  ExternalLink,
  Info,
} from "lucide-react";

interface BuyerRecommendation {
  buyer_id: string;
  company_name: string;
  country_code: string;
  city?: string;
  website?: string;
  contact_name?: string;
  contact_email?: string;
  primary_sector: string;
  hs_codes: string[];
  annual_import_volume_usd: number;
  avg_order_tons: number;
  required_certifications: string[];
  preferred_incoterms: string;
  customs_manifest_provenance: string;
  reliability_score: number;
  compatibility_score: number;
  match_tier: string;
  factor_breakdown: {
    product_similarity_pts: number;
    capacity_alignment_pts: number;
    compliance_match_pts: number;
    corridor_alignment_pts: number;
  };
  reasons: string[];
}

interface SwipedHistoryItem {
  buyer: BuyerRecommendation;
  decision: "accept" | "pass" | "bookmark";
  timestamp: number;
}

const SECTOR_OPTIONS = [
  { value: "textiles", label: "Textiles & Apparel (HS 6109, 6203)" },
  { value: "solar", label: "Solar Cells & Clean Energy (HS 8541)" },
  { value: "automotive", label: "Automotive Components (HS 8708)" },
  { value: "pharma", label: "Pharmaceuticals & APIs (HS 3004)" },
  { value: "machinery", label: "Machinery & Equipment (HS 8471, 8483)" },
  { value: "agriculture", label: "Agri-Commodities & Spices (HS 0910, 1006)" },
  { value: "chemicals", label: "Chemicals & Petrochemicals (HS 2902, 3808)" },
  { value: "leather", label: "Leather & Footwear (HS 4104, 6403)" },
  { value: "ceramics", label: "Ceramics & Building Materials (HS 6907)" },
  { value: "gems", label: "Gems & Jewellery (HS 7113)" },
  { value: "electronics", label: "Electronics & Electrical (HS 8504)" },
  { value: "medical", label: "Medical Devices & Diagnostics (HS 9018)" },
];

const POPULAR_COUNTRIES = ["US", "DE", "GB", "AE", "JP", "AU", "CA", "FR", "NL", "SG", "SA", "IT", "ES", "KE", "EG"];

export default function SwipeToExportPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recommendations, setRecommendations] = useState<BuyerRecommendation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [exitDirection, setExitDirection] = useState<"right" | "left" | "up" | null>(null);

  // Swipe stats & Undo history
  const [stats, setStats] = useState({ savedCount: 0, passedCount: 0, bookmarkedCount: 0 });
  const [excludedCount, setExcludedCount] = useState(0);
  const [undoStack, setUndoStack] = useState<SwipedHistoryItem[]>([]);
  const [undoing, setUndoing] = useState(false);
  const [activeToast, setActiveToast] = useState<{
    id: string;
    message: string;
    action: "saved" | "passed" | "bookmarked" | "undone";
    buyer: BuyerRecommendation;
  } | null>(null);

  // Expanded XAI details toggle
  const [showDetailedXAI, setShowDetailedXAI] = useState(false);

  // Exporter Profile Settings Drawer
  const [productCategory, setProductCategory] = useState("textiles");
  const [monthlyCapacityTons, setMonthlyCapacityTons] = useState(100);
  const [targetCountries, setTargetCountries] = useState(["US", "DE", "AE"]);
  const [certifications, setCertifications] = useState(["ISO 9001", "OEKO-TEX Standard 100"]);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [resettingDismissed, setResettingDismissed] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Drag physics state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Toast timer reference
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerToast = useCallback(
    (message: string, action: "saved" | "passed" | "bookmarked" | "undone", buyer: BuyerRecommendation) => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setActiveToast({
        id: `${buyer.buyer_id}-${Date.now()}`,
        message,
        action,
        buyer,
      });
      toastTimeoutRef.current = setTimeout(() => {
        setActiveToast(null);
      }, 5500);
    },
    []
  );

  const loadRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api
        .getRecommendations(workspaceId, 25, true)
        .catch(() => ({ items: [], total_recommendations: 0, excluded_count: 0 }));
      setRecommendations(res.items || []);
      setExcludedCount(res.excluded_count || 0);
      setCurrentIndex(0);
      setStats({ savedCount: 0, passedCount: 0, bookmarkedCount: 0 });
      setUndoStack([]);
    } catch (err) {
      console.warn("Could not load recommendations:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Load more fresh candidates as deck gets close to ending
  const fetchMoreCandidates = useCallback(async () => {
    if (loadingMore) return;
    try {
      setLoadingMore(true);
      const res = await api
        .getRecommendations(workspaceId, 25, true)
        .catch(() => ({ items: [], total_recommendations: 0, excluded_count: 0 }));
      if (res.items && res.items.length > 0) {
        setRecommendations((prev) => {
          const existingIds = new Set(prev.map((p) => p.buyer_id));
          const fresh = res.items.filter((item) => !existingIds.has(item.buyer_id));
          return [...prev, ...fresh];
        });
        setExcludedCount(res.excluded_count || 0);
      }
    } catch (err) {
      console.warn("Could not load more recommendations:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [workspaceId, loadingMore]);

  // Handle Swipe (Right = Accept, Left = Pass, Up = Bookmark)
  const handleSwipe = useCallback(
    async (decision: "accept" | "pass" | "bookmark") => {
      if (currentIndex >= recommendations.length || swiping) return;

      const currentBuyer = recommendations[currentIndex];
      setSwiping(true);
      const dir = decision === "accept" ? "right" : decision === "pass" ? "left" : "up";
      setExitDirection(dir);

      try {
        if (decision === "accept") {
          await api.swipeRecommendation(workspaceId, currentBuyer.buyer_id, "right");
          setStats((prev) => ({ ...prev, savedCount: prev.savedCount + 1 }));
          triggerToast(`Promoted ${currentBuyer.company_name} to CRM Leads`, "saved", currentBuyer);
        } else if (decision === "pass") {
          await api.swipeRecommendation(workspaceId, currentBuyer.buyer_id, "left");
          setStats((prev) => ({ ...prev, passedCount: prev.passedCount + 1 }));
          triggerToast(`Passed ${currentBuyer.company_name}`, "passed", currentBuyer);
        } else {
          await api.swipeRecommendation(workspaceId, currentBuyer.buyer_id, "up");
          setStats((prev) => ({ ...prev, bookmarkedCount: prev.bookmarkedCount + 1 }));
          triggerToast(`Bookmarked ${currentBuyer.company_name} for review`, "bookmarked", currentBuyer);
        }

        // Push to Undo stack
        setUndoStack((prev) => [{ buyer: currentBuyer, decision, timestamp: Date.now() }, ...prev]);
        setExcludedCount((prev) => prev + 1);

        setTimeout(() => {
          setCurrentIndex((prev) => {
            const nextIdx = prev + 1;
            if (nextIdx >= recommendations.length - 4) {
              fetchMoreCandidates();
            }
            return nextIdx;
          });
          setExitDirection(null);
          setDragOffset({ x: 0, y: 0 });
          setSwiping(false);
        }, 220);
      } catch (err) {
        console.error("Failed to record recommendation swipe:", err);
        setExitDirection(null);
        setDragOffset({ x: 0, y: 0 });
        setSwiping(false);
      }
    },
    [currentIndex, recommendations, swiping, workspaceId, fetchMoreCandidates, triggerToast]
  );

  // Undo Last Swipe
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0 || undoing) return;

    const [lastSwiped, ...remainingStack] = undoStack;
    setUndoing(true);

    try {
      await api.undoSwipeRecommendation(workspaceId, lastSwiped.buyer.buyer_id).catch((err) => {
        console.warn("Backend undo sync notice:", err);
      });

      // Decrement relevant counter
      if (lastSwiped.decision === "accept") {
        setStats((prev) => ({ ...prev, savedCount: Math.max(0, prev.savedCount - 1) }));
      } else if (lastSwiped.decision === "pass") {
        setStats((prev) => ({ ...prev, passedCount: Math.max(0, prev.passedCount - 1) }));
      } else {
        setStats((prev) => ({ ...prev, bookmarkedCount: Math.max(0, prev.bookmarkedCount - 1) }));
      }

      setExcludedCount((prev) => Math.max(0, prev - 1));
      setUndoStack(remainingStack);

      // Restore buyer right back into recommendations deck at the front of current deck
      setRecommendations((prev) => {
        const filtered = prev.filter((b) => b.buyer_id !== lastSwiped.buyer.buyer_id);
        const insertIdx = Math.max(0, currentIndex - 1);
        filtered.splice(insertIdx, 0, lastSwiped.buyer);
        return filtered;
      });

      setCurrentIndex((prev) => Math.max(0, prev - 1));
      triggerToast(`Restored ${lastSwiped.buyer.company_name} to deck`, "undone", lastSwiped.buyer);
    } catch (err) {
      console.warn("Undo completed with local fallback:", err);
    } finally {
      setUndoing(false);
    }
  }, [undoStack, undoing, workspaceId, currentIndex, triggerToast]);

  // Pointer drag event handlers for realistic Tinder card physics
  const handlePointerDown = (e: React.PointerEvent) => {
    if (swiping || currentIndex >= recommendations.length) return;
    // Don't drag if clicking buttons, links, or inputs
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input") || target.closest("select")) {
      return;
    }
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    if (cardRef.current) {
      cardRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || swiping) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    // Dampen upward/downward dragging slightly for horizontal preference
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (cardRef.current) {
      try {
        cardRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    const { x, y } = dragOffset;
    const thresholdX = 95;
    const thresholdY = -85;

    if (x > thresholdX) {
      handleSwipe("accept");
    } else if (x < -thresholdX) {
      handleSwipe("pass");
    } else if (y < thresholdY) {
      handleSwipe("bookmark");
    } else {
      // Spring back to center
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handlePointerCancel = () => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (showProfileDrawer) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "h") {
        e.preventDefault();
        handleSwipe("pass");
      } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "l") {
        e.preventDefault();
        handleSwipe("accept");
      } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleSwipe("bookmark");
      } else if (e.key.toLowerCase() === "u") {
        e.preventDefault();
        handleUndo();
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setShowProfileDrawer((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSwipe, handleUndo, showProfileDrawer]);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      await api.saveExporterProfile(workspaceId, {
        product_categories: [productCategory],
        capacity_tons: monthlyCapacityTons,
        target_countries: targetCountries,
        certifications: certifications,
      });
      setShowProfileDrawer(false);
      await loadRecommendations();
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setUpdatingProfile(false);
    }
  }

  async function handleResetDismissed() {
    try {
      setResettingDismissed(true);
      const res = await api.resetDismissedRecommendations(workspaceId);
      setResetMessage(`Reset ${res.reset_count} passed candidates. Loading fresh feed...`);
      setTimeout(() => setResetMessage(null), 4000);
      await loadRecommendations();
    } catch (err) {
      console.error("Failed to reset passed candidates:", err);
    } finally {
      setResettingDismissed(false);
    }
  }

  function toggleCountry(country: string) {
    setTargetCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]
    );
  }

  const currentBuyer = recommendations[currentIndex];
  const nextBuyer = recommendations[currentIndex + 1];

  // Dynamic drag rotation and stamp opacities
  const rotationDeg = dragOffset.x * 0.05;
  const acceptOpacity = Math.min(1, Math.max(0, (dragOffset.x - 20) / 75));
  const passOpacity = Math.min(1, Math.max(0, (-dragOffset.x - 20) / 75));
  const bookmarkOpacity = Math.min(1, Math.max(0, (-dragOffset.y - 20) / 60));

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 text-slate-900 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Two-Tower Recommender</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <Layers className="w-3 h-3 text-emerald-600" />
              <span>3,200+ Verified Importers</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            AI Buyer Matchmaking Deck
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time candidate evaluation powered by dense embeddings (Tower A × Tower B), factory capacity curves, and statutory compliance.
          </p>
        </div>

        {/* Action Controls & Counters */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Undo Action Button */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0 || undoing}
            title="Undo last swipe (Ctrl+Z or U)"
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              undoStack.length > 0
                ? "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100 shadow-2xs"
                : "bg-slate-50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
            }`}
          >
            {undoing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
            ) : (
              <Undo2 className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>Undo</span>
            {undoStack.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 text-amber-900 font-mono font-bold">
                {undoStack.length}
              </span>
            )}
          </button>

          {/* Profile Calibration Tuner */}
          <button
            onClick={() => setShowProfileDrawer(!showProfileDrawer)}
            className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span>Calibrate Tower</span>
          </button>

          {/* Stats Capsule */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-mono text-slate-700 shadow-2xs">
            <span className="text-emerald-700 font-bold" title="Qualified CRM Leads">
              +{stats.savedCount} Saved
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-indigo-600 font-bold" title="Bookmarked for Review">
              ★{stats.bookmarkedCount} Marked
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium" title="Passed candidates">
              {stats.passedCount} Passed
            </span>
            {excludedCount > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-blue-700 font-semibold" title="Total evaluated candidates">
                  {excludedCount} Evaluated
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating Undo Notification Toast */}
      {activeToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 text-xs font-medium border border-slate-800 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2">
            {activeToast.action === "saved" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : activeToast.action === "bookmarked" ? (
              <Bookmark className="w-4 h-4 text-indigo-400 shrink-0" />
            ) : activeToast.action === "undone" ? (
              <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <X className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{activeToast.message}</span>
          </div>

          {activeToast.action !== "undone" && undoStack.length > 0 && (
            <button
              onClick={handleUndo}
              disabled={undoing}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Undo2 className="w-3 h-3" />
              <span>Undo (Ctrl+Z)</span>
            </button>
          )}
        </div>
      )}

      {/* Reset Feedback Notification */}
      {resetMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{resetMessage}</span>
        </div>
      )}

      {/* Tuner Drawer */}
      {showProfileDrawer && (
        <form
          onSubmit={handleUpdateProfile}
          className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Tower A: Exporter Embedding Calibration
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowProfileDrawer(false)}
              className="text-slate-500 hover:text-slate-800 text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Product Sector
              </label>
              <select
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              >
                {SECTOR_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Monthly Capacity (Tons)
              </label>
              <input
                type="number"
                min="10"
                max="5000"
                value={monthlyCapacityTons}
                onChange={(e) => setMonthlyCapacityTons(Number(e.target.value))}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Certifications Held
              </label>
              <input
                type="text"
                value={certifications.join(", ")}
                onChange={(e) =>
                  setCertifications(e.target.value.split(",").map((c) => c.trim()).filter(Boolean))
                }
                placeholder="ISO 9001, OEKO-TEX Standard 100, CE Mark"
                className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
              Priority Target Markets (Corridor Weights)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_COUNTRIES.map((code) => {
                const active = targetCountries.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleCountry(code)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                      active
                        ? "bg-blue-600 text-white border border-blue-600 shadow-2xs"
                        : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={updatingProfile}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              {updatingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Re-rank Buyer Catalog</span>
            </button>
          </div>
        </form>
      )}

      {/* Main Card Deck */}
      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Computing Two-Tower embeddings & capacity fits...</span>
        </div>
      ) : currentIndex >= recommendations.length ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-5 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">All Matching Candidates Evaluated!</h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              You reviewed the catalog for your active profile criteria.
              <br />
              <span className="text-emerald-700 font-bold">+{stats.savedCount} buyers</span> converted to CRM Leads •{" "}
              <span className="text-indigo-600 font-bold">★{stats.bookmarkedCount} marked</span> •{" "}
              <span className="text-slate-500 font-medium">{stats.passedCount} passed</span>.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-center gap-2 font-mono">
            <span>{excludedCount} total catalog candidates evaluated</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {undoStack.length > 0 && (
              <button
                onClick={handleUndo}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Undo Last Action</span>
              </button>
            )}

            <button
              onClick={() => setShowProfileDrawer(true)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>Calibrate Tower Profile</span>
            </button>

            <button
              onClick={handleResetDismissed}
              disabled={resettingDismissed}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              {resettingDismissed ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>Re-evaluate Passed Buyers</span>
            </button>

            <Link
              href={`/workspace/${workspaceId}/leads`}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition"
            >
              <span>View CRM Leads</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="relative max-w-2xl mx-auto">
          {/* Card Stack Container */}
          <div className="relative touch-none">
            {/* Background Stack Preview (Underlying Next Card) */}
            {nextBuyer && (
              <div
                className="absolute top-3 inset-x-3.5 h-[98%] rounded-2xl bg-slate-50 border border-slate-200 pointer-events-none -z-10 shadow-sm transition-all duration-200"
                style={{
                  transform: `scale(${0.96 + Math.min(0.04, (Math.abs(dragOffset.x) + Math.abs(dragOffset.y)) / 1000)})`,
                  opacity: 0.75 + Math.min(0.25, (Math.abs(dragOffset.x) + Math.abs(dragOffset.y)) / 400),
                }}
              >
                <div className="p-6 opacity-30 flex justify-between items-center border-b border-slate-200">
                  <div className="h-5 w-40 bg-slate-300 rounded-sm" />
                  <div className="h-8 w-16 bg-slate-200 rounded-lg" />
                </div>
              </div>
            )}

            {/* Active Top Card with Touch & Pointer Drag Physics */}
            <div
              ref={cardRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              style={{
                transform: exitDirection === "right"
                  ? "translate3d(140%, 20px, 0) rotate(14deg)"
                  : exitDirection === "left"
                  ? "translate3d(-140%, 20px, 0) rotate(-14deg)"
                  : exitDirection === "up"
                  ? "translate3d(0, -140%, 0) scale(0.9)"
                  : `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotationDeg}deg)`,
                transition: isDragging ? "none" : "transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease",
                opacity: exitDirection ? 0 : 1,
                cursor: isDragging ? "grabbing" : "grab",
              }}
              className="relative rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden"
            >
              {/* Dynamic Action Stamps */}
              {/* Stamp Right: QUALIFY LEAD */}
              <div
                style={{ opacity: exitDirection === "right" ? 1 : acceptOpacity }}
                className="absolute top-8 left-8 z-30 pointer-events-none border-4 border-emerald-500 text-emerald-600 font-extrabold text-xl md:text-2xl tracking-wider uppercase px-4 py-2 rounded-xl -rotate-12 bg-white/95 shadow-xl transition-opacity flex items-center gap-1.5"
              >
                <Check className="w-6 h-6 stroke-[3]" />
                <span>QUALIFY LEAD</span>
              </div>

              {/* Stamp Left: PASS / DISMISS */}
              <div
                style={{ opacity: exitDirection === "left" ? 1 : passOpacity }}
                className="absolute top-8 right-8 z-30 pointer-events-none border-4 border-rose-500 text-rose-600 font-extrabold text-xl md:text-2xl tracking-wider uppercase px-4 py-2 rounded-xl rotate-12 bg-white/95 shadow-xl transition-opacity flex items-center gap-1.5"
              >
                <X className="w-6 h-6 stroke-[3]" />
                <span>PASS</span>
              </div>

              {/* Stamp Up: BOOKMARK */}
              <div
                style={{ opacity: exitDirection === "up" ? 1 : bookmarkOpacity }}
                className="absolute top-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none border-4 border-indigo-500 text-indigo-600 font-extrabold text-lg md:text-xl tracking-wider uppercase px-4 py-2 rounded-xl bg-white/95 shadow-xl transition-opacity flex items-center gap-1.5"
              >
                <Bookmark className="w-5 h-5 fill-indigo-600" />
                <span>BOOKMARK</span>
              </div>

              {/* Card Banner Header */}
              <div className="p-6 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono font-bold text-xs flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-600" />
                      <span>{currentBuyer.country_code}</span>
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {currentBuyer.city || "Direct Container Port Hub"}
                    </span>
                    {currentBuyer.website && (
                      <a
                        href={currentBuyer.website}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 ml-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    {currentBuyer.company_name}
                  </h2>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>
                      Sector: <strong className="text-slate-800">{currentBuyer.primary_sector}</strong>
                    </span>
                    {currentBuyer.contact_name && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-600">
                          Contact: <strong>{currentBuyer.contact_name}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Match Score Badge */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-center shrink-0 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Compatibility
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-700 mt-0.5">
                    {Math.round(currentBuyer.compatibility_score)}%
                  </div>
                  <div
                    className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 px-2 py-0.5 rounded-md ${
                      currentBuyer.match_tier === "Strong Match"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : currentBuyer.match_tier === "Good Fit"
                        ? "bg-blue-50 text-blue-800 border border-blue-200"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {currentBuyer.match_tier}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-5">
                {/* 1. XAI Feature Attribution Breakdown */}
                <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Explainable AI (XAI) Attribution Match</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetailedXAI(!showDetailedXAI);
                      }}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showDetailedXAI ? "Simple View" : "Factor Weights"}</span>
                      {showDetailedXAI ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Primary Qualitative Rationales */}
                  <div className="space-y-1.5">
                    {currentBuyer.reasons.map((reason, ri) => (
                      <div
                        key={ri}
                        className="text-xs text-slate-700 flex items-start gap-2 leading-relaxed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>

                  {/* 4 Quantitative Attribution Factor Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 border-t border-blue-100 text-center">
                    <div className="p-2 rounded-lg bg-white/70 border border-blue-100">
                      <div className="text-[9px] uppercase font-bold text-slate-500">Embedding Sim</div>
                      <div className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                        {currentBuyer.factor_breakdown.product_similarity_pts} / 35 pts
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-1 rounded-full"
                          style={{
                            width: `${Math.min(100, (currentBuyer.factor_breakdown.product_similarity_pts / 35) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white/70 border border-blue-100">
                      <div className="text-[9px] uppercase font-bold text-slate-500">Capacity Fit</div>
                      <div className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                        {currentBuyer.factor_breakdown.capacity_alignment_pts} / 25 pts
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-1 rounded-full"
                          style={{
                            width: `${Math.min(100, (currentBuyer.factor_breakdown.capacity_alignment_pts / 25) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white/70 border border-blue-100">
                      <div className="text-[9px] uppercase font-bold text-slate-500">Compliance</div>
                      <div className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                        {currentBuyer.factor_breakdown.compliance_match_pts} / 20 pts
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-1 rounded-full"
                          style={{
                            width: `${Math.min(100, (currentBuyer.factor_breakdown.compliance_match_pts / 20) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white/70 border border-blue-100">
                      <div className="text-[9px] uppercase font-bold text-slate-500">Corridor</div>
                      <div className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                        {currentBuyer.factor_breakdown.corridor_alignment_pts} / 20 pts
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                        <div
                          className="bg-purple-600 h-1 rounded-full"
                          style={{
                            width: `${Math.min(100, (currentBuyer.factor_breakdown.corridor_alignment_pts / 20) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Deep XAI Mathematical Breakdown */}
                  {showDetailedXAI && (
                    <div className="p-3 bg-white rounded-lg border border-blue-200/60 text-xs text-slate-600 space-y-2 mt-2">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        <span>Two-Tower Formulation Specification:</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600 font-mono">
                        Score = S_product(eA, eB) &times; 35 + C_capacity(Cap_exp, Ord_buy) &times; 25 + Compliance(Cert) &times; 20 + Corridor(Lane) &times; 20
                      </p>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                        <span>Target HS Codes: <strong>{currentBuyer.hs_codes.join(", ") || "General"}</strong></span>
                        <span>•</span>
                        <span>Corridor: <strong>IN → {currentBuyer.country_code}</strong></span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Operational Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-blue-600" />
                      <span>Annual Demand</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-slate-900 mt-1">
                      ${(currentBuyer.annual_import_volume_usd / 1_000_000).toFixed(1)}M USD
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                      <Container className="w-3 h-3 text-emerald-600" />
                      <span>Avg Order Size</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-slate-900 mt-1">
                      {currentBuyer.avg_order_tons} Tons
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                      <Ship className="w-3 h-3 text-indigo-600" />
                      <span>Incoterm Preferred</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-slate-900 mt-1">
                      {currentBuyer.preferred_incoterms || "CIF"}
                    </div>
                  </div>
                </div>

                {/* 3. Mandatory Certifications Required */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
                    Buyer Mandated Pre-Qualifications
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentBuyer.required_certifications.map((cert, ci) => {
                      const exporterHolds = certifications.some((c) =>
                        c.toLowerCase().includes(cert.toLowerCase()) || cert.toLowerCase().includes(c.toLowerCase())
                      );
                      return (
                        <span
                          key={ci}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                            exporterHolds
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {exporterHolds && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          <span>{cert}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Customs Provenance & Reliability */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>{currentBuyer.reliability_score}% Customs Reliability Score</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate" title={currentBuyer.customs_manifest_provenance}>
                    {currentBuyer.customs_manifest_provenance}
                  </div>
                </div>
              </div>

              {/* Swipe Control Action Bar */}
              <div className="p-5 bg-slate-50/90 border-t border-slate-200 flex items-center justify-between px-6 sm:px-8">
                {/* Dismiss Button (Left) */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSwipe("pass")}
                    disabled={swiping}
                    title="Swipe Left: Pass Candidate (Keyboard: ← or H)"
                    className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-600 hover:text-rose-600 flex items-center justify-center transition shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-6 h-6 stroke-[2.5]" />
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono font-medium hidden sm:inline">← Pass</span>
                </div>

                {/* Bookmark Button (Up / Middle) */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => handleSwipe("bookmark")}
                    disabled={swiping}
                    title="Swipe Up: Bookmark for Review (Keyboard: ↑ or K)"
                    className="w-11 h-11 rounded-full bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 flex items-center justify-center transition shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    <Bookmark className="w-5 h-5" />
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono font-medium">↑ Mark</span>
                </div>

                {/* Deck Counter */}
                <div className="text-center px-2 font-mono">
                  <span className="text-xs font-bold text-slate-800 block">
                    Candidate {currentIndex + 1} of {recommendations.length}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Drag card or use keys
                  </span>
                </div>

                {/* Accept Button (Right) */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-700 font-mono font-semibold hidden sm:inline">Save →</span>
                  <button
                    onClick={() => handleSwipe("accept")}
                    disabled={swiping}
                    title="Swipe Right: Convert to CRM Lead (Keyboard: → or L)"
                    className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center transition disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-6 h-6 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Keyboard Shortcuts Legend */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-center gap-4 text-[11px] text-slate-500 font-mono flex-wrap">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded-sm bg-slate-100 border border-slate-300 text-slate-700">←</kbd>
              <span>Pass</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded-sm bg-slate-100 border border-slate-300 text-slate-700">↑</kbd>
              <span>Bookmark</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded-sm bg-slate-100 border border-slate-300 text-slate-700">→</kbd>
              <span>Qualify Lead</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded-sm bg-slate-100 border border-slate-300 text-slate-700">Ctrl+Z</kbd>
              <span>Undo</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded-sm bg-slate-100 border border-slate-300 text-slate-700">T</kbd>
              <span>Calibrate</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
