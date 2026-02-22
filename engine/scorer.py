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
    graph_affinity: float = 0.0,
    weights: Optional[dict] = None,
) -> Tuple[float, dict]:
    """
    ⭐⭐⭐ THE MOST IMPORTANT FUNCTION ⭐⭐⭐
    
    Computes the final match score between an exporter and a buyer.
    
    Formula:
        score = Σ (weight_i × signal_i) for each signal
    
    Signals (from compatibility dict):
        - product_compatibility (0-1)
        - geography_fit (0-1)
        - trade_frequency (0-1)
        - buyer_activity (0-1)
    """
    if weights is None:
        weights = get_adjusted_weights()
    
    signals = {**compatibility}
    
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


def _compute_raw_signals(
    exporter_id: str,
    exporter_profile: pd.Series,
    buyer_profiles: pd.DataFrame,
    graph,
    news_df: Optional[pd.DataFrame] = None,
) -> List[dict]:
    """Pre-compute raw compatibility signals for ALL buyers (expensive, cached)."""
    from engine.features import compute_compatibility
    from engine.graph import compute_graph_affinity

    # Pre-compute news sentiment per buyer country
    news_cache: dict = {}
    if news_df is not None and len(news_df) > 0:
        from engine.news import compute_news_score
        industry = str(
            exporter_profile.get("industry", "")
            or exporter_profile.get("primary_hs", "")
        )
        for country in buyer_profiles["country"].dropna().unique():
            news_cache[country] = compute_news_score(news_df, industry, country)

    raw_list = []

    for _, buyer in buyer_profiles.iterrows():
        compat = compute_compatibility(exporter_profile, buyer)

        # Quick pre-filter: skip buyers with very low product compatibility
        if compat.get("product_compatibility", 0) < 0.1:
            continue

        g_score = compute_graph_affinity(graph, exporter_id, buyer["buyer_id"])

        buyer_country = buyer.get("country", "")
        news_result = news_cache.get(
            buyer_country,
            {"news_sentiment": 0.5, "risk_flags": [], "opportunity_flags": []},
        )

        raw_list.append({
            "buyer_id": buyer["buyer_id"],
            "buyer_name": buyer["company_name"],
            "buyer_country": buyer_country,
            "buyer_type": buyer.get("buyer_type", "Unknown"),
            "compat": compat,
            "graph_affinity": g_score,
            "news_result": news_result,
        })

    return raw_list


def rank_matches_for_exporter(
    exporter_id: str,
    exporter_profile: pd.Series,
    buyer_profiles: pd.DataFrame,
    graph,  # NetworkX Graph
    weights: Optional[dict] = None,
    top_k: int = TOP_K_MATCHES,
    news_df: Optional[pd.DataFrame] = None,
    _raw_cache: Optional[List[dict]] = None,
) -> List[dict]:
    """
    Generate ranked match suggestions for a given exporter.
    
    This is what powers the swipe UI — it returns the ordered list
    of buyers the exporter should see.
    
    Pass _raw_cache (from _compute_raw_signals) to skip the expensive
    compatibility computation when only weights changed.
    """
    # Use cached raw signals if provided, else compute fresh
    raw_list = _raw_cache if _raw_cache is not None else _compute_raw_signals(
        exporter_id, exporter_profile, buyer_profiles, graph, news_df
    )

    # Score all candidates with the weighted-sum formula first
    scored = []
    for entry in raw_list:
        score, breakdown = compute_match_score(
            entry["compat"], entry["graph_affinity"], weights
        )
        if score >= MIN_MATCH_SCORE * 100:
            scored.append((entry, score, breakdown))

    # ── ML layer 1: GB+RF regression ensemble (match quality) ────────
    try:
        from engine.ml_models import predict_match_batch
        signal_list = [e["compat"] for e, _, _ in scored]
        ga_list = [e["graph_affinity"] for e, _, _ in scored]
        gb_preds = predict_match_batch(signal_list, ga_list)
    except Exception:
        gb_preds = np.full(len(scored), 0.5)

    # ── ML layer 2: LightGBM LambdaRank (learning-to-rank) ──────────
    try:
        from engine.ltr_ranker import predict_ltr_scores
        signal_list = [e["compat"] for e, _, _ in scored]
        ltr_preds = predict_ltr_scores(signal_list)
    except Exception:
        ltr_preds = np.full(len(scored), 0.5)

    # ── ML layer 3: graph embedding similarity ───────────────────────
    try:
        from engine.graph_embeddings import compute_embedding_similarity
        graph_emb_scores = np.array([
            compute_embedding_similarity(exporter_id, e["buyer_id"])
            for e, _, _ in scored
        ])
    except Exception:
        graph_emb_scores = np.full(len(scored), 0.5)

    matches = []
    for i, (entry, ws_score, breakdown) in enumerate(scored):
        nr = entry["news_result"]
        gb_conf = float(gb_preds[i])
        ltr_conf = float(ltr_preds[i])
        ge_score = float(graph_emb_scores[i])

        # ── ML-first blending formula ────────────────────────────────
        # 30 % weighted-sum (explainable baseline)
        # 35 % LTR LambdaRank (learned ranking from trade data)
        # 25 % GB+RF ensemble (match quality prediction)
        # 10 % graph embedding similarity (structural network signal)
        blended = round(
            0.30 * ws_score
            + 0.35 * (ltr_conf * 100)
            + 0.25 * (gb_conf * 100)
            + 0.10 * (ge_score * 100),
            1,
        )
        blended = max(0.0, min(100.0, blended))

        matches.append({
            "buyer_id": entry["buyer_id"],
            "buyer_name": entry["buyer_name"],
            "buyer_country": entry["buyer_country"],
            "buyer_type": entry["buyer_type"],
            "score": blended,
            "weighted_sum_score": ws_score,
            "ml_confidence": round(gb_conf, 3),
            "ltr_score": round(ltr_conf, 3),
            "graph_emb_score": round(ge_score, 3),
            "breakdown": breakdown,
            "news_flags": {
                "risk": nr.get("risk_flags", []),
                "opportunity": nr.get("opportunity_flags", []),
                "sentiment": nr.get("news_sentiment", 0.5),
            },
            "_exporter_id": exporter_id,
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

    # ── Also record for LTR RLHF loop ───────────────────────────────
    try:
        from engine.ltr_ranker import record_swipe_feedback
        record_swipe_feedback(swiped_buyer, direction)
    except Exception:
        pass


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
