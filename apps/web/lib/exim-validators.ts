/**
 * ForeTrade EXIM Statutory Validators & UNECE Port Registry
 * Provides live format validation for DGFT IEC, GSTIN, SWIFT/BIC,
 * standardized UN/LOCODE port selections, and Export Readiness scoring.
 */

export interface EximPort {
  locode: string;
  name: string;
  terminal: string;
  state: string;
  type: "Sea Port" | "Inland Container Depot (ICD)" | "Air Cargo";
}

export const INDIAN_PORTS_REGISTRY: EximPort[] = [
  {
    locode: "INNSA",
    name: "Nhava Sheva (JNPT)",
    terminal: "Jawaharlal Nehru Port Container Terminal / APM / DP World",
    state: "Maharashtra",
    type: "Sea Port",
  },
  {
    locode: "INMUN",
    name: "Mundra Port",
    terminal: "Adani Ports & Special Economic Zone (APSEZ)",
    state: "Gujarat",
    type: "Sea Port",
  },
  {
    locode: "INMAA",
    name: "Chennai Port",
    terminal: "Chennai Container Terminal (DP World) / CITPL",
    state: "Tamil Nadu",
    type: "Sea Port",
  },
  {
    locode: "INCOK",
    name: "Cochin (Vallarpadam)",
    terminal: "International Container Transshipment Terminal (ICTT)",
    state: "Kerala",
    type: "Sea Port",
  },
  {
    locode: "INCCU",
    name: "Kolkata / Haldia",
    terminal: "Syama Prasad Mookerjee Port Authority",
    state: "West Bengal",
    type: "Sea Port",
  },
  {
    locode: "INTUT",
    name: "Tuticorin (V.O.C.)",
    terminal: "V.O. Chidambaranar Port Trust / Dakshin Bharat Gateway",
    state: "Tamil Nadu",
    type: "Sea Port",
  },
  {
    locode: "INPAV",
    name: "Pipavav Port",
    terminal: "APM Terminals Pipavav",
    state: "Gujarat",
    type: "Sea Port",
  },
  {
    locode: "INIXY",
    name: "Kandla (Deendayal)",
    terminal: "Deendayal Port Authority Container Terminal",
    state: "Gujarat",
    type: "Sea Port",
  },
  {
    locode: "INVTZ",
    name: "Visakhapatnam Port",
    terminal: "Visakha Container Terminal (VCTPL)",
    state: "Andhra Pradesh",
    type: "Sea Port",
  },
  {
    locode: "INDEL",
    name: "ICD Tughlakabad (TKD), New Delhi",
    terminal: "CONCOR Inland Container Depot (Rail Linked)",
    state: "Delhi NCR",
    type: "Inland Container Depot (ICD)",
  },
  {
    locode: "INBLR",
    name: "ICD Whitefield, Bengaluru",
    terminal: "CONCOR South Western Container Freight Station",
    state: "Karnataka",
    type: "Inland Container Depot (ICD)",
  },
  {
    locode: "INHYD",
    name: "ICD Sanathnagar, Hyderabad",
    terminal: "CONCOR Central Railway Transit Yard",
    state: "Telangana",
    type: "Inland Container Depot (ICD)",
  },
];

// ── STATUTORY FORMAT VALIDATORS ──

export interface ValidationResult {
  isValid: boolean;
  formatted: string;
  error?: string;
  hint?: string;
}

/**
 * Validates DGFT Importer-Exporter Code (IEC).
 * Standardized 10-character alphanumeric (matching entity PAN under current DGFT rules).
 */
