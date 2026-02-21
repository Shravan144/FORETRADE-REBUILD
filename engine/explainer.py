"""
=============================================================================
EXPLAINER — ForeTrade
=============================================================================
Generates human-readable explanations for WHY a match was suggested.

THIS IS YOUR SECRET WEAPON.
The problem statement explicitly says "Explainable scoring logic."
Judges will be very impressed if your app can say:

    "This buyer is a strong match because they import Electronics 
     (your top product) from Southeast Asia, have been actively 
     importing monthly, and share 3 common trade partners with you."

Instead of just showing a number.

TODO CHECKLIST:
    [ ] HOUR 6-7: Implement generate_explanation()
    [ ] HOUR 7:   Implement generate_match_card_text()
    [ ] HOUR 15:  (Optional) Make explanations more natural/detailed
=============================================================================
"""

from utils.constants import PRODUCT_CATEGORIES, COUNTRY_TO_REGION


def generate_explanation(
    exporter_profile: dict,
    buyer_profile: dict,
    score: float,
    breakdown: dict,
) -> str:
    """
    ⭐ Generate a human-readable explanation for a match.
    
    Args:
        exporter_profile: Dict/Series of exporter features
        buyer_profile:    Dict/Series of buyer features  
        score:            Final match score (0-100)
        breakdown:        Score breakdown dict from compute_match_score()
    
    Returns:
        A 2-3 sentence explanation string
    """
    # Step 1: Strength label
    if score >= 90:
        strength = "an EXCELLENT"
    elif score >= 70:
        strength = "a STRONG"
    elif score >= 50:
        strength = "a MODERATE"
    else:
        strength = "a POTENTIAL"
    
    # Step 2: Top reasons
    sorted_signals = sorted(breakdown.items(), key=lambda x: x[1].get("contribution", 0), reverse=True)
    top_1 = sorted_signals[0] if sorted_signals else None
    top_2 = sorted_signals[1] if len(sorted_signals) > 1 else None
    
    # Step 3: Signal-to-sentence mapping
    buyer_hs = str(buyer_profile.get("interested_hs", "") or buyer_profile.get("preferred_hs", ""))
    product_name = PRODUCT_CATEGORIES.get(buyer_hs[:2], "products") if buyer_hs else "products"
    
    signal_templates = {
        "product_compatibility": f"They import {product_name} — matching your export specialty",
        "geography_fit": f"Located in {buyer_profile.get('country', 'a key market')}, a strong trade corridor for your region",
        "trade_frequency": f"They import {buyer_profile.get('import_frequency', 'regularly')}, indicating consistent demand",
        "buyer_activity": f"They were active recently ({int(buyer_profile.get('last_active_days', 0))} days ago), showing current buying intent",
        "graph_affinity": f"You share common trade connections, suggesting network compatibility",
    }
    
    # Step 4: Assemble
    reason_1 = signal_templates.get(top_1[0], "") if top_1 else ""
    reason_2 = signal_templates.get(top_2[0], "") if top_2 else ""
    
    explanation = f"This buyer is {strength} match (score: {score:.1f}/100)."
    if reason_1:
        explanation += f" {reason_1}."
    if reason_2:
        explanation += f" {reason_2}."
    explanation += " Consider reaching out with a competitive quote."
    
    return explanation


def generate_match_card_text(
    buyer_name: str,
    buyer_country: str,
    buyer_type: str,
    score: float,
    top_signal: str,
) -> dict:
    """
    Generate text for the swipe card UI.
    
    Returns:
        Dict with card display fields:
        {
            "title":     "Pacific Trading Co.",
            "subtitle":  "Distributor • Vietnam",
            "score_text": "82% Match",
            "badge":      "High Intent" or "New Market" or "Frequent Buyer",
            "highlight":  "Imports your top product monthly",
        }
    """
    # Badge logic
    if top_signal == "buyer_activity":
        badge = "🔥 High Intent"
    elif top_signal == "geography_fit":
        badge = "🌍 New Market"
    elif top_signal == "trade_frequency":
        badge = "📦 Frequent Buyer"
    elif top_signal == "product_compatibility":
        badge = "✅ Product Match"
    else:
        badge = "⭐ Good Fit"
    
    # Highlight text
    highlight_map = {
        "buyer_activity": "Active buyer with recent trade activity",
        "geography_fit": "Strong trade corridor connection",
        "trade_frequency": "Consistent import frequency",
        "product_compatibility": "Perfect product alignment",
        "graph_affinity": "Shared trade network connections",
    }
    highlight = highlight_map.get(top_signal, "Strong compatibility match")
    
    return {
        "title": buyer_name,
        "subtitle": f"{buyer_type.title()} • {buyer_country}",
        "score_text": f"{int(score)}% Match",
        "badge": badge,
        "highlight": highlight,
    }
