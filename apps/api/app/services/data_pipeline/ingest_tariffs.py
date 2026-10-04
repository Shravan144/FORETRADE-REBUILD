"""
WTO & Free Trade Agreement (FTA) Tariff Schedule Ingestion Pipeline
Seeds MFN applied rates and preferential FTA concessions for trade corridors.
"""

import json
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.trade_intelligence import TariffSchedule

REPO_ROOT = Path(__file__).resolve().parents[5]
OUTPUT_FILE = REPO_ROOT / "data" / "tariffs" / "tariff_schedules.json"

TARIFF_DATA = [
    # ── India -> UAE (India-UAE CEPA) ──
    {
        "exporter_country": "IN",
        "importer_country": "AE",
        "hs_code": "6109",
        "mfn_applied_rate_pct": 5.0,
        "preferential_rate_pct": 0.0,
        "agreement_name": "India-UAE CEPA (Comprehensive Economic Partnership Agreement)",
        "rules_of_origin": "Value addition >= 40% with Change in Tariff Heading (CTH)",
    },
    {
        "exporter_country": "IN",
        "importer_country": "AE",
        "hs_code": "8504",
        "mfn_applied_rate_pct": 5.0,
        "preferential_rate_pct": 0.0,
        "agreement_name": "India-UAE CEPA",
        "rules_of_origin": "Value addition >= 40%",
    },
    {
        "exporter_country": "IN",
        "importer_country": "AE",
        "hs_code": "1006",
        "mfn_applied_rate_pct": 0.0,
        "preferential_rate_pct": 0.0,
        "agreement_name": "GCC Zero Duty on Essential Foodstuffs",
        "rules_of_origin": "Wholly obtained agricultural produce",
    },

    # ── India -> Australia (India-Australia ECTA) ──
    {
        "exporter_country": "IN",
        "importer_country": "AU",
        "hs_code": "6109",
        "mfn_applied_rate_pct": 5.0,
        "preferential_rate_pct": 0.0,
        "agreement_name": "India-Australia ECTA (Economic Cooperation & Trade Agreement)",
        "rules_of_origin": "Value addition >= 35% with Product Specific Rules",
    },
    {
        "exporter_country": "IN",
        "importer_country": "AU",
        "hs_code": "3004",
        "mfn_applied_rate_pct": 5.0,
        "preferential_rate_pct": 0.0,
        "agreement_name": "India-Australia ECTA",
        "rules_of_origin": "Therapeutic Goods Administration (TGA) fast-track compliance",
    },

    # ── India -> Japan (India-Japan CEPA) ──
    {
        "exporter_country": "IN",
        "importer_country": "JP",
        "hs_code": "3004",
        "mfn_applied_rate_pct": 3.1,
        "preferential_rate_pct": 0.0,
        "agreement_name": "India-Japan CEPA",
        "rules_of_origin": "Change in Tariff Subheading (CTSH) + 35% RVC",
    },
    {
        "exporter_country": "IN",
        "importer_country": "JP",
        "hs_code": "8708",
        "mfn_applied_rate_pct": 0.0,
        "preferential_rate_pct": 0.0,
        "agreement_name": "India-Japan CEPA",
        "rules_of_origin": "Wholly manufactured auto components",
    },

    # ── India -> United States (WTO MFN Basis) ──
    {
        "exporter_country": "IN",
        "importer_country": "US",
        "hs_code": "6109",
        "mfn_applied_rate_pct": 16.5,
        "preferential_rate_pct": 16.5,  # Standard MFN (No bilateral FTA active)
        "agreement_name": "WTO MFN Schedule",
        "rules_of_origin": "US Customs Rule of Origin for Textiles & Apparel",
    },
    {
        "exporter_country": "IN",
        "importer_country": "US",
        "hs_code": "3004",
        "mfn_applied_rate_pct": 0.0,
        "preferential_rate_pct": 0.0,  # Zero duty for generic pharmaceuticals
        "agreement_name": "WTO Pharmaceutical Zero-for-Zero Initiative",
        "rules_of_origin": "US FDA CGMP Compliant Origin",
    },
    {
        "exporter_country": "IN",
        "importer_country": "US",
        "hs_code": "8708",
        "mfn_applied_rate_pct": 2.5,
        "preferential_rate_pct": 2.5,
        "agreement_name": "WTO MFN Schedule",
        "rules_of_origin": "USMCA non-signatory standard entry",
    },
    {
        "exporter_country": "IN",
        "importer_country": "US",
        "hs_code": "8541",
        "mfn_applied_rate_pct": 0.0,
        "preferential_rate_pct": 0.0,  # Information Technology Agreement (ITA-1)
        "agreement_name": "WTO Information Technology Agreement (ITA-1)",
        "rules_of_origin": "Non-Section 301 origin compliance",
    },

    # ── India -> European Union / Germany (WTO MFN Basis) ──
    {
        "exporter_country": "IN",
        "importer_country": "DE",
        "hs_code": "6109",
        "mfn_applied_rate_pct": 12.0,
        "preferential_rate_pct": 9.6,  # EU GSP Standard
        "agreement_name": "EU Generalised Scheme of Preferences (GSP)",
        "rules_of_origin": "Double transformation rule (yarn to fabric to garment)",
    },
    {
        "exporter_country": "IN",
        "importer_country": "DE",
        "hs_code": "8708",
        "mfn_applied_rate_pct": 3.5,
        "preferential_rate_pct": 3.5,
        "agreement_name": "EU Common Customs Tariff",
        "rules_of_origin": "EU standard non-preferential origin",
    },

    # ── India -> United Kingdom (UK Developing Countries Trading Scheme - DCTS) ──
    {
        "exporter_country": "IN",
        "importer_country": "GB",
        "hs_code": "6109",
        "mfn_applied_rate_pct": 12.0,
        "preferential_rate_pct": 9.6,  # UK DCTS Standard Preferences
        "agreement_name": "UK Developing Countries Trading Scheme (DCTS)",
        "rules_of_origin": "Single processing rule for specific chapters",
    },
]


def ingest_tariffs(db: Session | None = None) -> int:
    """Ingest WTO MFN and FTA preferential tariffs into the database."""
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(TARIFF_DATA, f, indent=2)

    close_session = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_session = True

    count = 0
    try:
        for t in TARIFF_DATA:
            existing = db.scalar(
                select(TariffSchedule).where(
                    TariffSchedule.exporter_country == t["exporter_country"],
                    TariffSchedule.importer_country == t["importer_country"],
                    TariffSchedule.hs_code == t["hs_code"],
                )
            )
            if existing:
                existing.mfn_applied_rate_pct = t["mfn_applied_rate_pct"]
                existing.preferential_rate_pct = t["preferential_rate_pct"]
                existing.agreement_name = t["agreement_name"]
                existing.rules_of_origin = t["rules_of_origin"]
            else:
                db.add(
                    TariffSchedule(
                        exporter_country=t["exporter_country"],
                        importer_country=t["importer_country"],
                        hs_code=t["hs_code"],
                        effective_year=2024,
                        mfn_applied_rate_pct=t["mfn_applied_rate_pct"],
                        preferential_rate_pct=t["preferential_rate_pct"],
                        agreement_name=t["agreement_name"],
                        rules_of_origin=t["rules_of_origin"],
                    )
                )
            count += 1
        db.commit()
    finally:
        if close_session:
            db.close()

    print(f"Ingested {count} bilateral tariff schedules into database.")
    return count


if __name__ == "__main__":
    ingest_tariffs()
