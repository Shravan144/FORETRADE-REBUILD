"""Versioned deterministic scoring. It never fabricates outcomes or contacts."""

from dataclasses import dataclass


ALGORITHM_VERSION = "deterministic-v1"


@dataclass(frozen=True)
class ScoreResult:
    score: float
    tier: str
    reasons: list[str]
    features: dict[str, float | bool | str]


def score_company(profile: dict, company: dict) -> ScoreResult:
    score = 20.0
    reasons: list[str] = []
    categories = {str(item).strip().lower() for item in profile.get("product_categories", []) if str(item).strip()}
    industry = (company.get("product_or_industry") or "").strip().lower()
    if categories and industry and any(category in industry or industry in category for category in categories):
        score += 40; reasons.append("product_category_match")
    elif categories:
        reasons.append("product_category_not_matched")
    else:
        reasons.append("exporter_product_categories_missing")
    if company.get("website"):
        score += 10; reasons.append("company_has_website")
    if company.get("contact_email"):
        score += 15; reasons.append("user_provided_email_available")
    if company.get("country_code"):
        score += 15; reasons.append("country_identified")
    score = min(score, 100.0)
    tier = "high" if score >= 70 else "medium" if score >= 45 else "low"
    return ScoreResult(score=score, tier=tier, reasons=reasons, features={"has_website": bool(company.get("website")), "has_contact_email": bool(company.get("contact_email")), "country": company.get("country_code") or "unknown", "category_count": float(len(categories))})
