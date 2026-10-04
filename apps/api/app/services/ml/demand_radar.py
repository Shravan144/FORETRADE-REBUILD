"""
Model 4: Real-Time Demand Radar (NLP Signal Extractor)
Extracts actionable procurement tenders, government quota openings, and demand surges
from unstructured trade news, press releases, and ministry bulletins using
Named Entity Recognition, monetary parsing, and semantic HS code linking.
"""

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trade_intelligence import MarketDemandSignal
from app.services.ml.hs_classifier import classify_product_description

# Country Gazetteer mapping names to ISO-2 codes
COUNTRY_GAZETTEER = {
    "united states": "US", "usa": "US", "american": "US", "us": "US",
    "germany": "DE", "german": "DE", "berlin": "DE", "hamburg": "DE",
    "united kingdom": "GB", "uk": "GB", "british": "GB", "london": "GB",
    "united arab emirates": "AE", "uae": "AE", "dubai": "AE", "abu dhabi": "AE",
    "egypt": "EG", "egyptian": "EG", "cairo": "EG",
    "kenya": "KE", "kenyan": "KE", "nairobi": "KE",
    "japan": "JP", "japanese": "JP", "tokyo": "JP",
    "australia": "AU", "australian": "AU", "sydney": "AU", "melbourne": "AU",
    "singapore": "SG", "singaporean": "SG",
    "france": "FR", "french": "FR", "paris": "FR",
    "canada": "CA", "canadian": "CA", "montreal": "CA",
    "netherlands": "NL", "dutch": "NL", "rotterdam": "NL",
}

INTENT_KEYWORDS = [
    ("tender", 0.95), ("procurement", 0.92), ("rfp", 0.94),
    ("bidding", 0.90), ("supplies contract", 0.88),
    ("quota opening", 0.91), ("duty-free quota", 0.89),
    ("urgent demand", 0.85), ("shortage", 0.82), ("emergency supply", 0.87),
]


@dataclass
class ExtractedDemandSignal:
    title: str
    target_country: str
    product_category: str
    hs_code: Optional[str]
    estimated_budget_usd: Optional[float]
    deadline_text: Optional[str]
    signal_type: str              # "Procurement Tender", "Quota Opening", "Demand Surge"
    urgency_level: str            # "Critical", "High", "Standard"
    intent_score: float           # 0.0 to 1.0
    extracted_entities: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _extract_monetary_amount(text: str) -> Optional[float]:
    """Extracts budget figures like '$40M', '40 million USD', '€25M' into numeric USD."""
    # Pattern: ($|USD|€|EUR|£)\s*([0-9]+(?:\.[0-9]+)?)\s*(M|B|K|million|billion|thousand)?
    pattern = r"(?:\$|USD|EUR|€|GBP|£)\s*([0-9]+(?:\.[0-9]+)?)\s*(M|B|K|million|billion|thousand)?"
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        # Alternative pattern: 40 million USD
        alt_pattern = r"([0-9]+(?:\.[0-9]+)?)\s*(million|billion|thousand|M|B|K)\s*(?:USD|dollars|EUR|euro)?"
        match = re.search(alt_pattern, text, re.IGNORECASE)
        if not match:
            return None

    num_str = match.group(1)
    scale_str = (match.group(2) or "").lower()

    try:
        val = float(num_str)
        if scale_str in ["m", "million"]:
            return val * 1_000_000.0
        elif scale_str in ["b", "billion"]:
            return val * 1_000_000_000.0
        elif scale_str in ["k", "thousand"]:
            return val * 1_000.0
        return val
    except ValueError:
        return None


def _extract_country(text: str) -> str:
    """Finds country mention in text using gazetteer; defaults to US if unspecified."""
    text_lower = text.lower()
    for name, code in COUNTRY_GAZETTEER.items():
        if re.search(rf"\b{name}\b", text_lower):
            return code
    return "US"


def _extract_deadline(text: str) -> Optional[str]:
    """Extracts bidding deadline or timeframe phrases."""
    deadline_patterns = [
        r"(?:closing|due|deadline|bids due)\s*(?:in|by|within)?\s*([0-9]+\s*days)",
        r"(?:closing|due|deadline)\s*(?:on|by)?\s*([A-Za-z]+\s+[0-9]{1,2}(?:,\s*[0-9]{4})?)",
        r"(?:within)\s*([0-9]+\s*days)",
    ]
    for pat in deadline_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            return match.group(0).strip()
    return "Open / Ongoing"


def _infer_signal_type_and_intent(text: str) -> tuple[str, str, float]:
    """Infers signal category, urgency level, and buyer intent score."""
    text_lower = text.lower()

    # Intent score calculation
    intent_score = 0.65
    for kw, score in INTENT_KEYWORDS:
        if kw in text_lower:
            intent_score = max(intent_score, score)

    # Signal type inference
    if any(k in text_lower for k in ["quota", "duty-free", "tariff concession", "import quota"]):
        signal_type = "Government Quota Opening"
        urgency = "Standard"
    elif any(k in text_lower for k in ["shortage", "urgent demand", "emergency", "surge"]):
        signal_type = "Sudden Demand Surge"
        urgency = "Critical"
    else:
        signal_type = "Procurement Tender"
        urgency = "High" if "urgent" in text_lower or "immediate" in text_lower else "Standard"

    return signal_type, urgency, round(intent_score, 2)


