"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Globe,
  Building2,
  Briefcase,
  UploadCloud,
  BarChart3,
  LogOut,
  Compass,
  Layers,
  Sparkles,
  Radar,
  Ship,
  ShieldAlert,
  FileText,
  Settings,
} from "lucide-react";
import { api } from "@/lib/api";

interface SidebarProps {
  workspaceId: string;
  workspaceName?: string;
  userEmail?: string;
}

export function Sidebar({ workspaceId, workspaceName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [userProfile, setUserProfile] = useState<{
    full_name?: string | null;
    job_title?: string | null;
    email?: string;
  } | null>(null);
  const [activeOrgName, setActiveOrgName] = useState<string>(workspaceName || "");

  useEffect(() => {
    let isMounted = true;
    async function fetchUserData() {
      try {
        const me = await api.me();
        if (isMounted && me) {
          setUserProfile(me);
        }
      } catch {
        // use fallback props
      }

      try {
        const profile = await api.getExporterProfile(workspaceId);
        if (isMounted && profile?.payload?.company_name) {
          setActiveOrgName(profile.payload.company_name);
        }
      } catch {
        // use fallback props
      }
    }
    fetchUserData();
    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  const navItems = [
    {
      name: "Dashboard",
      href: `/workspace/${workspaceId}`,
      icon: Layers,
      match: pathname === `/workspace/${workspaceId}`,
    },
    {
      name: "Swipe to Export",
      href: `/workspace/${workspaceId}/swipe`,
      icon: Sparkles,
      match: pathname.startsWith(`/workspace/${workspaceId}/swipe`),
    },
    {
      name: "Demand Radar",
      href: `/workspace/${workspaceId}/radar`,
      icon: Radar,
      match: pathname.startsWith(`/workspace/${workspaceId}/radar`),
    },
    {
      name: "Market Explorer",
      href: `/workspace/${workspaceId}/markets`,
      icon: Globe,
      match: pathname.startsWith(`/workspace/${workspaceId}/markets`),
    },
    {
      name: "Landed Cost Estimator",
      href: `/workspace/${workspaceId}/logistics`,
      icon: Ship,
      match: pathname.startsWith(`/workspace/${workspaceId}/logistics`),
    },
    {
      name: "Trade Risk Simulator",
      href: `/workspace/${workspaceId}/risk`,
      icon: ShieldAlert,
      match: pathname.startsWith(`/workspace/${workspaceId}/risk`),
    },
    {
      name: "Global Buyer Directory",
      href: `/workspace/${workspaceId}/companies`,
      icon: Building2,
      match: pathname.startsWith(`/workspace/${workspaceId}/companies`),
    },
    {
      name: "Lead Pipeline",
      href: `/workspace/${workspaceId}/leads`,
      icon: Briefcase,
      match: pathname.startsWith(`/workspace/${workspaceId}/leads`),
    },
    {
      name: "Document Studio",
      href: `/workspace/${workspaceId}/documents`,
      icon: FileText,
      match: pathname.startsWith(`/workspace/${workspaceId}/documents`),
    },
    {
      name: "Import Wizard",
      href: `/workspace/${workspaceId}/imports/new`,
      icon: UploadCloud,
      match: pathname.startsWith(`/workspace/${workspaceId}/imports`),
    },
    {
      name: "Analytics & Export",
      href: `/workspace/${workspaceId}/analytics`,
      icon: BarChart3,
      match: pathname.startsWith(`/workspace/${workspaceId}/analytics`),
    },
    {
      name: "Settings & Profile",
      href: `/workspace/${workspaceId}/settings`,
      icon: Settings,
      match: pathname.startsWith(`/workspace/${workspaceId}/settings`),
    },
  ];

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    router.push("/sign-in");
  }

  const displayName = userProfile?.full_name || userEmail || userProfile?.email?.split("@")[0] || "Export Director";
  const displayTitle = userProfile?.job_title || "Export Director";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "ED";

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <Link href={`/workspace/${workspaceId}`} className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold tracking-tight">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-white tracking-tight leading-none text-base">
              ForeTrade
            </h1>
            <span className="text-[10px] text-blue-400 font-medium tracking-wide uppercase">
              EXIM Intelligence
            </span>
          </div>
        </Link>
      </div>

      {/* Workspace Indicator */}
      <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Active Workspace</span>
        </div>
        <div className="font-medium text-sm text-slate-200 truncate">
          {activeOrgName || workspaceName || "Exporter Workspace"}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                item.match
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Algo Badge */}
      <div className="p-3 mx-3 mb-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 text-blue-400 font-medium mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Two-Tower & ML Suite</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-snug">
          Operational matchmaking, ARIMA corridor forecasts, and WTO landed costs.
        </p>
      </div>

      {/* User & Settings Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between gap-2">
        <Link
          href={`/workspace/${workspaceId}/settings`}
          title="Open Profile & Settings"
          className="flex items-center gap-2.5 min-w-0 flex-1 p-1.5 rounded-lg hover:bg-slate-800/60 transition group"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 group-hover:border-blue-400 transition">
            {initials}
          </div>
          <div className="min-w-0 pr-1">
            <div className="text-xs font-medium text-slate-200 truncate group-hover:text-blue-300 transition">
              {displayName}
            </div>
            <div className="text-[10px] text-slate-500 truncate">{displayTitle}</div>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          title="Sign Out"
          className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
