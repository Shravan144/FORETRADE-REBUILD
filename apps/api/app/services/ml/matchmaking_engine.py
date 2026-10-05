"""
Model 2: Two-Tower Hybrid Recommender System ("Swipe to Export")
Encodes Exporter capabilities (Tower A) and Buyer procurement profiles (Tower B)
into dense semantic embeddings to calculate cosine compatibility, capacity fit,
and compliance alignment with explainable feature attribution (XAI).
"""

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional
import math
import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trade_intelligence import GlobalBuyerCatalog


# ── CANONICAL VOCABULARY FOR DENSE EMBEDDING ──
SECTOR_FEATURES = [
    "textiles", "apparel", "6109", "6203", "5208",
    "solar", "renewables", "8541",
    "automotive", "auto", "8708", "8483",
    "pharmaceuticals", "pharma", "3004", "2902",
    "machinery", "8471", "electronics", "8504",
    "agriculture", "spices", "1006", "0910",
    "medical", "9018",
    "chemicals", "petrochemicals", "2901", "3808",
    "leather", "footwear", "4104", "6403",
    "ceramics", "tiles", "6907", "6802",
    "gems", "jewellery", "7113", "7102",
]

CERT_FEATURES = [
    "iso 9001", "oeko-tex", "gots", "iatf 16949",
    "ce mark", "fda", "who gmp", "eu gmp",
    "brcgs", "halal", "iso 13485", "ul",
    "haccp", "fssc 22000", "usda organic", "reach",
    "lwg", "rjc", "rohs", "bsci",
]

COUNTRY_FEATURES = [
    "us", "de", "gb", "ae", "jp", "au", "sg", "nl", "fr", "ca",
    "sa", "it", "es", "ke", "eg",
]

DIMENSION = len(SECTOR_FEATURES) + len(CERT_FEATURES) + len(COUNTRY_FEATURES)


@dataclass
class MatchFactorBreakdown:
    product_similarity_pts: float    # 0 to 35 pts
    capacity_alignment_pts: float    # 0 to 25 pts
    compliance_match_pts: float      # 0 to 20 pts
    corridor_alignment_pts: float    # 0 to 20 pts


@dataclass
class BuyerRecommendation:
    buyer_id: str
    company_name: str
    country_code: str
    city: Optional[str]
    website: Optional[str]
    contact_name: Optional[str]
    contact_email: Optional[str]
    primary_sector: str
    hs_codes: List[str]
    annual_import_volume_usd: float
    avg_order_tons: float
    required_certifications: List[str]
    preferred_incoterms: str
    customs_manifest_provenance: str
    reliability_score: float

    # RecSys outputs
    compatibility_score: float       # 0 to 100%
    match_tier: str                  # "Strong Match", "Good Fit", "Potential Prospect", "Low Fit"
    factor_breakdown: MatchFactorBreakdown
    reasons: List[str]

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["factor_breakdown"] = asdict(self.factor_breakdown)
        return d


# ── TOWER A: EXPORTER ENCODER ──
def encode_exporter(profile: Dict[str, Any]) -> np.ndarray:
    """Encodes Exporter capabilities into a normalized vector (Tower A)."""
    vec = np.zeros(DIMENSION, dtype=float)

    # 1. Sector & Product tokens
    prod_tokens = [str(p).lower() for p in profile.get("product_categories", [])]
    for i, feat in enumerate(SECTOR_FEATURES):
        if any(feat in tok or tok in feat for tok in prod_tokens):
            vec[i] = 1.0

    # 2. Certifications
    offset = len(SECTOR_FEATURES)
    certs_held = [str(c).lower() for c in profile.get("certifications", [])]
    for i, feat in enumerate(CERT_FEATURES):
        if any(feat in c for c in certs_held):
            vec[offset + i] = 1.0

    # 3. Target Countries
    offset = len(SECTOR_FEATURES) + len(CERT_FEATURES)
    target_countries = [str(c).lower() for c in profile.get("target_countries", [])]
    for i, feat in enumerate(COUNTRY_FEATURES):
        if feat in target_countries:
            vec[offset + i] = 1.0

    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


