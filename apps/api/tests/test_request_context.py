from fastapi.testclient import TestClient
from app.main import app


def test_response_echoes_correlation_id() -> None:
    response = TestClient(app).get("/api/v1/system/status", headers={"X-Request-ID": "test-request"})
    assert response.headers["X-Request-ID"] == "test-request"
