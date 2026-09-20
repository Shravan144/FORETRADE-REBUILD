from fastapi.testclient import TestClient
from app.main import app
def test_market_response_includes_source_period_and_version():
 row=TestClient(app).get("/api/v1/markets?hs_code=6109").json()["items"][0];assert {"source_name","source_period","dataset_version","refreshed_at"}<=row.keys()
