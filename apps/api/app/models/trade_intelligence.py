"""
Trade Intelligence Database Models
Stores real bilateral trade flows, WCO HS code taxonomy, tariff matrices, and country risk indicators.
"""

import uuid
from datetime import datetime
from sqlalchemy import DateTime, Float, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _id() -> str:
    return str(uuid.uuid4())


class HsCodeTaxonomy(Base):
    """
    Standardized Harmonized System (HS) code classification table.
    Supports Chapters (2-digit), Headings (4-digit), and Subheadings (6-digit).
    """
    __tablename__ = "hs_code_taxonomies"
    __table_args__ = (UniqueConstraint("hs_code", name="uq_hs_code"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    hs_code: Mapped[str] = mapped_column(String(10), index=True)
    level: Mapped[int] = mapped_column(Integer)  # 2, 4, or 6 digits
    chapter_code: Mapped[str] = mapped_column(String(2), index=True)
    heading_code: Mapped[str | None] = mapped_column(String(4), index=True)
    description: Mapped[str] = mapped_column(Text)
    category_name: Mapped[str] = mapped_column(String(100), index=True)
    search_keywords: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TradeCorridorFlow(Base):
    """
    Real bilateral trade flows derived from the official UN Comtrade API v1.
    Tracks export/import values, weight, quantity, and year-over-year momentum.
    """
    __tablename__ = "trade_corridor_flows"
    __table_args__ = (
        UniqueConstraint(
            "origin_country",
            "destination_country",
            "hs_code",
            "year",
            name="uq_corridor_flow_pair",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    origin_country: Mapped[str] = mapped_column(String(2), index=True)       # ISO 2 (e.g. IN)
    destination_country: Mapped[str] = mapped_column(String(2), index=True)  # ISO 2 (e.g. US)
    partner_m49: Mapped[int | None] = mapped_column(Integer)                 # UN M49 numeric code
    hs_code: Mapped[str] = mapped_column(String(10), index=True)             # 4 or 6-digit HS
    year: Mapped[int] = mapped_column(Integer, index=True)
    trade_value_usd: Mapped[float] = mapped_column(Float)
    net_weight_kg: Mapped[float | None] = mapped_column(Float)
    quantity: Mapped[float | None] = mapped_column(Float)
    quantity_unit: Mapped[str | None] = mapped_column(String(50))
    unit_value_usd_per_kg: Mapped[float | None] = mapped_column(Float)
    yoy_growth_pct: Mapped[float | None] = mapped_column(Float)
    source_dataset: Mapped[str] = mapped_column(String(100), default="UN Comtrade API v1")
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TariffSchedule(Base):
    """
    WTO Most-Favored-Nation (MFN) and Preferential Free Trade Agreement (FTA) duty rates.
    """
    __tablename__ = "tariff_schedules"
    __table_args__ = (
        UniqueConstraint(
            "exporter_country",
            "importer_country",
            "hs_code",
            "effective_year",
            name="uq_tariff_corridor_year",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    exporter_country: Mapped[str] = mapped_column(String(2), index=True)
    importer_country: Mapped[str] = mapped_column(String(2), index=True)
    hs_code: Mapped[str] = mapped_column(String(10), index=True)
    effective_year: Mapped[int] = mapped_column(Integer, default=2024)
    mfn_applied_rate_pct: Mapped[float] = mapped_column(Float)
    preferential_rate_pct: Mapped[float] = mapped_column(Float)
    agreement_name: Mapped[str | None] = mapped_column(String(200))
    rules_of_origin: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CountryRiskFactor(Base):
    """
    Normalized Country Risk Profile derived from World Bank Worldwide Governance Indicators.
    """
    __tablename__ = "country_risk_factors"
    __table_args__ = (UniqueConstraint("country_code", name="uq_country_risk_code"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    country_code: Mapped[str] = mapped_column(String(2), index=True)
    country_name: Mapped[str] = mapped_column(String(100))
    political_stability_score: Mapped[float] = mapped_column(Float)  # -2.5 to +2.5
    rule_of_law_score: Mapped[float] = mapped_column(Float)          # -2.5 to +2.5
    regulatory_quality_score: Mapped[float] = mapped_column(Float)   # -2.5 to +2.5
    composite_risk_score: Mapped[float] = mapped_column(Float)       # 0 (Safe) to 100 (High Risk)
    risk_tier: Mapped[str] = mapped_column(String(30))               # Low Risk, Moderate Risk, High Risk
    currency_code: Mapped[str] = mapped_column(String(3))
    fx_volatility_pct: Mapped[float] = mapped_column(Float, default=3.0)
    last_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GlobalBuyerCatalog(Base):
    """
    Global Master Catalog of verified overseas buyers derived from public customs Bill of Lading records.
    Powers the cross-border matching engine and the Swipe-to-Export deck.
    """
    __tablename__ = "global_buyer_catalogs"
    __table_args__ = (
        UniqueConstraint("normalized_name", "country_code", name="uq_global_buyer_identity"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    company_name: Mapped[str] = mapped_column(String(300))
    normalized_name: Mapped[str] = mapped_column(String(300), index=True)
    country_code: Mapped[str] = mapped_column(String(2), index=True)
    city: Mapped[str | None] = mapped_column(String(100))
    website: Mapped[str | None] = mapped_column(String(500))
    contact_name: Mapped[str | None] = mapped_column(String(200))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    primary_sector: Mapped[str] = mapped_column(String(100), index=True)
    hs_codes: Mapped[list] = mapped_column(JSON, default=list)
    annual_import_volume_usd: Mapped[float] = mapped_column(Float, default=0.0)
    avg_order_tons: Mapped[float] = mapped_column(Float, default=0.0)
    required_certifications: Mapped[list] = mapped_column(JSON, default=list)
    preferred_incoterms: Mapped[str | None] = mapped_column(String(50), default="CIF")
    customs_manifest_provenance: Mapped[str] = mapped_column(String(200))
    reliability_score: Mapped[float] = mapped_column(Float, default=85.0)  # 0 to 100
    shipment_frequency: Mapped[str | None] = mapped_column(String(50), default="Monthly (12x/yr)")
    avg_container_teu: Mapped[float | None] = mapped_column(Float, default=4.0)
    estimated_order_cycle_days: Mapped[int | None] = mapped_column(Integer, default=30)
    top_historical_suppliers: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())



class MarketDemandSignal(Base):
    """
    Model 4: Real-Time Demand Radar signal records.
    Stores extracted tender notices, procurement bulletins, and demand spikes.
    """
    __tablename__ = "market_demand_signals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    title: Mapped[str] = mapped_column(String(500))
    raw_text: Mapped[str] = mapped_column(Text)
    source_channel: Mapped[str] = mapped_column(String(100), index=True)
    signal_type: Mapped[str] = mapped_column(String(50), index=True)  # Procurement Tender, Quota Opening, Demand Surge
    target_country: Mapped[str] = mapped_column(String(2), index=True)
    product_category: Mapped[str] = mapped_column(String(100), index=True)
    hs_code: Mapped[str | None] = mapped_column(String(10), index=True)
    estimated_budget_usd: Mapped[float | None] = mapped_column(Float)
    deadline_date: Mapped[str | None] = mapped_column(String(50))
    intent_score: Mapped[float] = mapped_column(Float, default=0.85)  # 0.0 to 1.0
    urgency_level: Mapped[str] = mapped_column(String(30), default="High")  # Critical, High, Standard
    extracted_entities: Mapped[dict] = mapped_column(JSON, default=dict)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


