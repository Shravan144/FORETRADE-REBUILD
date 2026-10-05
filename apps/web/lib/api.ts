/**
 * ForeTrade Typed API Client
 * Wraps browser fetch with credentials, CSRF token handling, and error formatting.
 */

let csrfTokenCache: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfTokenCache = token;
  if (typeof window !== "undefined") {
    if (token) {
      sessionStorage.setItem("foretrade_csrf", token);
    } else {
      sessionStorage.removeItem("foretrade_csrf");
    }
  }
}

export function getCsrfToken(): string | null {
  if (csrfTokenCache) return csrfTokenCache;
  if (typeof window !== "undefined") {
    csrfTokenCache = sessionStorage.getItem("foretrade_csrf");
  }
  return csrfTokenCache;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const csrf = getCsrfToken();
  if (csrf && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", csrf);
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: "include", // send/receive HttpOnly session cookies
  });

  if (res.status === 204) {
    return {} as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let detail = "Request failed";
    if (typeof data.detail === "string") {
      detail = data.detail;
    } else if (Array.isArray(data.detail)) {
      detail = data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
    } else if (data.message) {
      detail = data.message;
    }
    throw new ApiError(detail, res.status, data.code);
  }

  return data as T;
}

export const api = {
  // Auth
  async login(payload: { email: string; password: string }) {
    const data = await fetchApi<{ csrf_token: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (data.csrf_token) setCsrfToken(data.csrf_token);
    return data;
  },

  async register(payload: { email: string; password: string }) {
    return fetchApi<{ id: string; email: string }>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async logout() {
    await fetchApi<void>("/api/v1/auth/logout", { method: "POST" });
    setCsrfToken(null);
  },

  async me() {
    return fetchApi<{ id: string; email: string }>("/api/v1/auth/me");
  },

  // Workspaces
  async listWorkspaces() {
    return fetchApi<{ items: Array<{ id: string; name: string; role: string }> }>("/api/v1/workspaces");
  },

  async getWorkspace(id: string) {
    return fetchApi<{ id: string; name: string; role: string }>(`/api/v1/workspaces/${id}`);
  },

  async createWorkspace(name: string) {
    return fetchApi<{ id: string; name: string; role: string }>("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async getWorkspaceMembers(workspaceId: string) {
    return fetchApi<{ items: Array<{ id: string; user_id: string; email: string; role: string; created_at: string }> }>(
      `/api/v1/workspaces/${workspaceId}/members`
    );
  },

  // Exporter Profile
  async getExporterProfile(workspaceId: string) {
    return fetchApi<{
      id: string;
      workspace_id: string;
      version: number;
      payload: {
        company_name?: string;
        capacity_tons?: number;
        product_categories?: string[];
        target_countries?: string[];
        certifications?: string[];
      };
    }>(`/api/v1/workspaces/${workspaceId}/exporter-profile`);
  },

  async saveExporterProfile(
    workspaceId: string,
    payload: {
      company_name?: string;
      capacity_tons?: number;
      product_categories?: string[];
      target_countries?: string[];
      certifications?: string[];
      min_order_value_usd?: number;
    }
  ) {
    return fetchApi<{ version: number; workspace_id: string }>(`/api/v1/workspaces/${workspaceId}/exporter-profile`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Markets
  async listMarkets(params?: { hs_code?: string; country_code?: string }) {
    const query = new URLSearchParams();
    if (params?.hs_code) query.set("hs_code", params.hs_code);
    if (params?.country_code) query.set("country_code", params.country_code);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return fetchApi<{
      items: Array<{
        id: string;
        country_code: string;
        hs_code: string;
        export_value_usd: number;
        growth_pct: number;
        source_name: string;
        source_period: string;
        dataset_version: string;
        score: number;
        confidence: string;
        missing_inputs: string[];
      }>;
    }>(`/api/v1/markets${qs}`);
  },

  async listWatchlist(workspaceId: string) {
    return fetchApi<{ items: Array<{ id: string; country_code: string; hs_code: string; created_at: string }> }>(
      `/api/v1/workspaces/${workspaceId}/market-watchlist`
    );
  },

  async addWatchlist(workspaceId: string, payload: { country_code: string; hs_code: string }) {
    return fetchApi<{ id: string; country_code: string; hs_code: string }>(
      `/api/v1/workspaces/${workspaceId}/market-watchlist`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  async removeWatchlist(workspaceId: string, itemId: string) {
    return fetchApi<void>(`/api/v1/workspaces/${workspaceId}/market-watchlist/${itemId}`, {
      method: "DELETE",
    });
  },

  // Trade Intelligence & Model 1 ML Forecasting
  async getCorridors(params?: { origin_country?: string; destination_country?: string; hs_code?: string }) {
    const q = new URLSearchParams();
    if (params?.origin_country) q.set("origin_country", params.origin_country);
    if (params?.destination_country) q.set("destination_country", params.destination_country);
    if (params?.hs_code) q.set("hs_code", params.hs_code);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return fetchApi<{
      items: Array<{
        id: string;
        origin_country: string;
        destination_country: string;
        hs_code: string;
        year: number;
        trade_value_usd: number;
        net_weight_kg?: number;
        unit_value_usd_per_kg?: number;
        yoy_growth_pct?: number;
        source_dataset: string;
      }>;
    }>(`/api/v1/intelligence/corridors${qs}`);
  },

  async getForecast(params: { destination_country: string; hs_code: string; origin_country?: string }) {
    const q = new URLSearchParams({
      destination_country: params.destination_country,
      hs_code: params.hs_code,
      origin_country: params.origin_country || "IN",
    });
    return fetchApi<{
      origin_country: string;
      destination_country: string;
      hs_code: string;
      historical_years: number[];
      historical_values_usd: number[];
      forecast_12m: {
        year: number;
        projected_usd: number;
        ci_80_lower: number;
        ci_80_upper: number;
        ci_95_lower: number;
        ci_95_upper: number;
      };
      forecast_24m: {
        year: number;
        projected_usd: number;
        ci_80_lower: number;
        ci_80_upper: number;
        ci_95_lower: number;
        ci_95_upper: number;
      };
      projected_cagr_pct: number;
      opportunity_index: number;
      opportunity_tier: string;
      unit_value_trend: string;
      risk_adjusted_rating: string;
      explanation_factors: string[];
    }>(`/api/v1/intelligence/forecast?${q.toString()}`);
  },

  async getTariffs(params: {
    importer_country: string;
    hs_code: string;
    exporter_country?: string;
    shipment_value_usd?: number;
  }) {
    const q = new URLSearchParams({
      importer_country: params.importer_country,
      hs_code: params.hs_code,
      exporter_country: params.exporter_country || "IN",
    });
    if (params.shipment_value_usd !== undefined) {
      q.set("shipment_value_usd", params.shipment_value_usd.toString());
    }
    return fetchApi<{
      exporter_country: string;
      importer_country: string;
      hs_code: string;
      shipment_value_usd: number;
      mfn_applied_rate_pct: number;
      preferential_rate_pct: number;
      tariff_savings_pct: number;
      duty_under_mfn_usd: number;
      duty_under_fta_usd: number;
      duty_savings_usd: number;
      agreement_name: string;
      rules_of_origin?: string;
    }>(`/api/v1/intelligence/tariffs?${q.toString()}`);
  },

  async getComplianceMatrix(params: { destination_country: string; hs_code: string }) {
    const q = new URLSearchParams({
      destination_country: params.destination_country,
      hs_code: params.hs_code,
    });
    return fetchApi<{
      destination_country: string;
      destination_country_name: string;
      hs_code: string;
      sector_name: string;
      customs_entry_clearance_complexity: string;
      mandatory_certificates: Array<{
        certificate_name: string;
        issuing_authority_agency: string;
        is_mandatory: boolean;
        purpose: string;
        estimated_lead_time_days: number;
        testing_or_audit_requirement: string;
        penalties_or_consequences: string;
      }>;
      recommended_commercial_standards: Array<{
        certificate_name: string;
        issuing_authority_agency: string;
        is_mandatory: boolean;
        purpose: string;
        estimated_lead_time_days: number;
        testing_or_audit_requirement: string;
        penalties_or_consequences: string;
      }>;
      customs_declaration_documents: string[];
      border_inspection_protocols: string;
    }>(`/api/v1/intelligence/compliance-matrix?${q.toString()}`);
  },

  async getCountryRisk(country_code: string) {

    return fetchApi<{
      country_code: string;
      country_name: string;
      political_stability_score: number;
      rule_of_law_score: number;
      regulatory_quality_score: number;
      composite_risk_score: number;
      risk_tier: string;
      currency_code: string;
      fx_volatility_pct: number;
    }>(`/api/v1/intelligence/risk?country_code=${country_code}`);
  },

  // Model 3: XGBoost Cross-Border Trade Risk Assessment
  async assessTransactionRisk(payload: {
    destination_country: string;
    invoice_amount_usd: number;
    payment_terms: string;
    buyer_id?: string;
    buyer_name?: string;
  }) {
    return fetchApi<{
      buyer_name: string;
      destination_country: string;
      invoice_amount_usd: number;
      payment_terms: string;
      risk_tier: string;
      composite_risk_score: number;
      class_probabilities: { low: number; moderate: number; high: number };
      top_risk_factors: string[];
      mitigation_strategies: string[];
    }>("/api/v1/intelligence/assess-transaction-risk", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Model 5: Semantic HS Code Auto-Classifier
  async classifyProduct(query: string, top_k: number = 3) {
    return fetchApi<{
      query: string;
      total_matches: number;
      predictions: Array<{
        hs_code: string;
        level: number;
        description: string;
        category_name: string;
        confidence_pct: number;
        matched_keywords: string[];
        chapter_code: string;
        heading_code?: string;
      }>;
    }>("/api/v1/intelligence/classify-product", {
      method: "POST",
      body: JSON.stringify({ query, top_k }),
    });
  },

  // Model 2: Two-Tower Matchmaking & Swipe-to-Export
  async getRecommendations(workspaceId: string, top_k: number = 20, exclude_swiped: boolean = true) {
    return fetchApi<{
      workspace_id: string;
      total_recommendations: number;
      excluded_count?: number;
      items: Array<{
        buyer_id: string;
        company_name: string;
        country_code: string;
        city?: string;
        website?: string;
        contact_name?: string;
        contact_email?: string;
        primary_sector: string;
        hs_codes: string[];
        annual_import_volume_usd: number;
        avg_order_tons: number;
        required_certifications: string[];
        preferred_incoterms: string;
        customs_manifest_provenance: string;
        reliability_score: number;
        compatibility_score: number;
        match_tier: string;
        factor_breakdown: {
          product_similarity_pts: number;
          capacity_alignment_pts: number;
          compliance_match_pts: number;
          corridor_alignment_pts: number;
        };
        reasons: string[];
      }>;
    }>(`/api/v1/workspaces/${workspaceId}/recommendations?top_k=${top_k}&exclude_swiped=${exclude_swiped}`);
  },

  async swipeRecommendation(workspaceId: string, buyerId: string, direction: "right" | "left") {
    return fetchApi<{
      action: "saved_to_crm" | "dismissed";
      buyer_id?: string;
      company_id?: string;
      lead_id?: string;
      stage?: string;
      compatibility_score?: number;
    }>(`/api/v1/workspaces/${workspaceId}/recommendations/${buyerId}/swipe`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    });
  },

  async resetDismissedRecommendations(workspaceId: string) {
    return fetchApi<{ status: string; reset_count: number }>(
      `/api/v1/workspaces/${workspaceId}/recommendations/reset-dismissed`,
      {
        method: "POST",
      }
    );
  },

  async getMatchmakingFeed(workspaceId: string, top_k: number = 20) {
    return this.getRecommendations(workspaceId, top_k);
  },



  // Companies & Scores
  async listCompanies(workspaceId: string, params?: { query?: string; country_code?: string }) {
    const search = new URLSearchParams();
    if (params?.query) search.set("query", params.query);
    if (params?.country_code) search.set("country_code", params.country_code);
    const qs = search.toString() ? `?${search.toString()}` : "";
    return fetchApi<{
      items: Array<{
        id: string;
        name: string;
        country_code: string;
        website: string | null;
        product_or_industry: string;
        contact_name: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        provenance: string;
      }>;
    }>(`/api/v1/workspaces/${workspaceId}/companies${qs}`);
  },

  async getCompany(workspaceId: string, companyId: string) {
    return fetchApi<{
      id: string;
      name: string;
      country_code: string;
      website: string | null;
      product_or_industry: string;
      contact_name: string | null;
      contact_email: string | null;
      contact_phone: string | null;
      provenance: string;
    }>(`/api/v1/workspaces/${workspaceId}/companies/${companyId}`);
  },

  async calculateScore(workspaceId: string, companyId: string) {
    return fetchApi<{
      id: string;
      company_id: string;
      score: number;
      tier: string;
      reason_codes: string[];
      feature_values: Record<string, any>;
      algorithm_version: string;
    }>(`/api/v1/workspaces/${workspaceId}/companies/${companyId}/scores`, {
      method: "POST",
    });
  },

  async getCompanyScores(workspaceId: string, companyId: string) {
    return fetchApi<{
      items: Array<{
        id: string;
        score: number;
        tier: string;
        reason_codes: string[];
        feature_values: Record<string, any>;
        algorithm_version: string;
        created_at: string;
      }>;
    }>(`/api/v1/workspaces/${workspaceId}/companies/${companyId}/scores`);
  },

  // Imports
  async uploadImport(workspaceId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    return fetchApi<{ id: string; status: string; filename: string }>(`/api/v1/workspaces/${workspaceId}/imports`, {
      method: "POST",
      body: form,
    });
  },

  async getImportPreview(jobId: string) {
    return fetchApi<{
      job: { id: string; status: string; filename: string; row_count: number };
      columns: string[];
      rows: Array<{ row_number: number; data: Record<string, any>; issues: string[] }>;
    }>(`/api/v1/jobs/${jobId}/preview`);
  },

  async commitImport(jobId: string, mapping: Record<string, string>) {
    return fetchApi<{
      job: { id: string; status: string };
      summary: { created: number; updated: number; invalid: number };
    }>(`/api/v1/jobs/${jobId}/commit`, {
      method: "POST",
      body: JSON.stringify({ mapping }),
    });
  },

  // Leads
  async listLeads(workspaceId: string, stage?: string) {
    const qs = stage ? `?stage=${stage}` : "";
    return fetchApi<{
      items: Array<{
        id: string;
        company_id: string;
        stage: string;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>;
    }>(`/api/v1/workspaces/${workspaceId}/leads${qs}`);
  },

  async getLead(workspaceId: string, leadId: string) {
    return fetchApi<{
      id: string;
      workspace_id: string;
      company_id: string;
      stage: string;
      notes: string | null;
      created_at: string;
      updated_at: string;
      company?: {
        id: string;
        name: string;
        country_code: string;
        product_or_industry: string;
        contact_name?: string;
        contact_email?: string;
        website?: string;
        attributes?: Record<string, any>;
      };
      score?: {
        score: number;
        tier: string;
        reasons?: string[];
        feature_values?: Record<string, any>;
      };
    }>(`/api/v1/workspaces/${workspaceId}/leads/${leadId}`);
  },

  async generatePitch(
    workspaceId: string,
    leadId: string,
    payload: { channel?: string; custom_notes?: string } = {}
  ) {
    return fetchApi<{
      id: string;
      lead_id: string;
      channel: string;
      subject: string;
      body: string;
      status: string;
      created_at: string;
      model_used?: string;
    }>(`/api/v1/workspaces/${workspaceId}/leads/${leadId}/generate-pitch`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createLead(workspaceId: string, companyId: string, notes?: string) {
    return fetchApi<{ id: string; company_id: string; stage: string }>(`/api/v1/workspaces/${workspaceId}/leads`, {
      method: "POST",
      body: JSON.stringify({ company_id: companyId, notes }),
    });
  },

  async changeLeadStage(workspaceId: string, leadId: string, stage: string, note?: string) {
    return fetchApi<{ id: string; stage: string }>(`/api/v1/workspaces/${workspaceId}/leads/${leadId}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage, note }),
    });
  },

  async addLeadEvent(workspaceId: string, leadId: string, event_type: string, payload: Record<string, any> = {}) {
    return fetchApi<{ id: string; event_type: string }>(`/api/v1/workspaces/${workspaceId}/leads/${leadId}/events`, {
      method: "POST",
      body: JSON.stringify({ event_type, payload }),
    });
  },

  async listLeadEvents(workspaceId: string, leadId: string) {
    return fetchApi<{ items: Array<{ id: string; event_type: string; payload: Record<string, any>; occurred_at: string }> }>(
      `/api/v1/workspaces/${workspaceId}/leads/${leadId}/events`
    );
  },

  async createDraft(workspaceId: string, leadId: string, payload: { channel: string; subject: string; body: string }) {
    return fetchApi<{ id: string; channel: string; subject: string; body: string; status: string }>(
      `/api/v1/workspaces/${workspaceId}/leads/${leadId}/drafts`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  async listDrafts(workspaceId: string, leadId: string) {
    return fetchApi<{ items: Array<{ id: string; channel: string; subject: string; body: string; status: string; created_at: string }> }>(
      `/api/v1/workspaces/${workspaceId}/leads/${leadId}/drafts`
    );
  },

  // AI Trade Copilot
  async copilotChat(
    workspaceId: string,
    payload: {
      message: string;
      conversation_history?: Array<{ role: "user" | "assistant"; content: string }>;
    }
  ) {
    return fetchApi<{
      response: string;
      model_used: string;
      suggested_questions: string[];
    }>(`/api/v1/workspaces/${workspaceId}/copilot/chat`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Analytics
  async getAnalytics(workspaceId: string) {
    return fetchApi<{
      companies: number;
      pipeline: Record<string, number>;
      import_quality: { jobs: number; rows: number; invalid_rows: number };
      score_distribution: Record<string, number>;
    }>(`/api/v1/workspaces/${workspaceId}/analytics`);
  },

  async exportCompanies(workspaceId: string) {
    return fetchApi<{ job_id: string; download_url: string }>(`/api/v1/workspaces/${workspaceId}/exports/companies`, {
      method: "POST",
    });
  },

  // ── Real-Time Demand Radar Endpoints ──
  async getDemandSignals(params?: { target_country?: string; hs_code?: string; signal_type?: string }) {
    const q = new URLSearchParams();
    if (params?.target_country) q.set("target_country", params.target_country);
    if (params?.hs_code) q.set("hs_code", params.hs_code);
    if (params?.signal_type) q.set("signal_type", params.signal_type);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return fetchApi<{
      total: number;
      items: Array<{
        id: string;
        title: string;
        raw_text: string;
        source_channel: string;
        signal_type: string;
        target_country: string;
        product_category: string;
        hs_code: string;
        estimated_budget_usd: number | null;
        deadline_date: string | null;
        intent_score: number;
        urgency_level: string;
        extracted_entities: Record<string, any>;
        published_at: string | null;
        created_at: string | null;
      }>;
    }>(`/api/v1/intelligence/demand-signals${qs}`);
  },

  async extractSignal(payload: { text: string; source_channel?: string }) {
    return fetchApi<{
      title: string;
      target_country: string;
      product_category: string;
      hs_code: string;
      estimated_budget_usd: number | null;
      deadline_text: string | null;
      signal_type: string;
      urgency_level: string;
      intent_score: number;
      extracted_entities: Record<string, any>;
    }>("/api/v1/intelligence/extract-signal", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async convertDemandSignal(signalId: string, workspaceId: string) {
    return fetchApi<{
      status: string;
      company_id: string;
      lead_id: string;
      stage: string;
      signal_title: string;
    }>(`/api/v1/intelligence/demand-signals/${signalId}/convert?workspace_id=${workspaceId}`, {
      method: "POST",
    });
  },

  // ── Smart Buyer Discovery & Bill of Lading Endpoints ──
  async getGlobalBuyers(params?: {
    country_code?: string;
    sector?: string;
    hs_code?: string;
    query?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.country_code) q.set("country_code", params.country_code);
    if (params?.sector) q.set("sector", params.sector);
    if (params?.hs_code) q.set("hs_code", params.hs_code);
    if (params?.query) q.set("query", params.query);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return fetchApi<{
      total: number;
      items: Array<{
        id: string;
        company_name: string;
        normalized_name: string;
        country_code: string;
        city: string | null;
        website: string | null;
        contact_name: string | null;
        contact_email: string | null;
        primary_sector: string;
        hs_codes: string[];
        annual_import_volume_usd: number;
        avg_order_tons: number;
        required_certifications: string[];
        preferred_incoterms: string | null;
        customs_manifest_provenance: string;
        reliability_score: number;
        shipment_frequency: string;
        avg_container_teu: number;
        estimated_order_cycle_days: number;
        top_historical_suppliers: Array<{
          supplier_name: string;
          origin_country: string;
          share_pct: number;
          port_of_lading: string;
        }>;
      }>;
    }>(`/api/v1/intelligence/buyers${qs}`);
  },

  async getBuyerBolManifest(buyerId: string) {
    return fetchApi<{
      id: string;
      company_name: string;
      country_code: string;
      city: string | null;
      website: string | null;
      contact_name: string | null;
      contact_email: string | null;
      primary_sector: string;
      hs_codes: string[];
      annual_import_volume_usd: number;
      avg_order_tons: number;
      required_certifications: string[];
      preferred_incoterms: string | null;
      customs_manifest_provenance: string;
      reliability_score: number;
      shipment_frequency: string;
      avg_container_teu: number;
      estimated_order_cycle_days: number;
      top_historical_suppliers: Array<{
        supplier_name: string;
        origin_country: string;
        share_pct: number;
        port_of_lading: string;
      }>;
    }>(`/api/v1/intelligence/buyers/${buyerId}`);
  },

  // ── Landed Cost & Logistics Estimator Endpoints ──
  async getShippingRoutes() {
    return fetchApi<{
      origin_ports: Array<{ code: string; name: string; country_code: string; city: string }>;
      destination_ports: Array<{ code: string; name: string; country_code: string; city: string }>;
      container_types: Array<{ code: string; label: string; max_payload_kg: number; volume_cbm: number }>;
    }>("/api/v1/intelligence/shipping-routes");
  },

  async calculateLandedCost(payload: {
    factory_price_usd: number;
    cargo_units: number;
    origin_port?: string;
    destination_port?: string;
    container_type?: string;
    container_count?: number;
    hs_code?: string;
    apply_fta?: boolean;
    target_margin_pct?: number;
    cbm_volume?: number;
  }) {
    return fetchApi<{
      origin_port: { code: string; name: string; country_code: string; city: string };
      destination_port: { code: string; name: string; country_code: string; city: string };
      container_type: string;
      container_count: number;
      transit_days: number;
      primary_carrier: string;
      hs_code: string;
      applied_tariff_agreement: string | null;
      breakdown: {
        factory_gate_price_usd: number;
        inland_trucking_usd: number;
        origin_terminal_handling_usd: number;
        export_customs_clearance_usd: number;
        fob_value_usd: number;
        ocean_freight_usd: number;
        cfr_value_usd: number;
        marine_insurance_usd: number;
        cif_value_usd: number;
        destination_port_handling_usd: number;
        customs_brokerage_usd: number;
        customs_import_duty_usd: number;
        tariff_rate_applied_pct: number;
        is_fta_rate_applied: boolean;
        tariff_savings_usd: number;
        destination_inland_delivery_usd: number;
        total_landed_cost_ddp_usd: number;
        units: number;
        unit_factory_cost_usd: number;
        unit_fob_cost_usd: number;
        unit_cif_cost_usd: number;
        unit_landed_cost_usd: number;
      };
      incoterms: {
        exw_total_usd: number;
        fob_total_usd: number;
        cfr_total_usd: number;
        cif_total_usd: number;
        ddp_total_usd: number;
        suggested_cif_quote_with_margin_usd: number;
        margin_percentage: number;
        cost_percentages: {
          factory_goods_pct: number;
          ocean_freight_pct: number;
          customs_duties_pct: number;
          inland_and_port_handling_pct: number;
          marine_insurance_pct: number;
        };
      };
    }>("/api/v1/intelligence/landed-cost", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};



