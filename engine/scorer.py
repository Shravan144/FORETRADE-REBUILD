"""
=============================================================================
SCORING ENGINE — ForeTrade (The Brain)
=============================================================================
This is the CORE of your hackathon submission.
It combines all signals into a final match score.

WHAT JUDGES WILL LOOK AT:
    1. How you weight different signals
    2. Whether weights are adjustable (real-time adaptability)
    3. Whether scoring is explainable
    4. How you handle edge cases

PIPELINE:
    Exporter Profile + Buyer Profile + Graph Affinity 
        → compute_match_score() 
        → Match Score (0-100) + Breakdown

TODO CHECKLIST:
    [ ] HOUR 5-6: Implement compute_match_score()
    [ ] HOUR 6:   Implement rank_matches_for_exporter()
    [ ] HOUR 8:   Implement update_weights_from_swipe() (adaptability!)
    [ ] HOUR 14:  Test with different weight configurations
=============================================================================
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Tuple, Optional
from utils.constants import (
    SCORING_WEIGHTS, 
    MIN_MATCH_SCORE, 
    TOP_K_MATCHES,
    SWIPE_RIGHT_BOOST,
    SWIPE_LEFT_PENALTY,
)


# ---------------------------------------------------------------------------
# In-memory weight adjustments (simulates "learning" from swipe feedback)
# ---------------------------------------------------------------------------
_weight_adjustments: Dict[str, float] = {}


def compute_match_score(
    compatibility: dict,
    graph_affinity: float,
    weights: Optional[dict] = None,
) -> Tuple[float, dict]:
    """
    ⭐⭐⭐ THE MOST IMPORTANT FUNCTION ⭐⭐⭐
    
    Computes the final match score between an exporter and a buyer.
    
    Formula:
        score = Σ (weight_i × signal_i) for each signal
    
    Signals (from compatibility dict + graph):
        - product_compatibility (0-1)
        - geography_fit (0-1)
        - trade_frequency (0-1)
        - buyer_activity (0-1)
        - graph_affinity (0-1)  ← passed separately
    """
    if weights is None:
        weights = get_adjusted_weights()
    
    # Merge graph_affinity into signals
    signals = {**compatibility, "graph_affinity": graph_affinity}
    
    # Compute weighted score
    breakdown = {}
    total = 0.0
    
    for key, weight in weights.items():
        raw = signals.get(key, 0.0)
        contribution = raw * weight * 100
        breakdown[key] = {
            "raw": round(raw, 3),
            "weight": round(weight, 3),
            "contribution": round(contribution, 1),
        }
        total += contribution
    
    return round(total, 1), breakdown


def rank_matches_for_exporter(
    exporter_id: str,
    exporter_profile: pd.Series,
    buyer_profiles: pd.DataFrame,
    graph,  # NetworkX Graph
    weights: Optional[dict] = None,
    top_k: int = TOP_K_MATCHES,
    news_df: Optional[pd.DataFrame] = None,
) -> List[dict]:
    """
    Generate ranked match suggestions for a given exporter.
    
    This is what powers the swipe UI — it returns the ordered list
    of buyers the exporter should see.
    """
    from engine.features import compute_compatibility
    from engine.graph import compute_graph_affinity

    # Pre-compute news sentiment per buyer country (avoids redundant work)
    news_cache: dict = {}
    if news_df is not None and len(news_df) > 0:
        from engine.news import compute_news_score
        industry = str(
            exporter_profile.get("industry", "")
            or exporter_profile.get("primary_hs", "")
        )
        for country in buyer_profiles["country"].dropna().unique():
            news_cache[country] = compute_news_score(news_df, industry, country)

    matches = []
    
    for _, buyer in buyer_profiles.iterrows():
        compat = compute_compatibility(exporter_profile, buyer)
        g_score = compute_graph_affinity(graph, exporter_id, buyer["buyer_id"])

        # Inject live news sentiment into the signal vector
        buyer_country = buyer.get("country", "")
        news_result = news_cache.get(
            buyer_country,
            {"news_sentiment": 0.5, "risk_flags": [], "opportunity_flags": []},
        )
        compat["news_sentiment"] = news_result["news_sentiment"]

        score, breakdown = compute_match_score(compat, g_score, weights)
        
        if score >= MIN_MATCH_SCORE * 100:
            matches.append({
                "buyer_id": buyer["buyer_id"],
                "buyer_name": buyer["company_name"],
                "buyer_country": buyer["country"],
                "buyer_type": buyer.get("buyer_type", "Unknown"),
                "score": score,
                "breakdown": breakdown,
                "news_flags": {
                    "risk": news_result.get("risk_flags", []),
                    "opportunity": news_result.get("opportunity_flags", []),
                    "sentiment": news_result.get("news_sentiment", 0.5),
                },
            })
    
    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches[:top_k]


def update_weights_from_swipe(
    swiped_buyer: dict, 
    direction: str,  # "right" or "left"
) -> None:
    """
    ⭐ REAL-TIME ADAPTABILITY — Mandatory per problem statement.
    
    When a user swipes right (interested) or left (not interested),
    adjust the scoring weights to reflect this feedback.
    
    Simple approach:
        - Swipe RIGHT on a buyer with high geography_fit?
          → Slightly BOOST geography_fit weight for future matches
        
        - Swipe LEFT on a buyer with high product_compatibility?
          → Slightly REDUCE product_compatibility weight
    
    This simulates the system "learning" from user behavior.
    """
    global _weight_adjustments
    
    breakdown = swiped_buyer.get("breakdown", {})
    if not breakdown:
        return
    
    # Find the top contributing signal
    top_signal = max(breakdown, key=lambda k: breakdown[k]["contribution"])
    
    boost = SWIPE_RIGHT_BOOST if direction == "right" else SWIPE_LEFT_PENALTY
    _weight_adjustments[top_signal] = _weight_adjustments.get(top_signal, 0) + boost


def get_adjusted_weights() -> dict:
    """Get scoring weights with any swipe-based adjustments applied."""
    weights = SCORING_WEIGHTS.copy()
    for key, adj in _weight_adjustments.items():
        if key in weights:
            weights[key] = max(0.05, min(0.5, weights[key] + adj))  # Clamp
    
    # Re-normalize so weights sum to 1.0
    total = sum(weights.values())
    if total > 0:
        weights = {k: v / total for k, v in weights.items()}
    
    return weights
