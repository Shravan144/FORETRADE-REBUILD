"""
=============================================================================
FEATURE ENGINEERING — ForeTrade
=============================================================================
Converts cleaned data into feature vectors for scoring.

This is where raw data becomes "intelligence."
Each exporter and buyer gets a feature profile that the scorer uses.

PIPELINE:
    Cleaned Data  →  build_exporter_profiles()  →  Exporter features
                  →  build_buyer_profiles()      →  Buyer features
                  →  compute_compatibility()     →  Pairwise match features

TODO CHECKLIST:
    [ ] HOUR 4: Implement build_exporter_profiles()
    [ ] HOUR 4: Implement build_buyer_profiles()
    [ ] HOUR 5: Implement compute_compatibility()
    [ ] HOUR 6: (Optional) Add temporal features (trend detection)
=============================================================================
"""

import pandas as pd
import numpy as np
from utils.constants import COUNTRY_TO_REGION, PRODUCT_CATEGORIES


def build_exporter_profiles(
    exporters: pd.DataFrame, 
    transactions: pd.DataFrame
) -> pd.DataFrame:
    """
    Create rich feature profiles for each exporter.
    
    Features to compute:
        - total_trade_volume:    Sum of all trade_value
        - avg_trade_value:       Average transaction size
        - num_transactions:      Total number of trades
        - num_unique_buyers:     How many distinct buyers
        - num_unique_countries:  Geographic diversification
        - primary_product:       Most-traded HS code
        - trade_recency:         Days since last transaction
        - growth_trend:          Is their trading volume growing? (slope)
    """
    profiles = exporters.copy()
    
    # Ensure date is datetime
    if not pd.api.types.is_datetime64_any_dtype(transactions["date"]):
        transactions = transactions.copy()
        transactions["date"] = pd.to_datetime(transactions["date"], errors="coerce")
    
    # Group transactions by exporter_id and compute aggregates
    agg = transactions.groupby("exporter_id").agg(
        total_trade_volume=("trade_value", "sum"),
        avg_trade_value=("trade_value", "mean"),
        num_transactions=("transaction_id", "count"),
        num_unique_buyers=("buyer_id", "nunique"),
        num_unique_countries=("port_of_dest", "nunique"),
        last_transaction_date=("date", "max"),
    ).reset_index()
    
    profiles = profiles.merge(agg, on="exporter_id", how="left")
    
    # Fill numeric cols only (avoid putting 0 in date column)
    for col in ["total_trade_volume", "avg_trade_value", "num_transactions", "num_unique_buyers", "num_unique_countries"]:
        if col in profiles.columns:
            profiles[col] = profiles[col].fillna(0)
    
    # Compute trade_recency (days since last transaction)
    now = pd.Timestamp.now()
    last_dt = pd.to_datetime(profiles["last_transaction_date"], errors="coerce")
    profiles["trade_recency"] = (now - last_dt).dt.days
    profiles["trade_recency"] = profiles["trade_recency"].fillna(999).astype(int)
    
    # Compute primary_product (most-traded HS code)
    primary_products = transactions.groupby("exporter_id")["hs_code"].agg(
        lambda x: x.mode()[0] if len(x.mode()) > 0 else x.iloc[0] if len(x) > 0 else None
    ).reset_index()
    primary_products.columns = ["exporter_id", "primary_product"]
    profiles = profiles.merge(primary_products, on="exporter_id", how="left")
    
    # Compute growth_trend (simplified: compare last 2 quarters)
    profiles["growth_trend"] = 0.0
    for exp_id in profiles["exporter_id"]:
        exp_txns = transactions[transactions["exporter_id"] == exp_id].copy()
        if len(exp_txns) >= 2:
            exp_txns = exp_txns.sort_values("date")
            mid_point = exp_txns["date"].quantile(0.5)
            q1_volume = exp_txns[exp_txns["date"] < mid_point]["trade_value"].sum()
            q2_volume = exp_txns[exp_txns["date"] >= mid_point]["trade_value"].sum()
            if q1_volume > 0:
                growth = (q2_volume - q1_volume) / q1_volume
                profiles.loc[profiles["exporter_id"] == exp_id, "growth_trend"] = growth
    
    return profiles