export function validateIEC(raw: string): ValidationResult {
  const clean = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) {
    return {
      isValid: false,
      formatted: "",
      error: "IEC code is required for customs shipping bill filing.",
    };
  }

  const iecRegex = /^[A-Z0-9]{10}$/;
  if (clean.length < 10) {
    return {
      isValid: false,
      formatted: clean,
      error: `IEC code must be 10 characters (${clean.length}/10 entered).`,
      hint: "Enter your 10-character DGFT registration or business PAN.",
    };
  }

  if (clean.length > 10) {
    return {
      isValid: false,
      formatted: clean.slice(0, 10),
      error: "IEC code cannot exceed 10 characters.",
    };
  }

  if (!iecRegex.test(clean)) {
    return {
      isValid: false,
      formatted: clean,
      error: "IEC must contain only alphanumeric characters.",
    };
  }

  return {
    isValid: true,
    formatted: clean,
    hint: "Valid DGFT Importer-Exporter Code format.",
  };
}

/**
 * Validates Indian Goods & Services Tax Identification Number (GSTIN).
 * Format: 2 digits (State) + 10 chars (PAN) + 1 digit (Entity) + 'Z' + 1 check digit = 15 chars.
 */
export function validateGSTIN(raw: string): ValidationResult {
  const clean = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) {
    return {
      isValid: false,
      formatted: "",
      error: "GSTIN is required for export Letter of Undertaking (LUT) zero-tax shipping.",
    };
  }

  if (clean.length < 15) {
    return {
      isValid: false,
      formatted: clean,
      error: `GSTIN must be 15 characters (${clean.length}/15 entered).`,
      hint: "Format: 27AABCF1234F1Z5 (State + PAN + Entity + Z + Check)",
    };
  }

  if (clean.length > 15) {
    return {
      isValid: false,
      formatted: clean.slice(0, 15),
      error: "GSTIN cannot exceed 15 characters.",
    };
  }

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(clean)) {
    return {
      isValid: false,
      formatted: clean,
      error: "Invalid GSTIN format structure (e.g., 27AABCF1234F1Z5).",
      hint: "Check state code prefix and default 'Z' in 14th position.",
    };
  }

  return {
    isValid: true,
    formatted: clean,
    hint: "Verified GSTIN structure for export LUT filing.",
  };
}

/**
 * Validates international SWIFT / BIC banking wire code.
 * Format: 8 or 11 characters (4 letters bank + 2 letters country + 2 alphanumeric location + optional 3 branch).
 */
export function validateSWIFT(raw: string): ValidationResult {
  const clean = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) {
    return {
      isValid: false,
      formatted: "",
      error: "SWIFT/BIC code is required for overseas advance wire payments and LC issuance.",
    };
  }

  if (clean.length !== 8 && clean.length !== 11) {
    return {
      isValid: false,
      formatted: clean,
      error: `SWIFT/BIC must be 8 or 11 characters (${clean.length} entered).`,
      hint: "e.g., HDFCINBB or HDFCINBBDEL",
    };
  }

  const swiftRegex = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
  if (!swiftRegex.test(clean)) {
    return {
      isValid: false,
      formatted: clean,
      error: "Invalid SWIFT/BIC structure. First 6 characters must be letters (Bank + Country).",
    };
  }

  return {
    isValid: true,
    formatted: clean,
    hint: "Valid SWIFT/BIC code for international TT/wire transfers.",
  };
}

// ── EXPORT READINESS SCORE ENGINE ──

export interface ExporterProfileData {
  company_name?: string;
  company_address?: string;
  contact_person?: string;
  contact_email?: string;
  iec_code?: string;
  tax_id?: string;
  origin_port?: string;
  capacity_tons?: number;
  min_order_value_usd?: number;
  bank_name?: string;
  bank_account?: string;
  bank_swift?: string;
  product_categories?: string | string[];
}

export interface ReadinessScoreResult {
  score: number; // 0 to 100
  tier: "Incomplete" | "Operational" | "Near Ready" | "100% Export Ready";
  breakdown: {
    identity: { points: number; max: number; label: string };
    customs: { points: number; max: number; label: string };
    logistics: { points: number; max: number; label: string };
    banking: { points: number; max: number; label: string };
  };
  missingRequirements: string[];
  nextAction: string;
}

