import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.trade_intelligence import GlobalBuyerCatalog


def test_buyer_contacts_api_endpoints():
    client = TestClient(app)
    with SessionLocal() as db_session:
        # Seed buyer
        buyer = GlobalBuyerCatalog(
            id="test-buyer-api-contacts",
            company_name="EuroTech Importers GmbH",
            normalized_name="eurotech importers gmbh",
            country_code="DE",
            city="Munich",
            website="https://www.eurotech-import.de",
            primary_sector="Automotive",
            customs_manifest_provenance="CBP-BOL-8888",
        )
        db_session.add(buyer)
        db_session.commit()

    # Test GET contacts endpoint
    resp = client.get("/api/v1/intelligence/buyers/test-buyer-api-contacts/contacts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["buyer_id"] == "test-buyer-api-contacts"
    assert data["total"] >= 2
    assert len(data["contacts"]) >= 2
    contact = data["contacts"][0]
    assert "@eurotech-import.de" in contact["email"]
    assert contact["country_code"] == "DE"
    assert contact["phone_number"].startswith("+49")

    # Test POST force re-enrich endpoint
    resp_enrich = client.post("/api/v1/intelligence/buyers/test-buyer-api-contacts/enrich-contacts")
    assert resp_enrich.status_code == 200
    data_enrich = resp_enrich.json()
    assert data_enrich["total"] >= 2
