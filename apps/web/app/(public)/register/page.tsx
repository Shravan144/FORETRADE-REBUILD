import Image from "next/image";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Compass, CheckCircle2, Globe, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* Left Column: Maritime Editorial Showcase (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-slate-900 border-r border-slate-800 overflow-hidden">
        {/* Background Image: Container Ship */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/container-ship.jpg"
            alt="Commercial Cargo Vessel"
            fill
            priority
            className="object-cover object-center filter brightness-50 contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40" />
        </div>

        {/* Top Header */}
        <div className="relative z-10 flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md font-bold">
              <Compass className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-white text-lg tracking-tight">ForeTrade</span>
          </Link>
          <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-950/90 border border-blue-800">
            Enterprise Onboarding
          </span>
        </div>

        {/* Editorial Quote & Trust Points */}
        <div className="relative z-10 space-y-6 max-w-lg">
          <blockquote className="space-y-3">
            <p className="text-xl font-medium text-slate-100 leading-snug">
              "Connecting with overseas buyers usually takes months of trade fairs and unverified directory leads. ForeTrade gives us live customs shipment volumes and machine learning match scores directly."
            </p>
            <footer className="text-xs text-slate-400 font-medium">
              — Managing Director, Precision Engineering & Capital Goods Exporters
            </footer>
          </blockquote>

          <div className="pt-4 border-t border-slate-800/80 space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Full Two-Tower Recommender Compatibility Scoring</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Real-Time Government Procurement Tender Radar</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zero Synthetic Mocks: 100% Verifiable Customs Data</span>
            </div>
          </div>
        </div>

        {/* Footer Metrics */}
        <div className="relative z-10 flex items-center gap-6 pt-6 border-t border-slate-800 text-xs text-slate-400 font-mono">
          <span>$4.2B+ TRADE INDEXED</span>
          <span>•</span>
          <span>1,400+ VERIFIED IMPORTERS</span>
          <span>•</span>
          <span>ENTERPRISE EXIM OS</span>
        </div>
      </div>

      {/* Right Column: Registration Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-slate-950">
        <AuthForm mode="register" />
      </div>
    </div>
  );
}
