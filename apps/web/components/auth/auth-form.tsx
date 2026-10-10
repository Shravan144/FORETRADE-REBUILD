"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Compass, ArrowRight, Loader2, KeyRound, CheckCircle2, AlertCircle, Info, ExternalLink } from "lucide-react";

export function AuthForm({ mode }: { mode: "sign-in" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<"idle" | "checking" | "unconfigured">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "register") {
        await api.register({
          email,
          password,
          full_name: fullName.trim() || undefined,
          company_name: companyName.trim() || undefined,
        });
      }
      // Log in to obtain session cookie & CSRF token
      await api.login({ email, password });

      // Fetch user workspaces
      const { items } = await api.listWorkspaces();
      if (items.length > 0) {
        router.push(`/workspace/${items[0].id}`);
      } else {
        router.push("/onboarding");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message === "invalid_credentials" ? "Invalid email or password." : err.message);
      } else {
        setError("Unable to authenticate. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleFillDemo() {
    setEmail("demo@example.com");
    setPassword("DemoPassword123!");
    setError(null);
  }

  async function handleGoogleLogin(e: React.MouseEvent) {
    setGoogleStatus("checking");
    try {
      const res = await fetch("/api/v1/auth/google/start", { method: "GET" });
      if (res.status === 503) {
        e.preventDefault();
        setGoogleStatus("unconfigured");
        return;
      }
      // If configured, navigate directly to Google authorization endpoint
      window.location.href = "/api/v1/auth/google/start";
    } catch {
      // Fallback redirect
      window.location.href = "/api/v1/auth/google/start";
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-2xs font-bold">
            <Compass className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 text-base">ForeTrade OS</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {mode === "register" ? "Create Exporter Workspace" : "Sign In to Your Workspace"}
        </h2>
        <p className="text-xs text-slate-500">
          {mode === "register"
            ? "Enter your company credentials to begin evaluating overseas buyers."
            : "Access live trade corridors, demand radar feeds, and landed cost tools."}
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed font-medium">{error}</div>
        </div>
      )}

      {/* Google OAuth Button */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleStatus === "checking"}
          className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold rounded-lg text-xs shadow-2xs transition flex items-center justify-center gap-2.5"
        >
          {/* Official Google G Logo SVG */}
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{googleStatus === "checking" ? "Connecting to Google..." : "Continue with Google"}</span>
        </button>

        {googleStatus === "unconfigured" && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1 shadow-2xs">
            <div className="flex items-center gap-1.5 font-semibold text-blue-950">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>Google OAuth Setup Note</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              To activate Google login, paste your <code className="text-blue-800 font-mono bg-blue-100 px-1 py-0.2 rounded">GOOGLE_CLIENT_ID</code> and <code className="text-blue-800 font-mono bg-blue-100 px-1 py-0.2 rounded">GOOGLE_CLIENT_SECRET</code> into your root <code className="text-blue-800 font-mono bg-blue-100 px-1 py-0.2 rounded">.env</code> file. In the meantime, use email authentication or the Demo button below.
            </p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="border-t border-slate-200 w-full" />
        <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          or continue with email
        </span>
      </div>

      {/* Credentials Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <>
            <div>
              <label htmlFor="auth-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                id="auth-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rajesh Sharma"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
              />
            </div>

            <div>
              <label htmlFor="auth-company" className="block text-xs font-semibold text-slate-700 mb-1">
                Company / Organization Name <span className="text-slate-400 text-[10px]">(Optional)</span>
              </label>
              <input
                id="auth-company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Apex Agro Exports Pvt Ltd"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1">
            Work Email Address
          </label>
          <input
            id="auth-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="export.director@company.com"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700">
              Password
            </label>
            <span className="text-[10px] text-slate-400 font-mono">Min 12 characters</span>
          </div>
          <input
            id="auth-password"
            type="password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-2xs hover:shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span>{mode === "register" ? "Create Account & Workspace" : "Sign In to Workspace"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {/* Quick Demo Credentials */}
      <div className="pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={handleFillDemo}
          className="w-full py-2.5 px-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-2xs"
        >
          <KeyRound className="w-3.5 h-3.5 text-blue-600" />
          <span>Autofill Demo Exporter Credentials</span>
        </button>
      </div>

      {/* Switch between Sign-In and Register */}
      <div className="text-center text-xs text-slate-500 pt-1">
        {mode === "register" ? (
          <p>
            Already have an active account?{" "}
            <Link href="/sign-in" className="text-blue-600 font-bold hover:underline">
              Sign In
            </Link>
          </p>
        ) : (
          <p>
            New exporter or review evaluator?{" "}
            <Link href="/register" className="text-blue-600 font-bold hover:underline">
              Create an account
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