def extract_demand_signal(
    db: Session,
    raw_text: str,
    source_channel: str = "Global Trade Bulletin",
) -> ExtractedDemandSignal:
    """
    NLP Information Extractor
    Parses unstructured announcement into structured entities with linked HS classification.
    """
    budget = _extract_monetary_amount(raw_text)
    country = _extract_country(raw_text)
    deadline = _extract_deadline(raw_text)
    sig_type, urgency, intent = _infer_signal_type_and_intent(raw_text)

    # Link product to Model 5 HS classification
    preds = classify_product_description(db, raw_text, top_k=1)
    if preds:
        best_hs = preds[0].hs_code
        category = preds[0].category_name
    else:
        best_hs = "6109"
        category = "General Commodities"

    # Title extraction (first sentence or up to 100 chars)
    first_sentence = raw_text.split(".")[0].strip()
    title = first_sentence if len(first_sentence) <= 120 else first_sentence[:117] + "..."

    entities = {
        "budget_usd": budget,
        "country_iso": country,
        "deadline": deadline,
        "hs_code": best_hs,
        "category": category,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
    }

    return ExtractedDemandSignal(
        title=title,
        target_country=country,
        product_category=category,
        hs_code=best_hs,
        estimated_budget_usd=budget,
        deadline_text=deadline,
        signal_type=sig_type,
        urgency_level=urgency,
        intent_score=intent,
        extracted_entities=entities,
    )


# ── CANONICAL HIGH-VALUE TRADE RADAR SIGNALS ──
RADAR_SEED_NOTICES = [
    {
        "text": "Egypt General Authority for Supply Commodities (GASC) issues $40M emergency international tender for wheat and agricultural packaging materials, closing in 30 days.",
        "source": "UN Procurement & GASC Cairo Bulletin",
    },
    {
        "text": "Kenya Ministry of Education announces $15M procurement tender for cotton school uniforms and knitwear apparel for national public schools, bids due in 45 days.",
        "source": "Kenya Government Public Procurement Information Portal",
    },
    {
        "text": "Germany Federal Network Agency (Bundesnetzagentur) launches $65M commercial rooftop solar panel and photovoltaic module tender program for municipal energy transition.",
        "source": "EU Official Journal & Bundesnetzagentur",
    },
    {
        "text": "Dubai Health Authority issues $28M urgent tender for active pharmaceutical ingredients, paracetamol tablets, and generic antibiotics with delivery to Jebel Ali Port within 60 days.",
        "source": "DHA Procurement Portal UAE",
    },
    {
        "text": "US Department of Transportation issues $35M supply contract for automotive commercial truck braking systems, gear boxes, and heavy replacement components.",
        "source": "US Federal Business Opportunities (SAM.gov)",
    },
    {
        "text": "Australia Clean Energy Council opens $22M preferential import quota for high-efficiency monocrystalline solar panels and solar wafers under the ECTA trade corridor.",
        "source": "Australia Trade & Investment Commission (Austrade)",
    },
    {
        "text": "Japan Ministry of Economy, Trade and Industry (METI) announces $18M industrial procurement for precision mechanical transmission shafts and bearing housings.",
        "source": "Japan External Trade Organization (JETRO)",
    },
    {
        "text": "United Kingdom National Health Service (NHS) opens $14M tender for sterile surgical diagnostic instruments and medical devices with rapid customs clearance into Felixstowe.",
        "source": "UK Contracts Finder NHS Supply Chain",
    },
]


def ingest_live_market_signals(db: Session) -> int:
    """Populates the live MarketDemandSignal radar table with NLP-extracted notices."""
    count = 0
    for notice in RADAR_SEED_NOTICES:
        sig = extract_demand_signal(db, notice["text"], notice["source"])

        # Check if already present
        existing = db.scalar(
            select(MarketDemandSignal).where(
                MarketDemandSignal.title == sig.title,
                MarketDemandSignal.target_country == sig.target_country,
            )
        )
        if not existing:
            db.add(
                MarketDemandSignal(
                    title=sig.title,
                    raw_text=notice["text"],
                    source_channel=notice["source"],
                    signal_type=sig.signal_type,
                    target_country=sig.target_country,
                    product_category=sig.product_category,
                    hs_code=sig.hs_code,
                    estimated_budget_usd=sig.estimated_budget_usd,
                    deadline_date=sig.deadline_text,
                    intent_score=sig.intent_score,
                    urgency_level=sig.urgency_level,
                    extracted_entities=sig.extracted_entities,
                )
            )
            count += 1

    db.commit()
    print(f"Ingested {count} NLP-extracted market demand signals into radar.")
    return count