# ── TOWER B: BUYER ENCODER ──
def encode_buyer(buyer: GlobalBuyerCatalog) -> np.ndarray:
    """Encodes Buyer procurement profile into a normalized vector (Tower B)."""
    vec = np.zeros(DIMENSION, dtype=float)

    # 1. Sector & HS Codes
    b_tokens = [buyer.primary_sector.lower()] + [str(h).lower() for h in (buyer.hs_codes or [])]
    for i, feat in enumerate(SECTOR_FEATURES):
        if any(feat in tok or tok in feat for tok in b_tokens):
            vec[i] = 1.0

    # 2. Required Certifications
    offset = len(SECTOR_FEATURES)
    req_certs = [str(c).lower() for c in (buyer.required_certifications or [])]
    for i, feat in enumerate(CERT_FEATURES):
        if any(feat in c for c in req_certs):
            vec[offset + i] = 1.0

    # 3. Buyer Location
    offset = len(SECTOR_FEATURES) + len(CERT_FEATURES)
    b_country = buyer.country_code.lower()
    for i, feat in enumerate(COUNTRY_FEATURES):
        if feat == b_country:
            vec[offset + i] = 1.0

    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


# ── NON-LINEAR CAPACITY CURVE ──
def evaluate_capacity_fit(exporter_capacity: float, buyer_order_tons: float) -> tuple[float, str]:
    """
    Evaluates capacity compatibility.
    Ideal: Exporter produces 1.0x to 4.0x the buyer's average shipment size.
    """
    if buyer_order_tons <= 0:
        return 20.0, "Buyer order size not constrained."

    ratio = exporter_capacity / buyer_order_tons
    if 0.9 <= ratio <= 4.5:
        # Ideal operational balance
        pts = 25.0
        reason = f"Capacity optimal: {exporter_capacity:.0f}T/mo comfortably supplies buyer's {buyer_order_tons:.0f}T order size (ratio: {ratio:.1f}x)."
    elif 0.5 <= ratio < 0.9:
        # Near capacity limit
        pts = 18.0
        reason = f"Capacity tight: buyer's {buyer_order_tons:.0f}T order size requires {ratio*100:.0f}% of monthly output."
    elif ratio > 4.5:
        # Order is relatively small for factory scale
        pts = 20.0
        reason = f"High capacity buffer: {exporter_capacity:.0f}T/mo handles {buyer_order_tons:.0f}T shipment with minimal production strain."
    else:
        # Under-capacity risk
        pts = 8.0
        reason = f"Capacity alert: buyer demand ({buyer_order_tons:.0f}T) exceeds safe production threshold ({exporter_capacity:.0f}T)."

    return pts, reason


# ── COMPLIANCE INTERSECTION ──
def evaluate_compliance_match(exporter_certs: List[str], buyer_reqs: List[str]) -> tuple[float, str]:
    """Evaluates percentage of buyer's compliance requirements fulfilled."""
    if not buyer_reqs:
        return 20.0, "Buyer has no mandatory pre-qualification certificates."

    norm_held = [c.lower() for c in exporter_certs]
    matched = []
    missing = []

    for req in buyer_reqs:
        req_clean = req.lower()
        if any(req_clean in h or h in req_clean for h in norm_held):
            matched.append(req)
        else:
            missing.append(req)

    ratio = len(matched) / len(buyer_reqs)
    pts = round(ratio * 20.0, 1)

    if not missing:
        reason = f"100% Compliance match: holds all required standards ({', '.join(matched)})."
    elif matched:
        reason = f"Partial compliance ({len(matched)}/{len(buyer_reqs)}): holds {', '.join(matched)}, missing {', '.join(missing)}."
    else:
        reason = f"Missing required pre-qualifications: {', '.join(missing)}."

    return pts, reason


