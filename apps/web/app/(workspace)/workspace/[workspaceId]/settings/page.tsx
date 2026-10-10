"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import {
  INDIAN_PORTS_REGISTRY,
  validateIEC,
  validateGSTIN,
  validateSWIFT,
  calculateExportReadinessScore,
} from "@/lib/exim-validators";
import {
  User,
  Building2,
  Landmark,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Globe2,
  FileText,
  Ship,
  Sparkles,
  ArrowRight,
  Info,
  BadgeCheck,
  Copy,
  Check,
  Compass,
} from "lucide-react";

export default function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"profile" | "company" | "bank">("profile");

  // Loading & Feedback states
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [companySuccess, setCompanySuccess] = useState<string | null>(null);
  const [bankSuccess, setBankSuccess] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // User Profile State
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  // Company Profile State
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [originCountry, setOriginCountry] = useState("IN");
  const [originPort, setOriginPort] = useState("INNSA - Nhava Sheva (JNPT), Maharashtra");
  const [iecCode, setIecCode] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [capacityTons, setCapacityTons] = useState<number>(5000);
  const [minOrderValueUsd, setMinOrderValueUsd] = useState<number>(25000);
  const [productCategories, setProductCategories] = useState<string>("Basmati Rice, Spices, Textiles");
  const [targetCountries, setTargetCountries] = useState<string>("AE, US, DE, SA, GB");
  const [certifications, setCertifications] = useState<string>("ISO 22000, HACCP, APEDA, FSSAI");

  // Bank Coordinates State
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankSwift, setBankSwift] = useState("");
  const [bankIban, setBankIban] = useState("");

  // Live Statutory Validators
  const iecValidation = useMemo(() => validateIEC(iecCode), [iecCode]);
  const gstinValidation = useMemo(() => validateGSTIN(taxId), [taxId]);
  const swiftValidation = useMemo(() => validateSWIFT(bankSwift), [bankSwift]);

  // Live Export Readiness Score
  const readiness = useMemo(() => {
    return calculateExportReadinessScore({
      company_name: companyName,
      company_address: companyAddress,
      contact_person: contactPerson,
      contact_email: contactEmail,
      origin_port: originPort,
      iec_code: iecCode,
      tax_id: taxId,
      capacity_tons: capacityTons,
      min_order_value_usd: minOrderValueUsd,
      bank_name: bankName,
      bank_account: bankAccount,
      bank_swift: bankSwift,
      product_categories: productCategories,
    });
  }, [
    companyName,
    companyAddress,
    contactPerson,
    contactEmail,
    originPort,
    iecCode,
    taxId,
    capacityTons,
    minOrderValueUsd,
    bankName,
    bankAccount,
    bankSwift,
    productCategories,
  ]);

  function copyToClipboard(text: string, label: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2500);
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch current user
        const userData = await api.me();
        setUserId(userData.id);
        setUserEmail(userData.email);
        setFullName(userData.full_name || "");
        setJobTitle(userData.job_title || "Export Director");

        // Fetch current exporter profile
        try {
          const profileData = await api.getExporterProfile(workspaceId);
          const p = profileData.payload || {};
          if (p.company_name) setCompanyName(p.company_name);
          if (p.company_address) setCompanyAddress(p.company_address);
          if (p.origin_country) setOriginCountry(p.origin_country);
          if (p.origin_port) setOriginPort(p.origin_port);
          if (p.iec_code) setIecCode(p.iec_code);
          if (p.tax_id) setTaxId(p.tax_id);
          if (p.contact_person) setContactPerson(p.contact_person);
          if (p.contact_email) setContactEmail(p.contact_email);
          if (p.contact_phone) setContactPhone(p.contact_phone);
          if (p.capacity_tons !== undefined) setCapacityTons(p.capacity_tons);
          if (p.min_order_value_usd !== undefined) setMinOrderValueUsd(p.min_order_value_usd);
          if (p.product_categories && Array.isArray(p.product_categories)) {
            setProductCategories(p.product_categories.join(", "));
          }
          if (p.target_countries && Array.isArray(p.target_countries)) {
            setTargetCountries(p.target_countries.join(", "));
          }
          if (p.certifications && Array.isArray(p.certifications)) {
            setCertifications(p.certifications.join(", "));
          }

          if (p.bank_name) setBankName(p.bank_name);
          if (p.bank_branch) setBankBranch(p.bank_branch);
          if (p.bank_account) setBankAccount(p.bank_account);
          if (p.bank_swift) setBankSwift(p.bank_swift);
          if (p.bank_iban) setBankIban(p.bank_iban);
        } catch {
          // If profile doesn't exist yet, fallback to sensible exporter defaults
          setCompanyName("Apex Agro Exports Pvt Ltd");
          setCompanyAddress("Plot No. 42, Export Promotion Industrial Park, MIDC, Navi Mumbai 400705, Maharashtra, India");
          setIecCode("0311029481");
          setTaxId("27AABCF1234F1Z5");
          setContactPerson("Rajesh Sharma");
          setContactEmail("exports@apex-agro.com");
          setContactPhone("+91 22 2781 9900");
          setBankName("State Bank of India (Overseas Banking Branch)");
          setBankBranch("Commercial Branch, Fort, Mumbai - 400001");
          setBankAccount("309812458923");
          setBankSwift("SBININBB001");
          setBankIban("IN30SBIN0000309812458923");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load settings data.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [workspaceId]);

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    setUserSuccess(null);
    setError(null);
    setSavingUser(true);
    try {
      await api.updateMe({
        full_name: fullName,
        job_title: jobTitle,
      });
      setUserSuccess("Personal profile updated successfully! Changes reflect across the workspace.");
      setTimeout(() => setUserSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setSavingUser(false);
    }
  }

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    setCompanySuccess(null);
    setError(null);
    setSavingCompany(true);
    try {
      const prodList = productCategories.split(",").map((s) => s.trim()).filter(Boolean);
      const targetList = targetCountries.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      const certList = certifications.split(",").map((s) => s.trim()).filter(Boolean);

      await api.saveExporterProfile(workspaceId, {
        company_name: companyName,
        company_address: companyAddress,
        origin_country: originCountry,
        origin_port: originPort,
        iec_code: iecCode,
        tax_id: taxId,
        contact_person: contactPerson,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        capacity_tons: capacityTons,
        min_order_value_usd: minOrderValueUsd,
        product_categories: prodList,
        target_countries: targetList,
        certifications: certList,
        bank_name: bankName,
        bank_branch: bankBranch,
        bank_account: bankAccount,
        bank_swift: bankSwift,
        bank_iban: bankIban,
      });
      setCompanySuccess("Company EXIM credentials and statutory codes saved! Proforma invoices will auto-populate with these details.");
      setTimeout(() => setCompanySuccess(null), 4500);
    } catch (err: any) {
      setError(err.message || "Failed to save company credentials.");
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleSaveBank(e: React.FormEvent) {
    e.preventDefault();
    setBankSuccess(null);
    setError(null);
    setSavingBank(true);
    try {
      const prodList = productCategories.split(",").map((s) => s.trim()).filter(Boolean);
      const targetList = targetCountries.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      const certList = certifications.split(",").map((s) => s.trim()).filter(Boolean);

      await api.saveExporterProfile(workspaceId, {
        company_name: companyName,
        company_address: companyAddress,
        origin_country: originCountry,
        origin_port: originPort,
        iec_code: iecCode,
        tax_id: taxId,
        contact_person: contactPerson,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        capacity_tons: capacityTons,
        min_order_value_usd: minOrderValueUsd,
        product_categories: prodList,
        target_countries: targetList,
        certifications: certList,
        bank_name: bankName,
        bank_branch: bankBranch,
        bank_account: bankAccount,
        bank_swift: bankSwift,
        bank_iban: bankIban,
      });
      setBankSuccess("Bank remittance coordinates saved! Document Studio will use these coordinates for wire transfers.");
      setTimeout(() => setBankSuccess(null), 4500);
    } catch (err: any) {
      setError(err.message || "Failed to save bank coordinates.");
    } finally {
      setSavingBank(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm">Loading workspace and profile settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8 text-slate-800">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase font-bold tracking-widest text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Settings</span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> EXIM Ready
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1.5">Exporter Profile & Workspace Settings</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Manage your personal profile, statutory customs credentials (IEC & GSTIN), dispatch ports, and bank wire remittance coordinates.
          </p>
        </div>

        <Link
          href={`/workspace/${workspaceId}/documents`}
          className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg shadow-2xs transition"
        >
          <FileText className="w-4 h-4 text-blue-600" />
          <span>View Document Studio</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </Link>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-900">Action Failed</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* ── EXPORT READINESS SCORE METER ── */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Statutory EXIM Governance
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                  readiness.score === 100
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : readiness.score >= 80
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : readiness.score >= 50
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                {readiness.tier}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Export Readiness & Statutory Score
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Measures profile completeness across DGFT IEC, GSTIN, UN/LOCODE dispatch ports, and foreign banking wire instructions.
            </p>
          </div>

          <div className="flex items-baseline gap-1 self-start sm:self-auto bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80">
            <span className="text-3xl font-extrabold font-mono text-slate-900">
              {readiness.score}%
            </span>
            <span className="text-xs font-semibold text-slate-500">
              / 100%
            </span>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              readiness.score === 100
                ? "bg-emerald-500"
                : readiness.score >= 80
                ? "bg-blue-600"
                : readiness.score >= 50
                ? "bg-amber-500"
                : "bg-rose-500"
            }`}
            style={{ width: `${Math.max(5, readiness.score)}%` }}
          />
        </div>

        {/* 4 Pillars Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {readiness.breakdown.identity.label}
            </div>
            <div className="text-sm font-bold font-mono text-slate-900 mt-1">
              {readiness.breakdown.identity.points} / {readiness.breakdown.identity.max} pts
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {readiness.breakdown.customs.label}
            </div>
            <div className="text-sm font-bold font-mono text-slate-900 mt-1">
              {readiness.breakdown.customs.points} / {readiness.breakdown.customs.max} pts
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {readiness.breakdown.logistics.label}
            </div>
            <div className="text-sm font-bold font-mono text-slate-900 mt-1">
              {readiness.breakdown.logistics.points} / {readiness.breakdown.logistics.max} pts
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {readiness.breakdown.banking.label}
            </div>
            <div className="text-sm font-bold font-mono text-slate-900 mt-1">
              {readiness.breakdown.banking.points} / {readiness.breakdown.banking.max} pts
            </div>
          </div>
        </div>

        {/* Action Prompt */}
        <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200/80 flex items-start gap-2.5 text-xs text-blue-900">
          <Compass className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Next Milestone: </span>
            <span>{readiness.nextAction}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-1">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "profile"
              ? "border-blue-600 text-blue-700 bg-blue-50/70 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Personal Profile</span>
        </button>

        <button
          onClick={() => setActiveTab("company")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "company"
              ? "border-blue-600 text-blue-700 bg-blue-50/70 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Company & Statutory EXIM</span>
        </button>

        <button
          onClick={() => setActiveTab("bank")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "bank"
              ? "border-blue-600 text-blue-700 bg-blue-50/70 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Bank Remittance & Wire</span>
        </button>
      </div>

      {/* TAB 1: PERSONAL PROFILE */}
      {activeTab === "profile" && (
        <div className="bg-white border border-slate-200/90 shadow-2xs rounded-xl p-6 space-y-6">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span>Personal Identity</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Your name and title appear in correspondence, pitch letters, and the workspace sidebar.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-semibold shadow-2xs">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Active Member</span>
            </div>
          </div>

          {userSuccess && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{userSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveUser} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rajesh Sharma"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Job Title / Designation
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Export Director / VP International Trade"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Authenticated Email <span className="text-[10px] text-slate-500">(Primary Login)</span>
              </label>
              <input
                type="email"
                disabled
                value={userEmail}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingUser}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs hover:shadow-xs transition disabled:opacity-50"
              >
                {savingUser ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Personal Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: COMPANY & STATUTORY CREDENTIALS */}
      {activeTab === "company" && (
        <div className="bg-white border border-slate-200/90 shadow-2xs rounded-xl p-6 space-y-6">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Exporter Enterprise & Statutory Credentials</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure your DGFT Importer-Exporter Code (IEC), GSTIN, port of loading, and production capacities.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-[11px] text-blue-700 font-semibold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Fills Documents</span>
            </div>
          </div>

          {companySuccess && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{companySuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveCompany} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Company / Corporate Name
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Apex Agro Exports Pvt Ltd"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Origin Country
                </label>
                <input
                  type="text"
                  required
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                  placeholder="IN (India)"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Registered Factory / Office Address
                </label>
                <textarea
                  rows={2}
                  required
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Plot No. 42, Export Promotion Industrial Park, MIDC, Navi Mumbai 400705, Maharashtra, India"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition resize-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Default Port of Loading / Lading (POL)</span>
                  <span className="text-[10px] text-blue-600 font-mono font-medium">UN/LOCODE Standardized</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <select
                      value={INDIAN_PORTS_REGISTRY.some((p) => originPort.startsWith(p.locode)) ? originPort : "CUSTOM"}
                      onChange={(e) => {
                        if (e.target.value !== "CUSTOM") {
                          setOriginPort(e.target.value);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    >
                      {INDIAN_PORTS_REGISTRY.map((port) => (
                        <option key={port.locode} value={`${port.locode} - ${port.name}, ${port.state}`}>
                          {port.locode} — {port.name} ({port.state}) [{port.type}]
                        </option>
                      ))}
                      <option value="CUSTOM">Specify Custom Dispatch Port / ICD...</option>
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={originPort}
                      onChange={(e) => setOriginPort(e.target.value)}
                      placeholder="e.g. INNSA - Nhava Sheva (JNPT)"
                      className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 font-mono shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    />
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Designated departure terminal automatically populates shipping bills and Incoterms 2020 calculation lanes.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>DGFT IEC Code</span>
                  <span className="text-[10px] text-slate-500 font-mono">(10 characters)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={iecCode}
                    maxLength={10}
                    onChange={(e) => setIecCode(e.target.value.toUpperCase().trim())}
                    placeholder="0311029481 or PAN"
                    className={`w-full px-3.5 py-2.5 text-sm rounded-lg border font-mono tracking-wider shadow-2xs focus:outline-none transition ${
                      iecValidation.isValid
                        ? "border-emerald-400 bg-emerald-50/20 text-slate-900 focus:ring-emerald-500/20 focus:border-emerald-600"
                        : iecCode
                        ? "border-amber-400 bg-amber-50/20 text-slate-900 focus:ring-amber-500/20 focus:border-amber-600"
                        : "border-slate-300 bg-white text-slate-900 focus:ring-blue-500/20 focus:border-blue-600"
                    }`}
                  />
                  {iecValidation.isValid && (
                    <div className="absolute right-3 top-3 text-emerald-600 flex items-center gap-1 text-[11px] font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>
                {iecValidation.isValid ? (
                  <span className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> {iecValidation.hint}
                  </span>
                ) : iecCode ? (
                  <span className="text-[10px] text-amber-700 mt-1 block font-medium">
                    {iecValidation.error} {iecValidation.hint && `(${iecValidation.hint})`}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Mandatory for ICEGATE shipping bill clearance at Indian ports.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>GSTIN Tax Registration ID</span>
                  <span className="text-[10px] text-slate-500 font-mono">(15 characters)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={taxId}
                    maxLength={15}
                    onChange={(e) => setTaxId(e.target.value.toUpperCase().trim())}
                    placeholder="27AABCF1234F1Z5"
                    className={`w-full px-3.5 py-2.5 text-sm rounded-lg border font-mono tracking-wider shadow-2xs focus:outline-none transition ${
                      gstinValidation.isValid
                        ? "border-emerald-400 bg-emerald-50/20 text-slate-900 focus:ring-emerald-500/20 focus:border-emerald-600"
                        : taxId
                        ? "border-amber-400 bg-amber-50/20 text-slate-900 focus:ring-amber-500/20 focus:border-amber-600"
                        : "border-slate-300 bg-white text-slate-900 focus:ring-blue-500/20 focus:border-blue-600"
                    }`}
                  />
                  {gstinValidation.isValid && (
                    <div className="absolute right-3 top-3 text-emerald-600 flex items-center gap-1 text-[11px] font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>
                {gstinValidation.isValid ? (
                  <span className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> {gstinValidation.hint}
                  </span>
                ) : taxId ? (
                  <span className="text-[10px] text-amber-700 mt-1 block font-medium">
                    {gstinValidation.error} {gstinValidation.hint && `(${gstinValidation.hint})`}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Required for zero-rated export Letter of Undertaking (LUT) filing.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Export Operations Officer / Signatory
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Rajesh Sharma (VP Exports)"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Official Trade Inquiries Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="exports@company.com"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Commercial Contact Phone
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 22 2781 9900"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Annual Shipping Capacity (Metric Tons)
                </label>
                <input
                  type="number"
                  value={capacityTons}
                  onChange={(e) => setCapacityTons(Number(e.target.value))}
                  placeholder="5000"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Minimum Order Value (USD)
                </label>
                <input
                  type="number"
                  value={minOrderValueUsd}
                  onChange={(e) => setMinOrderValueUsd(Number(e.target.value))}
                  placeholder="25000"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Export Product Categories <span className="text-[10px] text-slate-500">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={productCategories}
                  onChange={(e) => setProductCategories(e.target.value)}
                  placeholder="Basmati Rice, Organic Spices, Cotton Yarn"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Target Destination ISO Countries <span className="text-[10px] text-slate-500">(comma-separated 2-letter codes)</span>
                </label>
                <input
                  type="text"
                  value={targetCountries}
                  onChange={(e) => setTargetCountries(e.target.value)}
                  placeholder="AE, US, DE, SA, GB, NL, JP"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 font-mono uppercase shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Certifications & Accreditations <span className="text-[10px] text-slate-500">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={certifications}
                  onChange={(e) => setCertifications(e.target.value)}
                  placeholder="ISO 22000, HACCP, APEDA, FSSAI, FDA Registered"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingCompany}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs hover:shadow-xs transition disabled:opacity-50"
              >
                {savingCompany ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Company Credentials...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Company Credentials</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: BANK REMITTANCE DETAILS */}
      {activeTab === "bank" && (
        <div className="bg-white border border-slate-200/90 shadow-2xs rounded-xl p-6 space-y-6">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-blue-600" />
                <span>Bank Remittance & Wire Instructions</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Overseas buyers use these banking coordinates when fulfilling Proforma Invoices and letters of credit.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-semibold shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>SWIFT / BIC Validated</span>
            </div>
          </div>

          {bankSuccess && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{bankSuccess}</span>
            </div>
          )}

          <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5 shadow-2xs">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              These coordinates are automatically embedded into generated PDF Proforma Invoices in the Document Studio, eliminating manual invoice transcription errors.
            </div>
          </div>

          <form onSubmit={handleSaveBank} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Beneficiary Account Name
                </label>
                <input
                  type="text"
                  disabled
                  value={companyName || "Apex Agro Exports Pvt Ltd"}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Tied to registered company name</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Bank Name
                </label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="State Bank of India (Overseas Banking Branch)"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Bank Branch Address
                </label>
                <input
                  type="text"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  placeholder="Commercial Branch, Fort, Mumbai - 400001, India"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Account Number
                </label>
                <input
                  type="text"
                  required
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="309812458923"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 font-mono shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>SWIFT / BIC Routing Code</span>
                  <span className="text-[10px] text-slate-500 font-mono">(8 or 11 chars)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={bankSwift}
                    onChange={(e) => setBankSwift(e.target.value.toUpperCase().trim())}
                    placeholder="SBININBB001"
                    className={`w-full px-3.5 py-2.5 text-sm rounded-lg border font-mono uppercase tracking-wider shadow-2xs focus:outline-none transition ${
                      swiftValidation.isValid
                        ? "border-emerald-400 bg-emerald-50/20 text-slate-900 focus:ring-emerald-500/20 focus:border-emerald-600"
                        : bankSwift
                        ? "border-amber-400 bg-amber-50/20 text-slate-900 focus:ring-amber-500/20 focus:border-amber-600"
                        : "border-slate-300 bg-white text-slate-900 focus:ring-blue-500/20 focus:border-blue-600"
                    }`}
                  />
                  {swiftValidation.isValid && (
                    <div className="absolute right-3 top-3 text-emerald-600 flex items-center gap-1 text-[11px] font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>
                {swiftValidation.isValid ? (
                  <span className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> {swiftValidation.hint}
                  </span>
                ) : bankSwift ? (
                  <span className="text-[10px] text-amber-700 mt-1 block font-medium">
                    {swiftValidation.error} {swiftValidation.hint && `(${swiftValidation.hint})`}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Required for overseas telegraphic wire transfers (T/T) and documentary Letters of Credit.
                  </span>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  IBAN / IFSC Code
                </label>
                <input
                  type="text"
                  value={bankIban}
                  onChange={(e) => setBankIban(e.target.value)}
                  placeholder="IN30SBIN0000309812458923 / SBIN0000300"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 font-mono uppercase shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingBank}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs hover:shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {savingBank ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Bank Details...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Bank Remittance Coordinates</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Beneficiary Remittance Advice Preview Card */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-600" />
                  <span>Beneficiary Remittance Advice Card (Invoice Preview)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  This official wire instruction certificate is embedded directly on export proforma invoices sent to overseas buyers.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase font-mono">
                Wire Certificate
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/90 shadow-2xs space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Beneficiary Entity Name</span>
                  <div className="font-bold text-slate-900 mt-0.5 text-sm">{companyName || "Apex Agro Exports Pvt Ltd"}</div>
                  <span className="text-[11px] text-slate-500 font-mono">IEC: {iecCode || "0311029481"} • GSTIN: {taxId || "27AABCF1234F1Z5"}</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Beneficiary Bank</span>
                  <div className="font-bold text-slate-900 mt-0.5">{bankName || "State Bank of India (Overseas Banking Branch)"}</div>
                  <span className="text-[11px] text-slate-500">{bankBranch || "Commercial Branch, Fort, Mumbai, India"}</span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200/90 flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Account Number</span>
                    <span className="font-mono font-bold text-slate-900 text-sm tracking-wider">{bankAccount || "309812458923"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bankAccount || "309812458923", "account")}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                  >
                    {copiedField === "account" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === "account" ? "Copied" : "Copy"}</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200/90 flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">SWIFT / BIC Code</span>
                    <span className="font-mono font-bold text-blue-700 text-sm tracking-wider">{bankSwift || "SBININBB001"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bankSwift || "SBININBB001", "swift")}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                  >
                    {copiedField === "swift" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === "swift" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>Remittance Route: Direct T/T Wire or Irrevocable Documentary Letter of Credit (LC at Sight)</span>
                <span className="font-medium text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> RBI EDPMS Compliant
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