export function calculateExportReadinessScore(data: ExporterProfileData): ReadinessScoreResult {
  let identityPoints = 0;
  let customsPoints = 0;
  let logisticsPoints = 0;
  let bankingPoints = 0;

  const missing: string[] = [];

  // 1. Identity (Max 25 pts)
  if (data.company_name && data.company_name.trim().length >= 3) {
    identityPoints += 10;
  } else {
    missing.push("Company registered legal name");
  }

  if (data.company_address && data.company_address.trim().length >= 10) {
    identityPoints += 10;
  } else {
    missing.push("Factory / Registered export address");
  }

  if (data.contact_person && data.contact_person.trim()) {
    identityPoints += 2.5;
  }
  if (data.contact_email && data.contact_email.includes("@")) {
    identityPoints += 2.5;
  }

  // 2. Statutory Customs Clearance (Max 30 pts)
  const iecValid = data.iec_code ? validateIEC(data.iec_code).isValid : false;
  if (iecValid) {
    customsPoints += 15;
  } else {
    missing.push("Valid 10-character DGFT IEC Code");
  }

  const gstinValid = data.tax_id ? validateGSTIN(data.tax_id).isValid : false;
  if (gstinValid) {
    customsPoints += 15;
  } else {
    missing.push("Valid 15-character GSTIN tax number");
  }

  // 3. Logistics & Gateway Coordinates (Max 20 pts)
  if (data.origin_port && data.origin_port.trim()) {
    logisticsPoints += 10;
  } else {
    missing.push("Standardized UN/LOCODE Port of Loading");
  }

  if (data.capacity_tons && data.capacity_tons > 0) {
    logisticsPoints += 5;
  }

  if (data.min_order_value_usd && data.min_order_value_usd > 0) {
    logisticsPoints += 5;
  }

  // 4. Banking & Foreign Remittance (Max 25 pts)
  if (data.bank_name && data.bank_name.trim()) {
    bankingPoints += 5;
  } else {
    missing.push("Beneficiary Bank Name");
  }

  if (data.bank_account && data.bank_account.trim()) {
    bankingPoints += 5;
  } else {
    missing.push("Authorized Bank Account / IBAN Number");
  }

  const swiftValid = data.bank_swift ? validateSWIFT(data.bank_swift).isValid : false;
  if (swiftValid) {
    bankingPoints += 15;
  } else {
    missing.push("Valid SWIFT/BIC Wire Routing Code");
  }

  const totalScore = Math.min(100, Math.round(identityPoints + customsPoints + logisticsPoints + bankingPoints));

  let tier: ReadinessScoreResult["tier"] = "Incomplete";
  let nextAction = "Complete your company name and registered address.";

  if (totalScore >= 100) {
    tier = "100% Export Ready";
    nextAction = "Statutory credentials verified. Qualified for 1-click Proforma Invoices & Customs Shipping Bills.";
  } else if (totalScore >= 80) {
    tier = "Near Ready";
    nextAction = missing.length > 0 ? `Add ${missing[0]} to achieve 100% export verification.` : "Review your statutory details.";
  } else if (totalScore >= 50) {
    tier = "Operational";
    nextAction = missing.length > 0 ? `Add ${missing[0]} to unlock foreign buyer payments.` : "Complete your banking coordinates.";
  } else {
    tier = "Incomplete";
    nextAction = "Add your DGFT IEC code and Port of Loading to start matching with buyers.";
  }

  return {
    score: totalScore,
    tier,
    breakdown: {
      identity: { points: Math.round(identityPoints), max: 25, label: "Identity & Legal Entity" },
      customs: { points: Math.round(customsPoints), max: 30, label: "Statutory Customs (DGFT / GST)" },
      logistics: { points: Math.round(logisticsPoints), max: 20, label: "Port & Logistics Gateway" },
      banking: { points: Math.round(bankingPoints), max: 25, label: "Foreign Banking & SWIFT" },
    },
    missingRequirements: missing,
    nextAction,
  };
}
