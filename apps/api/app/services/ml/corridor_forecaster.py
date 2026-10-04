"""
Model 1: Market Opportunity Scorer (Time-Series Forecasting Engine)
Predicts 12-month and 24-month trade flows, confidence intervals (80% & 95%),
CAGR momentum, and a composite Opportunity Index (0-100).
"""

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional
import math
import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trade_intelligence import TradeCorridorFlow, CountryRiskFactor


@dataclass
class ForecastPoint:
    year: int
    projected_usd: float
    ci_80_lower: float
    ci_80_upper: float
    ci_95_lower: float
    ci_95_upper: float


@dataclass
class OpportunityScoreResult:
    origin_country: str
    destination_country: str
    hs_code: str
    historical_years: List[int]
    historical_values_usd: List[float]
    forecast_12m: ForecastPoint
    forecast_24m: ForecastPoint
    projected_cagr_pct: float
    opportunity_index: float  # 0 to 100
    opportunity_tier: str     # "High Opportunity", "Moderate Growth", "Emerging", "Low Momentum"
    unit_value_trend: str     # "Expanding Margin", "Stable", "Price Compression"
    risk_adjusted_rating: str # "A+", "A", "B+", "B", "C"
    explanation_factors: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _fit_log_linear_trend(years: List[int], values: List[float]) -> tuple[float, float, float]:
    """
    Fits exponential trend model: ln(Y) = alpha + beta * (t - t0)
    Returns (alpha, beta, residual_std_error).
    """
    n = len(years)
    t0 = years[0]
    t_norm = np.array([yr - t0 for yr in years], dtype=float)
    
    # Avoid zero or negative values in log transform
    log_y = np.array([math.log(max(v, 1.0)) for v in values], dtype=float)

    # Ordinary Least Squares on log_y vs t_norm
    if n >= 2:
        # np.polyfit degree 1: log_y = beta * t_norm + alpha
        coeffs = np.polyfit(t_norm, log_y, 1)
        beta = float(coeffs[0])
        alpha = float(coeffs[1])
        predictions = alpha + beta * t_norm
        residuals = log_y - predictions
        dof = max(n - 2, 1)
        residual_std = float(math.sqrt(np.sum(residuals**2) / dof))
        # Floor standard error to avoid unrealistically narrow intervals
        residual_std = max(residual_std, 0.05)
    else:
        alpha = log_y[0] if n > 0 else 0.0
        beta = 0.05  # Default 5% trend
        residual_std = 0.10

    return alpha, beta, residual_std


def _calculate_forecast_point(
    target_year: int,
    t0: int,
    alpha: float,
    beta: float,
    std_err: float,
) -> ForecastPoint:
    """Project trade value and calculate 80% & 95% confidence intervals."""
    t_diff = target_year - t0
    log_pred = alpha + beta * t_diff
    pred_usd = math.exp(log_pred)

    # Critical values for standard normal distribution
    # Z_80% = 1.282, Z_95% = 1.960
    z_80 = 1.282
    z_95 = 1.960

    # Prediction interval expands with forecast horizon
    horizon_factor = math.sqrt(1.0 + (t_diff**2) / 10.0)
    se_scaled = std_err * horizon_factor

    return ForecastPoint(
        year=target_year,
        projected_usd=round(pred_usd, 2),
        ci_80_lower=round(max(pred_usd * math.exp(-z_80 * se_scaled), 0.0), 2),
        ci_80_upper=round(pred_usd * math.exp(z_80 * se_scaled), 2),
        ci_95_lower=round(max(pred_usd * math.exp(-z_95 * se_scaled), 0.0), 2),
        ci_95_upper=round(pred_usd * math.exp(z_95 * se_scaled), 2),
    )


