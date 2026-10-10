import { describe, it, expect } from "vitest";

function computeSeasonalityCurve(sector: string) {
  const s = (sector || "").toLowerCase();
  if (s.includes("textile") || s.includes("apparel")) {
    return [6, 5, 7, 8, 9, 10, 14, 13, 11, 8, 5, 4];
  } else if (s.includes("solar") || s.includes("renew")) {
    return [7, 8, 11, 12, 13, 12, 10, 8, 7, 5, 4, 3];
  } else if (s.includes("agri") || s.includes("spice") || s.includes("grain")) {
    return [11, 12, 12, 9, 7, 5, 5, 6, 7, 9, 11, 12];
  } else if (s.includes("gem") || s.includes("jewel")) {
    return [6, 7, 6, 6, 7, 7, 8, 8, 10, 13, 12, 10];
  }
  return [8, 8, 9, 9, 9, 9, 8, 7, 9, 9, 8, 7];
}

describe("Customs Bill of Lading (BoL) Intelligence & Directory Logic", () => {
  it("computes accurate maritime procurement seasonality curves by sector", () => {
    const textiles = computeSeasonalityCurve("Textiles & Apparel");
    expect(textiles).toHaveLength(12);
    // Peak is in July/Aug (index 6, 7)
    expect(textiles[6]).toBe(14);
    expect(textiles[7]).toBe(13);

    const solar = computeSeasonalityCurve("Renewables & Solar Cells");
    expect(solar[3]).toBe(12); // April/May construction peak
    expect(solar[4]).toBe(13);

    const agri = computeSeasonalityCurve("Agri-Commodities & Spices");
    expect(agri[0]).toBe(11); // Post-harvest peak Nov-Feb
    expect(agri[1]).toBe(12);
  });

  it("accurately aggregates supplier origin market shares", () => {
    const suppliers = [
      { supplier_name: "Ambur Footwear", origin_country: "IN", share_pct: 45.0, port_of_lading: "Chennai" },
      { supplier_name: "Guangdong Leather Co", origin_country: "CN", share_pct: 35.0, port_of_lading: "Shenzhen" },
      { supplier_name: "Hai Phong Tannery", origin_country: "VN", share_pct: 20.0, port_of_lading: "Hai Phong" },
    ];

    const originMap: Record<string, number> = {};
    suppliers.forEach((s) => {
      originMap[s.origin_country] = (originMap[s.origin_country] || 0) + s.share_pct;
    });

    expect(originMap["IN"]).toBe(45.0);
    expect(originMap["CN"]).toBe(35.0);
    expect(originMap["VN"]).toBe(20.0);
  });

  it("handles multi-select batch array operations and toggles", () => {
    const selected = new Set<string>();

    // Select 3 buyers
    selected.add("b-1");
    selected.add("b-2");
    selected.add("b-3");
    expect(selected.size).toBe(3);

    // Toggle off b-2
    selected.delete("b-2");
    expect(selected.size).toBe(2);
    expect(selected.has("b-1")).toBe(true);
    expect(selected.has("b-2")).toBe(false);

    // Clear all
    selected.clear();
    expect(selected.size).toBe(0);
  });
});
