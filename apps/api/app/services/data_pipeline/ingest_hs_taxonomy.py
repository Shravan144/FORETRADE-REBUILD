"""
WCO Harmonized System (HS) Code Taxonomy Ingestion Pipeline
Seeds standardized 2-digit, 4-digit, and 6-digit HS codes with categories and keywords.
"""

import json
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.trade_intelligence import HsCodeTaxonomy

REPO_ROOT = Path(__file__).resolve().parents[5]
OUTPUT_FILE = REPO_ROOT / "data" / "hs_taxonomy" / "hs_codes_reference.json"

# Core trade taxonomy spanning global export sectors
TAXONOMY_SEED = [
    # ── Textiles & Apparel (Chapters 52, 61, 62) ──
    {
        "hs_code": "52",
        "level": 2,
        "chapter_code": "52",
        "heading_code": None,
        "description": "Cotton, including yarns and woven fabrics",
        "category_name": "Textiles & Apparel",
        "search_keywords": "cotton, raw cotton, cotton yarn, woven cotton, denim",
    },
    {
        "hs_code": "5208",
        "level": 4,
        "chapter_code": "52",
        "heading_code": "5208",
        "description": "Woven fabrics of cotton, containing 85% or more by weight of cotton",
        "category_name": "Textiles & Apparel",
        "search_keywords": "woven fabric, cotton textile, plain weave, bleached cotton",
    },
    {
        "hs_code": "61",
        "level": 2,
        "chapter_code": "61",
        "heading_code": None,
        "description": "Articles of apparel and clothing accessories, knitted or crocheted",
        "category_name": "Textiles & Apparel",
        "search_keywords": "apparel, knitwear, garments, clothing, shirts, t-shirts",
    },
    {
        "hs_code": "6109",
        "level": 4,
        "chapter_code": "61",
        "heading_code": "6109",
        "description": "T-shirts, singlets and other vests, knitted or crocheted",
        "category_name": "Textiles & Apparel",
        "search_keywords": "t-shirt, tee, jersey, cotton t-shirt, tank top, singlet, knitwear",
    },
    {
        "hs_code": "610910",
        "level": 6,
        "chapter_code": "61",
        "heading_code": "6109",
        "description": "T-shirts, singlets and other vests, knitted or crocheted, of cotton",
        "category_name": "Textiles & Apparel",
        "search_keywords": "cotton t-shirt, combed cotton tee, round neck, organic cotton shirt",
    },
    {
        "hs_code": "62",
        "level": 2,
        "chapter_code": "62",
        "heading_code": None,
        "description": "Articles of apparel and clothing accessories, not knitted or crocheted",
        "category_name": "Textiles & Apparel",
        "search_keywords": "woven garments, suits, trousers, jackets, formal wear",
    },
    {
        "hs_code": "6203",
        "level": 4,
        "chapter_code": "62",
        "heading_code": "6203",
        "description": "Men's or boys' suits, ensembles, jackets, blazers, trousers, bib and brace overalls",
        "category_name": "Textiles & Apparel",
        "search_keywords": "trousers, pants, denim jeans, men suit, blazer, chino",
    },
    {
        "hs_code": "6204",
        "level": 4,
        "chapter_code": "62",
        "heading_code": "6204",
        "description": "Women's or girls' suits, ensembles, jackets, dresses, skirts, trousers",
        "category_name": "Textiles & Apparel",
        "search_keywords": "dresses, skirts, womens trousers, denim jeans, blazers",
    },

    # ── Machinery & Mechanical Appliances (Chapter 84) ──
    {
        "hs_code": "84",
        "level": 2,
        "chapter_code": "84",
        "heading_code": None,
        "description": "Nuclear reactors, boilers, machinery and mechanical appliances; parts thereof",
        "category_name": "Machinery & Equipment",
        "search_keywords": "machinery, industrial equipment, engines, pumps, mechanical parts",
    },
    {
        "hs_code": "8471",
        "level": 4,
        "chapter_code": "84",
        "heading_code": "8471",
        "description": "Automatic data processing machines and units thereof; magnetic or optical readers",
        "category_name": "Machinery & Equipment",
        "search_keywords": "computers, servers, laptops, processors, data processing hardware",
    },
    {
        "hs_code": "8483",
        "level": 4,
        "chapter_code": "84",
        "heading_code": "8483",
        "description": "Transmission shafts, cranks, bearing housings, gears and gearing, ball screws",
        "category_name": "Engineering & Components",
        "search_keywords": "gears, transmission shafts, bearings, pulleys, clutches, mechanical drives",
    },

    # ── Electronics & Electrical Equipment (Chapter 85) ──
    {
        "hs_code": "85",
        "level": 2,
        "chapter_code": "85",
        "heading_code": None,
        "description": "Electrical machinery and equipment and parts thereof; sound recorders and reproducers",
        "category_name": "Electronics & Electrical",
        "search_keywords": "electronics, circuit boards, transformers, batteries, telecom equipment",
    },
    {
        "hs_code": "8504",
        "level": 4,
        "chapter_code": "85",
        "heading_code": "8504",
        "description": "Electrical transformers, static converters (e.g. inverters) and inductors",
        "category_name": "Electronics & Electrical",
        "search_keywords": "transformer, power inverter, power supply, static converter, inductor",
    },
    {
        "hs_code": "8541",
        "level": 4,
        "chapter_code": "85",
        "heading_code": "8541",
        "description": "Semiconductor devices, photovoltaic cells (solar cells/panels), LEDs, diodes",
        "category_name": "Renewables & Solar",
        "search_keywords": "solar panels, photovoltaic cells, solar modules, semiconductors, diodes, led",
    },
    {
        "hs_code": "854140",
        "level": 6,
        "chapter_code": "85",
        "heading_code": "8541",
        "description": "Photosensitive semiconductor devices, including photovoltaic cells and solar modules",
        "category_name": "Renewables & Solar",
        "search_keywords": "solar modules, solar panel array, pv cells, photovoltaic wafers",
    },

    # ── Pharmaceuticals & Chemicals (Chapters 29, 30) ──
    {
        "hs_code": "29",
        "level": 2,
        "chapter_code": "29",
        "heading_code": None,
        "description": "Organic chemicals, acyclic hydrocarbons, alcohols, phenols, ethers",
        "category_name": "Chemicals",
        "search_keywords": "organic chemicals, specialty chemicals, aromatic compounds, chemical intermediates",
    },
    {
        "hs_code": "2902",
        "level": 4,
        "chapter_code": "29",
        "heading_code": "2902",
        "description": "Cyclic hydrocarbons: benzene, toluene, xylenes, styrene",
        "category_name": "Chemicals",
        "search_keywords": "benzene, toluene, xylene, solvents, petrochemical intermediates",
    },
    {
        "hs_code": "30",
        "level": 2,
        "chapter_code": "30",
        "heading_code": None,
        "description": "Pharmaceutical products, medicaments, vaccines, toxins, blood fractions",
        "category_name": "Pharmaceuticals",
        "search_keywords": "pharma, medicines, drugs, active pharmaceutical ingredients, API, medicaments",
    },
    {
        "hs_code": "3004",
        "level": 4,
        "chapter_code": "30",
        "heading_code": "3004",
        "description": "Medicaments consisting of mixed or unmixed products for therapeutic or prophylactic uses",
        "category_name": "Pharmaceuticals",
        "search_keywords": "generic drugs, tablets, capsules, therapeutic medicaments, antibiotics",
    },

    # ── Automotive & Transport (Chapter 87) ──
    {
        "hs_code": "87",
        "level": 2,
        "chapter_code": "87",
        "heading_code": None,
        "description": "Vehicles other than railway or tramway rolling stock, and parts and accessories",
        "category_name": "Automotive",
        "search_keywords": "vehicles, automotive, car parts, trucks, motorcycles, auto components",
    },
    {
        "hs_code": "8708",
        "level": 4,
        "chapter_code": "87",
        "heading_code": "8708",
        "description": "Parts and accessories of the motor vehicles of headings 8701 to 8705",
        "category_name": "Automotive Components",
        "search_keywords": "auto parts, brakes, gear boxes, drive axles, radiators, suspension shock absorbers",
    },

    # ── Optical, Medical & Surgical Instruments (Chapter 90) ──
    {
        "hs_code": "90",
        "level": 2,
        "chapter_code": "90",
        "heading_code": None,
        "description": "Optical, photographic, cinematographic, measuring, precision, medical instruments",
        "category_name": "Medical & Instruments",
        "search_keywords": "medical devices, surgical instruments, diagnostic equipment, optical lenses",
    },
    {
        "hs_code": "9018",
        "level": 4,
        "chapter_code": "90",
        "heading_code": "9018",
        "description": "Instruments and appliances used in medical, surgical, dental or veterinary sciences",
        "category_name": "Medical Devices",
        "search_keywords": "catheters, syringes, surgical tools, diagnostic apparatus, dental instruments",
    },

    # ── Agri-Commodities & Spices (Chapters 09, 10) ──
    {
        "hs_code": "09",
        "level": 2,
        "chapter_code": "09",
        "heading_code": None,
        "description": "Coffee, tea, mate and spices",
        "category_name": "Agriculture & Spices",
        "search_keywords": "spices, black pepper, cardamom, turmeric, ginger, tea, coffee beans",
    },
    {
        "hs_code": "0910",
        "level": 4,
        "chapter_code": "09",
        "heading_code": "0910",
        "description": "Ginger, saffron, turmeric (curcuma), thyme, bay leaves, curry and other spices",
        "category_name": "Agriculture & Spices",
        "search_keywords": "turmeric, curcuma, ginger, saffron, curry powder, ground spices",
    },
    {
        "hs_code": "1006",
        "level": 4,
        "chapter_code": "10",
        "heading_code": "1006",
        "description": "Rice: in husk, husked (brown), semi-milled or wholly milled (white/basmati)",
        "category_name": "Agri-Commodities",
        "search_keywords": "basmati rice, non-basmati rice, parboiled rice, polished rice, grain export",
    },
]


def ingest_hs_taxonomy(db: Session | None = None) -> int:
    """Ingest WCO HS Code reference taxonomy into PostgreSQL / SQLite."""
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(TAXONOMY_SEED, f, indent=2)

    close_session = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_session = True

    count = 0
    try:
        for item in TAXONOMY_SEED:
            existing = db.scalar(select(HsCodeTaxonomy).where(HsCodeTaxonomy.hs_code == item["hs_code"]))
            if existing:
                existing.description = item["description"]
                existing.category_name = item["category_name"]
                existing.search_keywords = item["search_keywords"]
            else:
                db.add(
                    HsCodeTaxonomy(
                        hs_code=item["hs_code"],
                        level=item["level"],
                        chapter_code=item["chapter_code"],
                        heading_code=item["heading_code"],
                        description=item["description"],
                        category_name=item["category_name"],
                        search_keywords=item["search_keywords"],
                    )
                )
            count += 1
        db.commit()
    finally:
        if close_session:
            db.close()

    print(f"Ingested {count} HS Code taxonomy entries.")
    return count


if __name__ == "__main__":
    ingest_hs_taxonomy()
