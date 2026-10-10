import { describe, it, expect } from "vitest";
import {
  INDIAN_PORTS_REGISTRY,
  validateIEC,
  validateGSTIN,
  validateSWIFT,
  calculateExportReadinessScore,
} from "../lib/exim-validators";

describe("EXIM Statutory Validators & Registry", () => {
  it("contains major Indian ports with valid UN/LOCODEs", () => {
    expect(INDIAN_PORTS_REGISTRY.length).toBeGreaterThanOrEqual(10);
    const nhavaSheva = INDIAN_PORTS_REGISTRY.find((p) => p.locode === "INNSA");
    expect(nhavaSheva).toBeDefined();
    expect(nhavaSheva?.name).toContain("Nhava Sheva");

    const mundra = INDIAN_PORTS_REGISTRY.find((p) => p.locode === "INMUN");
    expect(mundra).toBeDefined();
  });

  describe("DGFT IEC Validator", () => {
    it("validates 10-character alphanumeric IEC codes", () => {
      const res = validateIEC("0311029481");
      expect(res.isValid).toBe(true);
      expect(res.formatted).toBe("0311029481");

      const panIec = validateIEC("aabcf1234f");
      expect(panIec.isValid).toBe(true);
      expect(panIec.formatted).toBe("AABCF1234F");
    });

    it("rejects invalid lengths", () => {
      const tooShort = validateIEC("12345");
      expect(tooShort.isValid).toBe(false);
      expect(tooShort.error).toContain("10 characters");

      const empty = validateIEC("");
      expect(empty.isValid).toBe(false);
    });
  });

  describe("GSTIN Tax ID Validator", () => {
    it("validates correct 15-character GSTIN structure", () => {
      const valid = validateGSTIN("27AABCF1234F1Z5");
      expect(valid.isValid).toBe(true);
      expect(valid.formatted).toBe("27AABCF1234F1Z5");
    });

    it("rejects non-15 character codes or malformed formats", () => {
      const short = validateGSTIN("27AABCF1234F");
      expect(short.isValid).toBe(false);
      expect(short.error).toContain("15 characters");

      const invalidStructure = validateGSTIN("999999999999999");
      expect(invalidStructure.isValid).toBe(false);
    });
  });

  describe("SWIFT / BIC Wire Code Validator", () => {
    it("validates 8 and 11 character SWIFT codes", () => {
      const swift8 = validateSWIFT("HDFCINBB");
      expect(swift8.isValid).toBe(true);

      const swift11 = validateSWIFT("sbininbb001");
      expect(swift11.isValid).toBe(true);
      expect(swift11.formatted).toBe("SBININBB001");
    });

    it("rejects invalid lengths and structures", () => {
      const invalidLen = validateSWIFT("HDFC12");
      expect(invalidLen.isValid).toBe(false);

      const invalidChars = validateSWIFT("1234INBB");
      expect(invalidChars.isValid).toBe(false);
    });
  });

  describe("Export Readiness Score Engine", () => {
    it("calculates 100% readiness for complete profiles", () => {
      const result = calculateExportReadinessScore({
        company_name: "Apex Agro Exports Pvt Ltd",
        company_address: "Plot 42, Export Promotion Industrial Park, Navi Mumbai",
        contact_person: "Rajesh Sharma",
        contact_email: "rajesh@apex.com",
        iec_code: "0311029481",
        tax_id: "27AABCF1234F1Z5",
        origin_port: "INNSA - Nhava Sheva (JNPT)",
        capacity_tons: 5000,
        min_order_value_usd: 25000,
        bank_name: "State Bank of India",
        bank_account: "309812458923",
        bank_swift: "SBININBB001",
      });

      expect(result.score).toBe(100);
      expect(result.tier).toBe("100% Export Ready");
      expect(result.missingRequirements).toHaveLength(0);
    });

    it("identifies missing requirements and suggests next milestones", () => {
      const result = calculateExportReadinessScore({
        company_name: "Apex Agro Exports Pvt Ltd",
        company_address: "Plot 42, Export Promotion Industrial Park, Navi Mumbai",
      });

      expect(result.score).toBeLessThan(50);
      expect(result.tier).toBe("Incomplete");
      expect(result.missingRequirements).toContain("Valid 10-character DGFT IEC Code");
      expect(result.missingRequirements).toContain("Valid SWIFT/BIC Wire Routing Code");
    });
  });
});
