"""
Unit and Integration Tests for Model 3: Cross-Border Trade Risk Classifier (XGBoost).
"""

import pytest
from app.db.session import SessionLocal
from app.services.data_pipeline.run_pipeline import run_all_pipelines
from app.services.ml.risk_classifier import (
    get_or_train_risk_model,
    assess_trade_risk,
)


@pytest.fixture(autouse=True)
def setup_pipeline_data():
    run_all_pipelines()


def test_xgboost_risk_model_initialization_and_shape() -> None:
    model = get_or_train_risk_model()
    assert model is not None
    assert model.n_classes_ == 3


def test_low_risk_scenario_us_letter_of_credit() -> None:
    session = SessionLocal()
    try:
        # Safe transaction: US destination, $40,000 order, Letter of Credit (LC)
        assessment = assess_trade_risk(
            db=session,
            destination_country="US",
            invoice_amount_usd=40_000.0,
            payment_terms="lc",
            buyer_name="Manhattan Apparel Imports LLC",
        )
        assert assessment is not None
        assert assessment.destination_country == "US"
        assert assessment.risk_tier == "Low Risk"
        assert assessment.composite_risk_score < 45.0
        assert assessment.class_probabilities["low"] > 0.50
        assert len(assessment.mitigation_strategies) >= 1
    finally:
        session.close()


def test_high_risk_scenario_unsecured_open_account_high_exposure() -> None:
    session = SessionLocal()
    try:
        # High risk: Open Account (unsecured credit) with 75% invoice-to-buyer concentration ratio
        assessment = assess_trade_risk(
            db=session,
            destination_country="FR",
            invoice_amount_usd=400_000.0,
            payment_terms="open_account",
            buyer_name="Small Local Trader",
        )
        assert assessment is not None
        assert assessment.risk_tier in ["High Risk", "Moderate Risk"]
        assert assessment.composite_risk_score > 50.0
        assert len(assessment.top_risk_factors) >= 1
        # Check that high-risk mitigations include LC or ECGC insurance
        combined_mitigations = " ".join(assessment.mitigation_strategies)
        assert "Letter of Credit" in combined_mitigations or "advance" in combined_mitigations.lower()
    finally:
        session.close()
