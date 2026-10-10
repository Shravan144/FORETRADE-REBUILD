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
  Factory,
  PackageCheck,
  ShieldCheck,
  Mail,
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

  const isImporterMode = pathname.includes("/importer");

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
        if (isImporterMode) {
          const impProfile = await api.getImporterProfile(workspaceId);
          if (isMounted && impProfile?.company_name) {
            setActiveOrgName(impProfile.company_name);
            return;
          }
        }
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
  }, [workspaceId, isImporterMode]);

  const exporterNavItems = [
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

  const importerNavItems = [
    {
      name: "Procurement Hub",
      href: `/workspace/${workspaceId}/importer`,
      icon: Layers,
      match: pathname === `/workspace/${workspaceId}/importer`,
    },
    {
      name: "Buyer Profile & Tax IDs",
      href: `/workspace/${workspaceId}/importer/profile`,
      icon: ShieldCheck,
      match: pathname.startsWith(`/workspace/${workspaceId}/importer/profile`),
    },
    {
      name: "Sourcing RFQs & Tenders",
      href: `/workspace/${workspaceId}/importer/rfqs`,
      icon: PackageCheck,
      match: pathname.startsWith(`/workspace/${workspaceId}/importer/rfqs`),
    },
    {
      name: "Factory Proposals Inbox",
      href: `/workspace/${workspaceId}/importer/inbox`,
      icon: Mail,
      match: pathname.startsWith(`/workspace/${workspaceId}/importer/inbox`),
    },
  ];

  const navItems = isImporterMode ? importerNavItems : exporterNavItems;

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
    <aside className="w-64 bg-white text-slate-800 flex flex-col border-r border-slate-200 shrink-0 select-none shadow-xs">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <Link href={`/workspace/${workspaceId}`} className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold tracking-tight">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight leading-none text-base">
              ForeTrade
            </h1>
            <span className="text-[10px] text-blue-600 font-bold tracking-wide uppercase">
              EXIM Operating System
            </span>
          </div>
        </Link>
      </div>

      {/* Workspace Indicator */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${isImporterMode ? "bg-indigo-500" : "bg-emerald-500"} animate-pulse`}></span>
            <span className="uppercase tracking-wider text-[10px]">{isImporterMode ? "Procurement Desk" : "Active Enterprise"}</span>
          </div>
          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${isImporterMode ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"}`}>
            {isImporterMode ? "Buyer" : "Exporter"}
          </span>
        </div>
        <div className="font-bold text-xs text-slate-900 truncate">
          {activeOrgName || workspaceName || (isImporterMode ? "Global Importer Org" : "Exporter Workspace")}
        </div>
      </div>

      {/* Bilateral Role Switcher */}
      <div className="p-2.5 border-b border-slate-100 bg-slate-50/60">
        <div className="grid grid-cols-2 p-1 bg-slate-200/70 rounded-xl text-xs font-semibold gap-1">
          <Link
            href={`/workspace/${workspaceId}`}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition text-[11px] ${
              !isImporterMode
                ? "bg-white text-blue-700 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            <span>Exporter</span>
          </Link>
          <Link
            href={`/workspace/${workspaceId}/importer`}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition text-[11px] ${
              isImporterMode
                ? "bg-white text-indigo-700 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Importer</span>
          </Link>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                item.match
                  ? isImporterMode
                    ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-xs"
                    : "bg-blue-50 text-blue-700 font-bold border border-blue-200/80 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${item.match ? (isImporterMode ? "text-indigo-600" : "text-blue-600") : "text-slate-400"}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Intelligence Engine Status Pill */}
      <div className={`p-3 mx-3 mb-3 rounded-xl border text-xs ${isImporterMode ? "bg-indigo-50/50 border-indigo-200/70" : "bg-slate-50 border-slate-200"}`}>
        <div className={`flex items-center gap-1.5 font-bold mb-0.5 text-[11px] ${isImporterMode ? "text-indigo-700" : "text-blue-700"}`}>
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isImporterMode ? "Direct Sourcing Active" : "Intelligence Engine Active"}</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug font-normal">
          {isImporterMode
            ? "Tenders broadcast to verified Indian exporters & customs desks."
            : "Indexed for 3,200 verified importers across 15 corridors."}
        </p>
      </div>

      {/* User & Settings Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
        <Link
          href={isImporterMode ? `/workspace/${workspaceId}/importer/profile` : `/workspace/${workspaceId}/settings`}
          title={isImporterMode ? "Open Buyer Compliance Profile" : "Open Profile & Settings"}
          className="flex items-center gap-2.5 min-w-0 flex-1 p-1.5 rounded-xl hover:bg-slate-100 transition group"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:border-blue-400 transition">
            {initials}
          </div>
          <div className="min-w-0 pr-1">
            <div className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-600 transition">
              {displayName}
            </div>
            <div className="text-[10px] text-slate-500 truncate">{displayTitle}</div>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          title="Sign Out"
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
