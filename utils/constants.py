"""
=============================================================================
CONSTANTS & CONFIG — ForeTrade Scoring Engine
=============================================================================
This is the SINGLE place you tweak scoring weights, product categories,
country mappings, and any global config.

HOW TO USE:
  - Import from here:  from utils.constants import SCORING_WEIGHTS, PRODUCT_CATEGORIES
  - Adjust weights before the demo to show "real-time adaptability"
=============================================================================
"""

# ---------------------------------------------------------------------------
# SCORING WEIGHTS  (must sum to 1.0)
# These are the default weights for the final match score.
# Judges will love it if you let users change these via sliders.
# ---------------------------------------------------------------------------
SCORING_WEIGHTS = {
    "product_compatibility": 0.22,   # Industry / HS-code alignment
    "geography_fit":         0.14,   # Regional trade-corridor strength
    "trade_frequency":       0.10,   # How actively the buyer imports
    "buyer_activity":        0.10,   # Recency of buyer's last trade
    "buyer_readiness":       0.16,   # Hiring + Funding + Response Prob
    "geo_risk":              0.14,   # Tariff + StockShock + War + Calamity + FX
    "payment_trust":         0.14,   # Payment history + prompt response
}

# ---------------------------------------------------------------------------
# PRODUCT CATEGORIES  (HS codes + EXIM dataset industry names)
# ---------------------------------------------------------------------------
PRODUCT_CATEGORIES = {
    "61": "Knitted Apparel",
    "62": "Woven Apparel",
    "84": "Machinery & Mechanical Appliances",
    "85": "Electrical Machinery & Electronics",
    "27": "Mineral Fuels & Oils",
    "39": "Plastics",
    "72": "Iron & Steel",
    "87": "Vehicles",
    "30": "Pharmaceuticals",
    "09": "Coffee, Tea & Spices",
    "10": "Cereals",
    "71": "Gems & Precious Metals",
    "94": "Furniture",
    "73": "Iron/Steel Articles",
    "90": "Optical & Medical Instruments",
    # EXIM dataset industries (for display)
    "Textiles": "Textiles",
    "Solar": "Solar",
    "Chemicals": "Chemicals",
    "Electronics": "Electronics",
    "Engineering": "Engineering",
    "IT Software": "IT Software",
    "Machinery": "Machinery",
    "Medical Devices": "Medical Devices",
    "Pharmaceuticals": "Pharmaceuticals",
    "Auto Parts": "Auto Parts",
}

# ---------------------------------------------------------------------------
# COUNTRIES & REGIONS  (for geography scoring)
# TODO (HOUR 1-2): Expand with more trade corridors
# ---------------------------------------------------------------------------
TRADE_REGIONS = {
    "South Asia":       ["India", "Bangladesh", "Sri Lanka", "Pakistan", "Nepal"],
    "Southeast Asia":   ["Vietnam", "Thailand", "Indonesia", "Malaysia", "Philippines", "Singapore"],
    "East Asia":        ["China", "Japan", "South Korea", "Taiwan"],
    "Middle East":      ["UAE", "Saudi Arabia", "Qatar", "Oman", "Kuwait"],
    "Europe":           ["Germany", "UK", "France", "Netherlands", "Italy", "Spain"],
    "North America":    ["USA", "Canada", "Mexico"],
    "Africa":           ["Nigeria", "Kenya", "South Africa", "Egypt", "Ethiopia"],
    "South America":    ["Brazil", "Argentina", "Chile", "Colombia"],
    "Oceania":          ["Australia"],
}

# Flat lookup: country -> region
COUNTRY_TO_REGION = {}
for region, countries in TRADE_REGIONS.items():
    for country in countries:
        COUNTRY_TO_REGION[country] = region

# ---------------------------------------------------------------------------
# TRADE CORRIDOR STRENGTH (region-pair affinity, 0-1)
# Higher = more natural trade flow between regions.
# Covers all 36 unique region pairs (9 regions) + same-region = 1.0.
# ---------------------------------------------------------------------------
CORRIDOR_STRENGTH = {
    # South Asia outbound
    ("South Asia", "Middle East"):       0.90,
    ("South Asia", "Southeast Asia"):    0.80,
    ("South Asia", "Europe"):            0.75,
    ("South Asia", "North America"):     0.70,
    ("South Asia", "Africa"):            0.65,
    ("South Asia", "East Asia"):         0.70,
    ("South Asia", "South America"):     0.45,
    ("South Asia", "Oceania"):           0.55,
    # East Asia outbound (remaining)
    ("East Asia", "North America"):      0.90,
    ("East Asia", "Europe"):             0.85,
    ("East Asia", "Southeast Asia"):     0.85,
    ("East Asia", "Middle East"):        0.65,
    ("East Asia", "Africa"):             0.50,
    ("East Asia", "South America"):      0.55,
    ("East Asia", "Oceania"):            0.70,
    # Southeast Asia outbound (remaining)
    ("Southeast Asia", "Europe"):        0.65,
    ("Southeast Asia", "North America"): 0.60,
    ("Southeast Asia", "Middle East"):   0.60,
    ("Southeast Asia", "Africa"):        0.45,
    ("Southeast Asia", "South America"): 0.40,
    ("Southeast Asia", "Oceania"):       0.70,
    # Europe outbound (remaining)
    ("Europe", "North America"):         0.80,
    ("Europe", "Middle East"):           0.70,
    ("Europe", "Africa"):                0.70,
    ("Europe", "South America"):         0.60,
    ("Europe", "Oceania"):               0.60,
    # North America outbound (remaining)
    ("North America", "South America"):  0.75,
    ("North America", "Middle East"):    0.55,
    ("North America", "Africa"):         0.45,
    ("North America", "Oceania"):        0.65,
    # Middle East outbound (remaining)
    ("Middle East", "Africa"):           0.65,
    ("Middle East", "South America"):    0.35,
    ("Middle East", "Oceania"):          0.40,
    # Africa outbound (remaining)
    ("Africa", "South America"):         0.35,
    ("Africa", "Oceania"):               0.30,
    # South America outbound (remaining)
    ("South America", "Oceania"):        0.35,
}
# Make symmetric (A->B == B->A) + default
def get_corridor_strength(region_a: str, region_b: str) -> float:
    if region_a == region_b:
        return 1.0
    key1 = (region_a, region_b)
    key2 = (region_b, region_a)
    return CORRIDOR_STRENGTH.get(key1, CORRIDOR_STRENGTH.get(key2, 0.4))

# ---------------------------------------------------------------------------
# THRESHOLDS & MISC
# ---------------------------------------------------------------------------
MIN_MATCH_SCORE = 0.3          # Don't show matches below this
TOP_K_MATCHES   = 10           # How many matches to show per exporter
RECENCY_DECAY_DAYS = 180       # Trades older than this get decayed score

# ---------------------------------------------------------------------------
# SWIPE FEEDBACK WEIGHTS
# When user swipes right/left, how much to adjust future scoring
# This is the "real-time adaptability" layer
# ---------------------------------------------------------------------------
SWIPE_RIGHT_BOOST = 0.05       # Boost similar profiles by this much
SWIPE_LEFT_PENALTY = -0.03     # Penalize similar profiles by this much
