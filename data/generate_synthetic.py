"""
=============================================================================
SYNTHETIC DATA GENERATOR — ForeTrade
=============================================================================
Generates realistic-looking EXIM trade data for the hackathon demo.
Run this FIRST to create your dataset.

HOW TO RUN:
    python data/generate_synthetic.py

OUTPUT:
    data/exporters.csv      — Exporter companies
    data/buyers.csv         — Buyer companies
    data/transactions.csv   — Trade transactions between them

TODO CHECKLIST (copy into your task tracker):
    [x] Basic structure defined
    [ ] HOUR 1: Run this script, inspect the CSVs
    [ ] HOUR 1: Tweak NUM_EXPORTERS / NUM_BUYERS if needed
    [ ] HOUR 2: Add more product codes from constants.py
    [ ] HOUR 5: (Optional) Add noise/missing values to test your cleaner
=============================================================================
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os
import sys

# Add parent dir to path so we can import utils
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from utils.constants import PRODUCT_CATEGORIES, TRADE_REGIONS

# ---------------------------------------------------------------------------
# CONFIG — Tweak these numbers
# ---------------------------------------------------------------------------
NUM_EXPORTERS       = 50       # Number of exporter companies
NUM_BUYERS          = 200      # Number of buyer companies
NUM_TRANSACTIONS    = 2000     # Number of trade transactions to generate
DAYS_BACK           = 365 * 2  # How far back transactions go (2 years)
OUTPUT_DIR          = os.path.join(os.path.dirname(__file__))

# ---------------------------------------------------------------------------
# HELPER DATA
# ---------------------------------------------------------------------------
EXPORTER_COUNTRIES = ["India", "Bangladesh", "Vietnam", "China", "Thailand"]
BUYER_COUNTRIES = []
for countries in TRADE_REGIONS.values():
    BUYER_COUNTRIES.extend(countries)
BUYER_COUNTRIES = list(set(BUYER_COUNTRIES))

COMPANY_PREFIXES = [
    "Global", "Pacific", "Atlas", "Nexus", "Prime", "Summit", "Crown",
    "Vanguard", "Apex", "Zenith", "Sterling", "Titan", "Horizon", "Nova",
    "Phoenix", "Vertex", "Compass", "Pinnacle", "Eagle", "Diamond",
]
COMPANY_SUFFIXES = [
    "Trading Co.", "Exports Ltd.", "International", "Industries",
    "Commerce", "Enterprises", "Group", "Corp.", "Solutions", "Partners",
]

HS_CODES = list(PRODUCT_CATEGORIES.keys())


def generate_company_name(used_names: set) -> str:
    """Generate a unique company name."""
    while True:
        name = f"{random.choice(COMPANY_PREFIXES)} {random.choice(COMPANY_SUFFIXES)}"
        if name not in used_names:
            used_names.add(name)
            return name


def generate_exporters(n: int) -> pd.DataFrame:
    """
    Generate exporter companies.
    
    Each exporter has:
        - exporter_id:   Unique ID (E001, E002, ...)
        - company_name:  Fake but realistic name
        - country:       Where they're based
        - primary_hs:    Main product category (2-digit HS code)
        - secondary_hs:  Secondary product (can be same or different)
        - employees:     Company size estimate
        - annual_volume: Estimated annual trade volume in USD
    
    TODO (HOUR 2): Add more fields if you need them for scoring
    """
    used_names = set()
    rows = []
    for i in range(n):
        primary_hs = random.choice(HS_CODES)
        secondary_hs = random.choice(HS_CODES)
        rows.append({
            "exporter_id":   f"E{i+1:03d}",
            "company_name":  generate_company_name(used_names),
            "country":       random.choice(EXPORTER_COUNTRIES),
            "primary_hs":    primary_hs,
            "secondary_hs":  secondary_hs,
            "employees":     random.choice([10, 25, 50, 100, 250, 500, 1000]),
            "annual_volume": round(random.uniform(50_000, 10_000_000), 2),
        })
    return pd.DataFrame(rows)


def generate_buyers(n: int) -> pd.DataFrame:
    """
    Generate buyer companies.
    
    Each buyer has:
        - buyer_id:        Unique ID (B001, B002, ...)
        - company_name:    Fake but realistic name
        - country:         Where they're based
        - interested_hs:   What product codes they typically import
        - buyer_type:      Distributor / Retailer / Manufacturer / Wholesaler
        - import_frequency: How often they import (monthly/quarterly/yearly)
        - last_active_days: Days since their last import (lower = more active)
    
    TODO (HOUR 2): Add "expansion_signals" boolean for high-intent detection
    """
    used_names = set()
    rows = []
    buyer_types = ["Distributor", "Retailer", "Manufacturer", "Wholesaler"]
    freq_options = ["monthly", "quarterly", "biannual", "yearly"]

    for i in range(n):
        rows.append({
            "buyer_id":          f"B{i+1:03d}",
            "company_name":      generate_company_name(used_names),
            "country":           random.choice(BUYER_COUNTRIES),
            "interested_hs":     random.choice(HS_CODES),
            "buyer_type":        random.choice(buyer_types),
            "import_frequency":  random.choice(freq_options),
            "last_active_days":  random.randint(1, 400),
        })
    return pd.DataFrame(rows)


def generate_transactions(
    exporters: pd.DataFrame, 
    buyers: pd.DataFrame, 
    n: int
) -> pd.DataFrame:
    """
    Generate trade transactions.
    
    Each transaction has:
        - transaction_id:  Unique ID
        - exporter_id:     Who exported
        - buyer_id:        Who imported
        - hs_code:         Product code traded
        - trade_value:     USD value
        - quantity:        Units traded
        - date:            When it happened
        - port_of_origin:  (simplified — just country)
        - port_of_dest:    (simplified — just country)
    
    NOTE: Some transactions intentionally have missing values
    to test your data cleaning pipeline!
    
    TODO (HOUR 3): Add more noise types (typos, weird values) 
                   to test cleaner robustness
    """
    rows = []
    base_date = datetime.now()

    for i in range(n):
        exp = exporters.sample(1).iloc[0]
        buy = buyers.sample(1).iloc[0]

        # 70% of time, trade the exporter's primary product
        # 30% of time, trade a random product (creates noise)
        if random.random() < 0.7:
            hs = exp["primary_hs"]
        else:
            hs = random.choice(HS_CODES)

        trade_value = round(random.uniform(1_000, 500_000), 2)
        quantity = random.randint(10, 10_000)
        days_ago = random.randint(0, DAYS_BACK)
        date = base_date - timedelta(days=days_ago)

        row = {
            "transaction_id":  f"T{i+1:05d}",
            "exporter_id":     exp["exporter_id"],
            "buyer_id":        buy["buyer_id"],
            "hs_code":         hs,
            "trade_value":     trade_value,
            "quantity":        quantity,
            "date":            date.strftime("%Y-%m-%d"),
            "port_of_origin":  exp["country"],
            "port_of_dest":    buy["country"],
        }

        # Inject ~5% missing values (for cleaning pipeline to handle)
        if random.random() < 0.05:
            row["trade_value"] = np.nan
        if random.random() < 0.03:
            row["quantity"] = np.nan

        rows.append(row)

    return pd.DataFrame(rows)


def main():
    """Generate all synthetic data and save to CSV."""
    print("🏭 Generating synthetic EXIM data...")
    
    np.random.seed(42)
    random.seed(42)

    exporters = generate_exporters(NUM_EXPORTERS)
    buyers = generate_buyers(NUM_BUYERS)
    transactions = generate_transactions(exporters, buyers, NUM_TRANSACTIONS)

    # Save
    exporters.to_csv(os.path.join(OUTPUT_DIR, "exporters.csv"), index=False)
    buyers.to_csv(os.path.join(OUTPUT_DIR, "buyers.csv"), index=False)
    transactions.to_csv(os.path.join(OUTPUT_DIR, "transactions.csv"), index=False)

    print(f"✅ Generated:")
    print(f"   {len(exporters)} exporters  → data/exporters.csv")
    print(f"   {len(buyers)} buyers     → data/buyers.csv")
    print(f"   {len(transactions)} transactions → data/transactions.csv")
    print(f"\n📊 Transaction date range: {transactions['date'].min()} to {transactions['date'].max()}")
    print(f"   Missing trade_values: {transactions['trade_value'].isna().sum()}")
    print(f"   Missing quantities:   {transactions['quantity'].isna().sum()}")
    print(f"\n🚀 Data is ready. Next step: run the cleaning pipeline.")


if __name__ == "__main__":
    main()
