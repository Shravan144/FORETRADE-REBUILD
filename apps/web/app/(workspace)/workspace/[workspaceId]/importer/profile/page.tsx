"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ImporterProfile } from "@/lib/api";
import {
  ShieldCheck,
  Building2,
  Anchor,
  Ship,
  Boxes,
  FileCheck2,
  CreditCard,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowLeft,
  Info,
  Globe2,
} from "lucide-react";

const COMMON_DISCHARGE_PORTS = [
  { code: "USLAX", name: "Port of Los Angeles (US)" },
  { code: "USNYC", name: "Port of New York / New Jersey (US)" },
  { code: "DEHAM", name: "Port of Hamburg (DE)" },
  { code: "NLRTM", name: "Port of Rotterdam (NL)" },
  { code: "GBFXT", name: "Port of Felixstowe (GB)" },
  { code: "AEJEA", name: "Jebel Ali Port, Dubai (AE)" },
  { code: "AUMEL", name: "Port of Melbourne (AU)" },
  { code: "JPTYO", name: "Port of Tokyo (JP)" },
  { code: "SGSIN", name: "Port of Singapore (SG)" },
];

const SECTORS = [
  "Textiles & Garments",
  "Spices & Agricultural Products",
  "Renewable Energy & Solar",
  "Engineering & Machinery",
  "Pharmaceuticals & Active Ingredients",
  "Chemicals & Petrochemicals",
  "Leather Goods & Footwear",
  "Electronics & Precision Hardware",
  "Automotive Parts",
];

const CERT_OPTIONS = [
  "ISO 9001:2015",
  "ISO 14001",
  "ISO 22000 / HACCP",
  "CE Conformité",
  "FDA Food Facility Registered",
  "OEKO-TEX Standard 100",
  "GOTS Organic Textile",
  "BRCGS Global Food Standard",
  "WRAP Certified",
  "SEDEX / SMETA Audited",
];

