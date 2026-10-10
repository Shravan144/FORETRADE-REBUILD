import pytest
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.trade_intelligence import GlobalBuyerCatalog, EnrichedBuyerContact
from app.services.contact_enrichment import (
    clean_domain,
    generate_smart_procurement_personas,
    get_or_enrich_buyer_contacts,
)


def test_clean_domain_utility():
    assert clean_domain("https://www.target.com/about") == "target.com"
    assert clean_domain("http://aldi-sued.de/catalog?item=1") == "aldi-sued.de"
    assert clean_domain("walmart.com") == "walmart.com"
    assert clean_domain("Some US Importer LLC") == "someusimporterllc.com"


def test_generate_smart_procurement_personas():
    personas = generate_smart_procurement_personas(
        company_name="Zara Inditex S.A.",
        domain="inditex.com",
        country_code="ES",
        primary_sector="Textiles & Apparel",
        city="Arteixo",
    )
    assert len(personas) == 3
    assert personas[0]["is_primary"] is True
    assert "@inditex.com" in personas[0]["email"]
    assert "Sourcing" in personas[0]["job_title"] or "Apparel" in personas[0]["job_title"]
    assert personas[0]["linkedin_url"].startswith("https://www.linkedin.com/in/")
    assert personas[0]["deliverability_score"] >= 90.0


def test_buyer_contact_enrichment_and_caching():
    with SessionLocal() as db_session:
        # Create test buyer
        buyer = GlobalBuyerCatalog(
            id="test-buyer-enrich-1",
            company_name="Apex Global Apparel Inc",
            normalized_name="apex global apparel inc",
            country_code="US",
            city="New York",
            website="https://www.apexapparel.com",
            primary_sector="Textiles",
            customs_manifest_provenance="CBP-BOL-9999",
        )
        db_session.add(buyer)
        db_session.commit()

        # First call: Enriches and caches
        contacts_first = get_or_enrich_buyer_contacts(db_session, buyer_id="test-buyer-enrich-1")
        assert len(contacts_first) >= 2
        assert contacts_first[0]["buyer_id"] == "test-buyer-enrich-1"
        assert "@apexapparel.com" in contacts_first[0]["email"]

        # Verify rows in DB
        cached_db_rows = db_session.scalars(
            select(EnrichedBuyerContact).where(EnrichedBuyerContact.buyer_id == "test-buyer-enrich-1")
        ).all()
        assert len(cached_db_rows) == len(contacts_first)

        # Second call: Returns from cache
        contacts_second = get_or_enrich_buyer_contacts(db_session, buyer_id="test-buyer-enrich-1")
        assert len(contacts_second) == len(contacts_first)
        assert contacts_second[0]["id"] == contacts_first[0]["id"]

        # Force refresh replaces cache
        contacts_refreshed = get_or_enrich_buyer_contacts(
            db_session, buyer_id="test-buyer-enrich-1", force_refresh=True
        )
        assert len(contacts_refreshed) >= 2


def test_hunter_api_parsing_mock(monkeypatch):
    from unittest.mock import MagicMock
    import urllib.request
    import json
    from app.services.contact_enrichment import query_hunter_api, fetch_live_contacts

    fake_hunter_response = {
        "data": {
            "domain": "acmeprocurement.com",
            "emails": [
                {
                    "value": "sarah.connor@acmeprocurement.com",
                    "first_name": "Sarah",
                    "last_name": "Connor",
                    "position": "Chief Procurement Officer",
                    "seniority": "executive",
                    "department": "procurement",
                    "confidence": 96,
                    "linkedin": "https://linkedin.com/in/sarah-connor",
                    "phone_number": "+1 212 555 0199",
                }
            ],
        }
    }

    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.read.return_value = json.dumps(fake_hunter_response).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout=8: mock_resp)

    results = query_hunter_api("acmeprocurement.com", "fake_hunter_key_123")
    assert results is not None
    assert len(results) == 1
    assert results[0]["email"] == "sarah.connor@acmeprocurement.com"
    assert results[0]["first_name"] == "Sarah"
    assert results[0]["email_status"] == "verified"
    assert results[0]["confidence"] == 96.0

    # Also test fetch_live_contacts prioritizing Hunter
    monkeypatch.setenv("HUNTER_API_KEY", "fake_hunter_key_123")
    live_contacts = fetch_live_contacts("acmeprocurement.com", city="Chicago", country_code="US")
    assert len(live_contacts) == 1
    assert live_contacts[0]["source"] == "hunter_api"
    assert live_contacts[0]["email"] == "sarah.connor@acmeprocurement.com"
    assert live_contacts[0]["is_primary"] is True

