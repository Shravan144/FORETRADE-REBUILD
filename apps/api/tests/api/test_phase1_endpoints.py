from fastapi.testclient import TestClient

from app.main import app
from tests.api.test_workspace_flows import authenticated_client


def test_exporter_profile_get_and_history() -> None:
    client, workspace_id, headers = authenticated_client("profile_test@example.com")
    # Initially no profile exists
    res = client.get(f"/api/v1/workspaces/{workspace_id}/exporter-profile")
    assert res.status_code == 404

    # Create first profile
    p1 = client.post(
        f"/api/v1/workspaces/{workspace_id}/exporter-profile",
        json={"capacity_tons": 50, "product_categories": ["textiles"]},
        headers=headers,
    )
    assert p1.status_code == 200
    assert p1.json()["version"] == 1

    # Get current profile
    current = client.get(f"/api/v1/workspaces/{workspace_id}/exporter-profile")
    assert current.status_code == 200
    assert current.json()["version"] == 1
    assert current.json()["payload"]["capacity_tons"] == 50

    # Update profile (version 2)
    p2 = client.put(
        f"/api/v1/workspaces/{workspace_id}/exporter-profile",
        json={"capacity_tons": 100, "product_categories": ["textiles", "apparel"]},
        headers=headers,
    )
    assert p2.status_code == 200
    assert p2.json()["version"] == 2

    # Get history
    history = client.get(f"/api/v1/workspaces/{workspace_id}/exporter-profile/history")
    assert history.status_code == 200
    items = history.json()["items"]
    assert len(items) == 2
    assert items[0]["version"] == 2
    assert items[1]["version"] == 1


def test_workspace_members_list() -> None:
    client, workspace_id, headers = authenticated_client("members_test@example.com")
    members = client.get(f"/api/v1/workspaces/{workspace_id}/members")
    assert members.status_code == 200
    items = members.json()["items"]
    assert len(items) == 1
    assert items[0]["email"] == "members_test@example.com"
    assert items[0]["role"] == "owner"


def test_watchlist_delete_endpoint() -> None:
    client, workspace_id, headers = authenticated_client("watchlist_test@example.com")
    # Add watchlist item
    add_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/market-watchlist",
        json={"country_code": "US", "hs_code": "6109"},
        headers=headers,
    )
    assert add_res.status_code == 201
    item_id = add_res.json()["id"]

    # Verify present
    list_res = client.get(f"/api/v1/workspaces/{workspace_id}/market-watchlist")
    assert list_res.status_code == 200
    assert any(i["id"] == item_id for i in list_res.json()["items"])

    # Delete item
    del_res = client.delete(
        f"/api/v1/workspaces/{workspace_id}/market-watchlist/{item_id}",
        headers=headers,
    )
    assert del_res.status_code == 204

    # Verify removed
    list_res2 = client.get(f"/api/v1/workspaces/{workspace_id}/market-watchlist")
    assert not any(i["id"] == item_id for i in list_res2.json()["items"])


def test_outreach_drafts_get_endpoint() -> None:
    client, workspace_id, headers = authenticated_client("drafts_test@example.com")
    # Upload and commit a company
    csv = b"Company,Country,Product,Website,Email\nDemo Co,US,Textiles,https://demo.example,hi@demo.example\n"
    uploaded = client.post(
        f"/api/v1/workspaces/{workspace_id}/imports",
        files={"file": ("test.csv", csv, "text/csv")},
        headers=headers,
    )
    assert uploaded.status_code == 202
    job_id = uploaded.json()["id"]
    client.post(
        f"/api/v1/jobs/{job_id}/commit",
        json={"mapping": {"Company": "company_name", "Country": "country_code", "Product": "product_or_industry"}},
        headers=headers,
    )
    company_id = client.get(f"/api/v1/workspaces/{workspace_id}/companies").json()["items"][0]["id"]
    lead = client.post(f"/api/v1/workspaces/{workspace_id}/leads", json={"company_id": company_id}, headers=headers)
    lead_id = lead.json()["id"]

    # Initially empty drafts
    empty_drafts = client.get(f"/api/v1/workspaces/{workspace_id}/leads/{lead_id}/drafts")
    assert empty_drafts.status_code == 200
    assert empty_drafts.json()["items"] == []

    # Create a draft
    created = client.post(
        f"/api/v1/workspaces/{workspace_id}/leads/{lead_id}/drafts",
        json={"channel": "email", "subject": "Introductory Proposal", "body": "Dear Partner,..."},
        headers=headers,
    )
    assert created.status_code == 201

    # List drafts
    drafts = client.get(f"/api/v1/workspaces/{workspace_id}/leads/{lead_id}/drafts")
    assert drafts.status_code == 200
    items = drafts.json()["items"]
    assert len(items) == 1
    assert items[0]["subject"] == "Introductory Proposal"


def test_company_score_history_endpoint() -> None:
    client, workspace_id, headers = authenticated_client("score_history_test@example.com")
    csv = b"Company,Country,Product,Website,Email\nScore Co,AE,Apparel,https://score.example,contact@score.example\n"
    uploaded = client.post(
        f"/api/v1/workspaces/{workspace_id}/imports",
        files={"file": ("test.csv", csv, "text/csv")},
        headers=headers,
    )
    job_id = uploaded.json()["id"]
    client.post(
        f"/api/v1/jobs/{job_id}/commit",
        json={"mapping": {"Company": "company_name", "Country": "country_code", "Product": "product_or_industry"}},
        headers=headers,
    )
    company_id = client.get(f"/api/v1/workspaces/{workspace_id}/companies").json()["items"][0]["id"]

    # Calculate score
    score = client.post(f"/api/v1/workspaces/{workspace_id}/companies/{company_id}/scores", headers=headers)
    assert score.status_code == 201

    # Retrieve score history
    history = client.get(f"/api/v1/workspaces/{workspace_id}/companies/{company_id}/scores")
    assert history.status_code == 200
    items = history.json()["items"]
    assert len(items) >= 1
    assert items[0]["company_id"] == company_id
    assert "score" in items[0]


def test_markets_require_authentication() -> None:
    unauthenticated = TestClient(app)
    res = unauthenticated.get("/api/v1/markets")
    assert res.status_code == 401

    client, _, _ = authenticated_client("market_auth_test@example.com")
    authed_res = client.get("/api/v1/markets")
    assert authed_res.status_code == 200


def test_logout_invalidates_session() -> None:
    client, _, headers = authenticated_client("logout_test@example.com")
    # Verify logged in
    assert client.get("/api/v1/auth/me").status_code == 200

    # Logout with CSRF header
    logout_res = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_res.status_code == 204

    # Subsequent call fails
    assert client.get("/api/v1/auth/me").status_code == 401