# ── CORE MATCHMAKING FUNCTION ──
def rank_buyer_recommendations(
    db: Session,
    exporter_profile: Dict[str, Any],
    top_k: int = 20,
) -> List[BuyerRecommendation]:
    """
    Two-Tower Hybrid Matchmaker
    Vectorizes profile vs. all global buyers, applies domain constraints,
    and returns ranked recommendations with XAI explainability.
    """
    buyers = list(db.scalars(select(GlobalBuyerCatalog)))
    if not buyers:
        return []

    # Encode Tower A (Exporter)
    exp_vec = encode_exporter(exporter_profile)
    exp_capacity = float(exporter_profile.get("capacity_tons") or 100.0)
    exp_certs = exporter_profile.get("certifications", [])
    exp_targets = [str(c).upper() for c in exporter_profile.get("target_countries", [])]

    recommendations: List[BuyerRecommendation] = []

    for buyer in buyers:
        # Encode Tower B (Buyer)
        buy_vec = encode_buyer(buyer)

        # 1. Two-Tower Cosine Similarity (max 35 pts)
        cosine_sim = float(np.dot(exp_vec, buy_vec)) if np.linalg.norm(exp_vec) > 0 and np.linalg.norm(buy_vec) > 0 else 0.0
        product_pts = round(max(cosine_sim, 0.0) * 35.0, 1)

        # 2. Capacity Fit (max 25 pts)
        capacity_pts, cap_reason = evaluate_capacity_fit(exp_capacity, float(buyer.avg_order_tons))

        # 3. Compliance Match (max 20 pts)
        compliance_pts, comp_reason = evaluate_compliance_match(exp_certs, buyer.required_certifications or [])

        # 4. Corridor / Market Alignment (max 20 pts)
        if buyer.country_code.upper() in exp_targets:
            corridor_pts = 20.0
            corridor_reason = f"Direct Corridor: operating in priority target market {buyer.country_code} ({buyer.city or 'Main Port'})."
        else:
            corridor_pts = 10.0
            corridor_reason = f"Secondary Corridor: buyer based in {buyer.country_code} (non-primary target country)."

        # Total Composite Compatibility Score (0 - 100)
        total_score = round(min(max(product_pts + capacity_pts + compliance_pts + corridor_pts, 10.0), 99.0), 1)

        # Match Tier Classification
        if total_score >= 85.0:
            tier = "Strong Match"
        elif total_score >= 70.0:
            tier = "Good Fit"
        elif total_score >= 55.0:
            tier = "Potential Prospect"
        else:
            tier = "Low Fit"

        # Build Explainability Insights
        reasons = [
            f"Product fit: {product_pts:.1f}/35.0 alignment with buyer's active procurement categories.",
            cap_reason,
            comp_reason,
            corridor_reason,
        ]

        recommendations.append(
            BuyerRecommendation(
                buyer_id=buyer.id,
                company_name=buyer.company_name,
                country_code=buyer.country_code,
                city=buyer.city,
                website=buyer.website,
                contact_name=buyer.contact_name,
                contact_email=buyer.contact_email,
                primary_sector=buyer.primary_sector,
                hs_codes=buyer.hs_codes or [],
                annual_import_volume_usd=float(buyer.annual_import_volume_usd),
                avg_order_tons=float(buyer.avg_order_tons),
                required_certifications=buyer.required_certifications or [],
                preferred_incoterms=buyer.preferred_incoterms or "CIF",
                customs_manifest_provenance=buyer.customs_manifest_provenance,
                reliability_score=float(buyer.reliability_score),
                compatibility_score=total_score,
                match_tier=tier,
                factor_breakdown=MatchFactorBreakdown(
                    product_similarity_pts=product_pts,
                    capacity_alignment_pts=capacity_pts,
                    compliance_match_pts=compliance_pts,
                    corridor_alignment_pts=corridor_pts,
                ),
                reasons=reasons,
            )
        )

    # Sort descending by compatibility score
    recommendations.sort(key=lambda x: x.compatibility_score, reverse=True)
    return recommendations[:top_k]