def build_buyer_profiles(
    buyers: pd.DataFrame, 
    transactions: pd.DataFrame
) -> pd.DataFrame:
    """
    Create rich feature profiles for each buyer.
    
    Features to compute:
        - total_import_volume:    Sum of trade_value as buyer
        - avg_import_value:       Average import size
        - num_imports:            Number of transactions
        - num_unique_exporters:   How many suppliers
        - preferred_hs:           Most-imported product code
        - import_recency:         Days since last import
        - region:                 Mapped from country using COUNTRY_TO_REGION
    """
    profiles = buyers.copy()
    
    # Ensure date is datetime
    if not pd.api.types.is_datetime64_any_dtype(transactions["date"]):
        transactions = transactions.copy()
        transactions["date"] = pd.to_datetime(transactions["date"], errors="coerce")
    
    # Group transactions by buyer_id and compute aggregates
    agg = transactions.groupby("buyer_id").agg(
        total_import_volume=("trade_value", "sum"),
        avg_import_value=("trade_value", "mean"),
        num_imports=("transaction_id", "count"),
        num_unique_exporters=("exporter_id", "nunique"),
        last_import_date=("date", "max"),
    ).reset_index()
    
    profiles = profiles.merge(agg, on="buyer_id", how="left")
    
    # Fill numeric cols only (avoid putting 0 in date column)
    for col in ["total_import_volume", "avg_import_value", "num_imports", "num_unique_exporters"]:
        if col in profiles.columns:
            profiles[col] = profiles[col].fillna(0)
    
    # Compute import_recency
    now = pd.Timestamp.now()
    last_dt = pd.to_datetime(profiles["last_import_date"], errors="coerce")
    profiles["import_recency"] = (now - last_dt).dt.days
    profiles["import_recency"] = profiles["import_recency"].fillna(999).astype(int)
    
    # Compute preferred_hs (most-imported product code)
    preferred_products = transactions.groupby("buyer_id")["hs_code"].agg(
        lambda x: x.mode()[0] if len(x.mode()) > 0 else x.iloc[0] if len(x) > 0 else None
    ).reset_index()
    preferred_products.columns = ["buyer_id", "preferred_hs"]
    profiles = profiles.merge(preferred_products, on="buyer_id", how="left")
    
    # Add region mapping
    profiles["region"] = profiles["country"].map(COUNTRY_TO_REGION)
    profiles["region"].fillna("Unknown", inplace=True)
    
    return profiles


def compute_compatibility(
    exporter_profile: pd.Series, 
    buyer_profile: pd.Series
) -> dict:
    """
    ⭐ CORE MATCHING LOGIC — Compute pairwise compatibility features.
    
    Given one exporter and one buyer, compute:
    
    1. product_match (0 or 1):
       Does the exporter's primary_hs == buyer's interested_hs?
       (Or any overlap between exporter's products and buyer's imports)
    
    2. geography_score (0-1):
       Use COUNTRY_TO_REGION mapping + CORRIDOR_STRENGTH from constants
    
    3. trade_frequency_match (0-1):
       Normalized comparison of exporter's trade frequency vs buyer's
    
    4. activity_score (0-1):
       Based on buyer's last_active_days + intent_score
    """
    from utils.constants import get_corridor_strength
    
    # 1. Product compatibility
    exp_hs = str(exporter_profile.get("primary_hs", "") or exporter_profile.get("primary_product", ""))
    buy_hs = str(buyer_profile.get("interested_hs", "") or buyer_profile.get("preferred_hs", ""))
    
    if exp_hs == buy_hs and exp_hs != "":
        product_compatibility = 1.0
    elif exp_hs[:2] == buy_hs[:2] and len(exp_hs) >= 2 and len(buy_hs) >= 2:
        product_compatibility = 0.7
    elif exp_hs != "" and buy_hs != "":
        product_compatibility = 0.3
    else:
        product_compatibility = 0.0
    
    # 2. Geography fit
    exp_country = exporter_profile.get("country", "")
    buy_country = buyer_profile.get("country", "")
    exp_region = COUNTRY_TO_REGION.get(exp_country, "Unknown")
    buy_region = COUNTRY_TO_REGION.get(buy_country, "Unknown")
    
    geography_fit = get_corridor_strength(exp_region, buy_region)
    
    # 3. Trade frequency match
    # Normalize exporter's num_transactions vs buyer's num_imports
    exp_freq = exporter_profile.get("num_transactions", 0)
    buy_freq = buyer_profile.get("num_imports", 0)
    
    if exp_freq == 0 and buy_freq == 0:
        trade_frequency = 0.5
    elif exp_freq == 0 or buy_freq == 0:
        trade_frequency = 0.3
    else:
        # Normalize to 0-1: closer frequencies = higher score
        max_freq = max(exp_freq, buy_freq)
        min_freq = min(exp_freq, buy_freq)
        trade_frequency = min_freq / max_freq
    
    # 4. Buyer activity score
    # Combine activity_score and intent_score from buyer profile
    activity_score = buyer_profile.get("activity_score", 0.5)
    intent_score = buyer_profile.get("intent_score", 0.5)
    buyer_activity = 0.6 * activity_score + 0.4 * intent_score
    
    return {
        "product_compatibility": float(product_compatibility),
        "geography_fit": float(geography_fit),
        "trade_frequency": float(trade_frequency),
        "buyer_activity": float(buyer_activity),
    }
