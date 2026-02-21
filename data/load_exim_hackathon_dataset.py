"""
=============================================================================
LOAD ORGANIZER EXIM DATASET — ForeTrade
=============================================================================
Reads EXIM_DatasetAlgo_Hackathon.xlsx  **or**  .csv  and produces:
  - exporters_df: one row per exporter (latest or aggregated signals)
  - buyers_df: one row per buyer (latest or aggregated signals)
  - transactions_df: synthetic links for the trade graph (same industry + intent)
  - global_news_df: for risk/opportunity adjustment

Supports TWO formats:
  1. Excel (.xlsx) with 3 sheets: Exporter*, Importer*, Global_News*
  2. CSV  (.csv)  with buyer rows first, then a header-separator row
     ("News_ID,Date,Region,…") marking the start of news data.

Usage:
  python data/load_exim_hackathon_dataset.py

  Or from app: set DATA_SOURCE = "exim_hackathon" and point EXIM_XLSX_PATH
  (or EXIM_CSV_PATH env) to the file.
=============================================================================
"""

import pandas as pd
import numpy as np
import os
from datetime import datetime

# ── locate the organiser dataset ──────────────────────────────────────────
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Try CSV first (single-file format provided for the hackathon), then Excel
_DATA_DIR_CSV  = os.path.join(_SCRIPT_DIR, "EXIM_DatasetAlgo_Hackathon.csv")
_DATA_DIR_EXCEL = os.path.join(_SCRIPT_DIR, "EXIM_DatasetAlgo_Hackathon.xlsx")

# Env overrides
EXIM_CSV_PATH = os.environ.get("EXIM_CSV_PATH", _DATA_DIR_CSV)
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


def load_csv_dataset(path: str):
    """
    Load the single-CSV format used here:
      rows 0‥N-1 = Buyer/Importer data
      row  N     = header row for News (Date == "News_ID")
      rows N+1.. = News events
    Returns (buyers_raw, news_raw).  No exporter sheet in CSV.
    """
    df = pd.read_csv(path, on_bad_lines="skip", dtype=str)

    # Detect the separator row where the news header starts
    news_header_idx = df.index[df["Date"] == "News_ID"]
    if len(news_header_idx) == 0:
        raise ValueError("Cannot find the News header row ('News_ID') in the CSV.")

    split = news_header_idx[0]

    # ── Buyer section ─────────────────────────────────────────────────
    buyers_raw = df.iloc[:split].copy()
    # Drop artifact unnamed columns
    buyers_raw = buyers_raw[[c for c in buyers_raw.columns if "Unnamed" not in c]]
    # Cast numeric columns
    _numeric_buyer_cols = [
        "Avg_Order_Tons", "Revenue_Size_USD", "Team_Size",
        "Good_Payment_History", "Prompt_Response", "Hiring_Growth",
        "Funding_Event", "Engagement_Spike", "DecisionMaker_Change",
        "Intent_Score", "Response_Probability",
        "Tariff_News", "StockMarket_Shock", "War_Event",
        "Natural_Calamity", "Currency_Fluctuation",
    ]
    for col in _numeric_buyer_cols:
        if col in buyers_raw.columns:
            buyers_raw[col] = pd.to_numeric(buyers_raw[col], errors="coerce")

    # ── News section ──────────────────────────────────────────────────
    news_raw = df.iloc[split + 1:].copy().reset_index(drop=True)

    # The news data is stored under the *buyer* column headers positionally.
    # Map buyer column positions → actual news column names.
    # Positional mapping (based on the header row at the split):
    #   col0 (Date)                → News_ID
    #   col1 (Buyer_ID)            → Date
    #   col2 (Country)             → Region
    #   col3 (Industry)            → Event_Type
    #   col4 (Avg_Order_Tons)      → Impact_Level
    #   col5 (Revenue_Size_USD)    → Affected_Industry
    #   col6 (Team_Size)           → Tariff_Change
    #   col7 (Unnamed: 7)          → StockMarket_Shock
    #   col8 (Good_Payment_History)→ War_Flag
    #   col9 (Prompt_Response)     → Natural_Calamity_Flag
    #   col10(Hiring_Growth)       → Currency_Shift
    #   remaining columns are empty in the news section

    # Build a fresh DataFrame with only the 11 news columns
    orig_cols = list(news_raw.columns)
    news_df = pd.DataFrame({
        "News_ID":              news_raw[orig_cols[0]],
        "Date":                 news_raw[orig_cols[1]],
        "Region":               news_raw[orig_cols[2]],
        "Event_Type":           news_raw[orig_cols[3]],
        "Impact_Level":         news_raw[orig_cols[4]],
        "Affected_Industry":    news_raw[orig_cols[5]],
        "Tariff_Change":        pd.to_numeric(news_raw[orig_cols[6]], errors="coerce"),
        "StockMarket_Shock":    pd.to_numeric(news_raw[orig_cols[7]], errors="coerce"),
        "War_Flag":             pd.to_numeric(news_raw[orig_cols[8]], errors="coerce"),
        "Natural_Calamity_Flag": pd.to_numeric(news_raw[orig_cols[9]], errors="coerce"),
        "Currency_Shift":       pd.to_numeric(news_raw[orig_cols[10]], errors="coerce"),
    })

    return buyers_raw.reset_index(drop=True), news_df


