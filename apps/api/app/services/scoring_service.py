"""Versioned deterministic scoring. It never fabricates outcomes or contacts.

Opportunity score weighting (from spec):
  0.30 * product_fit
+ 0.20 * target_market_fit
+ 0.15 * exporter_capacity_fit
+ 0.15 * certification_fit
+ 0.10 * data_quality
+ 0.10 * user_priority_fit
"""

from dataclasses import dataclass


ALGORITHM_VERSION = "deterministic-v2"


@dataclass(frozen=True)
class ScoreResult:
    score: float
    tier: str
    reasons: list[str]
    features: dict[str, float | bool | str | list[str]]


def score_company(profile: dict, company: dict) -> ScoreResult:
    reasons: list[str] = []
    missing_inputs: list[str] = []

    # 1. Product Fit (weight: 0.30)
    categories = {str(item).strip().lower() for item in profile.get("product_categories", []) if str(item).strip()}
    industry = (company.get("product_or_industry") or "").strip().lower()
    if categories and industry and any(category in industry or industry in category for category in categories):
        product_fit = 100.0
        reasons.append("product_category_match")
    elif categories:
        product_fit = 20.0
        reasons.append("product_category_not_matched")
    else:
        product_fit = 40.0
        missing_inputs.append("exporter_product_categories")
        reasons.append("exporter_product_categories_missing")

    # 2. Target Market Fit (weight: 0.20)
    target_countries = {str(item).strip().upper() for item in profile.get("target_countries", []) if str(item).strip()}
    country = (company.get("country_code") or "").strip().upper()
    if target_countries and country in target_countries:
        target_market_fit = 100.0
        reasons.append("target_market_match")
    elif country:
        target_market_fit = 75.0
        reasons.append("country_identified")
    else:
        target_market_fit = 25.0
        missing_inputs.append("company_country")
        reasons.append("country_unspecified")

    # 3. Exporter Capacity Fit (weight: 0.15)
    capacity = profile.get("capacity_tons") or profile.get("capacity")
    if capacity is not None and capacity > 0:
        capacity_fit = 100.0
        reasons.append("exporter_capacity_available")
    else:
        capacity_fit = 50.0
        missing_inputs.append("exporter_capacity")

    # 4. Certification Fit (weight: 0.15)
    certs = profile.get("certifications", [])
    if certs:
        certification_fit = 100.0
        reasons.append("certifications_aligned")
    else:
        certification_fit = 70.0

    # 5. Data Quality (weight: 0.10)
    dq_score = 20.0
    if company.get("website"):
        dq_score += 40.0
        reasons.append("company_has_website")
    if company.get("contact_email"):
        dq_score += 40.0
        reasons.append("user_provided_email_available")
    data_quality = min(dq_score, 100.0)

    # 6. User Priority Fit (weight: 0.10)
    user_priority_fit = 80.0

    raw_score = (
        0.30 * product_fit
        + 0.20 * target_market_fit
        + 0.15 * capacity_fit
        + 0.15 * certification_fit
        + 0.10 * data_quality
        + 0.10 * user_priority_fit
    )
    score = round(min(max(raw_score, 0.0), 100.0), 1)
    tier = "high" if score >= 70.0 else "medium" if score >= 45.0 else "low"
    confidence = "low" if len(missing_inputs) >= 2 else "medium" if len(missing_inputs) == 1 else "high"

    features = {
        "product_fit": product_fit,
        "target_market_fit": target_market_fit,
        "capacity_fit": capacity_fit,
        "certification_fit": certification_fit,
        "data_quality": data_quality,
        "user_priority_fit": user_priority_fit,
        "confidence": confidence,
        "missing_inputs": missing_inputs,
        "has_website": bool(company.get("website")),
        "has_contact_email": bool(company.get("contact_email")),
        "country": country or "unknown",
        "category_count": float(len(categories)),
    }
    return ScoreResult(score=score, tier=tier, reasons=reasons, features=features)
