"""
=============================================================================
LOAD ORGANIZER EXIM DATASET — ForeTrade
=============================================================================
Reads EXIM_DatasetAlgo_Hackathon.xlsx and produces:
  - exporters_df: one row per exporter (latest or aggregated signals)
  - buyers_df: one row per buyer (latest or aggregated signals)
  - transactions_df: optional synthetic links for graph (same industry + intent)
  - global_news_df: for optional risk/opportunity adjustment

Usage:
  python data/load_exim_hackathon_dataset.py

  Or from app: set DATA_SOURCE = "exim_hackathon" and point EXIM_XLSX_PATH to the file.

Expects the Excel at path given below, or set env EXIM_XLSX_PATH.
=============================================================================
"""

import pandas as pd
import numpy as np
import os
from datetime import datetime

# Default path: 1) same folder as this script (data/), 2) then env EXIM_XLSX_PATH, 3) then this fallback
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR_EXCEL = os.path.join(_SCRIPT_DIR, "EXIM_DatasetAlgo_Hackathon.xlsx")
EXIM_XLSX_PATH = os.environ.get(
    "EXIM_XLSX_PATH",
    _DATA_DIR_EXCEL if os.path.exists(_DATA_DIR_EXCEL) else os.path.join(
        os.path.expanduser("~"), "Downloads", "OneDrive_2026-02-21",
        "PS Swipe to Export Algo Docs", "EXIM_DatasetAlgo_Hackathon.xlsx"
    )
)
OUTPUT_DIR = _SCRIPT_DIR

# ── deterministic company-name generator ──────────────────────────────────
import hashlib as _hashlib

_NAME_PREFIXES = [
    "Global", "Pacific", "Atlas", "Nexus", "Prime", "Summit", "Crown",
    "Vanguard", "Apex", "Zenith", "Sterling", "Titan", "Horizon", "Nova",
    "Phoenix", "Vertex", "Compass", "Pinnacle", "Eagle", "Diamond",
    "Meridian", "Quantum", "Stellar", "Olympus", "Keystone", "Beacon",
    "Sovereign", "Crest", "Magellan", "Orion", "Velocity", "Alpine",
    "Harbor", "Catalyst", "Frontier", "Ascent", "Paragon", "Venture",
]

_INDUSTRY_TAG = {
    "Engineering":     "Engineering",
    "Solar":           "Solar",
    "Chemicals":       "Chem",
    "Electronics":     "Electronics",
    "Textiles":        "Textiles",
    "Medical Devices": "MedTech",
    "Auto Parts":      "Auto",
    "Machinery":       "Machinery",
    "Pharmaceuticals": "Pharma",
    "IT Software":     "Tech",
}

_EXP_SUFFIXES = ["Exports", "Industries", "Manufacturing", "Corp", "International"]
_BUY_SUFFIXES = ["Imports", "Trading", "Distribution", "Group", "Enterprises"]


