"""
Trade Intelligence & Model 1 ML Forecast API Endpoints
Exposes UN Comtrade flows, time-series forecasting, tariffs, and risk assessment.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_optional_user
from app.db.session import get_db
from app.models.user import User
from app.models.trade_intelligence import (
    TradeCorridorFlow,
    TariffSchedule,
    CountryRiskFactor,
    HsCodeTaxonomy,
)
from app.services.ml.corridor_forecaster import score_corridor_opportunity

router = APIRouter(prefix="/api/v1/intelligence", tags=["trade-intelligence"])


@router.get("/corridors")
def list_corridors(
    origin_country: str = Query("IN", max_length=2),
    destination_country: Optional[str] = Query(None, max_length=2),
    hs_code: Optional[str] = Query(None, max_length=10),
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """List historical bilateral corridor trade flows with annual values and unit values."""
    query = select(TradeCorridorFlow).where(TradeCorridorFlow.origin_country == origin_country.upper())
    if destination_country:
        query = query.where(TradeCorridorFlow.destination_country == destination_country.upper())
    if hs_code:
        query = query.where(TradeCorridorFlow.hs_code == hs_code)

    rows = db.scalars(query.order_by(TradeCorridorFlow.year.desc())).all()
    return {
        "items": [
            {
                "id": r.id,
                "origin_country": r.origin_country,
                "destination_country": r.destination_country,
                "hs_code": r.hs_code,
                "year": r.year,
                "trade_value_usd": r.trade_value_usd,
                "net_weight_kg": r.net_weight_kg,
                "unit_value_usd_per_kg": r.unit_value_usd_per_kg,
                "yoy_growth_pct": r.yoy_growth_pct,
                "source_dataset": r.source_dataset,
            }
            for r in rows
        ]
    }


@router.get("/forecast")
def get_corridor_forecast(
    destination_country: str = Query(..., max_length=2, description="Target import country ISO code"),
    hs_code: str = Query(..., max_length=10, description="4 or 6 digit HS code"),
    origin_country: str = Query("IN", max_length=2, description="Origin country ISO code"),
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Model 1: Market Opportunity Scorer
    Returns 12-month and 24-month forecasted import volumes, 80% & 95% confidence intervals,
    projected CAGR, and an Opportunity Index (0-100) with explainable factors.
    """
    result = score_corridor_opportunity(
        db=db,
        origin_country=origin_country.upper(),
        destination_country=destination_country.upper(),
        hs_code=hs_code,
    )
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Trade corridor {origin_country}->{destination_country} for HS {hs_code} not found in UN Comtrade records.",
        )
    return result.to_dict()


