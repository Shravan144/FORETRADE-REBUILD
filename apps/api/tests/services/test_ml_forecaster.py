"""
Unit and Integration Tests for Model 1: Market Opportunity Scorer (Time-Series Forecasting).
"""

import pytest
from app.db.session import SessionLocal
from app.services.data_pipeline.run_pipeline import run_all_pipelines
from app.services.ml.corridor_forecaster import score_corridor_opportunity


@pytest.fixture(autouse=True)
def setup_pipeline_data():
    run_all_pipelines()


def test_corridor_forecast_flagship_us_apparel() -> None:
    session = SessionLocal()
    try:
        # Test India -> US Cotton T-Shirts (HS 6109)
        result = score_corridor_opportunity(
            db=session,
            origin_country="IN",
            destination_country="US",
            hs_code="6109",
        )
        assert result is not None
        assert result.origin_country == "IN"
        assert result.destination_country == "US"
        assert result.hs_code == "6109"

        # Check multi-year historical tracking
        assert len(result.historical_years) >= 3
        assert len(result.historical_values_usd) == len(result.historical_years)

        # 12-month Forecast verification
        fc_12 = result.forecast_12m
        assert fc_12.projected_usd > 500_000_000.0  # Scale validation

        # Statistical confidence interval mathematical properties
        # 80% CI must bound the projection
        assert fc_12.ci_80_lower < fc_12.projected_usd
        assert fc_12.projected_usd < fc_12.ci_80_upper

        # 95% CI must be strictly wider than 80% CI
        assert fc_12.ci_95_lower <= fc_12.ci_80_lower
        assert fc_12.ci_95_upper >= fc_12.ci_80_upper

        # 24-month forecast should have wider intervals than 12-month
        fc_24 = result.forecast_24m
        interval_12m = fc_12.ci_95_upper - fc_12.ci_95_lower
        interval_24m = fc_24.ci_95_upper - fc_24.ci_95_lower
        assert interval_24m > interval_12m  # Uncertainty expands with time horizon

        # Opportunity Index bounds
        assert 50.0 <= result.opportunity_index <= 100.0
        assert result.opportunity_tier in ["High Opportunity", "Moderate Growth", "Emerging"]
        assert len(result.explanation_factors) >= 3

        # Test dictionary conversion
        d = result.to_dict()
        assert "opportunity_index" in d
        assert "forecast_12m" in d
    finally:
        session.close()


def test_corridor_forecast_germany_auto_parts() -> None:
    session = SessionLocal()
    try:
        # Test India -> Germany Auto Components (HS 8708)
        result = score_corridor_opportunity(
            db=session,
            origin_country="IN",
            destination_country="DE",
            hs_code="8708",
        )
        assert result is not None
        assert result.destination_country == "DE"
        assert result.forecast_12m.projected_usd > 200_000_000.0
        assert result.projected_cagr_pct > 0.0
        assert result.risk_adjusted_rating in ["A+", "A", "B+"]
    finally:
        session.close()


def test_corridor_forecast_nonexistent_corridor_returns_none() -> None:
    session = SessionLocal()
    try:
        # Nonexistent trade pair
        result = score_corridor_opportunity(
            db=session,
            origin_country="XX",
            destination_country="YY",
            hs_code="9999",
        )
        assert result is None
    finally:
        session.close()
