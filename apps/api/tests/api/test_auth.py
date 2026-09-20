from fastapi.testclient import TestClient
from app.main import app


def test_password_hash_is_argon2_and_never_returned() -> None:
    created = TestClient(app).post("/api/v1/auth/register", json={"email": "a@example.com", "password": "correct horse battery staple"})
    assert created.status_code == 201
    assert "password_hash" not in created.json()


def test_google_start_without_credentials_is_explicit() -> None:
    response = TestClient(app).get("/api/v1/auth/google/start")
    assert response.status_code == 503
    assert response.json()["code"] == "google_oauth_unconfigured"
