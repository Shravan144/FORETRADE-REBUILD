from fastapi.testclient import TestClient

from app.main import app


def authenticated_client(email: str = "owner@example.com") -> tuple[TestClient, str, dict[str, str]]:
    client = TestClient(app)
    assert client.post("/api/v1/auth/register", json={"email": email, "password": "correct horse battery staple"}).status_code == 201
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "correct horse battery staple"})
    assert login.status_code == 200
    workspace_id = client.get("/api/v1/workspaces").json()["items"][0]["id"]
    return client, workspace_id, {"X-CSRF-Token": login.json()["csrf_token"]}


def test_auth_requires_a_real_session_and_csrf_for_writes() -> None:
    client = TestClient(app)
    assert client.get("/api/v1/workspaces").status_code == 401
    client, workspace_id, headers = authenticated_client()
    assert client.post(f"/api/v1/workspaces/{workspace_id}/market-watchlist", json={"country_code": "AE", "hs_code": "6109"}).status_code == 403
    assert client.post(f"/api/v1/workspaces/{workspace_id}/market-watchlist", json={"country_code": "AE", "hs_code": "6109"}, headers=headers).status_code == 201


def test_new_login_rotates_existing_session() -> None:
    first = TestClient(app)
    assert first.post("/api/v1/auth/register", json={"email": "rotate@example.com", "password": "correct horse battery staple"}).status_code == 201
    assert first.post("/api/v1/auth/login", json={"email": "rotate@example.com", "password": "correct horse battery staple"}).status_code == 200
    second = TestClient(app)
    assert second.post("/api/v1/auth/login", json={"email": "rotate@example.com", "password": "correct horse battery staple"}).status_code == 200
    assert first.get("/api/v1/auth/me").status_code == 401
    assert second.get("/api/v1/auth/me").status_code == 200


def test_login_rate_limit_blocks_repeated_failed_passwords() -> None:
    client = TestClient(app)
    assert client.post("/api/v1/auth/register", json={"email": "limited@example.com", "password": "correct horse battery staple"}).status_code == 201
    for _ in range(10):
        assert client.post("/api/v1/auth/login", json={"email": "limited@example.com", "password": "wrong password"}).status_code == 401
    blocked = client.post("/api/v1/auth/login", json={"email": "limited@example.com", "password": "wrong password"})
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "login_rate_limited"


def test_google_start_uses_oidc_authorization_code_with_pkce(monkeypatch) -> None:
    from app.core.config import settings

    old_values = settings.google_client_id, settings.google_client_secret, settings.google_redirect_uri
    object.__setattr__(settings, "google_client_id", "client-id")
    object.__setattr__(settings, "google_client_secret", "client-secret")
    object.__setattr__(settings, "google_redirect_uri", "http://testserver/api/v1/auth/google/callback")
    try:
        response = TestClient(app).get("/api/v1/auth/google/start", follow_redirects=False)
    finally:
        object.__setattr__(settings, "google_client_id", old_values[0])
        object.__setattr__(settings, "google_client_secret", old_values[1])
        object.__setattr__(settings, "google_redirect_uri", old_values[2])
    assert response.status_code == 302
    assert "response_type=code" in response.headers["location"]
    assert "code_challenge=" in response.headers["location"]
    assert response.cookies.get("foretrade_google_state") is None


def test_google_callback_rejects_unknown_or_reused_state(monkeypatch) -> None:
    from app.core.config import settings

    old_values = settings.google_client_id, settings.google_client_secret, settings.google_redirect_uri
    object.__setattr__(settings, "google_client_id", "client-id")
    object.__setattr__(settings, "google_client_secret", "client-secret")
    object.__setattr__(settings, "google_redirect_uri", "http://testserver/api/v1/auth/google/callback")
    try:
        response = TestClient(app).get("/api/v1/auth/google/callback?code=code&state=unknown")
    finally:
        object.__setattr__(settings, "google_client_id", old_values[0])
        object.__setattr__(settings, "google_client_secret", old_values[1])
        object.__setattr__(settings, "google_redirect_uri", old_values[2])
    assert response.status_code == 400
    assert response.json()["detail"] == "invalid_google_oauth_state"


def test_google_callback_creates_session_after_verified_identity(monkeypatch) -> None:
    from urllib.parse import parse_qs, urlparse
    from app.api.v1 import auth as auth_module
    from app.core.config import settings

    old_values = settings.google_client_id, settings.google_client_secret, settings.google_redirect_uri
    object.__setattr__(settings, "google_client_id", "client-id")
    object.__setattr__(settings, "google_client_secret", "client-secret")
    object.__setattr__(settings, "google_redirect_uri", "http://testserver/api/v1/auth/google/callback")
    monkeypatch.setattr(auth_module, "exchange_google_authorization", lambda code, verifier, nonce: {"email": "google@example.com", "email_verified": True, "sub": "google-subject"}, raising=False)
    try:
        client = TestClient(app)
        start = client.get("/api/v1/auth/google/start", follow_redirects=False)
        state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
        response = client.get(f"/api/v1/auth/google/callback?code=one-time-code&state={state}")
    finally:
        object.__setattr__(settings, "google_client_id", old_values[0])
        object.__setattr__(settings, "google_client_secret", old_values[1])
        object.__setattr__(settings, "google_redirect_uri", old_values[2])
    assert response.status_code == 200
    assert response.json()["email"] == "google@example.com"
    assert response.json()["csrf_token"]
    assert client.get("/api/v1/auth/me").json()["email"] == "google@example.com"


