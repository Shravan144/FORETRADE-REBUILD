"""
API Integration Tests for Model 2 Matchmaking and Swipe-to-Export Endpoints.
"""

from app.main import app
from app.services.data_pipeline.run_pipeline import run_all_pipelines
from tests.api.test_workspace_flows import authenticated_client


def test_matchmaking_recommendations_and_swipe_flow() -> None:
    run_all_pipelines()
    client, user_id, headers = authenticated_client("recsys_test@example.com")

    # 1. Create Workspace
    ws_res = client.post("/api/v1/workspaces", json={"name": "Kashmir Textiles Export"}, headers=headers)
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # 2. Set Exporter Profile
    client.post(
        f"/api/v1/workspaces/{ws_id}/exporter-profile",
        json={
            "company_name": "Kashmir Textiles Export",
            "capacity_tons": 250,
            "product_categories": ["textiles", "apparel", "6109"],
            "target_countries": ["US", "DE", "AE"],
            "certifications": ["ISO 9001", "OEKO-TEX Standard 100", "GOTS Organic"],
        },
        headers=headers,
    )

    # 3. Fetch Recommendations
    recs_res = client.get(f"/api/v1/workspaces/{ws_id}/recommendations", headers=headers)
    assert recs_res.status_code == 200
    data = recs_res.json()
    items = data.get("items", [])
    assert len(items) > 0

    top_card = items[0]
    assert "buyer_id" in top_card
    assert "company_name" in top_card
    assert "compatibility_score" in top_card
    assert "factor_breakdown" in top_card
    assert len(top_card["reasons"]) >= 3
    assert top_card["compatibility_score"] >= 75.0

    target_buyer_id = top_card["buyer_id"]

    # 4. Test Swipe Left (Pass)
    pass_res = client.post(
        f"/api/v1/workspaces/{ws_id}/recommendations/{target_buyer_id}/swipe",
        json={"direction": "left"},
        headers=headers,
    )
    assert pass_res.status_code == 200
    assert pass_res.json()["action"] == "dismissed"

    # 5. Test Swipe Right (Promote to CRM Lead)
    swipe_res = client.post(
        f"/api/v1/workspaces/{ws_id}/recommendations/{target_buyer_id}/swipe",
        json={"direction": "right"},
        headers=headers,
    )
    assert swipe_res.status_code == 200
    swipe_data = swipe_res.json()
    assert swipe_data["action"] == "saved_to_crm"
    assert "company_id" in swipe_data
    assert "lead_id" in swipe_data
    assert swipe_data["stage"] == "new"

    # 6. Verify Company was created in workspace
    comp_res = client.get(f"/api/v1/workspaces/{ws_id}/companies", headers=headers)
    assert comp_res.status_code == 200
    workspace_companies = comp_res.json().get("items", [])
    assert any(c["id"] == swipe_data["company_id"] for c in workspace_companies)

    # 7. Verify Lead was created in workspace
    leads_res = client.get(f"/api/v1/workspaces/{ws_id}/leads", headers=headers)
    assert leads_res.status_code == 200
    workspace_leads = leads_res.json().get("items", [])
    assert any(l["id"] == swipe_data["lead_id"] for l in workspace_leads)
