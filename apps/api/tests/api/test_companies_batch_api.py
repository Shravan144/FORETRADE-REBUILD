"""
Integration Tests for Step 3: Batch Buyer Promotion and Bill of Lading (BoL) Manifest.
"""

from app.services.data_pipeline.run_pipeline import run_all_pipelines
from tests.api.test_workspace_flows import authenticated_client


def test_batch_promote_and_bol_manifest_flow():
    run_all_pipelines()
    client, user_id, headers = authenticated_client("batch_bol_test@example.com")

    # 1. Create Workspace
    ws_res = client.post("/api/v1/workspaces", json={"name": "Surat Diamonds Exporters"}, headers=headers)
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # 2. Fetch Global Buyers
    buyers_res = client.get("/api/v1/intelligence/buyers?limit=10", headers=headers)
    assert buyers_res.status_code == 200
    buyers = buyers_res.json().get("items", [])
    assert len(buyers) >= 2

    buyer_1_id = buyers[0]["id"]
    buyer_2_id = buyers[1]["id"]

    # 3. Test Bill of Lading Manifest Endpoint
    bol_res = client.get(f"/api/v1/intelligence/buyers/{buyer_1_id}", headers=headers)
    assert bol_res.status_code == 200
    bol_data = bol_res.json()
    assert bol_data["id"] == buyer_1_id
    assert "seasonality_curve" in bol_data
    assert len(bol_data["seasonality_curve"]) == 12
    assert "origin_breakdown" in bol_data
    assert isinstance(bol_data["origin_breakdown"], list)

    # 4. Test Batch Promote Buyers to CRM Leads
    batch_res = client.post(
        f"/api/v1/workspaces/{ws_id}/companies/batch-promote-buyers",
        json={"buyer_ids": [buyer_1_id, buyer_2_id]},
        headers=headers,
    )
    assert batch_res.status_code == 200
    batch_data = batch_res.json()
    assert batch_data["status"] == "ok"
    assert batch_data["promoted_count"] == 2
    assert len(batch_data["company_ids"]) == 2
    assert len(batch_data["lead_ids"]) == 2

    # 5. Verify Workspace Companies and Leads were created
    comps_res = client.get(f"/api/v1/workspaces/{ws_id}/companies", headers=headers)
    assert comps_res.status_code == 200
    created_comps = comps_res.json().get("items", [])
    assert len(created_comps) >= 2

    leads_res = client.get(f"/api/v1/workspaces/{ws_id}/leads", headers=headers)
    assert leads_res.status_code == 200
    created_leads = leads_res.json().get("items", [])
    assert len(created_leads) >= 2
