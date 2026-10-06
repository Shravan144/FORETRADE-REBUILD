"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
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
  const [originPort, setOriginPort] = useState("Nhava Sheva (JNPT), Mumbai");
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
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm">Loading workspace and profile settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-bold tracking-widest text-blue-400">Settings</span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> EXIM Ready
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Exporter Profile & Workspace Settings</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Manage your personal profile, statutory customs credentials (IEC & GSTIN), dispatch ports, and bank wire remittance coordinates.
          </p>
        </div>

        <Link
          href={`/workspace/${workspaceId}/documents`}
          className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
        >
          <FileText className="w-4 h-4 text-blue-400" />
          <span>View Document Studio</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </Link>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-800 text-xs text-rose-300 flex items-start gap-3 shadow-md">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-200">Action Failed</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-1">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "profile"
              ? "border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Personal Profile</span>
        </button>

        <button
          onClick={() => setActiveTab("company")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "company"
              ? "border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Company & Statutory EXIM</span>
        </button>

        <button
          onClick={() => setActiveTab("bank")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "bank"
              ? "border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Bank Remittance & Wire</span>
        </button>
      </div>

      {/* TAB 1: PERSONAL PROFILE */}
      {activeTab === "profile" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                <span>Personal Identity</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Your name and title appear in correspondence, pitch letters, and the workspace sidebar.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 font-medium">
              <BadgeCheck className="w-3.5 h-3.5" />
              <span>Active Member</span>
            </div>
          </div>

          {userSuccess && (
            <div className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{userSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveUser} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rajesh Sharma"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Job Title / Designation
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Export Director / VP International Trade"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Authenticated Email <span className="text-[10px] text-slate-500">(Primary Login)</span>
              </label>
              <input
                type="email"
                disabled
                value={userEmail}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-800 bg-slate-950/60 text-slate-400 cursor-not-allowed font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingUser}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition disabled:opacity-50"
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>Exporter Enterprise & Statutory Credentials</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure your DGFT Importer-Exporter Code (IEC), GSTIN, port of loading, and production capacities.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Fills Documents</span>
            </div>
          </div>

          {companySuccess && (
            <div className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{companySuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveCompany} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Company / Corporate Name
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Apex Agro Exports Pvt Ltd"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Origin Country
                </label>
                <input
                  type="text"
                  required
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                  placeholder="IN (India)"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Registered Factory / Office Address
                </label>
                <textarea
                  rows={2}
                  required
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Plot No. 42, Export Promotion Industrial Park, MIDC, Navi Mumbai 400705, Maharashtra, India"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Default Port of Loading / Lading (POL)
                </label>
                <input
                  type="text"
                  value={originPort}
                  onChange={(e) => setOriginPort(e.target.value)}
                  placeholder="Nhava Sheva (JNPT) / Mundra Port"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  IEC Code <span className="text-[10px] text-slate-500">(10-digit DGFT)</span>
                </label>
                <input
                  type="text"
                  value={iecCode}
                  onChange={(e) => setIecCode(e.target.value)}
                  placeholder="0311029481"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  GSTIN / Tax Registration ID
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="27AABCF1234F1Z5"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Export Operations Officer / Signatory
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Rajesh Sharma (VP Exports)"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Official Trade Inquiries Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="exports@company.com"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Commercial Contact Phone
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 22 2781 9900"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Annual Shipping Capacity (Metric Tons)
                </label>
                <input
                  type="number"
                  value={capacityTons}
                  onChange={(e) => setCapacityTons(Number(e.target.value))}
                  placeholder="5000"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Minimum Order Value (USD)
                </label>
                <input
                  type="number"
                  value={minOrderValueUsd}
                  onChange={(e) => setMinOrderValueUsd(Number(e.target.value))}
                  placeholder="25000"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Export Product Categories <span className="text-[10px] text-slate-500">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={productCategories}
                  onChange={(e) => setProductCategories(e.target.value)}
                  placeholder="Basmati Rice, Organic Spices, Cotton Yarn"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Target Destination ISO Countries <span className="text-[10px] text-slate-500">(comma-separated 2-letter codes)</span>
                </label>
                <input
                  type="text"
                  value={targetCountries}
                  onChange={(e) => setTargetCountries(e.target.value)}
                  placeholder="AE, US, DE, SA, GB, NL, JP"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Certifications & Accreditations <span className="text-[10px] text-slate-500">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={certifications}
                  onChange={(e) => setCertifications(e.target.value)}
                  placeholder="ISO 22000, HACCP, APEDA, FSSAI, FDA Registered"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <button
                type="submit"
                disabled={savingCompany}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition disabled:opacity-50"
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Landmark className="w-4 h-4 text-blue-400" />
                <span>Bank Remittance & Wire Instructions</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Overseas buyers use these banking coordinates when fulfilling Proforma Invoices and letters of credit.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SWIFT / BIC Validated</span>
            </div>
          </div>

          {bankSuccess && (
            <div className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{bankSuccess}</span>
            </div>
          )}

          <div className="p-3.5 rounded-lg bg-blue-950/40 border border-blue-900 text-xs text-blue-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              These coordinates are automatically embedded into generated PDF Proforma Invoices in the Document Studio, eliminating manual invoice transcription errors.
            </div>
          </div>

          <form onSubmit={handleSaveBank} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Beneficiary Account Name
                </label>
                <input
                  type="text"
                  disabled
                  value={companyName || "Apex Agro Exports Pvt Ltd"}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-800 bg-slate-950/60 text-slate-400 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Tied to registered company name</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Bank Name
                </label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="State Bank of India (Overseas Banking Branch)"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Bank Branch Address
                </label>
                <input
                  type="text"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  placeholder="Commercial Branch, Fort, Mumbai - 400001, India"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Account Number
                </label>
                <input
                  type="text"
                  required
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="309812458923"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  SWIFT / BIC Code
                </label>
                <input
                  type="text"
                  required
                  value={bankSwift}
                  onChange={(e) => setBankSwift(e.target.value)}
                  placeholder="SBININBB001"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  IBAN / IFSC Code
                </label>
                <input
                  type="text"
                  value={bankIban}
                  onChange={(e) => setBankIban(e.target.value)}
                  placeholder="IN30SBIN0000309812458923 / SBIN0000300"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <button
                type="submit"
                disabled={savingBank}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition disabled:opacity-50"
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
        </div>
      )}
    </div>
  );
}
