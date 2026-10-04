"""
Master Data Pipeline Orchestrator for ForeTrade
Executes the end-to-end ETL flow:
1. Ingests WCO Harmonized System (HS) Code Taxonomy.
2. Ingests real UN Comtrade bilateral trade flows across 10 global destinations.
3. Ingests WTO MFN and FTA preferential tariff schedules.
4. Ingests World Bank country governance & risk factors.
"""

import sys
from pathlib import Path
from sqlalchemy import func, select

REPO_ROOT = Path(__file__).resolve().parents[5]
API_DIR = REPO_ROOT / "apps" / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.trade_intelligence import (
    HsCodeTaxonomy,
    TradeCorridorFlow,
    TariffSchedule,
    CountryRiskFactor,
    GlobalBuyerCatalog,
    MarketDemandSignal,
)
from app.services.data_pipeline.ingest_hs_taxonomy import ingest_hs_taxonomy
from app.services.data_pipeline.ingest_un_comtrade import ingest_un_comtrade
from app.services.data_pipeline.ingest_tariffs import ingest_tariffs
from app.services.data_pipeline.ingest_country_risk import ingest_country_risk
from app.services.data_pipeline.ingest_buyer_manifests import ingest_buyer_manifests
from app.services.ml.demand_radar import ingest_live_market_signals


def run_all_pipelines() -> dict:
    print("==================================================")
    print(">>> ForeTrade Step 1: Real Data Engineering ETL")
    print("==================================================")

    # 1. Ensure all tables exist
    print("\n[1/7] Creating database schemas for trade intelligence...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 2. HS Code Taxonomy
        print("\n[2/7] Ingesting WCO HS Code Taxonomy...")
        hs_count = ingest_hs_taxonomy(db)

        # 3. UN Comtrade Bilateral Flows
        print("\n[3/7] Ingesting UN Comtrade Bilateral Flows (Live & Calibrated)...")
        flow_count = ingest_un_comtrade(db, fetch_live_sample=True)

        # 4. Tariffs & FTA Matrices
        print("\n[4/7] Ingesting WTO MFN and FTA Preferential Tariff Schedules...")
        tariff_count = ingest_tariffs(db)

        # 5. World Bank Country Risk
        print("\n[5/7] Ingesting World Bank Country Risk Indicators...")
        risk_count = ingest_country_risk(db)

        # 6. Global Buyer Manifests
        print("\n[6/7] Ingesting Global Buyer Manifest Catalog...")
        buyer_count = ingest_buyer_manifests(db)

        # 7. Real-Time Demand Radar Signals
        print("\n[7/7] Ingesting NLP Demand Radar Signals...")
        signal_count = ingest_live_market_signals(db)

        # Verification report
        total_hs = db.scalar(select(func.count(HsCodeTaxonomy.id)))
        total_flows = db.scalar(select(func.count(TradeCorridorFlow.id)))
        total_tariffs = db.scalar(select(func.count(TariffSchedule.id)))
        total_risk = db.scalar(select(func.count(CountryRiskFactor.id)))
        total_buyers = db.scalar(select(func.count(GlobalBuyerCatalog.id)))
        total_signals = db.scalar(select(func.count(MarketDemandSignal.id)))

        print("\n==================================================")
        print("[OK] ETL Data Pipeline Execution Summary")
        print("==================================================")
        print(f" * HS Code Taxonomy Entries:   {total_hs}")
        print(f" * UN Comtrade Corridor Flows: {total_flows}")
        print(f" * Tariff Schedules (MFN/FTA): {total_tariffs}")
        print(f" * Country Risk Profiles:      {total_risk}")
        print(f" * Verified Buyer Profiles:    {total_buyers}")
        print(f" * Market Demand Radar Signals:{total_signals}")
        print("==================================================")

        return {
            "hs_codes": total_hs,
            "corridor_flows": total_flows,
            "tariffs": total_tariffs,
            "country_risk": total_risk,
            "buyers": total_buyers,
            "demand_signals": total_signals,
        }
    finally:
        db.close()




if __name__ == "__main__":
    run_all_pipelines()
