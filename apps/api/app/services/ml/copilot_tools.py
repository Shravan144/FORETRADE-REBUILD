"""
Trade Copilot Tool Engine
Provides executable tools that allow the Trade Copilot to query ForeTrade's verified database:
- 671 Global Buyers with customs Bill of Lading data
- Bilateral WTO & FTA Tariff Schedules (CEPA, ECTA, MFN)
- Landed Cost Estimator & Freight calculation
- Country Risk & Governance ratings
- WCO HS Code Taxonomy
"""

from typing import Any, Dict, List, Optional
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.models.trade_intelligence import (
    TariffSchedule,
    CountryRiskFactor,
    HsCodeTaxonomy,
    GlobalBuyerCatalog,
)
from app.services.ml.landed_cost_calculator import calculate_landed_cost


def tool_search_tariffs(
    db: Session,
    importer_country: str,
    exporter_country: str = "IN",
    hs_code: Optional[str] = None,
) -> Dict[str, Any]:
    """Look up verified preferential (FTA) and MFN duty rates for a corridor."""
    imp = importer_country.strip().upper()
    exp = exporter_country.strip().upper()

    query = select(TariffSchedule).where(
        TariffSchedule.exporter_country == exp,
        TariffSchedule.importer_country == imp,
    )
    if hs_code:
        clean_hs = hs_code.replace(".", "").strip()[:4]
        query = query.where(TariffSchedule.hs_code.startswith(clean_hs))

    records = db.scalars(query.limit(5)).all()
    if not records:
        # Fallback query for any tariffs to this destination
        records = db.scalars(
            select(TariffSchedule)
            .where(TariffSchedule.importer_country == imp)
            .limit(3)
        ).all()

    if not records:
        return {
            "found": False,
            "message": f"No specific bilateral tariff treaty recorded for {exp} -> {imp}.",
            "standard_rule": "Standard WTO Most-Favored-Nation (MFN) tariffs apply with non-preferential Certificate of Origin.",
        }

    items = []
    for r in records:
        savings = max(0.0, float(r.mfn_applied_rate_pct - r.preferential_rate_pct))
        items.append({
            "exporter_country": r.exporter_country,
            "importer_country": r.importer_country,
            "hs_code": r.hs_code,
            "mfn_duty_pct": r.mfn_applied_rate_pct,
            "preferential_fta_duty_pct": r.preferential_rate_pct,
            "tariff_savings_pct": savings,
            "agreement_name": r.agreement_name,
            "rules_of_origin": r.rules_of_origin or "Standard Certificate of Origin required",
        })

    return {"found": True, "corridor": f"{exp} -> {imp}", "schedules": items}


def tool_search_buyers(
    db: Session,
    country: Optional[str] = None,
    sector: Optional[str] = None,
    limit: int = 4,
) -> Dict[str, Any]:
    """Search verified overseas buyers from ForeTrade's 671 Master Catalog with customs BoL provenance."""
    query = select(GlobalBuyerCatalog)

    if country:
        query = query.where(GlobalBuyerCatalog.country_code == country.strip().upper())
    if sector:
        query = query.where(
            or_(
                GlobalBuyerCatalog.primary_sector.ilike(f"%{sector.strip()}%"),
                GlobalBuyerCatalog.company_name.ilike(f"%{sector.strip()}%"),
            )
        )

    records = db.scalars(query.order_by(GlobalBuyerCatalog.annual_import_volume_usd.desc()).limit(limit)).all()
    if not records:
        records = db.scalars(select(GlobalBuyerCatalog).limit(limit)).all()

    buyers = []
    for b in records:
        buyers.append({
            "company_name": b.company_name,
            "country": b.country_code,
            "city": b.city,
            "primary_sector": b.primary_sector,
            "annual_volume_usd": b.annual_import_volume_usd,
            "avg_order_tons": b.avg_order_tons,
            "preferred_incoterms": b.preferred_incoterms,
            "customs_provenance": b.customs_manifest_provenance,
            "required_certifications": b.required_certifications,
        })

    return {"found": len(buyers) > 0, "count": len(buyers), "buyers": buyers}


def tool_get_country_risk(db: Session, country_code: str) -> Dict[str, Any]:
    """Retrieve World Bank governance scores, currency volatility, and composite risk tier."""
    code = country_code.strip().upper()
    risk = db.scalar(select(CountryRiskFactor).where(CountryRiskFactor.country_code == code))
    if not risk:
        return {
            "found": False,
            "country_code": code,
            "risk_tier": "Moderate Risk (Default Standard)",
            "composite_score": 40.0,
            "payment_recommendation": "Confirmed Irrevocable Letter of Credit (LC) or 30% advance with CAD.",
        }

    return {
        "found": True,
        "country_name": risk.country_name,
        "country_code": risk.country_code,
        "risk_tier": risk.risk_tier,
        "composite_risk_score": risk.composite_risk_score,
        "political_stability": risk.political_stability_score,
        "currency": risk.currency_code,
        "fx_volatility_pct": risk.fx_volatility_pct,
        "recommended_payment_term": (
            "Open Account / CAD acceptable"
            if risk.composite_risk_score < 30
            else "Irrevocable Letter of Credit (LC) recommended"
            if risk.composite_risk_score < 60
            else "Confirmed LC with ECGC credit insurance mandatory"
        ),
    }


