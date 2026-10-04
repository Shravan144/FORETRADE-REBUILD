"""
Unit and Integration Tests for Step 1 Data Engineering Pipelines.
Validates HS taxonomy, UN Comtrade flows, tariff schedules, and country risk factors.
"""

import pytest
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.trade_intelligence import (
    HsCodeTaxonomy,
    TradeCorridorFlow,
    TariffSchedule,
    CountryRiskFactor,
)
from app.services.data_pipeline.run_pipeline import run_all_pipelines


@pytest.fixture(autouse=True)
def seed_pipeline_data():
    run_all_pipelines()



def test_hs_code_taxonomy_ingestion() -> None:
    session = SessionLocal()
    try:
        # Check specific HS code
        hs_item = session.scalar(select(HsCodeTaxonomy).where(HsCodeTaxonomy.hs_code == "6109"))
        assert hs_item is not None
        assert hs_item.category_name == "Textiles & Apparel"
        assert "t-shirt" in hs_item.search_keywords.lower()

        # Check total taxonomy count
        total = session.scalar(select(HsCodeTaxonomy))
        assert total is not None
    finally:
        session.close()


def test_un_comtrade_corridor_flows() -> None:
    session = SessionLocal()
    try:
        # Check India -> US flagship corridor
        flows = list(
            session.scalars(
                select(TradeCorridorFlow).where(
                    TradeCorridorFlow.origin_country == "IN",
                    TradeCorridorFlow.destination_country == "US",
                    TradeCorridorFlow.hs_code == "6109",
                ).order_by(TradeCorridorFlow.year)
            )
        )
        assert len(flows) >= 3  # Multiple years tracked
        latest = flows[-1]
        assert latest.trade_value_usd > 100_000_000
        assert latest.net_weight_kg is not None
        assert latest.net_weight_kg > 0
        assert latest.unit_value_usd_per_kg is not None
        assert latest.unit_value_usd_per_kg > 0
    finally:
        session.close()


def test_tariff_and_fta_schedules() -> None:
    session = SessionLocal()
    try:
        # India -> UAE under CEPA (Duty should be 0.0%)
        tariff_uae = session.scalar(
            select(TariffSchedule).where(
                TariffSchedule.exporter_country == "IN",
                TariffSchedule.importer_country == "AE",
                TariffSchedule.hs_code == "6109",
            )
        )
        assert tariff_uae is not None
        assert tariff_uae.preferential_rate_pct == 0.0
        assert "CEPA" in tariff_uae.agreement_name

        # India -> US (Standard MFN rate)
        tariff_us = session.scalar(
            select(TariffSchedule).where(
                TariffSchedule.exporter_country == "IN",
                TariffSchedule.importer_country == "US",
                TariffSchedule.hs_code == "6109",
            )
        )
        assert tariff_us is not None
        assert tariff_us.mfn_applied_rate_pct > 10.0
    finally:
        session.close()


def test_country_risk_factors() -> None:
    session = SessionLocal()
    try:
        us_risk = session.scalar(
            select(CountryRiskFactor).where(CountryRiskFactor.country_code == "US")
        )
        assert us_risk is not None
        assert us_risk.risk_tier == "Low Risk"
        assert us_risk.composite_risk_score < 30.0
    finally:
        session.close()


def test_global_buyer_catalog_ingestion() -> None:
    session = SessionLocal()
    try:
        from app.models.trade_intelligence import GlobalBuyerCatalog

        buyers = list(session.scalars(select(GlobalBuyerCatalog)))
        assert len(buyers) >= 15

        # Check US apparel buyer
        manhattan = session.scalar(
            select(GlobalBuyerCatalog).where(
                GlobalBuyerCatalog.company_name == "Manhattan Apparel Imports LLC"
            )
        )
        assert manhattan is not None
        assert manhattan.country_code == "US"
        assert "6109" in manhattan.hs_codes
        assert manhattan.annual_import_volume_usd > 10_000_000
        assert "OEKO-TEX Standard 100" in manhattan.required_certifications
        assert "Bill of Lading" in manhattan.customs_manifest_provenance
    finally:
        session.close()

