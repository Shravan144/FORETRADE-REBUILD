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
    if (!csrfTokenCache) {
      const match = document.cookie.match(/(?:^|;\s*)foretrade_csrf=([^;]+)/);
      if (match) {
        csrfTokenCache = decodeURIComponent(match[1]);
      }
    }
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
    const data = await fetchApi<{ csrf_token: string; session_token?: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (data.csrf_token) setCsrfToken(data.csrf_token);
    if (data.session_token && typeof document !== "undefined") {
      document.cookie = `foretrade_session=${encodeURIComponent(data.session_token)}; path=/; max-age=${7 * 86400}; SameSite=Lax; Secure`;
    }
    return data;
  },

  async register(payload: { email: string; password: string; full_name?: string; company_name?: string }) {
    return fetchApi<{ id: string; email: string; full_name?: string | null }>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async logout() {
    await fetchApi<void>("/api/v1/auth/logout", { method: "POST" });
    setCsrfToken(null);
  },

  async me() {
    const data = await fetchApi<{ id: string; email: string; full_name?: string | null; job_title?: string | null; csrf_token?: string | null }>("/api/v1/auth/me");
    if (data.csrf_token) setCsrfToken(data.csrf_token);
    return data;
  },

  async updateMe(payload: { full_name?: string; job_title?: string }) {
    return fetchApi<{ id: string; email: string; full_name?: string | null; job_title?: string | null }>("/api/v1/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
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
        company_address?: string;
        origin_country?: string;
        origin_port?: string;
        iec_code?: string;
        tax_id?: string;
        contact_person?: string;
        contact_email?: string;
        contact_phone?: string;
        capacity_tons?: number;
        product_categories?: string[];
        target_countries?: string[];
        certifications?: string[];
        min_order_value_usd?: number;
        bank_name?: string;
        bank_branch?: string;
        bank_account?: string;
        bank_swift?: string;
        bank_iban?: string;
      };
    }>(`/api/v1/workspaces/${workspaceId}/exporter-profile`);
  },

  async saveExporterProfile(
    workspaceId: string,
    payload: {
      company_name?: string;
      company_address?: string;
      origin_country?: string;
      origin_port?: string;
      iec_code?: string;
      tax_id?: string;
      contact_person?: string;
      contact_email?: string;
      contact_phone?: string;
      capacity_tons?: number;
      product_categories?: string[];
      target_countries?: string[];
      certifications?: string[];
      min_order_value_usd?: number;
      bank_name?: string;
      bank_branch?: string;
      bank_account?: string;
      bank_swift?: string;
      bank_iban?: string;
    }
  ) {
    return fetchApi<{ version: number; workspace_id: string; payload: Record<string, any> }>(
      `/api/v1/workspaces/${workspaceId}/exporter-profile`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
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

  async swipeRecommendation(workspaceId: string, buyerId: string, direction: "right" | "left" | "up") {
    return fetchApi<{
      action: "saved_to_crm" | "dismissed" | "bookmarked";
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

  async undoSwipeRecommendation(workspaceId: string, buyerId: string) {
    return fetchApi<{
      status: string;
      undone_action: string;
      buyer_id: string;
    }>(`/api/v1/workspaces/${workspaceId}/recommendations/${buyerId}/undo`, {
      method: "POST",
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
    payload: {
      channel?: string;
      custom_notes?: string;
      pitch_angle?: "cost_duty" | "reliability_compliance" | "speed_trial";
      recipient_name?: string;
      recipient_title?: string;
      recipient_email?: string;
    } = {}
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
  async getDemandSignals(params?: { target_country?: string; hs_code?: string; signal_type?: string; status?: string }) {
    const q = new URLSearchParams();
    if (params?.target_country) q.set("target_country", params.target_country);
    if (params?.hs_code) q.set("hs_code", params.hs_code);
    if (params?.signal_type) q.set("signal_type", params.signal_type);
    if (params?.status) q.set("status", params.status);
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
        external_id?: string | null;
        source_url?: string | null;
        buyer_name?: string | null;
        status?: string;
        expires_at?: string | null;
        published_at: string | null;
        created_at: string | null;
      }>;
    }>(`/api/v1/intelligence/demand-signals${qs}`);
  },

  async syncDemandSignals(purgeExpired: boolean = false) {
    return fetchApi<{
      sync_time: string;
      total_in_radar: number;
      sources: Array<{ source: string; status: string; new: number; updated: number; error?: string }>;
      lifecycle: {
        active_count: number;
        closing_soon_count: number;
        expired_count: number;
        purged_count: number;
      };
    }>(`/api/v1/intelligence/demand-signals/sync?purge_expired=${purgeExpired}`, {
      method: "POST",
    });
  },

  async purgeExpiredSignals() {
    return fetchApi<{
      active_count: number;
      closing_soon_count: number;
      expired_count: number;
      purged_count: number;
    }>("/api/v1/intelligence/demand-signals/purge-expired", {
      method: "POST",
    });
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
  async getGlobalBuyerFacets() {
    return fetchApi<{
      total_buyers: number;
      total_annual_volume_usd: number;
      countries: Array<{ code: string; count: number }>;
      sectors: Array<{ name: string; count: number }>;
      incoterms: Array<{ incoterm: string; count: number }>;
      volume_tiers: Array<{ label: string; min: number; max: number | null }>;
    }>("/api/v1/intelligence/buyers/facets");
  },

  async getGlobalBuyers(params?: {
    country_code?: string;
    sector?: string;
    hs_code?: string;
    query?: string;
    min_volume?: number;
    max_volume?: number;
    incoterm?: string;
    sort_by?: string;
    min_reliability?: number;
  }) {
    const q = new URLSearchParams();
    if (params?.country_code) q.set("country_code", params.country_code);
    if (params?.sector) q.set("sector", params.sector);
    if (params?.hs_code) q.set("hs_code", params.hs_code);
    if (params?.query) q.set("query", params.query);
    if (params?.min_volume !== undefined && params?.min_volume !== null) q.set("min_volume", String(params.min_volume));
    if (params?.max_volume !== undefined && params?.max_volume !== null) q.set("max_volume", String(params.max_volume));
    if (params?.incoterm) q.set("incoterm", params.incoterm);
    if (params?.sort_by) q.set("sort_by", params.sort_by);
    if (params?.min_reliability !== undefined && params?.min_reliability !== null) q.set("min_reliability", String(params.min_reliability));
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
      annual_estimated_teu?: number;
      top_historical_suppliers: Array<{
        supplier_name: string;
        origin_country: string;
        share_pct: number;
        port_of_lading: string;
      }>;
      seasonality_curve?: Array<{
        month_index: number;
        month_name: string;
        volume_share_pct: number;
        estimated_teu: number;
        estimated_shipments: number;
        is_peak: boolean;
      }>;
      origin_breakdown?: Array<{
        country_code: string;
        share_pct: number;
        is_indian_origin: boolean;
        displacement_opportunity: boolean;
      }>;
    }>(`/api/v1/intelligence/buyers/${buyerId}`);
  },

  async batchPromoteBuyers(workspaceId: string, buyerIds: string[]) {
    return fetchApi<{
      status: string;
      promoted_count: number;
      company_ids: string[];
      lead_ids: string[];
    }>(`/api/v1/workspaces/${workspaceId}/companies/batch-promote-buyers`, {
      method: "POST",
      body: JSON.stringify({ buyer_ids: buyerIds }),
    });
  },

  async getBuyerContacts(buyerId: string) {
    return fetchApi<{
      buyer_id: string;
      total: number;
      contacts: Array<{
        id: string;
        buyer_id?: string;
        company_id?: string;
        company_name: string;
        domain?: string;
        full_name: string;
        first_name?: string;
        last_name?: string;
        job_title: string;
        department?: string;
        seniority?: string;
        email?: string;
        email_status: string;
        deliverability_score: number;
        phone_number?: string;
        linkedin_url?: string;
        photo_url?: string;
        city?: string;
        country_code?: string;
        source: string;
        is_primary: boolean;
        created_at?: string;
      }>;
    }>(`/api/v1/intelligence/buyers/${buyerId}/contacts`);
  },

  async enrichBuyerContacts(buyerId: string) {
    return fetchApi<{
      buyer_id: string;
      total: number;
      contacts: Array<{
        id: string;
        buyer_id?: string;
        company_id?: string;
        company_name: string;
        domain?: string;
        full_name: string;
        first_name?: string;
        last_name?: string;
        job_title: string;
        department?: string;
        seniority?: string;
        email?: string;
        email_status: string;
        deliverability_score: number;
        phone_number?: string;
        linkedin_url?: string;
        photo_url?: string;
        city?: string;
        country_code?: string;
        source: string;
        is_primary: boolean;
        created_at?: string;
      }>;
    }>(`/api/v1/intelligence/buyers/${buyerId}/enrich-contacts`, {
      method: "POST",
    });
  },

  async getCompanyContacts(workspaceId: string, companyId: string) {
    return fetchApi<{
      company_id: string;
      total: number;
      contacts: Array<any>;
    }>(`/api/v1/workspaces/${workspaceId}/companies/${companyId}/contacts`);
  },

  async enrichCompanyContacts(workspaceId: string, companyId: string) {
    return fetchApi<{
      company_id: string;
      total: number;
      contacts: Array<any>;
    }>(`/api/v1/workspaces/${workspaceId}/companies/${companyId}/enrich-contacts`, {
      method: "POST",
    });
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

  // Commercial Documents Suite (Proforma Invoices & Packing Lists)
  async listWorkspaceDocuments(
    workspaceId: string,
    params?: { document_type?: string; status?: string }
  ) {
    const query = new URLSearchParams();
    if (params?.document_type) query.set("document_type", params.document_type);
    if (params?.status) query.set("status", params.status);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return fetchApi<{ items: any[] }>(`/api/v1/workspaces/${workspaceId}/documents${qs}`);
  },

  async listLeadDocuments(workspaceId: string, leadId: string) {
    return fetchApi<{ items: any[] }>(`/api/v1/workspaces/${workspaceId}/leads/${leadId}/documents`);
  },

  async generateLeadDocument(
    workspaceId: string,
    leadId: string,
    documentType: "proforma_invoice" | "packing_list",
    options?: {
      incoterm?: string;
      unit_price?: number;
      quantity?: number;
      unit?: string;
      product_description?: string;
      container_type?: string;
      destination_port?: string;
      payment_terms?: string;
      notes?: string;
      buyer_contact_name?: string;
      buyer_contact_email?: string;
      buyer_contact_phone?: string;
      buyer_contact_title?: string;
    }
  ) {
    return fetchApi<any>(`/api/v1/workspaces/${workspaceId}/leads/${leadId}/documents/generate`, {
      method: "POST",
      body: JSON.stringify({ document_type: documentType, ...(options || {}) }),
    });
  },

  async getDocument(workspaceId: string, documentId: string) {
    return fetchApi<any>(`/api/v1/workspaces/${workspaceId}/documents/${documentId}`);
  },

  async updateDocument(workspaceId: string, documentId: string, payload: any) {
    return fetchApi<any>(`/api/v1/workspaces/${workspaceId}/documents/${documentId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async deleteDocument(workspaceId: string, documentId: string) {
    return fetchApi<{ deleted: boolean; id: string }>(`/api/v1/workspaces/${workspaceId}/documents/${documentId}`, {
      method: "DELETE",
    });
  },

  getDocumentPdfUrl(workspaceId: string, documentId: string) {
    return `/api/v1/workspaces/${workspaceId}/documents/${documentId}/pdf`;
  },

  // Importer Desk Endpoints
  async getImporterProfile(workspaceId: string): Promise<ImporterProfile> {
    return fetchApi<ImporterProfile>(`/api/v1/workspaces/${workspaceId}/importer-profile`);
  },

  async saveImporterProfile(workspaceId: string, payload: Partial<ImporterProfile>): Promise<ImporterProfile> {
    return fetchApi<ImporterProfile>(`/api/v1/workspaces/${workspaceId}/importer-profile`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listRfqs(workspaceId: string, status?: string): Promise<{ items: SourcingRfq[]; total: number }> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return fetchApi<{ items: SourcingRfq[]; total: number }>(`/api/v1/workspaces/${workspaceId}/rfqs${qs}`);
  },

  async publishRfq(workspaceId: string, payload: Partial<SourcingRfq>): Promise<SourcingRfq> {
    return fetchApi<SourcingRfq>(`/api/v1/workspaces/${workspaceId}/rfqs`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listInboundProposals(workspaceId: string, status?: string): Promise<{ items: InboundProposal[]; total: number }> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return fetchApi<{ items: InboundProposal[]; total: number }>(`/api/v1/workspaces/${workspaceId}/inbound-proposals${qs}`);
  },

  async respondToProposal(
    workspaceId: string,
    proposalId: string,
    payload: { status: "reviewed" | "sample_requested" | "accepted" | "declined"; feedback_notes?: string }
  ): Promise<InboundProposal> {
    return fetchApi<InboundProposal>(`/api/v1/workspaces/${workspaceId}/inbound-proposals/${proposalId}/respond`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async getNegotiationMessages(
    workspaceId: string,
    proposalId: string
  ): Promise<{ items: NegotiationMessage[]; total: number }> {
    return fetchApi<{ items: NegotiationMessage[]; total: number }>(
      `/api/v1/workspaces/${workspaceId}/negotiations/${proposalId}/messages`
    );
  },

  async sendNegotiationMessage(
    workspaceId: string,
    proposalId: string,
    payload: { message_text: string; message_type?: string; payload?: any }
  ): Promise<NegotiationMessage> {
    return fetchApi<NegotiationMessage>(
      `/api/v1/workspaces/${workspaceId}/negotiations/${proposalId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  async getLeadProposal(workspaceId: string, leadId: string): Promise<InboundProposal | null> {
    return fetchApi<InboundProposal>(`/api/v1/workspaces/${workspaceId}/leads/${leadId}/proposal`).catch(() => null);
  },
};

export interface NegotiationMessage {
  id: string;
  proposal_id: string;
  thread_id: string;
  sender_workspace_id: string;
  sender_user_id: string;
  sender_role: "exporter" | "importer";
  sender_name: string;
  sender_company_name: string;
  message_text: string;
  message_type: "text" | "counter_offer" | "sample_request" | "commercial_document";
  payload?: any;
  created_at?: string;
}

export interface ImporterProfile {
  id?: string;
  workspace_id?: string;
  company_name: string;
  trade_name_dba?: string | null;
  country_code: string;
  city: string;
  headquarters_address?: string | null;
  corporate_website?: string | null;
  duns_number?: string | null;
  tax_identifier_type: string;
  tax_identifier_value: string;
  contact_name: string;
  contact_title?: string | null;
  contact_email: string;
  contact_phone?: string | null;
  primary_discharge_port: string;
  secondary_discharge_port?: string | null;
  customs_broker_name?: string | null;
  preferred_container_type: string;
  warehouse_dock_type?: string | null;
  primary_sector: string;
  target_hs_codes: string[];
  annual_sourcing_budget_usd: number;
  order_cycle_days: number;
  min_order_quantity_mt: number;
  consignee_name_on_bol?: string | null;
  required_certifications: string[];
  preferred_incoterm: string;
  payment_terms: string;
  issuing_bank_name?: string | null;
  issuing_bank_swift?: string | null;
  currency: string;
  is_publicly_discoverable: boolean;
  catalog_buyer_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SourcingRfq {
  id: string;
  workspace_id: string;
  importer_profile_id?: string;
  title: string;
  commodity_description: string;
  product_category: string;
  hs_code: string;
  target_quantity: number;
  quantity_unit: string;
  target_budget_usd?: number | null;
  target_unit_price_usd?: number | null;
  destination_country?: string | null;
  destination_port?: string | null;
  preferred_incoterm?: string | null;
  preferred_container_type?: string | null;
  required_certifications: string[];
  inspection_agency_allowed?: string | null;
  special_technical_clauses?: string | null;
  deadline_date?: string | null;
  target_delivery_date?: string | null;
  status: string;
  created_at?: string;
}

export interface InboundProposal {
  id: string;
  importer_workspace_id: string;
  exporter_workspace_id: string;
  rfq_id?: string | null;
  lead_id?: string | null;
  outreach_draft_id?: string | null;
  commercial_document_id?: string | null;
  exporter_company_name: string;
  exporter_country_code: string;
  exporter_origin_port?: string | null;
  exporter_readiness_score?: number | null;
  proposal_channel: string;
  subject: string;
  proposal_body: string;
  offered_unit_price_usd?: number | null;
  offered_incoterm?: string | null;
  estimated_transit_days?: number | null;
  duty_savings_usd?: number | null;
  status: "pending" | "reviewed" | "sample_requested" | "accepted" | "declined";
  importer_feedback_notes?: string | null;
  negotiation_thread_id?: string | null;
  created_at?: string;
  updated_at?: string;
}





