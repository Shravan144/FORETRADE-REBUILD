"""
Unit and Integration Tests for Model 2: Two-Tower Matchmaking Engine ("Swipe to Export").
"""

import pytest
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.trade_intelligence import GlobalBuyerCatalog
from app.services.data_pipeline.run_pipeline import run_all_pipelines
from app.services.ml.matchmaking_engine import (
    encode_exporter,
    encode_buyer,
    evaluate_capacity_fit,
    evaluate_compliance_match,
    rank_buyer_recommendations,
)


@pytest.fixture(autouse=True)
def setup_pipeline_data():
    run_all_pipelines()


def test_tower_encoders_vector_shape_and_norm() -> None:
    session = SessionLocal()
    try:
        profile = {
            "product_categories": ["textiles", "apparel", "6109"],
            "certifications": ["ISO 9001", "OEKO-TEX Standard 100"],
            "target_countries": ["US", "DE"],
        }
        vec_exp = encode_exporter(profile)
        assert len(vec_exp) > 30
        assert abs(float(sum(vec_exp**2)) - 1.0) < 1e-4  # Unit norm

        buyer = session.scalar(select(GlobalBuyerCatalog).limit(1))
        assert buyer is not None
        vec_buy = encode_buyer(buyer)
        assert len(vec_buy) == len(vec_exp)
        assert abs(float(sum(vec_buy**2)) - 1.0) < 1e-4  # Unit norm
    finally:
        session.close()


def test_capacity_fit_curve() -> None:
    # Optimal ratio: 300T producing for 75T order = 4.0x
    pts, reason = evaluate_capacity_fit(300.0, 75.0)
    assert pts == 25.0
    assert "Capacity optimal" in reason

    # Under-capacity alert: 20T producing for 100T order = 0.2x
    low_pts, low_reason = evaluate_capacity_fit(20.0, 100.0)
    assert low_pts < 15.0
    assert "alert" in low_reason.lower()


def test_compliance_matching() -> None:
    held = ["ISO 9001", "OEKO-TEX Standard 100", "GOTS Organic"]
    reqs = ["OEKO-TEX Standard 100", "GOTS Organic"]

    pts, reason = evaluate_compliance_match(held, reqs)
    assert pts == 20.0  # 100% fulfilled
    assert "100% Compliance match" in reason

    # Missing requirement
    strict_reqs = ["UL 1703", "IEC 61215"]
    bad_pts, bad_reason = evaluate_compliance_match(held, strict_reqs)
    assert bad_pts == 0.0
    assert "Missing" in bad_reason


def test_rank_buyer_recommendations_textile_exporter() -> None:
    session = SessionLocal()
    try:
        # Exporter: Indian Cotton Apparel Manufacturer
        textile_profile = {
            "company_name": "Bharat Global Textiles Ltd",
            "capacity_tons": 350.0,
            "product_categories": ["textiles", "apparel", "6109", "cotton"],
            "target_countries": ["US", "DE", "GB", "AE"],
            "certifications": ["ISO 9001", "OEKO-TEX Standard 100", "GOTS Organic"],
            "min_order_value_usd": 25000.0,
        }

        recs = rank_buyer_recommendations(session, textile_profile, top_k=10)
        assert len(recs) >= 5

        # Top recommendations must be apparel/textile buyers in target countries
        top_rec = recs[0]
        assert top_rec.compatibility_score >= 80.0
        assert top_rec.match_tier in ["Strong Match", "Good Fit"]
        assert top_rec.primary_sector == "Textiles & Apparel"
        assert top_rec.country_code in ["US", "DE", "GB", "AE"]

        # Verify XAI explanations & breakdown factors
        assert len(top_rec.reasons) == 4
        fb = top_rec.factor_breakdown
        assert fb.product_similarity_pts > 15.0
        assert fb.capacity_alignment_pts > 15.0
        assert fb.compliance_match_pts > 15.0
        assert fb.corridor_alignment_pts == 20.0

        # Non-matching buyers (e.g. Solar in Japan or Auto in Germany) must be ranked lower
        solar_recs = [r for r in recs if r.primary_sector == "Renewables & Solar"]
        if solar_recs:
            assert solar_recs[0].compatibility_score < top_rec.compatibility_score
    finally:
        session.close()
