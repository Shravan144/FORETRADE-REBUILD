"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setCsrfToken } from "@/lib/api";
import {
  Compass,
  ArrowRight,
  ShieldCheck,
  Building2,
  Factory,
  Globe2,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [companyName, setCompanyName] = useState("");
  const [capacityTons, setCapacityTons] = useState(100);
  const [categories, setCategories] = useState<string[]>(["textiles", "apparel"]);
  const [targetCountries, setTargetCountries] = useState<string[]>(["US", "AE", "GB"]);
  const [certifications, setCertifications] = useState<string[]>(["ISO 9001"]);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);

        // 0. Extract cross-domain tokens from OAuth redirect if present
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const st = params.get("session_token");
          const ct = params.get("csrf_token");
          if (st) {
            document.cookie = `foretrade_session=${encodeURIComponent(st)}; path=/; max-age=${7 * 86400}; SameSite=Lax; Secure`;
            if (ct) {
              document.cookie = `foretrade_csrf=${encodeURIComponent(ct)}; path=/; max-age=${7 * 86400}; SameSite=Lax; Secure`;
              setCsrfToken(ct);
            }
            window.history.replaceState({}, "", window.location.pathname);
          }
        }

        // 1. Ensure user is authenticated & restore CSRF
        try {
          await api.me();
        } catch (authErr: any) {
          if (authErr?.status === 401) {
            window.location.href = "/sign-in";
            return;
          }
        }

        // 2. Resolve workspaces
        const res = await api.listWorkspaces();
        if (res.items && res.items.length > 0) {
          setWorkspaceId(res.items[0].id);
          // Check if profile already exists
          const existing = await api.getExporterProfile(res.items[0].id).catch(() => null);
          if (existing?.payload?.company_name) {
            window.location.href = `/workspace/${res.items[0].id}`;
            return;
          }
        } else {
          // Create default workspace if none
          const newWs = await api.createWorkspace("My Export Operations");
          setWorkspaceId(newWs.id);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let targetWsId = workspaceId;
      if (!targetWsId) {
        // Dynamically resolve or create workspace if not set yet
        const wsRes = await api.listWorkspaces();
        if (wsRes.items && wsRes.items.length > 0) {
          targetWsId = wsRes.items[0].id;
        } else {
          const newWs = await api.createWorkspace("My Export Operations");
          targetWsId = newWs.id;
        }
        setWorkspaceId(targetWsId);
      }

      await api.saveExporterProfile(targetWsId, {
        company_name: companyName || "My Export Enterprise",
        capacity_tons: capacityTons,
        product_categories: categories,
        target_countries: targetCountries,
        certifications: certifications,
      });

      // Direct full-page navigation to initialize cockpit state
      window.location.href = `/workspace/${targetWsId}`;
    } catch (err: any) {
      console.error("Failed to save exporter profile:", err);
      const msg = err?.message || err?.detail || "Failed to save exporter profile. Please try again.";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function toggleCountry(country: string) {
    setTargetCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span>Setting up exporter workspace...</span>
        </div>
      </div>
    );
  }

  const availableCategories = [
    "textiles",
    "apparel",
    "machinery",
    "electronics",
    "chemicals",
    "pharmaceuticals",
    "solar",
    "auto_parts",
    "engineering",
    "medical_devices",
  ];

  const availableCountries = [
    { code: "US", label: "United States" },
    { code: "AE", label: "United Arab Emirates" },
    { code: "DE", label: "Germany" },
    { code: "GB", label: "United Kingdom" },
    { code: "FR", label: "France" },
    { code: "JP", label: "Japan" },
    { code: "SG", label: "Singapore" },
    { code: "AU", label: "Australia" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto w-full bg-slate-950/80 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 mb-2">
            <Compass className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Configure Your Exporter Profile
          </h1>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            ForeTrade's matchmaking algorithm calibrates opportunity scores based on your
            actual manufacturing capacity, product line, and corridor preferences.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Exporter Enterprise Name
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Bharat Textile & Garment Industries Ltd"
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Annual Capacity */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Annual Manufacturing Capacity (Metric Tons)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={1}
                max={50000}
                required
                value={capacityTons}
                onChange={(e) => setCapacityTons(parseInt(e.target.value) || 0)}
                className="w-36 px-4 py-3 rounded-xl border border-slate-700 bg-slate-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400">
                Used to filter buyers whose average import orders match your supply velocity.
              </span>
            </div>
          </div>

          {/* Product Categories */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Export Product Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((cat) => {
                const selected = categories.includes(cat);
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                      selected
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold"
                        : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    {selected ? "✓ " : "+ "}
                    {cat.replace(/_/g, " ")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Corridors */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Target Destination Corridors
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {availableCountries.map((c) => {
                const selected = targetCountries.includes(c.code);
                return (
                  <button
                    type="button"
                    key={c.code}
                    onClick={() => toggleCountry(c.code)}
                    className={`p-2.5 rounded-xl text-xs font-medium text-left border transition-all ${
                      selected
                        ? "bg-blue-950/80 border-blue-500 text-blue-200"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="font-bold">{c.code}</div>
                    <div className="text-[10px] text-slate-400 truncate">{c.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={submitting || !companyName.trim() || categories.length === 0}
              className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Calibrating Algorithmic Workspace...</span>
                </>
              ) : (
                <>
                  <span>Save Profile & Enter Cockpit</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