def _gen_name(entity_id: str, industry, entity_type: str = "exporter") -> str:
    """Deterministic, realistic company name from an entity ID + industry."""
    h = int(_hashlib.md5(entity_id.encode()).hexdigest(), 16)
    prefix = _NAME_PREFIXES[h % len(_NAME_PREFIXES)]
    tag = _INDUSTRY_TAG.get(
        str(industry), str(industry)[:8] if pd.notna(industry) else "Trade"
    )
    suffixes = _EXP_SUFFIXES if entity_type == "exporter" else _BUY_SUFFIXES
    suffix = suffixes[(h // len(_NAME_PREFIXES)) % len(suffixes)]
    return f"{prefix} {tag} {suffix}"


def load_excel_sheets(path: str):
    """Load all three sheets."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"EXIM dataset not found at:\n  {path}\n\n"
            "DO THIS: Copy 'EXIM_DatasetAlgo_Hackathon.xlsx' into the 'data' folder of this project,\n"
            "then run this script again."
        )
    
    exp = pd.read_excel(path, sheet_name="Exporter_LiveSignals_v5_Updated")
    imp = pd.read_excel(path, sheet_name="Importer_LiveSignals_v5_Updated")
    news = pd.read_excel(path, sheet_name="Global_News_LiveSignals_Updated")
    
    return exp, imp, news


def clean_exporters(exp: pd.DataFrame) -> pd.DataFrame:
    """One row per Exporter_ID: keep latest date row and aggregate key fields."""
    exp = exp.copy()
    exp["Date"] = pd.to_datetime(exp["Date"], errors="coerce")
    exp = exp.dropna(subset=["Date"])
    
    # Latest record per exporter (most recent signals)
    exp_sorted = exp.sort_values("Date", ascending=False)
    latest = exp_sorted.groupby("Exporter_ID").first().reset_index()
    
    # Build exporter table with naming our app expects
    exporters_df = pd.DataFrame({
        "exporter_id": latest["Exporter_ID"],
        "company_name": latest.apply(
            lambda r: _gen_name(r["Exporter_ID"], r.get("Industry", ""), "exporter"), axis=1
        ),
        "country": "India",
        "state": latest["State"],
        "industry": latest["Industry"],
        "primary_hs": latest["Industry"],  # map industry to "product" for compatibility
        "employees": latest["Team_Size"],
        "annual_volume": latest["Revenue_Size_USD"],
        "intent_score": latest["Intent_Score"],
        "prompt_response_score": latest["Prompt_Response_Score"],
        "good_payment_terms": latest["Good_Payment_Terms"],
        "hiring_signal": latest["Hiring_Signal"],
        "last_signal_date": latest["Date"],
        "manufacturing_capacity_tons": latest["Manufacturing_Capacity_Tons"],
        "certification": latest["Certification"],
        "msme_udyam": latest["MSME_Udyam"],
        "shipment_value_usd": latest["Shipment_Value_USD"],
        "quantity_tons": latest["Quantity_Tons"],
    })
    
    return exporters_df


def clean_buyers(imp: pd.DataFrame) -> pd.DataFrame:
    """One row per Buyer_ID: keep latest date row."""
    imp = imp.copy()
    imp = imp.dropna(subset=["Buyer_ID"])
    imp["Date"] = pd.to_datetime(imp["Date"], errors="coerce")
    imp = imp.dropna(subset=["Date"])
    
    imp_sorted = imp.sort_values("Date", ascending=False)
    latest = imp_sorted.groupby("Buyer_ID").first().reset_index()
    
    buyers_df = pd.DataFrame({
        "buyer_id": latest["Buyer_ID"],
        "company_name": latest.apply(
            lambda r: _gen_name(r["Buyer_ID"], r.get("Industry", ""), "buyer"), axis=1
        ),
        "country": latest["Country"],
        "industry": latest["Industry"],
        "interested_hs": latest["Industry"],
        "buyer_type": "Importer",
        "import_frequency": "quarterly",  # placeholder; not in dataset
        "last_active_days": (pd.Timestamp.now() - latest["Date"]).dt.days,
        "intent_score": latest["Intent_Score"],
        "preferred_channel": latest["Preferred_Channel"].fillna("Email"),
        "prompt_response": latest["Prompt_Response"],
        "good_payment_history": latest["Good_Payment_History"],
        "revenue_size_usd": latest["Revenue_Size_USD"],
        "team_size": latest["Team_Size"],
        "avg_order_tons": latest["Avg_Order_Tons"],
        "engagement_spike": latest["Engagement_Spike"],
        "decision_maker_change": latest["DecisionMaker_Change"],
    })
    
    return buyers_df


def build_synthetic_transactions(exporters_df: pd.DataFrame, buyers_df: pd.DataFrame, max_per_exporter: int = 50, seed: int = 42):
    """
    Build synthetic exporter-buyer links so the graph has edges (no real transactions in dataset).
    Link exporters to buyers with same industry; sample up to max_per_exporter per exporter.
    """
    np.random.seed(seed)
    rows = []
    for _, exp in exporters_df.iterrows():
        eid = exp["exporter_id"]
        ind = exp["industry"]
        same_industry = buyers_df[buyers_df["industry"] == ind]
        if same_industry.empty:
            continue
        n = min(max_per_exporter, len(same_industry))
        sample = same_industry.sample(n=n, random_state=seed)
        base_value = float(exp.get("shipment_value_usd")) if pd.notna(exp.get("shipment_value_usd")) else 100000.0
        base_qty = int(exp.get("quantity_tons")) if pd.notna(exp.get("quantity_tons")) else 100
        for _, buy in sample.iterrows():
            rows.append({
                "transaction_id": f"T_{eid}_{buy['buyer_id']}",
                "exporter_id": eid,
                "buyer_id": buy["buyer_id"],
                "hs_code": ind,
                "trade_value": round(base_value * (0.8 + 0.4 * np.random.random()), 2),
                "quantity": max(1, base_qty * (1 + np.random.randint(0, 5))),
                "date": (pd.Timestamp.now() - pd.Timedelta(days=int(np.random.randint(1, 365)))).strftime("%Y-%m-%d"),
                "port_of_origin": "India",
                "port_of_dest": buy["country"],
            })
    return pd.DataFrame(rows)


def run(output_dir: str = OUTPUT_DIR, excel_path: str = EXIM_XLSX_PATH, build_synthetic_txn: bool = True):
    """Load Excel, clean, write CSVs."""
    exp_raw, imp_raw, news = load_excel_sheets(excel_path)
    
    exporters_df = clean_exporters(exp_raw)
    buyers_df = clean_buyers(imp_raw)
    
    if build_synthetic_txn:
        transactions_df = build_synthetic_transactions(exporters_df, buyers_df)
    else:
        transactions_df = pd.DataFrame(columns=[
            "transaction_id", "exporter_id", "buyer_id", "hs_code", "trade_value",
            "quantity", "date", "port_of_origin", "port_of_dest"
        ])
    
    # Save
    exporters_df.to_csv(os.path.join(output_dir, "exporters.csv"), index=False)
    buyers_df.to_csv(os.path.join(output_dir, "buyers.csv"), index=False)
    transactions_df.to_csv(os.path.join(output_dir, "transactions.csv"), index=False)
    news.to_csv(os.path.join(output_dir, "global_news.csv"), index=False)
    
    print("EXIM Hackathon dataset loaded and saved:")
    print(f"  exporters:    {len(exporters_df)} -> data/exporters.csv")
    print(f"  buyers:       {len(buyers_df)} -> data/buyers.csv")
    print(f"  transactions: {len(transactions_df)} (synthetic) -> data/transactions.csv")
    print(f"  global_news:  {len(news)} -> data/global_news.csv")
    
    return exporters_df, buyers_df, transactions_df, news


if __name__ == "__main__":
    print("Looking for EXIM Excel at:", EXIM_XLSX_PATH)
    run()
