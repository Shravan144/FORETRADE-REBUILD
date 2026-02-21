"""
=============================================================================
USER-DERIVED EXPORTER PROFILE — ForeTrade
=============================================================================
When a real exporter logs in (not a demo account), we build their exporter
profile from signup data. This powers real-time, model-driven buyer matching
— no hardcoded dataset exporter mapping.

PIPELINE:
    User signup data (company, industry, etc.) → build_user_exporter_profile()
        → pd.Series compatible with compute_compatibility() and scorer
=============================================================================
"""

import pandas as pd
from utils.constants import PRODUCT_CATEGORIES

# Dataset industries (from exporters/buyers) — used to normalize user input
KNOWN_INDUSTRIES = [
    "Textiles", "Solar", "Electronics", "Engineering", "IT Software",
    "Machinery", "Medical Devices", "Pharmaceuticals", "Auto Parts", "Chemicals",
]


def _normalize_industry(user_industry: str) -> str:
    """
    Map user-typed industry to dataset format for product compatibility.
    E.g. "textiles" -> "Textiles", "it software" -> "IT Software".
    """
    raw = (user_industry or "").strip()
    if not raw:
        return "Trade"
    raw_lower = raw.lower()
    for known in KNOWN_INDUSTRIES:
        if known.lower() == raw_lower:
            return known
    # Fuzzy: "textile" -> "Textiles", "pharma" -> "Pharmaceuticals"
    if "textile" in raw_lower:
        return "Textiles"
    if "solar" in raw_lower or "renewable" in raw_lower:
        return "Solar"
    if "electron" in raw_lower or "tech" in raw_lower:
        return "Electronics"
    if "engineer" in raw_lower:
        return "Engineering"
    if "software" in raw_lower or "it " in raw_lower:
        return "IT Software"
    if "machinery" in raw_lower or "machin" in raw_lower:
        return "Machinery"
    if "medical" in raw_lower or "medtech" in raw_lower:
        return "Medical Devices"
    if "pharma" in raw_lower or "pharmaceutical" in raw_lower:
        return "Pharmaceuticals"
    if "auto" in raw_lower or "vehicle" in raw_lower:
        return "Auto Parts"
    if "chem" in raw_lower:
        return "Chemicals"
    # Fallback: title case
    return raw.title() if raw else "Trade"


def build_user_exporter_profile(user: dict) -> pd.Series:
    """
    Build an exporter profile from user signup data.
    Returns a pd.Series compatible with compute_compatibility() and scorer.
    """
    company = (user.get("company") or "").strip() or (user.get("first_name") or "").strip() or "Your Company"
    industry_raw = (user.get("industry") or "").strip()
    industry = _normalize_industry(industry_raw)

    return pd.Series({
        "exporter_id": "USER_SELF",
        "company_name": company,
        "country": "India",
        "state": "",
        "industry": industry,
        "primary_hs": industry,
        "primary_product": industry,
        "num_transactions": 0,
        "total_trade_volume": 0,
        "avg_trade_value": 0,
        "num_unique_buyers": 0,
        "num_unique_countries": 0,
        "trade_recency": 999,
        "growth_trend": 0.0,
        "employees": 0,
        "annual_volume": 0,
        "intent_score": 0.5,
        "prompt_response_score": 0.5,
        "good_payment_terms": 1,
        "hiring_signal": 0,
        "certification": "",
    })
