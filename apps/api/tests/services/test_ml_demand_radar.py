"""
Unit and Integration Tests for Model 4: Real-Time Demand Radar (NLP Signal Extractor).
"""

import pytest
from app.db.session import SessionLocal
from app.services.data_pipeline.run_pipeline import run_all_pipelines
from app.services.ml.demand_radar import (
    extract_demand_signal,
    _extract_monetary_amount,
    _extract_country,
    _extract_deadline,
    _infer_signal_type_and_intent,
)


@pytest.fixture(autouse=True)
def setup_pipeline_data():
    run_all_pipelines()


def test_monetary_amount_extraction():
    # Various formats: $40M, 15 million USD, EUR 25M, $500K
    assert _extract_monetary_amount("Egypt issues $40M emergency tender") == 40_000_000.0
    assert _extract_monetary_amount("Valued at 15 million USD") == 15_000_000.0
    assert _extract_monetary_amount("Contract worth $500K for urgent delivery") == 500_000.0
    assert _extract_monetary_amount("No monetary amount specified here") is None


def test_country_extraction():
    assert _extract_country("German Federal Agency announces procurement") == "DE"
    assert _extract_country("Ministry of Education in Kenya issues tender") == "KE"
    assert _extract_country("Egypt General Authority for Supply Commodities") == "EG"
    assert _extract_country("Dubai Health Authority opens contracts") == "AE"
    assert _extract_country("Unspecified overseas buyers announce requirements") == "US"  # default fallback


def test_deadline_extraction():
    res1 = _extract_deadline("Tender closing in 30 days for emergency grains")
    assert "30 days" in res1

    res2 = _extract_deadline("All bids due in 45 days at the procurement office")
    assert "45 days" in res2

    res3 = _extract_deadline("Ongoing open market trade bulletin")
    assert res3 == "Open / Ongoing"


def test_extract_demand_signal_egypt_wheat():
    session = SessionLocal()
    try:
        raw_text = "Egypt General Authority for Supply Commodities (GASC) issues $40M emergency international tender for wheat and agricultural packaging materials, closing in 30 days."
        signal = extract_demand_signal(session, raw_text, source_channel="UN GASC Notice")

        assert signal.target_country == "EG"
        assert signal.estimated_budget_usd == 40_000_000.0
        assert "30 days" in (signal.deadline_text or "")
        assert signal.intent_score >= 0.85
        assert signal.signal_type in ["Procurement Tender", "Sudden Demand Surge"]
        assert signal.hs_code is not None
        assert "wheat" in raw_text.lower()
    finally:
        session.close()


def test_extract_demand_signal_kenya_textiles():
    session = SessionLocal()
    try:
        raw_text = "Kenya Ministry of Education announces $15M procurement tender for cotton school uniforms and knitwear apparel for national public schools, bids due in 45 days."
        signal = extract_demand_signal(session, raw_text, source_channel="Kenya e-Procurement")

        assert signal.target_country == "KE"
        assert signal.estimated_budget_usd == 15_000_000.0
        assert "45 days" in (signal.deadline_text or "")
        assert signal.hs_code in ["52", "6109", "610910", "61"]
        assert "Textiles" in signal.product_category or "Apparel" in signal.product_category
        assert signal.intent_score >= 0.90
    finally:
        session.close()


def test_extract_demand_signal_australia_quota():
    session = SessionLocal()
    try:
        raw_text = "Australia Clean Energy Council opens $22M preferential import duty-free quota for high-efficiency solar panels under the ECTA trade corridor."
        signal = extract_demand_signal(session, raw_text, source_channel="Austrade")

        assert signal.target_country == "AU"
        assert signal.estimated_budget_usd == 22_000_000.0
        assert signal.signal_type == "Government Quota Opening"
        assert signal.hs_code in ["8541", "854140"]
    finally:
        session.close()