def score_corridor_opportunity(
    db: Session,
    origin_country: str,
    destination_country: str,
    hs_code: str,
) -> Optional[OpportunityScoreResult]:
    """
    Run Model 1 time-series forecast & opportunity scoring on a specific trade corridor.
    """
    records = list(
        db.scalars(
            select(TradeCorridorFlow)
            .where(
                TradeCorridorFlow.origin_country == origin_country,
                TradeCorridorFlow.destination_country == destination_country,
                TradeCorridorFlow.hs_code == hs_code,
            )
            .order_by(TradeCorridorFlow.year.asc())
        )
    )

    if not records:
        return None

    years = [r.year for r in records]
    values = [float(r.trade_value_usd) for r in records]
    unit_values = [r.unit_value_usd_per_kg for r in records if r.unit_value_usd_per_kg is not None]

    t0 = years[0]
    latest_year = years[-1]
    alpha, beta, std_err = _fit_log_linear_trend(years, values)

    # 1. Generate 12-month and 24-month forecasts
    target_12m_year = latest_year + 1
    target_24m_year = latest_year + 2

    fc_12m = _calculate_forecast_point(target_12m_year, t0, alpha, beta, std_err)
    fc_24m = _calculate_forecast_point(target_24m_year, t0, alpha, beta, std_err)

    # 2. Compound Annual Growth Rate (CAGR)
    base_val = values[0]
    num_years = max(latest_year - t0, 1)
    if base_val > 0 and values[-1] > 0:
        cagr = ((values[-1] / base_val) ** (1.0 / num_years) - 1.0) * 100.0
    else:
        cagr = beta * 100.0
    cagr = round(cagr, 2)

    # 3. Unit Value Trend
    if len(unit_values) >= 2:
        uv_change = (unit_values[-1] - unit_values[0]) / max(unit_values[0], 0.001)
        if uv_change > 0.05:
            uv_trend = "Expanding Margin"
            uv_score_boost = 10.0
        elif uv_change < -0.05:
            uv_trend = "Price Compression"
            uv_score_boost = -5.0
        else:
            uv_trend = "Stable"
            uv_score_boost = 5.0
    else:
        uv_trend = "Stable"
        uv_score_boost = 5.0

    # 4. Country Governance & Risk adjustment
    risk_record = db.scalar(
        select(CountryRiskFactor).where(CountryRiskFactor.country_code == destination_country)
    )
    country_risk_penalty = 0.0
    if risk_record:
        # composite_risk_score is 0 (safe) to 100 (high risk)
        country_risk_penalty = float(risk_record.composite_risk_score) * 0.15

    # 5. Composite Opportunity Index (0 - 100)
    # Factor A: Growth momentum (capped at 40 pts)
    growth_pts = min(max((cagr + 5.0) * 2.0, 0.0), 40.0)

    # Factor B: Market Scale (log scale of trade volume, capped at 35 pts)
    # $10M = ~23 pts, $100M = ~27 pts, $1B = ~31 pts
    log_scale = math.log10(max(fc_12m.projected_usd, 1_000_000.0))
    scale_pts = min(max((log_scale - 6.0) * 10.0 + 10.0, 5.0), 35.0)

    # Factor C: Margin resilience & price stability (capped at 15 pts)
    resilience_pts = min(max(10.0 + uv_score_boost, 2.0), 15.0)

    # Factor D: Reliability / low country risk (capped at 10 pts)
    stability_pts = max(10.0 - country_risk_penalty, 2.0)

    raw_index = growth_pts + scale_pts + resilience_pts + stability_pts
    opportunity_index = round(min(max(raw_index, 10.0), 99.0), 1)

    # 6. Opportunity Tiering
    if opportunity_index >= 80.0:
        tier = "High Opportunity"
        rating = "A+"
    elif opportunity_index >= 65.0:
        tier = "Moderate Growth"
        rating = "A"
    elif opportunity_index >= 50.0:
        tier = "Emerging"
        rating = "B+"
    else:
        tier = "Low Momentum"
        rating = "B"

    # 7. Generate Explainable Insight Factors
    factors = [
        f"Projected 12-month import demand: ${fc_12m.projected_usd:,.0f} USD ({cagr:+.1f}% annual CAGR momentum).",
        f"80% statistical confidence interval spans ${fc_12m.ci_80_lower:,.0f} to ${fc_12m.ci_80_upper:,.0f} USD.",
        f"Unit value pricing is classified as '{uv_trend}', reflecting resilient import price levels.",
    ]
    if risk_record and risk_record.risk_tier == "Low Risk":
        factors.append(f"Destination market has top-tier governance (World Bank Rule of Law: {risk_record.rule_of_law_score:.2f}).")

    return OpportunityScoreResult(
        origin_country=origin_country,
        destination_country=destination_country,
        hs_code=hs_code,
        historical_years=years,
        historical_values_usd=values,
        forecast_12m=fc_12m,
        forecast_24m=fc_24m,
        projected_cagr_pct=cagr,
        opportunity_index=opportunity_index,
        opportunity_tier=tier,
        unit_value_trend=uv_trend,
        risk_adjusted_rating=rating,
        explanation_factors=factors,
    )
