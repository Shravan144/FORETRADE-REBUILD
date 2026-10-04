"""
World Bank Governance & Country Risk Ingestion Pipeline
Seeds political stability, regulatory quality, rule of law, and risk tiers.
"""

import json
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.trade_intelligence import CountryRiskFactor

REPO_ROOT = Path(__file__).resolve().parents[5]
OUTPUT_FILE = REPO_ROOT / "data" / "country_risk_factors.json"

COUNTRY_RISK_DATA = [
    {
        "country_code": "US",
        "country_name": "United States",
        "political_stability_score": 0.45,
        "rule_of_law_score": 1.48,
        "regulatory_quality_score": 1.55,
        "composite_risk_score": 12.0,
        "risk_tier": "Low Risk",
        "currency_code": "USD",
        "fx_volatility_pct": 1.5,
    },
    {
        "country_code": "DE",
        "country_name": "Germany",
        "political_stability_score": 0.72,
        "rule_of_law_score": 1.62,
        "regulatory_quality_score": 1.68,
        "composite_risk_score": 9.5,
        "risk_tier": "Low Risk",
        "currency_code": "EUR",
        "fx_volatility_pct": 2.1,
    },
    {
        "country_code": "GB",
        "country_name": "United Kingdom",
        "political_stability_score": 0.51,
        "rule_of_law_score": 1.42,
        "regulatory_quality_score": 1.58,
        "composite_risk_score": 14.2,
        "risk_tier": "Low Risk",
        "currency_code": "GBP",
        "fx_volatility_pct": 2.8,
    },
    {
        "country_code": "AE",
        "country_name": "United Arab Emirates",
        "political_stability_score": 0.65,
        "rule_of_law_score": 0.92,
        "regulatory_quality_score": 1.15,
        "composite_risk_score": 21.0,
        "risk_tier": "Low Risk",
        "currency_code": "AED",
        "fx_volatility_pct": 0.2,  # Pegged to USD
    },
    {
        "country_code": "JP",
        "country_name": "Japan",
        "political_stability_score": 0.98,
        "rule_of_law_score": 1.58,
        "regulatory_quality_score": 1.45,
        "composite_risk_score": 10.5,
        "risk_tier": "Low Risk",
        "currency_code": "JPY",
        "fx_volatility_pct": 4.5,
    },
    {
        "country_code": "AU",
        "country_name": "Australia",
        "political_stability_score": 0.88,
        "rule_of_law_score": 1.65,
        "regulatory_quality_score": 1.72,
        "composite_risk_score": 8.0,
        "risk_tier": "Low Risk",
        "currency_code": "AUD",
        "fx_volatility_pct": 3.2,
    },
    {
        "country_code": "SG",
        "country_name": "Singapore",
        "political_stability_score": 1.25,
        "rule_of_law_score": 1.82,
        "regulatory_quality_score": 2.10,
        "composite_risk_score": 5.0,
        "risk_tier": "Low Risk",
        "currency_code": "SGD",
        "fx_volatility_pct": 1.8,
    },
    {
        "country_code": "NL",
        "country_name": "Netherlands",
        "political_stability_score": 0.81,
        "rule_of_law_score": 1.71,
        "regulatory_quality_score": 1.79,
        "composite_risk_score": 8.5,
        "risk_tier": "Low Risk",
        "currency_code": "EUR",
        "fx_volatility_pct": 2.1,
    },
    {
        "country_code": "FR",
        "country_name": "France",
        "political_stability_score": 0.28,
        "rule_of_law_score": 1.35,
        "regulatory_quality_score": 1.40,
        "composite_risk_score": 18.0,
        "risk_tier": "Low Risk",
        "currency_code": "EUR",
        "fx_volatility_pct": 2.1,
    },
    {
        "country_code": "CA",
        "country_name": "Canada",
        "political_stability_score": 0.85,
        "rule_of_law_score": 1.60,
        "regulatory_quality_score": 1.65,
        "composite_risk_score": 9.0,
        "risk_tier": "Low Risk",
        "currency_code": "CAD",
        "fx_volatility_pct": 2.4,
    },
]


def ingest_country_risk(db: Session | None = None) -> int:
    """Ingest World Bank country governance and risk factors."""
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(COUNTRY_RISK_DATA, f, indent=2)

    close_session = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_session = True

    count = 0
    try:
        for r in COUNTRY_RISK_DATA:
            existing = db.scalar(
                select(CountryRiskFactor).where(CountryRiskFactor.country_code == r["country_code"])
            )
            if existing:
                existing.political_stability_score = r["political_stability_score"]
                existing.rule_of_law_score = r["rule_of_law_score"]
                existing.regulatory_quality_score = r["regulatory_quality_score"]
                existing.composite_risk_score = r["composite_risk_score"]
                existing.risk_tier = r["risk_tier"]
                existing.currency_code = r["currency_code"]
                existing.fx_volatility_pct = r["fx_volatility_pct"]
            else:
                db.add(CountryRiskFactor(**r))
            count += 1
        db.commit()
    finally:
        if close_session:
            db.close()

    print(f"Ingested {count} country risk profiles into database.")
    return count


if __name__ == "__main__":
    ingest_country_risk()
