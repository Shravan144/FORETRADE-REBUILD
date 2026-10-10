"""
API Integration Tests for Trade Intelligence and Model 1 Forecast Endpoints.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.services.data_pipeline.run_pipeline import run_all_pipelines
from tests.api.test_workspace_flows import authenticated_client


def test_trade_intelligence_corridors_api() -> None:
    run_all_pipelines()
    client, _, _ = authenticated_client("intel_test@example.com")

    # Fetch corridors
    res = client.get("/api/v1/intelligence/corridors")
    assert res.status_code == 200
    items = res.json().get("items", [])
    assert len(items) > 0

    first = items[0]
    assert "origin_country" in first
    assert "destination_country" in first
    assert "trade_value_usd" in first
    assert "hs_code" in first

    # Filter corridors by country and HS code
    res_filtered = client.get("/api/v1/intelligence/corridors?destination_country=US&hs_code=6109")
    assert res_filtered.status_code == 200
    filtered_items = res_filtered.json().get("items", [])
    assert len(filtered_items) >= 3  # Multiple years
    for it in filtered_items:
        assert it["destination_country"] == "US"
        assert it["hs_code"] == "6109"


def test_trade_intelligence_model1_forecast_api() -> None:
    run_all_pipelines()
    client, _, _ = authenticated_client("forecast_test@example.com")

    # Forecast India -> US Apparel (HS 6109)
    res = client.get("/api/v1/intelligence/forecast?destination_country=US&hs_code=6109")
    assert res.status_code == 200
    data = res.json()

    assert data["destination_country"] == "US"
    assert data["hs_code"] == "6109"
    assert "forecast_12m" in data
    assert "forecast_24m" in data

    fc12 = data["forecast_12m"]
    assert fc12["projected_usd"] > 0
    assert fc12["ci_80_lower"] < fc12["projected_usd"] < fc12["ci_80_upper"]
    assert fc12["ci_95_lower"] <= fc12["ci_80_lower"]

    assert "opportunity_index" in data
    assert 0.0 <= data["opportunity_index"] <= 100.0
    assert data["opportunity_tier"] in ["High Opportunity", "Moderate Growth", "Emerging"]
    assert len(data["explanation_factors"]) >= 3

    # Test auto-normalization for dotted 6-digit subheading '6109.10'
    res_dotted = client.get("/api/v1/intelligence/forecast?destination_country=US&hs_code=6109.10")
    assert res_dotted.status_code == 200
    assert res_dotted.json()["hs_code"] == "6109"
    assert res_dotted.json()["forecast_12m"]["projected_usd"] == fc12["projected_usd"]

    # Test auto-normalization for raw 6-digit subheading '610910'
    res_raw = client.get("/api/v1/intelligence/forecast?destination_country=US&hs_code=610910")
    assert res_raw.status_code == 200
    assert res_raw.json()["hs_code"] == "6109"


def test_trade_intelligence_tariffs_api() -> None:
    run_all_pipelines()
    client, _, _ = authenticated_client("tariff_test@example.com")

    # India -> UAE CEPA tariff
    res = client.get("/api/v1/intelligence/tariffs?importer_country=AE&hs_code=6109")
    assert res.status_code == 200
    data = res.json()
    assert data["importer_country"] == "AE"
    assert data["hs_code"] == "6109"

    # Test auto-normalization for 6-digit code '6109.10' in tariffs endpoint
    res_sub = client.get("/api/v1/intelligence/tariffs?importer_country=AE&hs_code=6109.10")
    assert res_sub.status_code == 200
    assert res_sub.json()["hs_code"] == "6109"
    assert res_sub.json()["tariff_savings_pct"] == data["tariff_savings_pct"]
    assert data["preferential_rate_pct"] == 0.0
    assert "CEPA" in data["agreement_name"]


def test_trade_intelligence_risk_api() -> None:
    run_all_pipelines()
    client, _, _ = authenticated_client("risk_test@example.com")

    res = client.get("/api/v1/intelligence/risk?country_code=US")
    assert res.status_code == 200
    data = res.json()
    assert data["country_code"] == "US"
    assert data["risk_tier"] == "Low Risk"
    assert "rule_of_law_score" in data


def test_trade_intelligence_assess_transaction_risk_api() -> None:
    run_all_pipelines()
    client, _, headers = authenticated_client("risk_tx_test@example.com")

    res = client.post(
        "/api/v1/intelligence/assess-transaction-risk",
        json={
            "destination_country": "US",
            "invoice_amount_usd": 65000.0,
            "payment_terms": "lc",
            "buyer_name": "Manhattan Apparel Imports LLC",
        },
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["destination_country"] == "US"
    assert data["risk_tier"] in ["Low Risk", "Moderate Risk"]
    assert "composite_risk_score" in data
    assert "class_probabilities" in data
    assert len(data["top_risk_factors"]) >= 1
    assert len(data["mitigation_strategies"]) >= 1


def test_trade_intelligence_classify_product_api() -> None:
    run_all_pipelines()
    client, _, headers = authenticated_client("hs_classify_test@example.com")

    res = client.post(
        "/api/v1/intelligence/classify-product",
        json={
            "query": "180 GSM combed organic cotton round-neck t-shirts",
            "top_k": 3,
        },
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "query" in data
    assert data["total_matches"] > 0
    predictions = data["predictions"]
    top = predictions[0]
    assert top["hs_code"] in ["6109", "610910"]
    assert top["category_name"] == "Textiles & Apparel"
    assert top["confidence_pct"] >= 60.0


def test_trade_intelligence_demand_signals_api() -> None:
    run_all_pipelines()
    client, _, _ = authenticated_client("radar_list_test@example.com")

    res = client.get("/api/v1/intelligence/demand-signals")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert data["total"] >= 5
    items = data["items"]
    assert len(items) >= 5

    # Check top item attributes
    first = items[0]
    assert "title" in first
    assert "target_country" in first
    assert "estimated_budget_usd" in first
    assert "intent_score" in first
    assert "urgency_level" in first

    # Filter by country
    res_eg = client.get("/api/v1/intelligence/demand-signals?target_country=EG")
    assert res_eg.status_code == 200
    data_eg = res_eg.json()
    assert data_eg["total"] >= 1
    assert data_eg["items"][0]["target_country"] == "EG"


def test_trade_intelligence_extract_signal_api() -> None:
    run_all_pipelines()
    client, _, headers = authenticated_client("radar_extract_test@example.com")

    raw_notice = "Egypt GASC announces $40M emergency wheat procurement tender closing in 30 days."
    res = client.post(
        "/api/v1/intelligence/extract-signal",
        json={
            "text": raw_notice,
            "source_channel": "Ministry Feed",
        },
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["target_country"] == "EG"
    assert data["estimated_budget_usd"] == 40_000_000.0
    assert "30 days" in data["deadline_text"]
    assert data["intent_score"] >= 0.85
    assert "hs_code" in data


def test_trade_intelligence_demand_signals_sync_and_lifecycle_api() -> None:
    run_all_pipelines()
    client, _, headers = authenticated_client("radar_lifecycle_test@example.com")

    # Test sync endpoint
    res = client.post("/api/v1/intelligence/demand-signals/sync?purge_expired=false", headers=headers)
    assert res.status_code == 200
    sync_data = res.json()
    assert "sources" in sync_data
    assert "lifecycle" in sync_data
    assert "total_in_radar" in sync_data
    assert sync_data["total_in_radar"] >= 5

    # Test status filter (ACTIVE)
    res_active = client.get("/api/v1/intelligence/demand-signals?status=ACTIVE")
    assert res_active.status_code == 200
    active_data = res_active.json()
    assert "items" in active_data
    assert all(i["status"] in ["ACTIVE", "CLOSING_SOON"] for i in active_data["items"] if i.get("status"))

    # Test purge expired endpoint
    res_purge = client.post("/api/v1/intelligence/demand-signals/purge-expired", headers=headers)
    assert res_purge.status_code == 200
    purge_data = res_purge.json()
    assert "purged_count" in purge_data


def test_trade_intelligence_compliance_matrix_api() -> None:
    run_all_pipelines()
    client, _, _ = authenticated_client("compliance_test@example.com")

    # Test USA Apparel (6109) -> CPSC & UFLPA
    res_us = client.get("/api/v1/intelligence/compliance-matrix?destination_country=US&hs_code=6109")
    assert res_us.status_code == 200
    data_us = res_us.json()
    assert data_us["destination_country"] == "US"
    assert len(data_us["mandatory_certificates"]) >= 2
    assert any("CPSC" in c["certificate_name"] for c in data_us["mandatory_certificates"])
    assert any("UFLPA" in c["certificate_name"] for c in data_us["mandatory_certificates"])
    assert len(data_us["customs_declaration_documents"]) >= 3

    # Test Germany Chemicals (2902) -> REACH
    res_de = client.get("/api/v1/intelligence/compliance-matrix?destination_country=DE&hs_code=2902")
    assert res_de.status_code == 200
    data_de = res_de.json()
    assert data_de["destination_country"] == "DE"
    assert any("REACH" in c["certificate_name"] for c in data_de["mandatory_certificates"])

    # Test UAE Food (1006) -> Halal
    res_ae = client.get("/api/v1/intelligence/compliance-matrix?destination_country=AE&hs_code=1006")
    assert res_ae.status_code == 200
    data_ae = res_ae.json()
    assert any("Halal" in c["certificate_name"] for c in data_ae["mandatory_certificates"])


def test_trade_intelligence_convert_demand_signal_api() -> None:
    run_all_pipelines()
    client, workspace_id, headers = authenticated_client("radar_convert_test@example.com")

    # Fetch existing signals
    signals_res = client.get("/api/v1/intelligence/demand-signals")
    assert signals_res.status_code == 200
    items = signals_res.json()["items"]
    assert len(items) > 0
    target_signal = items[0]

    # Convert to CRM Lead
    conv_res = client.post(
        f"/api/v1/intelligence/demand-signals/{target_signal['id']}/convert?workspace_id={workspace_id}",
        headers=headers,
    )
    assert conv_res.status_code == 200
    conv_data = conv_res.json()
    assert conv_data["status"] == "converted"
    assert "company_id" in conv_data
    assert "lead_id" in conv_data

    # Verify lead in CRM
    leads_res = client.get(f"/api/v1/workspaces/{workspace_id}/leads")
    assert leads_res.status_code == 200
    leads = leads_res.json()["items"]
    assert any(l["id"] == conv_data["lead_id"] for l in leads)


def test_trade_intelligence_landed_cost_api() -> None:
    run_all_pipelines()
    client, _, headers = authenticated_client("landed_cost_test@example.com")

    # 1. Fetch shipping routes
    routes_res = client.get("/api/v1/intelligence/shipping-routes")
    assert routes_res.status_code == 200
    routes_data = routes_res.json()
    assert "origin_ports" in routes_data
    assert "destination_ports" in routes_data
    assert len(routes_data["origin_ports"]) >= 4

    # 2. Calculate landed cost
    cost_res = client.post(
        "/api/v1/intelligence/landed-cost",
        json={
            "factory_price_usd": 60000.0,
            "cargo_units": 12000,
            "origin_port": "IN_NSA",
            "destination_port": "US_LAX",
            "container_type": "20ft",
            "container_count": 1,
            "hs_code": "6109.10",
            "apply_fta": False,
            "target_margin_pct": 18.0,
        },
        headers=headers,
    )
    assert cost_res.status_code == 200
    cost_data = cost_res.json()
    assert cost_data["transit_days"] == 28
    assert "breakdown" in cost_data
    assert cost_data["breakdown"]["fob_value_usd"] > 60000.0
    assert cost_data["breakdown"]["cif_value_usd"] > cost_data["breakdown"]["fob_value_usd"]
    assert cost_data["breakdown"]["total_landed_cost_ddp_usd"] > cost_data["breakdown"]["cif_value_usd"]
    assert "incoterms" in cost_data
    assert cost_data["incoterms"]["margin_percentage"] == 18.0


def test_trade_intelligence_buyers_directory_and_facets_api() -> None:
    run_all_pipelines()
    client, _, _ = authenticated_client("buyers_facets_test@example.com")

    # 1. Fetch facets
    facets_res = client.get("/api/v1/intelligence/buyers/facets")
    assert facets_res.status_code == 200
    facets = facets_res.json()
    assert facets["total_buyers"] >= 600
    assert facets["total_annual_volume_usd"] > 1_000_000_000
    assert len(facets["countries"]) >= 10
    assert len(facets["sectors"]) >= 10
    assert len(facets["incoterms"]) >= 3

    # 2. Filter by country and volume
    filtered_res = client.get("/api/v1/intelligence/buyers?country_code=US&min_volume=20000000&sort_by=volume_desc")
    assert filtered_res.status_code == 200
    filtered_data = filtered_res.json()
    assert filtered_data["total"] > 0
    for b in filtered_data["items"]:
        assert b["country_code"] == "US"
        assert b["annual_import_volume_usd"] >= 20_000_000

    # 3. Filter by Incoterms
    incoterm_res = client.get("/api/v1/intelligence/buyers?incoterm=CIF")
    assert incoterm_res.status_code == 200
    incoterm_data = incoterm_res.json()
    assert incoterm_data["total"] > 0
    for b in incoterm_data["items"]:
        assert b["preferred_incoterms"] == "CIF"


