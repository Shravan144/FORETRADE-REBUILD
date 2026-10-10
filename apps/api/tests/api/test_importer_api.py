"""
End-to-End Integration Tests for Importer Procurement Desk:
1. Statutory corporate customs identifiers validation (EIN, EORI, TRN, ABN)
2. Importer Profile creation & auto-sync with GlobalBuyerCatalog
3. Sourcing RFQ publication & automatic injection into Demand Radar (MarketDemandSignal)
4. Inbound proposal response workflow (Accept, Request Sample, Decline)
"""

import pytest
from app.api.v1.importer import validate_statutory_tax_id
from tests.api.test_workspace_flows import authenticated_client


def test_statutory_tax_id_validator():
    """Validates international corporate customs/tax credentials."""
    # US EIN: 9 numeric digits
    assert validate_statutory_tax_id("EIN", "12-3456789", "US") is True
    assert validate_statutory_tax_id("EIN", "123456789", "US") is True
    assert validate_statutory_tax_id("EIN", "12345", "US") is False

    # EU EORI: 2 letters + 8-15 alphanumeric
    assert validate_statutory_tax_id("EORI", "DE123456789012", "DE") is True
    assert validate_statutory_tax_id("EORI", "FR987654321098", "FR") is True
    assert validate_statutory_tax_id("EORI", "12345", "DE") is False

    # UK EORI: GB followed by 12 digits
    assert validate_statutory_tax_id("UK_EORI", "GB123456789012", "GB") is True
    assert validate_statutory_tax_id("UK_EORI", "FR123456789012", "GB") is False

    # UAE TRN: 15 digits
    assert validate_statutory_tax_id("TRN", "100123456789012", "AE") is True
    assert validate_statutory_tax_id("TRN", "12345", "AE") is False

    # Australian ABN: 11 digits
    assert validate_statutory_tax_id("ABN", "12345678901", "AU") is True
    assert validate_statutory_tax_id("ABN", "12345", "AU") is False