COUNTRY_PORT_MAP = {
    "US": "US_LAX",
    "DE": "DE_HAM",
    "NL": "NL_RTM",
    "GB": "GB_FXT",
    "UK": "GB_FXT",
    "AE": "AE_DXB",
    "SG": "SG_SIN",
    "AU": "AU_MEL",
    "JP": "JP_TYO",
    "EG": "EG_SOK",
}


def tool_calculate_landed_cost(
    db: Session,
    destination_country: str,
    hs_code: str,
    fob_usd: float = 50000.0,
    weight_kg: float = 10000.0,
) -> Dict[str, Any]:
    """Calculate detailed landed cost including ocean freight, marine insurance, and customs duty."""
    dest_country_clean = destination_country.strip().upper()
    dest_port_code = COUNTRY_PORT_MAP.get(dest_country_clean, "US_LAX")

    res = calculate_landed_cost(
        db=db,
        factory_price_usd=fob_usd,
        cargo_units=1000,
        destination_port_code=dest_port_code,
        hs_code=hs_code,
        apply_fta=True,
    )
    bd = res.breakdown
    return {
        "destination_country": dest_country_clean,
        "fob_value_usd": bd.fob_value_usd,
        "freight_usd": bd.ocean_freight_usd,
        "insurance_usd": bd.marine_insurance_usd,
        "cif_value_usd": bd.cif_value_usd,
        "customs_duty_usd": bd.customs_import_duty_usd,
        "duty_rate_applied_pct": bd.tariff_rate_applied_pct,
        "total_landed_cost_usd": bd.total_landed_cost_ddp_usd,
        "effective_multiplier": round(bd.total_landed_cost_ddp_usd / max(fob_usd, 1.0), 3),
    }


def tool_search_hs_codes(db: Session, keyword: str) -> Dict[str, Any]:
    """Search the WCO Harmonized System taxonomy by product keyword or code prefix."""
    kw = keyword.strip()
    query = select(HsCodeTaxonomy).where(
        or_(
            HsCodeTaxonomy.hs_code.startswith(kw),
            HsCodeTaxonomy.description.ilike(f"%{kw}%"),
            HsCodeTaxonomy.category_name.ilike(f"%{kw}%"),
        )
    ).limit(5)

    records = db.scalars(query).all()
    results = [
        {
            "hs_code": r.hs_code,
            "level": f"{r.level}-digit",
            "category": r.category_name,
            "description": r.description,
        }
        for r in records
    ]
    return {"count": len(results), "matches": results}


def detect_and_execute_tools(db: Session, query: str) -> str:
    """
    Scans the user query for trade intent and automatically executes relevant tools,
    formatting the verified results as structured grounded context for the LLM.
    """
    q = query.lower()
    tool_outputs = []

    # 1. Tariff check
    target_countries = ["ae", "us", "de", "au", "jp", "gb", "sg", "nl", "sa", "fr", "it"]
    country_matched = next((c for c in target_countries if f" {c} " in f" {q} " or f"to {c}" in q or f"in {c}" in q), None)
    if "uae" in q or "dubai" in q or "cepa" in q:
        country_matched = "AE"
    elif "australia" in q or "ecta" in q:
        country_matched = "AU"
    elif "usa" in q or "united states" in q or "america" in q:
        country_matched = "US"
    elif "japan" in q:
        country_matched = "JP"
    elif "germany" in q:
        country_matched = "DE"
    elif "uk" in q or "britain" in q:
        country_matched = "GB"

    if country_matched and any(word in q for word in ["tariff", "duty", "cepa", "ecta", "fta", "mfn", "rate", "cost", "export"]):
        res = tool_search_tariffs(db, importer_country=country_matched)
        if res.get("found"):
            tool_outputs.append(f"[DATABASE VERIFIED TARIFFS for {country_matched}]:\n" + str(res["schedules"][:3]))

    # 2. Buyer query
    if any(word in q for word in ["buyer", "importer", "customer", "lead", "client", "who buys", "companies"]):
        sector_hint = None
        for s in ["textile", "apparel", "garment", "rice", "spice", "auto", "chemical", "pharma", "ceramic"]:
            if s in q:
                sector_hint = s
                break
        res = tool_search_buyers(db, country=country_matched, sector=sector_hint, limit=3)
        if res.get("found"):
            tool_outputs.append(f"[DATABASE VERIFIED GLOBAL BUYERS]:\n" + str(res["buyers"]))

    # 3. Country risk / payment query
    if country_matched and any(word in q for word in ["risk", "safe", "payment", "lc", "letter of credit", "currency", "default"]):
        res = tool_get_country_risk(db, country_code=country_matched)
        tool_outputs.append(f"[DATABASE COUNTRY RISK FACTOR ({country_matched})]:\n" + str(res))

    # 4. Landed cost query
    if country_matched and any(word in q for word in ["landed cost", "freight", "cif cost", "shipping cost"]):
        res = tool_calculate_landed_cost(db, destination_country=country_matched, hs_code="6109")
        tool_outputs.append(f"[DATABASE ESTIMATED LANDED COST BREAKDOWN ({country_matched})]:\n" + str(res))

    # 5. HS code query
    for kw in ["t-shirt", "cotton", "rice", "transformer", "pharma", "brake", "ceramic"]:
        if kw in q:
            res = tool_search_hs_codes(db, keyword=kw)
            if res.get("count", 0) > 0:
                tool_outputs.append(f"[WCO HS CODE TAXONOMY for '{kw}']:\n" + str(res["matches"][:2]))
            break

    return "\n\n".join(tool_outputs)