def test_import_commit_scores_leads_and_exports_are_persistent() -> None:
    client, workspace_id, headers = authenticated_client()
    csv = b"Company,Country,Product,Website,Email\nAcme Textiles,AE,Apparel,https://acme.example,buyer@acme.example\n"
    uploaded = client.post(f"/api/v1/workspaces/{workspace_id}/imports", files={"file": ("buyers.csv", csv, "text/csv")}, headers=headers)
    assert uploaded.status_code == 202
    job_id = uploaded.json()["id"]
    preview = client.get(f"/api/v1/jobs/{job_id}/preview")
    assert preview.status_code == 200
    committed = client.post(f"/api/v1/jobs/{job_id}/commit", json={"mapping": {"Company": "company_name", "Country": "country_code", "Product": "product_or_industry", "Website": "website", "Email": "contact_email"}}, headers=headers)
    assert committed.status_code == 200
    assert committed.json()["summary"] == {"created": 1, "updated": 0, "invalid": 0}
    company = client.get(f"/api/v1/workspaces/{workspace_id}/companies").json()["items"][0]
    assert client.post(f"/api/v1/workspaces/{workspace_id}/exporter-profile", json={"capacity_tons": 100, "product_categories": ["apparel"]}, headers=headers).status_code == 200
    score = client.post(f"/api/v1/workspaces/{workspace_id}/companies/{company['id']}/scores", headers=headers)
    assert score.status_code == 201 and score.json()["score"] >= 70
    lead = client.post(f"/api/v1/workspaces/{workspace_id}/leads", json={"company_id": company["id"]}, headers=headers)
    assert lead.status_code == 201
    lead_id = lead.json()["id"]
    assert client.patch(f"/api/v1/workspaces/{workspace_id}/leads/{lead_id}/stage", json={"stage": "replied"}, headers=headers).status_code == 409
    assert client.post(f"/api/v1/workspaces/{workspace_id}/leads/{lead_id}/events", json={"event_type": "reply_received"}, headers=headers).status_code == 201
    assert client.patch(f"/api/v1/workspaces/{workspace_id}/leads/{lead_id}/stage", json={"stage": "replied"}, headers=headers).status_code == 200
    analytics = client.get(f"/api/v1/workspaces/{workspace_id}/analytics")
    assert analytics.json()["companies"] == 1 and analytics.json()["pipeline"]["replied"] == 1
    export = client.post(f"/api/v1/workspaces/{workspace_id}/exports/companies", headers=headers)
    assert export.status_code == 202
    assert client.get(export.json()["download_url"]).status_code == 200


def test_workspace_data_is_not_visible_to_another_user() -> None:
    first, workspace_id, headers = authenticated_client("first@example.com")
    assert first.post(f"/api/v1/workspaces/{workspace_id}/market-watchlist", json={"country_code": "AE", "hs_code": "6109"}, headers=headers).status_code == 201
    second, _, _ = authenticated_client("second@example.com")
    assert second.get(f"/api/v1/workspaces/{workspace_id}/market-watchlist").status_code == 404


def test_user_profile_and_exporter_settings_flow() -> None:
    client = TestClient(app)
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "director@agroexports.example",
            "password": "correct horse battery staple",
            "full_name": "Rajesh Sharma",
            "company_name": "Agro Exports Ltd",
        },
    )
    assert reg.status_code == 201
    assert reg.json()["full_name"] == "Rajesh Sharma"

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "director@agroexports.example", "password": "correct horse battery staple"},
    )
    assert login.status_code == 200
    csrf = login.json()["csrf_token"]
    headers = {"X-CSRF-Token": csrf}

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["full_name"] == "Rajesh Sharma"

    patch_me = client.patch(
        "/api/v1/auth/me",
        json={"full_name": "Rajesh Kumar Sharma", "job_title": "VP International Trade"},
        headers=headers,
    )
    assert patch_me.status_code == 200
    assert patch_me.json()["full_name"] == "Rajesh Kumar Sharma"
    assert patch_me.json()["job_title"] == "VP International Trade"

    workspaces = client.get("/api/v1/workspaces").json()["items"]
    assert len(workspaces) >= 1
    assert "Agro Exports Ltd" in workspaces[0]["name"]
    ws_id = workspaces[0]["id"]

    profile_save = client.post(
        f"/api/v1/workspaces/{ws_id}/exporter-profile",
        json={
            "company_name": "Agro Exports Ltd",
            "company_address": "Plot 42, EPIP, Navi Mumbai",
            "origin_country": "IN",
            "origin_port": "Nhava Sheva (JNPT)",
            "iec_code": "0311029481",
            "tax_id": "27AABCF1234F1Z5",
            "bank_name": "State Bank of India",
            "bank_account": "309812458923",
            "bank_swift": "SBININBB001",
        },
        headers=headers,
    )
    assert profile_save.status_code == 200
    payload = profile_save.json()["payload"]
    assert payload["iec_code"] == "0311029481"
    assert payload["bank_swift"] == "SBININBB001"