def test_importer_desk_end_to_end_flow():
    """Tests the full lifecycle of an overseas buyer using ForeTrade."""
    client, workspace_id, headers = authenticated_client("global_buyer_direct@pacificsourcing.com")

    # 1. Profile initially 404
    get_res = client.get(f"/api/v1/workspaces/{workspace_id}/importer-profile")
    assert get_res.status_code == 404

    # 2. Register Importer Profile with US EIN
    profile_payload = {
        "company_name": "Pacific Sourcing Logistics LLC",
        "trade_name_dba": "Pacific Global Sourcing",
        "country_code": "US",
        "city": "Los Angeles",
        "headquarters_address": "100 Ocean Blvd, Suite 400, Los Angeles, CA 90015",
        "corporate_website": "https://www.pacificsourcing.com",
        "duns_number": "987654321",
        "tax_identifier_type": "EIN",
        "tax_identifier_value": "95-8844221",
        "contact_name": "Marcus Vance",
        "contact_title": "Director of Global Sourcing",
        "contact_email": "marcus.vance@pacificsourcing.com",
        "contact_phone": "+1 213 555 0199",
        "primary_discharge_port": "USLAX",
        "secondary_discharge_port": "USNYC",
        "customs_broker_name": "Flexport Logistics",
        "preferred_container_type": "40ft_hc",
        "warehouse_dock_type": "palletized_forklift",
        "primary_sector": "Textiles & Garments",
        "target_hs_codes": ["6109.10", "6205.20"],
        "annual_sourcing_budget_usd": 6500000.0,
        "order_cycle_days": 30,
        "min_order_quantity_mt": 25.0,
        "consignee_name_on_bol": "Pacific Sourcing Logistics LLC",
        "required_certifications": ["ISO 9001:2015", "OEKO-TEX Standard 100"],
        "preferred_incoterm": "CIF",
        "payment_terms": "letter_of_credit",
        "issuing_bank_name": "JPMorgan Chase Bank, N.A.",
        "issuing_bank_swift": "CHASUS33",
        "currency": "USD",
        "is_publicly_discoverable": True,
    }

    create_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/importer-profile",
        json=profile_payload,
        headers=headers,
    )
    assert create_res.status_code == 200, create_res.text
    profile_data = create_res.json()
    assert profile_data["company_name"] == "Pacific Sourcing Logistics LLC"
    assert profile_data["primary_discharge_port"] == "USLAX"
    assert profile_data["catalog_buyer_id"] is not None

    # 3. Verify Buyer is discoverable in Buyer Catalog with Verified provenance
    buyers_res = client.get("/api/v1/intelligence/buyers?query=Pacific Sourcing")
    assert buyers_res.status_code == 200
    catalog_items = buyers_res.json()["items"]
    assert any(b["company_name"] == "Pacific Sourcing Logistics LLC" for b in catalog_items)

    # 4. Publish a Sourcing RFQ (Procurement Tender)
    rfq_payload = {
        "title": "Sourcing 50 MT Combed Cotton Jersey Fabric",
        "commodity_description": "100% Cotton 30s combed yarn, 180 GSM, OEKO-TEX certified, reactive dyed",
        "product_category": "Textiles & Apparel",
        "hs_code": "6109.10",
        "target_quantity": 50.0,
        "quantity_unit": "Metric Tons (MT)",
        "target_budget_usd": 320000.0,
        "target_unit_price_usd": 6400.0,
        "destination_country": "US",
        "destination_port": "USLAX",
        "preferred_incoterm": "CIF",
        "preferred_container_type": "40ft_hc",
        "required_certifications": ["OEKO-TEX Standard 100", "ISO 9001"],
        "inspection_agency_allowed": "SGS / Bureau Veritas",
        "special_technical_clauses": "Moisture content strictly under 8.5%",
        "deadline_date": "2026-11-30",
        "target_delivery_date": "2026-12-31",
    }

    rfq_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/rfqs",
        json=rfq_payload,
        headers=headers,
    )
    assert rfq_res.status_code == 201, rfq_res.text
    rfq_data = rfq_res.json()
    assert rfq_data["title"] == "Sourcing 50 MT Combed Cotton Jersey Fabric"
    assert rfq_data["status"] == "ACTIVE"
    rfq_id = rfq_data["id"]

    # 5. List RFQs for this workspace
    list_rfqs_res = client.get(f"/api/v1/workspaces/{workspace_id}/rfqs")
    assert list_rfqs_res.status_code == 200
    rfqs = list_rfqs_res.json()["items"]
    assert len(rfqs) >= 1
    assert any(r["id"] == rfq_id for r in rfqs)

    # 6. Verify RFQ is visible on Demand Radar
    radar_res = client.get("/api/v1/intelligence/demand-signals")
    assert radar_res.status_code == 200
    signals = radar_res.json().get("items", [])
    assert any("Pacific Sourcing" in s.get("title", "") or "6109.10" in s.get("hs_code", "") for s in signals)

    # 7. Test Inbound Proposals endpoint
    proposals_res = client.get(f"/api/v1/workspaces/{workspace_id}/inbound-proposals")
    assert proposals_res.status_code == 200
    assert "items" in proposals_res.json()

    # 8. Insert a mock proposal and test response handling
    from app.db.session import SessionLocal
    from app.models.importer import InboundProposal

    with SessionLocal() as db:
        mock_proposal = InboundProposal(
            importer_workspace_id=workspace_id,
            exporter_workspace_id=workspace_id,
            rfq_id=rfq_id,
            exporter_company_name="Varanasi Silk & Handlooms Ltd",
            exporter_country_code="IN",
            exporter_origin_port="INNSA",
            exporter_readiness_score=94.5,
            proposal_channel="Direct ForeTrade Network",
            subject="Commercial Offer for 50 MT Combed Cotton Single Jersey",
            proposal_body="We offer 50 MT combed cotton single jersey at $6,200/MT CIF USLAX.",
            offered_unit_price_usd=6200.0,
            offered_incoterm="CIF",
            estimated_transit_days=18,
            duty_savings_usd=12500.0,
            status="pending",
        )
        db.add(mock_proposal)
        db.commit()
        db.refresh(mock_proposal)
        prop_id = mock_proposal.id

    # Test responding: Accept proposal
    resp = client.patch(
        f"/api/v1/workspaces/{workspace_id}/inbound-proposals/{prop_id}/respond",
        json={"status": "accepted", "feedback_notes": "Accepted subject to SGS pre-shipment report."},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"
    assert resp.json()["importer_feedback_notes"] == "Accepted subject to SGS pre-shipment report."

    # 9. Test Deal Room Negotiation Messaging
    # Send regular message
    msg_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/negotiations/{prop_id}/messages",
        json={"message_text": "Hello factory, can you confirm shipment date?", "message_type": "text"},
        headers=headers,
    )
    assert msg_res.status_code == 201, msg_res.text
    msg_data = msg_res.json()
    assert msg_data["message_text"] == "Hello factory, can you confirm shipment date?"
    assert msg_data["sender_role"] == "importer"

    # Send counter-offer
    counter_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/negotiations/{prop_id}/messages",
        json={
            "message_text": "Counter-offer: $5,900/MT CIF USLAX",
            "message_type": "counter_offer",
            "payload": {"counter_unit_price_usd": 5900.0, "incoterm": "CIF"},
        },
        headers=headers,
    )
    assert counter_res.status_code == 201
    assert counter_res.json()["message_type"] == "counter_offer"

    # List messages
    msgs_res = client.get(f"/api/v1/workspaces/{workspace_id}/negotiations/{prop_id}/messages")
    assert msgs_res.status_code == 200
    assert msgs_res.json()["total"] >= 2