export default function ImporterProfilePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [companyName, setCompanyName] = useState("");
  const [tradeNameDba, setTradeNameDba] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [city, setCity] = useState("Los Angeles");
  const [headquartersAddress, setHeadquartersAddress] = useState("");
  const [corporateWebsite, setCorporateWebsite] = useState("");
  const [dunsNumber, setDunsNumber] = useState("");

  // Statutory Tax Credentials
  const [taxIdentifierType, setTaxIdentifierType] = useState("EIN");
  const [taxIdentifierValue, setTaxIdentifierValue] = useState("");

  // Contact
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("Global Sourcing Director");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Port & Logistics
  const [primaryDischargePort, setPrimaryDischargePort] = useState("USLAX");
  const [secondaryDischargePort, setSecondaryDischargePort] = useState("");
  const [customsBrokerName, setCustomsBrokerName] = useState("");
  const [preferredContainerType, setPreferredContainerType] = useState("40ft_hc");
  const [warehouseDockType, setWarehouseDockType] = useState("palletized_forklift");
  const [consigneeNameOnBol, setConsigneeNameOnBol] = useState("");

  // Procurement & Commodities
  const [primarySector, setPrimarySector] = useState("Textiles & Garments");
  const [targetHsCodesInput, setTargetHsCodesInput] = useState("6109.10, 6205.20, 5208.11");
  const [annualSourcingBudgetUsd, setAnnualSourcingBudgetUsd] = useState(5000000);
  const [orderCycleDays, setOrderCycleDays] = useState(30);
  const [minOrderQuantityMt, setMinOrderQuantityMt] = useState(20);

  // Financial & Commercial Terms
  const [preferredIncoterm, setPreferredIncoterm] = useState("CIF");
  const [paymentTerms, setPaymentTerms] = useState("letter_of_credit");
  const [issuingBankName, setIssuingBankName] = useState("JPMorgan Chase Bank, N.A.");
  const [issuingBankSwift, setIssuingBankSwift] = useState("CHASUS33");
  const [currency, setCurrency] = useState("USD");
  const [selectedCerts, setSelectedCerts] = useState<string[]>(["ISO 9001:2015", "OEKO-TEX Standard 100"]);
  const [isPubliclyDiscoverable, setIsPubliclyDiscoverable] = useState(true);

  // Auto-adjust tax type helper when country changes
  useEffect(() => {
    if (countryCode === "US") setTaxIdentifierType("EIN");
    else if (["DE", "FR", "NL", "IT", "ES", "BE", "PL"].includes(countryCode)) setTaxIdentifierType("EORI");
    else if (countryCode === "GB") setTaxIdentifierType("UK_EORI");
    else if (countryCode === "AE") setTaxIdentifierType("TRN");
    else if (countryCode === "AU") setTaxIdentifierType("ABN");
  }, [countryCode]);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const p = await api.getImporterProfile(workspaceId);
        if (p) {
          setCompanyName(p.company_name || "");
          setTradeNameDba(p.trade_name_dba || "");
          setCountryCode(p.country_code || "US");
          setCity(p.city || "");
          setHeadquartersAddress(p.headquarters_address || "");
          setCorporateWebsite(p.corporate_website || "");
          setDunsNumber(p.duns_number || "");
          setTaxIdentifierType(p.tax_identifier_type || "EIN");
          setTaxIdentifierValue(p.tax_identifier_value || "");

          setContactName(p.contact_name || "");
          setContactTitle(p.contact_title || "Global Sourcing Director");
          setContactEmail(p.contact_email || "");
          setContactPhone(p.contact_phone || "");

          setPrimaryDischargePort(p.primary_discharge_port || "USLAX");
          setSecondaryDischargePort(p.secondary_discharge_port || "");
          setCustomsBrokerName(p.customs_broker_name || "");
          setPreferredContainerType(p.preferred_container_type || "40ft_hc");
          setWarehouseDockType(p.warehouse_dock_type || "palletized_forklift");
          setConsigneeNameOnBol(p.consignee_name_on_bol || "");

          setPrimarySector(p.primary_sector || "Textiles & Garments");
          setTargetHsCodesInput((p.target_hs_codes || []).join(", "));
          setAnnualSourcingBudgetUsd(p.annual_sourcing_budget_usd || 5000000);
          setOrderCycleDays(p.order_cycle_days || 30);
          setMinOrderQuantityMt(p.min_order_quantity_mt || 20);

          setPreferredIncoterm(p.preferred_incoterm || "CIF");
          setPaymentTerms(p.payment_terms || "letter_of_credit");
          setIssuingBankName(p.issuing_bank_name || "");
          setIssuingBankSwift(p.issuing_bank_swift || "");
          setCurrency(p.currency || "USD");
          setSelectedCerts(p.required_certifications || []);
          setIsPubliclyDiscoverable(p.is_publicly_discoverable ?? true);
        }
      } catch (err: any) {
        // If 404, that's fine - new profile creation mode
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [workspaceId]);

  function toggleCert(cert: string) {
    if (selectedCerts.includes(cert)) {
      setSelectedCerts(selectedCerts.filter((c) => c !== cert));
    } else {
      setSelectedCerts([...selectedCerts, cert]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!companyName.trim()) {
      setErrorMsg("Company legal name is required.");
      return;
    }
    if (!taxIdentifierValue.trim()) {
      setErrorMsg(`Statutory ${taxIdentifierType} credential is required.`);
      return;
    }
    if (!contactName.trim() || !contactEmail.trim()) {
      setErrorMsg("Contact procurement officer name and email are required.");
      return;
    }

    try {
      setSaving(true);
      const hsCodes = targetHsCodesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: Partial<ImporterProfile> = {
        company_name: companyName.trim(),
        trade_name_dba: tradeNameDba.trim() || null,
        country_code: countryCode.trim().toUpperCase(),
        city: city.trim(),
        headquarters_address: headquartersAddress.trim() || null,
        corporate_website: corporateWebsite.trim() || null,
        duns_number: dunsNumber.trim() || null,
        tax_identifier_type: taxIdentifierType,
        tax_identifier_value: taxIdentifierValue.trim(),
        contact_name: contactName.trim(),
        contact_title: contactTitle.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim() || null,
        primary_discharge_port: primaryDischargePort.trim().toUpperCase(),
        secondary_discharge_port: secondaryDischargePort.trim().toUpperCase() || null,
        customs_broker_name: customsBrokerName.trim() || null,
        preferred_container_type: preferredContainerType,
        warehouse_dock_type: warehouseDockType,
        primary_sector: primarySector,
        target_hs_codes: hsCodes,
        annual_sourcing_budget_usd: Number(annualSourcingBudgetUsd),
        order_cycle_days: Number(orderCycleDays),
        min_order_quantity_mt: Number(minOrderQuantityMt),
        consignee_name_on_bol: consigneeNameOnBol.trim() || companyName.trim(),
        required_certifications: selectedCerts,
        preferred_incoterm: preferredIncoterm,
        payment_terms: paymentTerms,
        issuing_bank_name: issuingBankName.trim() || null,
        issuing_bank_swift: issuingBankSwift.trim().toUpperCase() || null,
        currency,
        is_publicly_discoverable: isPubliclyDiscoverable,
      };

      await api.saveImporterProfile(workspaceId, payload);
      setSuccessMsg("Importer Procurement Dossier registered and synced with ForeTrade Network!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save importer profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-500 min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="text-sm font-medium">Loading Importer Profile...</span>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Navigation Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href={`/workspace/${workspaceId}/importer`}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                Statutory Procurement Dossier
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Importer Profile & Customs Identification
            </h1>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition flex items-center gap-2 cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? "Saving..." : "Save Dossier"}</span>
        </button>
      </div>

      {/* Success / Error Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2.5 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Info Callout */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-3">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>International Verification Standard:</strong> ForeTrade uses your statutory corporate credentials (EIN/EORI/TRN/ABN) to automatically link your profile into the Buyer Catalog and certify your purchase requirements for Indian manufacturers and customs documentation.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Legal Entity & Corporate Identity */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Legal Entity & Corporate Identity</h2>
              <p className="text-[11px] text-slate-400">Official registered corporate details for commercial invoices</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Legal Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Pacific Sourcing Logistics LLC"
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Trade Name / DBA (Optional)
              </label>
              <input
                type="text"
                value={tradeNameDba}
                onChange={(e) => setTradeNameDba(e.target.value)}
                placeholder="e.g., Pacific Global Trade"
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jurisdiction Country <span className="text-rose-500">*</span>
              </label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="US">🇺🇸 United States (US)</option>
                <option value="DE">🇩🇪 Germany (DE)</option>
                <option value="GB">🇬🇧 United Kingdom (GB)</option>
                <option value="AE">🇦🇪 United Arab Emirates (AE)</option>
                <option value="AU">🇦🇺 Australia (AU)</option>
                <option value="NL">🇳🇱 Netherlands (NL)</option>
                <option value="FR">🇫🇷 France (FR)</option>
                <option value="JP">🇯🇵 Japan (JP)</option>
                <option value="SG">🇸🇬 Singapore (SG)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                City <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g., Los Angeles"
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Corporate Website
              </label>
              <input
                type="url"
                value={corporateWebsite}
                onChange={(e) => setCorporateWebsite(e.target.value)}
                placeholder="https://www.pacificsourcing.com"
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                D-U-N-S Number (9 Digits)
              </label>
              <input
                type="text"
                value={dunsNumber}
                onChange={(e) => setDunsNumber(e.target.value)}
                placeholder="e.g., 123456789"
                maxLength={9}
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Statutory Tax & Customs Credentials */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Statutory Customs & Tax Credentials</h2>
              <p className="text-[11px] text-slate-400">Strictly verified international corporate customs identifier</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Credential Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={taxIdentifierType}
                onChange={(e) => setTaxIdentifierType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="EIN">US IRS EIN (Employer Identification Number)</option>
                <option value="EORI">EU EORI (Economic Operators Registration)</option>
                <option value="UK_EORI">UK EORI (GB + 12 Digits)</option>
                <option value="TRN">UAE TRN (Tax Registration Number - 15 Digits)</option>
                <option value="ABN">Australian ABN (11 Digits)</option>
                <option value="OTHER">Other National Customs Registration</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tax Identifier Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={taxIdentifierValue}
                onChange={(e) => setTaxIdentifierValue(e.target.value)}
                placeholder={
                  taxIdentifierType === "EIN"
                    ? "12-3456789"
                    : taxIdentifierType === "EORI"
                    ? "DE123456789012"
                    : taxIdentifierType === "TRN"
                    ? "100123456789012"
                    : "Official ID"
                }
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Format: {taxIdentifierType === "EIN" ? "9 numeric digits (e.g. 12-3456789)" : taxIdentifierType === "EORI" ? "2-letter country code + 8-15 chars (e.g. DE123456789012)" : taxIdentifierType === "TRN" ? "15 digits (e.g. 100123456789012)" : "Valid national identification code"}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Primary Discharge Port & Freight Logistics */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Anchor className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Maritime Discharge Ports & Freight Constraints</h2>
              <p className="text-[11px] text-slate-400">UN/LOCODE port destinations and container handling preferences</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Primary Discharge Port (UN/LOCODE) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={primaryDischargePort}
                onChange={(e) => setPrimaryDischargePort(e.target.value.toUpperCase())}
                placeholder="USLAX"
                maxLength={10}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                required
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {COMMON_DISCHARGE_PORTS.slice(0, 4).map((p) => (
                  <button
                    type="button"
                    key={p.code}
                    onClick={() => setPrimaryDischargePort(p.code)}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-200 cursor-pointer"
                  >
                    {p.code}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Secondary Discharge Port (Optional)
              </label>
              <input
                type="text"
                value={secondaryDischargePort}
                onChange={(e) => setSecondaryDischargePort(e.target.value.toUpperCase())}
                placeholder="USNYC"
                maxLength={10}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Preferred Container Specification
              </label>
              <select
                value={preferredContainerType}
                onChange={(e) => setPreferredContainerType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="40ft_hc">40ft High Cube (76 CBM / 28 MT)</option>
                <option value="40ft_fcl">40ft Standard FCL (67 CBM / 26 MT)</option>
                <option value="20ft_fcl">20ft Heavy FCL (33 CBM / 21 MT)</option>
                <option value="reefer">40ft Temperature-Controlled Reefer</option>
                <option value="open_top">40ft Open Top (Heavy Machinery)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Customs Brokerage Firm (Optional)
              </label>
              <input
                type="text"
                value={customsBrokerName}
                onChange={(e) => setCustomsBrokerName(e.target.value)}
                placeholder="e.g., Expeditors International / Flexport"
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Warehouse Unloading Dock
              </label>
              <select
                value={warehouseDockType}
                onChange={(e) => setWarehouseDockType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="palletized_forklift">Palletized Forklift Direct Dock</option>
                <option value="dock_leveler">Hydraulic Dock Leveler</option>
                <option value="ground_ramp">Ground Level Ramp / Manual Unload</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bill of Lading Consignee Name
              </label>
              <input
                type="text"
                value={consigneeNameOnBol}
                onChange={(e) => setConsigneeNameOnBol(e.target.value)}
                placeholder={companyName || "Consignee Legal Name"}
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Procurement Budget & Commodity Targets */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Boxes className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Procurement Budget & Commodity Specifications</h2>
              <p className="text-[11px] text-slate-400">Target HS Codes, purchase volume, and reorder frequency</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Primary Product Sector <span className="text-rose-500">*</span>
              </label>
              <select
                value={primarySector}
                onChange={(e) => setPrimarySector(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target HS Codes (Comma-separated)
              </label>
              <input
                type="text"
                value={targetHsCodesInput}
                onChange={(e) => setTargetHsCodesInput(e.target.value)}
                placeholder="6109.10, 6205.20, 5208.11"
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Annual Sourcing Budget (USD)
              </label>
              <input
                type="number"
                value={annualSourcingBudgetUsd}
                onChange={(e) => setAnnualSourcingBudgetUsd(Number(e.target.value))}
                min={10000}
                step={50000}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reorder Cycle (Days)
              </label>
              <input
                type="number"
                value={orderCycleDays}
                onChange={(e) => setOrderCycleDays(Number(e.target.value))}
                min={5}
                max={365}
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Min Order Quantity (MT)
              </label>
              <input
                type="number"
                value={minOrderQuantityMt}
                onChange={(e) => setMinOrderQuantityMt(Number(e.target.value))}
                min={0.5}
                step={1}
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Trade Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-bold font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AED">AED (د.إ)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 5: Commercial Terms & Trade Finance */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Commercial Terms & Trade Finance</h2>
              <p className="text-[11px] text-slate-400">Incoterms, payment security, and issuing bank SWIFT code</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Preferred Incoterms 2020
              </label>
              <select
                value={preferredIncoterm}
                onChange={(e) => setPreferredIncoterm(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-bold font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                <option value="FOB">FOB (Free on Board Origin Port)</option>
                <option value="CFR">CFR (Cost & Freight)</option>
                <option value="DDP">DDP (Delivered Duty Paid)</option>
                <option value="FCA">FCA (Free Carrier)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Mechanism
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="letter_of_credit">Irrevocable LC at Sight (Bank Guarantee)</option>
                <option value="telegraphic_transfer_30_70">TT 30% Advance / 70% against BL</option>
                <option value="cad">Cash Against Documents (CAD)</option>
                <option value="open_account_60">Open Account 60 Days (Credit Insured)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Issuing Bank Name
              </label>
              <input
                type="text"
                value={issuingBankName}
                onChange={(e) => setIssuingBankName(e.target.value)}
                placeholder="e.g., JPMorgan Chase / HSBC"
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Issuing Bank SWIFT / BIC Code
              </label>
              <input
                type="text"
                value={issuingBankSwift}
                onChange={(e) => setIssuingBankSwift(e.target.value.toUpperCase())}
                placeholder="CHASUS33"
                maxLength={11}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Section 6: Quality & Mandatory Certifications */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <FileCheck2 className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Mandatory Quality & Factory Certifications</h2>
              <p className="text-[11px] text-slate-400">Only suppliers meeting these standards will match with your tenders</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {CERT_OPTIONS.map((c) => {
              const checked = selectedCerts.includes(c);
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => toggleCert(c)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center justify-between cursor-pointer ${
                    checked
                      ? "bg-indigo-50 border-indigo-300 text-indigo-800 shadow-2xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="truncate pr-1">{c}</span>
                  {checked && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 7: Procurement Officer Contact */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Globe2 className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Procurement Officer Direct Point of Contact</h2>
              <p className="text-[11px] text-slate-400">Direct contact credentials for inbound factory inquiries and quotes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contact Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g., Marcus Vance"
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Title
              </label>
              <input
                type="text"
                value={contactTitle}
                onChange={(e) => setContactTitle(e.target.value)}
                placeholder="Global Sourcing Director"
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contact Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="sourcing@pacificsourcing.com"
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Direct Phone / WhatsApp
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+1 213 555 0199"
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={isPubliclyDiscoverable}
              onChange={(e) => setIsPubliclyDiscoverable(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300"
            />
            <span>Discoverable to verified Indian manufacturers in Global Buyer Directory</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition flex items-center gap-2 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? "Saving..." : "Save & Verify Dossier"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
