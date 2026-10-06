"""Integration Tests for Path 2: Export Documentation Suite (Proforma Invoices & Commercial Packing Lists)."""

from app.services.data_pipeline.run_pipeline import run_all_pipelines
from tests.api.test_workspace_flows import authenticated_client


def test_export_documentation_suite_flow() -> None:
    run_all_pipelines()
    client, user_id, headers = authenticated_client("doc_suite_test@foretrade.io")

    # 1. Create Workspace
    ws_res = client.post("/api/v1/workspaces", json={"name": "Kandla Engineering Exports"}, headers=headers)
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # 2. Set Exporter Profile
    client.post(
        f"/api/v1/workspaces/{ws_id}/exporter-profile",
        json={
            "company_name": "Kandla Engineering Exports Ltd.",
            "origin_country": "IN",
            "capacity_tons": 500,
            "product_categories": ["steel", "valves", "7210"],
            "target_countries": ["AE", "US"],
            "certifications": ["ISO 9001", "CE"],
        },
        headers=headers,
    )

    # 3. Create a lead via recommendation swipe
    recs_res = client.get(f"/api/v1/workspaces/{ws_id}/recommendations", headers=headers)
    assert recs_res.status_code == 200
    items = recs_res.json()["items"]
    assert len(items) > 0
    target_buyer_id = items[0]["buyer_id"]

    swipe_res = client.post(
        f"/api/v1/workspaces/{ws_id}/recommendations/{target_buyer_id}/swipe",
        json={"direction": "right"},
        headers=headers,
    )
    assert swipe_res.status_code == 200
    lead_id = swipe_res.json()["lead_id"]

    # 4. Generate Proforma Invoice (P/I) via 1-click endpoint
    pi_res = client.post(
        f"/api/v1/workspaces/{ws_id}/leads/{lead_id}/documents/generate",
        json={"document_type": "proforma_invoice"},
        headers=headers,
    )
    assert pi_res.status_code == 201
    pi_data = pi_res.json()
    assert pi_data["document_type"] == "proforma_invoice"
    assert pi_data["document_number"].startswith("PI-")
    assert pi_data["currency"] in ("USD", "EUR", "AED")
    assert pi_data["incoterm"] is not None
    assert len(pi_data["line_items"]) > 0
    assert "bank_details" in pi_data
    assert "swift_code" in pi_data["bank_details"]
    pi_id = pi_data["id"]

    # 5. Generate Commercial Packing List (CPL) via 1-click endpoint
    pkl_res = client.post(
        f"/api/v1/workspaces/{ws_id}/leads/{lead_id}/documents/generate",
        json={"document_type": "packing_list"},
        headers=headers,
    )
    assert pkl_res.status_code == 201
    pkl_data = pkl_res.json()
    assert pkl_data["document_type"] == "packing_list"
    assert pkl_data["document_number"].startswith("PKL-")
    assert "logistics_details" in pkl_data
    assert "container_type" in pkl_data["logistics_details"]
    pkl_id = pkl_data["id"]

    # 6. List Documents for Lead
    list_res = client.get(f"/api/v1/workspaces/{ws_id}/leads/{lead_id}/documents", headers=headers)
    assert list_res.status_code == 200
    doc_items = list_res.json()["items"]
    assert len(doc_items) >= 2

    # 7. Get Document Detail
    get_res = client.get(f"/api/v1/workspaces/{ws_id}/documents/{pi_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == pi_id

    # 8. Update Document (Edit mode)
    pi_data["status"] = "issued"
    pi_data["notes"] = "Updated statutory export clause applied."
    update_res = client.put(
        f"/api/v1/workspaces/{ws_id}/documents/{pi_id}",
        json=pi_data,
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "issued"
    assert "Updated statutory" in update_res.json()["notes"]

    # 9. Download Vector PDF
    pdf_res = client.get(f"/api/v1/workspaces/{ws_id}/documents/{pi_id}/pdf", headers=headers)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert len(pdf_res.content) > 1000
    assert pdf_res.content[:4] == b"%PDF"

    # Packing List PDF
    pkl_pdf_res = client.get(f"/api/v1/workspaces/{ws_id}/documents/{pkl_id}/pdf", headers=headers)
    assert pkl_pdf_res.status_code == 200
    assert pkl_pdf_res.headers["content-type"] == "application/pdf"
    assert pkl_pdf_res.content[:4] == b"%PDF"

    # 10. Delete Document
    del_res = client.delete(f"/api/v1/workspaces/{ws_id}/documents/{pkl_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True
