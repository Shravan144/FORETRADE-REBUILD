"""
Integration Tests for Lead Detail and AI Export Pitch & Outreach Generator.
"""

from app.services.data_pipeline.run_pipeline import run_all_pipelines
from tests.api.test_workspace_flows import authenticated_client


def test_lead_detail_and_pitch_generator_flow() -> None:
    run_all_pipelines()
    client, user_id, headers = authenticated_client("pitch_test@foretrade.io")

    # 1. Create Workspace
    ws_res = client.post("/api/v1/workspaces", json={"name": "Surat Silk & Cotton Mills"}, headers=headers)
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # 2. Set Exporter Profile
    client.post(
        f"/api/v1/workspaces/{ws_id}/exporter-profile",
        json={
            "company_name": "Surat Silk & Cotton Mills",
            "origin_country": "IN",
            "capacity_tons": 200,
            "product_categories": ["textiles", "cotton", "6109"],
            "target_countries": ["AE", "US"],
            "certifications": ["ISO 9001", "OEKO-TEX Standard 100"],
        },
        headers=headers,
    )

    # 3. Get Recommendations & Swipe Right to convert buyer into CRM Lead
    recs_res = client.get(f"/api/v1/workspaces/{ws_id}/recommendations", headers=headers)
    assert recs_res.status_code == 200
    items = recs_res.json()["items"]
    assert len(items) > 0
    target_buyer_id = items[0]["buyer_id"]
    target_company_name = items[0]["company_name"]

    swipe_res = client.post(
        f"/api/v1/workspaces/{ws_id}/recommendations/{target_buyer_id}/swipe",
        json={"direction": "right"},
        headers=headers,
    )
    assert swipe_res.status_code == 200
    lead_id = swipe_res.json()["lead_id"]

    # 5. Test GET /leads/{lead_id} (Lead Detail Endpoint)
    detail_res = client.get(f"/api/v1/workspaces/{ws_id}/leads/{lead_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == lead_id
    assert detail["company"]["name"] == target_company_name
    assert detail["company"]["country_code"] is not None

    # 6. Test POST /leads/{lead_id}/generate-pitch (Email Channel)
    pitch_res = client.post(
        f"/api/v1/workspaces/{ws_id}/leads/{lead_id}/generate-pitch",
        json={"channel": "email", "custom_notes": "We guarantee 14-day transit to destination port."},
        headers=headers,
    )
    assert pitch_res.status_code == 201
    pitch = pitch_res.json()
    assert pitch["lead_id"] == lead_id
    assert pitch["channel"] == "email"
    assert "subject" in pitch and len(pitch["subject"]) > 0
    assert "body" in pitch and len(pitch["body"]) > 20
    assert "model_used" in pitch
    assert pitch["status"] == "draft"

    # 7. Verify Timeline Event Recorded
    events_res = client.get(f"/api/v1/workspaces/{ws_id}/leads/{lead_id}/events", headers=headers)
    assert events_res.status_code == 200
    events = events_res.json()["items"]
    pitch_event = next((e for e in events if e["event_type"] == "outreach_draft_generated"), None)
    assert pitch_event is not None
    assert pitch_event["payload"]["channel"] == "email"

    # 8. Verify Outreach Draft Persisted
    drafts_res = client.get(f"/api/v1/workspaces/{ws_id}/leads/{lead_id}/drafts", headers=headers)
    assert drafts_res.status_code == 200
    drafts = drafts_res.json()["items"]
    assert len(drafts) >= 1
    assert drafts[0]["subject"] == pitch["subject"]

    # 9. Test POST /leads/{lead_id}/generate-pitch (LinkedIn Channel)
    li_res = client.post(
        f"/api/v1/workspaces/{ws_id}/leads/{lead_id}/generate-pitch",
        json={"channel": "linkedin"},
        headers=headers,
    )
    assert li_res.status_code == 201
    li_pitch = li_res.json()
    assert li_pitch["channel"] == "linkedin"
    assert target_company_name in li_pitch["subject"]