def load_excel_sheets(path: str):
    """Load all three sheets from the .xlsx format."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"EXIM dataset not found at:\n  {path}\n\n"
            "DO THIS: Copy 'EXIM_DatasetAlgo_Hackathon.xlsx' (or .csv) into the "
            "'data' folder of this project, then run this script again."
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
    """One row per Buyer_ID: keep latest date row.  Includes ALL organiser signals."""
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
        "decision_maker_change": latest.get("DecisionMaker_Change", pd.Series(dtype=float)),
        # ── NEW: Buyer-readiness & growth signals ────────────────────
        "hiring_growth": latest.get("Hiring_Growth", pd.Series(dtype=float)),
        "funding_event": latest.get("Funding_Event", pd.Series(dtype=float)),
        "response_probability": latest.get("Response_Probability", pd.Series(dtype=float)),
        # ── NEW: Geo-political risk signals (per buyer) ──────────────
        "tariff_news": latest.get("Tariff_News", pd.Series(dtype=float)),
        "stockmarket_shock": latest.get("StockMarket_Shock", pd.Series(dtype=float)),
        "war_event": latest.get("War_Event", pd.Series(dtype=float)),
        "natural_calamity": latest.get("Natural_Calamity", pd.Series(dtype=float)),
        "currency_fluctuation": latest.get("Currency_Fluctuation", pd.Series(dtype=float)),
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


def _build_exporters_from_buyers(buyers_df: pd.DataFrame, seed: int = 42) -> pd.DataFrame:
    """
    CSV format has NO exporter sheet.  Synthesise a realistic exporter table
    by sampling high-intent Indian industries from the buyer pool.
    Produces ~500 exporters with deterministic names.
    """
    np.random.seed(seed)
    industries = buyers_df["industry"].dropna().unique()
    rows = []
    eid = 1
    for ind in industries:
        # 30–60 exporters per industry
        n = np.random.randint(30, 61)
        for _ in range(n):
            exp_id = f"EXP_{eid:05d}"
            rows.append({
                "exporter_id": exp_id,
                "company_name": _gen_name(exp_id, ind, "exporter"),
                "country": "India",
                "state": np.random.choice(["Maharashtra", "Gujarat", "Tamil Nadu",
                                           "Karnataka", "Delhi", "Telangana",
                                           "West Bengal", "Rajasthan"]),
                "industry": ind,
                "primary_hs": ind,
                "employees": int(np.random.randint(50, 7000)),
                "annual_volume": int(np.random.randint(5_000_000, 200_000_000)),
                "intent_score": round(np.random.uniform(0.3, 1.0), 2),
                "prompt_response_score": round(np.random.uniform(0.2, 1.0), 2),
                "good_payment_terms": int(np.random.choice([0, 1], p=[0.2, 0.8])),
                "hiring_signal": int(np.random.choice([0, 1], p=[0.5, 0.5])),
                "last_signal_date": (pd.Timestamp.now()
                                     - pd.Timedelta(days=int(np.random.randint(1, 365)))),
                "manufacturing_capacity_tons": int(np.random.randint(100, 10000)),
                "certification": np.random.choice(["ISO 9001", "ISO 14001", "BIS", "CE", "None"]),
                "msme_udyam": np.random.choice(["Micro", "Small", "Medium", "None"]),
                "shipment_value_usd": int(np.random.randint(10000, 5_000_000)),
                "quantity_tons": int(np.random.randint(10, 8000)),
            })
            eid += 1
    return pd.DataFrame(rows)


def run(output_dir: str = OUTPUT_DIR, excel_path: str = EXIM_XLSX_PATH,
        csv_path: str = EXIM_CSV_PATH, build_synthetic_txn: bool = True):
    """Load from CSV or Excel, clean, write CSVs."""

    # ── Decide source format ──────────────────────────────────────────
    use_csv = os.path.exists(csv_path)
    use_xlsx = (not use_csv) and os.path.exists(excel_path)

    if use_csv:
        print(f"Loading from CSV: {csv_path}")
        imp_raw, news = load_csv_dataset(csv_path)
        buyers_df = clean_buyers(imp_raw)
        exporters_df = _build_exporters_from_buyers(buyers_df)
    elif use_xlsx:
        print(f"Loading from Excel: {excel_path}")
        exp_raw, imp_raw, news = load_excel_sheets(excel_path)
        exporters_df = clean_exporters(exp_raw)
        buyers_df = clean_buyers(imp_raw)
    else:
        raise FileNotFoundError(
            "EXIM dataset not found.\n"
            f"  Tried CSV:   {csv_path}\n"
            f"  Tried Excel: {excel_path}\n\n"
            "Copy the organiser file into the 'data/' folder and run again."
        )

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
    if isinstance(news, pd.DataFrame):
        news.to_csv(os.path.join(output_dir, "global_news.csv"), index=False)
    
    print("EXIM Hackathon dataset loaded and saved:")
    print(f"  exporters:    {len(exporters_df)} -> data/exporters.csv")
    print(f"  buyers:       {len(buyers_df)} -> data/buyers.csv")
    print(f"  transactions: {len(transactions_df)} (synthetic) -> data/transactions.csv")
    if isinstance(news, pd.DataFrame):
        print(f"  global_news:  {len(news)} -> data/global_news.csv")
    
    return exporters_df, buyers_df, transactions_df, news


if __name__ == "__main__":
    if os.path.exists(EXIM_CSV_PATH):
        print("Loading from CSV:", EXIM_CSV_PATH)
    else:
        print("Loading from Excel:", EXIM_XLSX_PATH)
    run()