@router.get("/tariffs")
def get_tariff_differential(
    importer_country: str = Query(..., max_length=2),
    hs_code: str = Query(..., max_length=10),
    exporter_country: str = Query("IN", max_length=2),
    shipment_value_usd: Optional[float] = Query(None, ge=0),
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Tariff & FTA Savings Calculator
    Calculates exact tariff differentials:
    Savings = Shipment Value * (MFN Tariff % - Preferential FTA Tariff %)
    """
    tariff = db.scalar(
        select(TariffSchedule).where(
            TariffSchedule.exporter_country == exporter_country.upper(),
            TariffSchedule.importer_country == importer_country.upper(),
            TariffSchedule.hs_code == hs_code,
        )
    )
    if not tariff:
        mfn = 5.0
        pref = 5.0
        agreement = "Standard WTO Most-Favored-Nation (MFN)"
        rules = "Standard Non-Preferential Origin Rules"
    else:
        mfn = tariff.mfn_applied_rate_pct
        pref = tariff.preferential_rate_pct
        agreement = tariff.agreement_name
        rules = tariff.rules_of_origin

    savings_pct = max(mfn - pref, 0.0)
    shipment_val = shipment_value_usd if shipment_value_usd is not None else 100_000.0
    duty_under_mfn = round(shipment_val * (mfn / 100.0), 2)
    duty_under_fta = round(shipment_val * (pref / 100.0), 2)
    duty_savings_usd = round(shipment_val * (savings_pct / 100.0), 2)

    return {
        "exporter_country": exporter_country.upper(),
        "importer_country": importer_country.upper(),
        "hs_code": hs_code,
        "shipment_value_usd": shipment_val,
        "mfn_applied_rate_pct": mfn,
        "preferential_rate_pct": pref,
        "tariff_savings_pct": round(savings_pct, 2),
        "duty_under_mfn_usd": duty_under_mfn,
        "duty_under_fta_usd": duty_under_fta,
        "duty_savings_usd": duty_savings_usd,
        "agreement_name": agreement,
        "rules_of_origin": rules,
    }


@router.get("/compliance-matrix")
def get_compliance_matrix_endpoint(
    destination_country: str = Query(..., max_length=2, description="Target import country ISO code"),
    hs_code: str = Query(..., max_length=10, description="Product 4-digit or 6-digit HS code"),
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Automated Compliance & Certification Matrix
    Instantly returns mandatory customs certificates (e.g. FDA registration for USA,
    CE marking and REACH for Europe, Halal & MOIAT for UAE, TGA for Australia),
    border inspection protocols, customs declaration documents, and lead times.
    """
    from app.services.ml.compliance_matrix import resolve_compliance_requirements

    profile = resolve_compliance_requirements(
        destination_country=destination_country,
        hs_code=hs_code,
    )
    return profile.to_dict()


@router.get("/risk")
def get_country_risk(
    country_code: str = Query(..., max_length=2),
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get World Bank Governance Indicators and country risk tier."""
    risk = db.scalar(
        select(CountryRiskFactor).where(CountryRiskFactor.country_code == country_code.upper())
    )
    if not risk:
        raise HTTPException(status_code=404, detail="Country risk profile not found.")

    return {
        "country_code": risk.country_code,
        "country_name": risk.country_name,
        "political_stability_score": risk.political_stability_score,
        "rule_of_law_score": risk.rule_of_law_score,
        "regulatory_quality_score": risk.regulatory_quality_score,
        "composite_risk_score": risk.composite_risk_score,
        "risk_tier": risk.risk_tier,
        "currency_code": risk.currency_code,
        "fx_volatility_pct": risk.fx_volatility_pct,
    }


class TransactionRiskRequest(BaseModel):
    destination_country: str = Field(..., max_length=2)
    invoice_amount_usd: float = Field(..., gt=0)
    payment_terms: str = Field("open_account", max_length=50)
    buyer_id: Optional[str] = None
    buyer_name: Optional[str] = None


@router.post("/assess-transaction-risk")
def assess_transaction_risk_endpoint(
    payload: TransactionRiskRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Model 3: Cross-Border Trade Risk Classifier
    Evaluates commercial default probability, currency volatility, and payment term exposure
    using XGBoost gradient boosted trees.
    """
    from app.services.ml.risk_classifier import assess_trade_risk

    result = assess_trade_risk(
        db=db,
        destination_country=payload.destination_country,
        invoice_amount_usd=payload.invoice_amount_usd,
        payment_terms=payload.payment_terms,
        buyer_id=payload.buyer_id,
        buyer_name=payload.buyer_name,
    )
    return result.to_dict()


class ProductClassificationRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500, description="Natural language product description")
    top_k: int = Field(3, ge=1, le=10)


@router.post("/classify-product")
def classify_product_endpoint(
    payload: ProductClassificationRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Model 5: Semantic HS Code Auto-Classifier
    Maps natural language product descriptions to standardized 6-digit Harmonized System (HS) codes
    using vector semantic similarity and calibrated confidence percentages.
    """
    from app.services.ml.hs_classifier import classify_product_description

    predictions = classify_product_description(db=db, query=payload.query, top_k=payload.top_k)
    return {
        "query": payload.query,
        "total_matches": len(predictions),
        "predictions": [p.to_dict() for p in predictions],
    }


class SignalExtractionRequest(BaseModel):
    text: str = Field(..., min_length=5, max_length=2000, description="Raw procurement notice or trade bulletin text")
    source_channel: str = Field("Manual Input", max_length=100)


@router.get("/demand-signals")
def list_demand_signals(
    target_country: Optional[str] = Query(None, max_length=2),
    hs_code: Optional[str] = Query(None, max_length=10),
    signal_type: Optional[str] = Query(None, max_length=50),
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Model 4: Real-Time Demand Radar
    Returns live procurement tenders, quota openings, and demand surge alerts.
    """
    from app.models.trade_intelligence import MarketDemandSignal

    query = select(MarketDemandSignal)
    if target_country:
        query = query.where(MarketDemandSignal.target_country == target_country.upper())
    if hs_code:
        query = query.where(MarketDemandSignal.hs_code.like(f"{hs_code}%"))
    if signal_type:
        query = query.where(MarketDemandSignal.signal_type == signal_type)

    signals = db.scalars(query.order_by(MarketDemandSignal.intent_score.desc())).all()
    return {
        "total": len(signals),
        "items": [
            {
                "id": s.id,
                "title": s.title,
                "raw_text": s.raw_text,
                "source_channel": s.source_channel,
                "signal_type": s.signal_type,
                "target_country": s.target_country,
                "product_category": s.product_category,
                "hs_code": s.hs_code,
                "estimated_budget_usd": s.estimated_budget_usd,
                "deadline_date": s.deadline_date,
                "intent_score": s.intent_score,
                "urgency_level": s.urgency_level,
                "extracted_entities": s.extracted_entities,
                "published_at": s.published_at.isoformat() if s.published_at else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in signals
        ],
    }


@router.post("/extract-signal")
def extract_signal_endpoint(
    payload: SignalExtractionRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Model 4: On-Demand NLP Signal Extractor
    Parses unstructured text, extracts monetary budget, deadline, target country,
    intent score, and matches the product with an official HS code.
    """
    from app.services.ml.demand_radar import extract_demand_signal

    extracted = extract_demand_signal(
        db=db,
        raw_text=payload.text,
        source_channel=payload.source_channel,
    )
    return extracted.to_dict()


@router.get("/buyers")
def list_global_buyers(
    country_code: Optional[str] = Query(None, max_length=2),
    sector: Optional[str] = Query(None, max_length=100),
    hs_code: Optional[str] = Query(None, max_length=10),
    query: Optional[str] = Query(None, max_length=200),
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Smart Buyer Discovery Engine
    Lists verified overseas buyers with customs Bill of Lading records,
    historical suppliers, shipment frequencies, container sizes, and order cycles.
    """
    from app.models.trade_intelligence import GlobalBuyerCatalog

    stmt = select(GlobalBuyerCatalog)
    if country_code:
        stmt = stmt.where(GlobalBuyerCatalog.country_code == country_code.upper())
    if sector:
        stmt = stmt.where(GlobalBuyerCatalog.primary_sector.ilike(f"%{sector}%"))
    if query:
        stmt = stmt.where(GlobalBuyerCatalog.company_name.ilike(f"%{query}%"))

    buyers = db.scalars(stmt.order_by(GlobalBuyerCatalog.annual_import_volume_usd.desc())).all()

    # In-memory filter for hs_codes if requested
    if hs_code:
        buyers = [b for b in buyers if any(hs_code in str(h) for h in b.hs_codes)]

    return {
        "total": len(buyers),
        "items": [
            {
                "id": b.id,
                "company_name": b.company_name,
                "normalized_name": b.normalized_name,
                "country_code": b.country_code,
                "city": b.city,
                "website": b.website,
                "contact_name": b.contact_name,
                "contact_email": b.contact_email,
                "primary_sector": b.primary_sector,
                "hs_codes": b.hs_codes,
                "annual_import_volume_usd": b.annual_import_volume_usd,
                "avg_order_tons": b.avg_order_tons,
                "required_certifications": b.required_certifications,
                "preferred_incoterms": b.preferred_incoterms,
                "customs_manifest_provenance": b.customs_manifest_provenance,
                "reliability_score": b.reliability_score,
                "shipment_frequency": b.shipment_frequency,
                "avg_container_teu": b.avg_container_teu,
                "estimated_order_cycle_days": b.estimated_order_cycle_days,
                "top_historical_suppliers": b.top_historical_suppliers,
            }
            for b in buyers
        ],
    }


@router.get("/buyers/{buyer_id}")
def get_buyer_bol_manifest(
    buyer_id: str,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """Detailed Bill of Lading customs intelligence for a specific buyer."""
    from app.models.trade_intelligence import GlobalBuyerCatalog

    buyer = db.scalar(select(GlobalBuyerCatalog).where(GlobalBuyerCatalog.id == buyer_id))
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer profile not found in master catalog.")

    return {
        "id": buyer.id,
        "company_name": buyer.company_name,
        "country_code": buyer.country_code,
        "city": buyer.city,
        "website": buyer.website,
        "contact_name": buyer.contact_name,
        "contact_email": buyer.contact_email,
        "primary_sector": buyer.primary_sector,
        "hs_codes": buyer.hs_codes,
        "annual_import_volume_usd": buyer.annual_import_volume_usd,
        "avg_order_tons": buyer.avg_order_tons,
        "required_certifications": buyer.required_certifications,
        "preferred_incoterms": buyer.preferred_incoterms,
        "customs_manifest_provenance": buyer.customs_manifest_provenance,
        "reliability_score": buyer.reliability_score,
        "shipment_frequency": buyer.shipment_frequency,
        "avg_container_teu": buyer.avg_container_teu,
        "estimated_order_cycle_days": buyer.estimated_order_cycle_days,
        "top_historical_suppliers": buyer.top_historical_suppliers,
    }


@router.post("/demand-signals/{signal_id}/convert")
def convert_demand_signal_to_lead(
    signal_id: str,
    workspace_id: str = Query(..., description="Target workspace ID"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Converts a real-time demand radar signal / tender notice into an active CRM Lead and Company.
    """
    from app.models.audit_event import record_audit_event
    from app.models.domain import Company, CompanySourceRecord, Lead, LeadEvent, ScoreSnapshot
    from app.models.trade_intelligence import MarketDemandSignal
    from app.services.deduplication import normalized_name

    signal = db.get(MarketDemandSignal, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Demand signal notice not found.")

    company_title = f"{signal.target_country} Tender: {signal.title[:60]}"
    norm = normalized_name(company_title)

    # 1. Create or fetch workspace company
    company = db.scalar(
        select(Company).where(
            Company.workspace_id == workspace_id,
            Company.normalized_name == norm,
        )
    )
    if not company:
        company = Company(
            workspace_id=workspace_id,
            name=company_title,
            normalized_name=norm,
            country_code=signal.target_country,
            product_or_industry=signal.product_category,
            contact_email="procurement@official-tender.org",
            provenance=signal.source_channel,
            attributes={
                "signal_type": signal.signal_type,
                "hs_code": signal.hs_code,
                "budget_usd": signal.estimated_budget_usd,
                "deadline": signal.deadline_date,
            },
        )
        db.add(company)
        db.flush()

        db.add(
            CompanySourceRecord(
                company_id=company.id,
                source_type="demand_radar_signal",
                source_reference=signal.source_channel,
                raw_data=signal.extracted_entities or {},
            )
        )

    # 2. Add Score Snapshot
    db.add(
        ScoreSnapshot(
            workspace_id=workspace_id,
            company_id=company.id,
            score=round(signal.intent_score * 100.0, 1),
            tier="high" if signal.intent_score >= 0.85 else "medium",
            feature_values={
                "intent_score": signal.intent_score,
                "urgency_level": signal.urgency_level,
                "budget_usd": signal.estimated_budget_usd,
            },
            reason_codes=[
                f"Sourced from {signal.source_channel}",
                f"Estimated budget: ${signal.estimated_budget_usd:,.0f} USD" if signal.estimated_budget_usd else "High urgency commercial tender",
                f"Bidding deadline: {signal.deadline_date}" if signal.deadline_date else "Open procurement rfp",
            ],
            algorithm_version="demand_radar_v1",
        )
    )

    # 3. Create or fetch Lead
    lead = db.scalar(
        select(Lead).where(
            Lead.workspace_id == workspace_id,
            Lead.company_id == company.id,
        )
    )
    if not lead:
        lead = Lead(
            workspace_id=workspace_id,
            company_id=company.id,
            stage="new",
            notes=f"Converted from Demand Radar: {signal.title} (Budget: ${signal.estimated_budget_usd:,.0f} USD)" if signal.estimated_budget_usd else f"Converted from Demand Radar: {signal.title}",
        )
        db.add(lead)
        db.flush()

        db.add(
            LeadEvent(
                lead_id=lead.id,
                actor_user_id=user.id,
                event_type="lead_created_from_radar",
                payload={"signal_id": signal.id, "to_stage": "new"},
            )
        )

    record_audit_event(
        db,
        workspace_id=workspace_id,
        actor_user_id=user.id,
        action="demand_signal.converted_to_lead",
        entity_type="lead",
        entity_id=lead.id,
        metadata={"title": signal.title, "budget_usd": signal.estimated_budget_usd},
    )

    db.commit()
    return {
        "status": "converted",
        "company_id": company.id,
        "lead_id": lead.id,
        "stage": lead.stage,
        "signal_title": signal.title,
    }


# ── Landed Cost & Logistics Estimator (Incoterms 2020) ──

@router.get("/shipping-routes")
def get_shipping_routes_endpoint(
    user: Optional[User] = Depends(get_optional_user),
) -> dict:
    """
    Returns catalog of supported international origin and destination seaports,
    container specifications, transit times, and maritime shipping lanes.
    """
    from app.services.ml.landed_cost_calculator import get_available_shipping_routes

    return get_available_shipping_routes()


class LandedCostRequest(BaseModel):
    factory_price_usd: float = Field(..., gt=0, description="Factory Gate (EXW) total order price in USD")
    cargo_units: int = Field(..., gt=0, description="Total units/pieces of cargo")
    origin_port: str = Field("IN_NSA", max_length=10)
    destination_port: str = Field("US_LAX", max_length=10)
    container_type: str = Field("20ft", max_length=20)
    container_count: int = Field(1, ge=1, le=50)
    hs_code: str = Field("6109.10", max_length=10)
    apply_fta: bool = Field(False)
    target_margin_pct: float = Field(15.0, ge=0.0, le=100.0)
    cbm_volume: float = Field(15.0, ge=0.5, le=500.0)


@router.post("/landed-cost")
def calculate_landed_cost_endpoint(
    payload: LandedCostRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Computes an itemized Landed Cost breakdown across Incoterms (EXW -> FOB -> CFR -> CIF -> DDP),
    integrating live WTO tariff schedules, ocean freight rates, insurance, and quotation margins.
    """
    from app.services.ml.landed_cost_calculator import calculate_landed_cost

    result = calculate_landed_cost(
        db=db,
        factory_price_usd=payload.factory_price_usd,
        cargo_units=payload.cargo_units,
        origin_port_code=payload.origin_port,
        destination_port_code=payload.destination_port,
        container_type=payload.container_type,
        container_count=payload.container_count,
        hs_code=payload.hs_code,
        apply_fta=payload.apply_fta,
        target_margin_pct=payload.target_margin_pct,
        cbm_volume=payload.cbm_volume,
    )
    return result.to_dict()

