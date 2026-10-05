"""
Model 5: AI Cross-Border Trade Copilot Service
Provides intelligent export advisory, tariff analysis, documentation guidance,
and commercial negotiation strategies powered by NVIDIA Nemotron 3 Ultra via OpenRouter.
"""

import os
import json
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trade_intelligence import TariffSchedule, CountryRiskFactor, HsCodeTaxonomy
from app.services.workspace_service import get_latest_profile_version

logger = logging.getLogger(__name__)


def build_copilot_context(db: Session, workspace_id: str, query: str) -> str:
    """
    Retrieves dynamic, grounded trade context from database tables:
    - Active exporter profile
    - Applicable Tariff agreements (CEPA, ECTA, WTO MFN)
    - Country risk profiles
    - Product taxonomy
    """
    context_parts = []

    # 1. Exporter Profile
    profile_record = get_latest_profile_version(db, workspace_id)
    if profile_record and profile_record.payload:
        p = profile_record.payload
        exp_info = (
            f"Active Exporter Profile: Company: '{p.get('company_name', 'Indian Manufacturer')}', "
            f"Origin Country: {p.get('origin_country', 'IN')}, "
            f"Monthly Capacity: {p.get('capacity_tons', 150)} MT, "
            f"Target Markets: {', '.join(p.get('target_countries', ['US', 'AE', 'DE']))}, "
            f"Sectors: {', '.join(p.get('product_categories', ['Textiles', 'Apparel']))}, "
            f"Certifications: {', '.join(p.get('certifications', ['ISO 9001']))}."
        )
        context_parts.append(exp_info)

    # 2. Key Tariff Agreements
    tariffs = db.scalars(select(TariffSchedule).limit(10)).all()
    if tariffs:
        tariff_lines = [
            f"- {t.exporter_country}->{t.importer_country} (HS {t.hs_code}): MFN {t.mfn_applied_rate_pct}% vs FTA {t.preferential_rate_pct}% ({t.agreement_name})"
            for t in tariffs[:8]
        ]
        context_parts.append("Known Bilateral Tariff Schedules in Database:\n" + "\n".join(tariff_lines))

    # 3. Country Risk Factors
    risks = db.scalars(select(CountryRiskFactor).limit(8)).all()
    if risks:
        risk_lines = [
            f"- {r.country_name} ({r.country_code}): Risk Tier: {r.risk_tier}, Score: {r.composite_risk_score}/100, Currency: {r.currency_code}"
            for r in risks[:6]
        ]
        context_parts.append("Country Risk Governance Ratings in Database:\n" + "\n".join(risk_lines))

    return "\n\n".join(context_parts)


def answer_trade_query(
    db: Session,
    workspace_id: str,
    user_message: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Generates a knowledgeable, actionable trade advisory response using:
    1. NVIDIA Nemotron 3 Ultra via OpenRouter (Primary)
    2. Google Gemini 2.0 Flash (Secondary)
    3. ForeTrade Institutional Rule-Engine (Deterministic Fallback)
    """
    grounded_context = build_copilot_context(db, workspace_id, user_message)

    system_instruction = (
        "You are ForeTrade's Cross-Border Trade Copilot — a senior international trade, customs, and export finance advisor. "
        "You advise Indian and global exporters on trade corridors, bilateral Free Trade Agreements (FTAs like India-UAE CEPA, India-Australia ECTA), "
        "Incoterms 2020 (CIF, FOB, DDP, DAP), international payment security (Letters of Credit, CAD, DA/DP), customs manifests, "
        "and compliance standards (ISO, OEKO-TEX, IATF, FDA). "
        "Always be practical, authoritative, and concise. Use clear markdown formatting with bullet points. "
        "When referencing tariffs or landed costs, cite realistic duty percentages and documentation rules. "
        "Base your analysis on the provided verified database context whenever relevant."
    )

    full_prompt = f"""[VERIFIED DATABASE KNOWLEDGE]:
{grounded_context}

[USER QUESTION]:
{user_message}
"""

    # Build messages array with prior history if provided
    messages = [{"role": "system", "content": system_instruction}]
    if conversation_history:
        for turn in conversation_history[-6:]:
            role = "user" if turn.get("role") == "user" else "assistant"
            messages.append({"role": role, "content": turn.get("content", "")})
    messages.append({"role": "user", "content": full_prompt})

    # 1. Try OpenRouter (NVIDIA Nemotron 3 Ultra)
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_key:
        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(Path(__file__).resolve().parents[4] / ".env")
        openrouter_key = os.getenv("OPENROUTER_API_KEY")

    if openrouter_key:
        try:
            import requests

            model_name = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free")
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": 0.4,
                "reasoning": {"enabled": True},
            }
            resp = requests.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openrouter_key}",
                    "HTTP-Referer": "https://foretrade.ai",
                    "X-Title": "ForeTrade Copilot",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=90,
            )
            if resp.status_code == 200:
                data = resp.json()
                answer = data["choices"][0]["message"]["content"].strip()
                if answer:
                    return {
                        "response": answer,
                        "model_used": model_name,
                        "suggested_questions": generate_suggested_followups(user_message),
                    }
            else:
                logger.warning(f"OpenRouter Copilot returned status {resp.status_code}: {resp.text[:200]}")
        except Exception as exc:
            logger.warning(f"OpenRouter Copilot query error: {exc}")

    # 2. Try Gemini 2.0 Flash
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if gemini_key:
        try:
            import urllib.request
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"
            gemini_prompt = f"{system_instruction}\n\n{full_prompt}"
            req_data = json.dumps({"contents": [{"parts": [{"text": gemini_prompt}]}]}).encode("utf-8")
            req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=12) as response:
                resp_json = json.loads(response.read().decode("utf-8"))
                text = resp_json["candidates"][0]["content"]["parts"][0]["text"].strip()
                if text:
                    return {
                        "response": text,
                        "model_used": "gemini-2.0-flash",
                        "suggested_questions": generate_suggested_followups(user_message),
                    }
        except Exception as exc:
            logger.warning(f"Gemini Copilot query error: {exc}")

    # 3. Deterministic Knowledge Engine Fallback
    fallback_response = generate_deterministic_trade_answer(user_message, grounded_context)
    return {
        "response": fallback_response,
        "model_used": "foretrade-trade-knowledge-engine",
        "suggested_questions": generate_suggested_followups(user_message),
    }


def generate_suggested_followups(query: str) -> List[str]:
    """Provides smart follow-up suggestions tailored to the exporter's topic."""
    q = query.lower()
    if "cepa" in q or "uae" in q or "dubai" in q:
        return [
            "What documents are needed for Certificate of Origin under CEPA?",
            "How does shipping transit time compare from Mundra vs JNPT?",
            "What are the typical payment terms for UAE buyers?",
        ]
    elif "lc" in q or "letter of credit" in q or "payment" in q:
        return [
            "Draft an irrevocable, non-negotiable LC clause for 60 days",
            "What is the difference between CAD and Confirmed Irrevocable LC?",
            "How can I mitigate buyer default risk in high-growth corridors?",
        ]
    elif "incoterm" in q or "cif" in q or "fob" in q:
        return [
            "Who bears port demurrage risk under CIF vs FOB?",
            "How do freight and insurance surcharges impact landed cost?",
            "Which Incoterm do European buyers prefer?",
        ]
    elif "tariff" in q or "duty" in q or "hs" in q:
        return [
            "Show bilateral tariff differential for HS 6109 in the US vs UAE",
            "What are the Rules of Origin value-add requirements?",
            "How do I obtain an advance customs ruling?",
        ]
    else:
        return [
            "Explain tariff savings under India-UAE CEPA",
            "What are the best Incoterms for a new exporter?",
            "How do I secure an Irrevocable Letter of Credit?",
        ]


def generate_deterministic_trade_answer(query: str, context: str) -> str:
    """Specialized fallback when offline or LLM rate-limited."""
    q = query.lower()

    if "cepa" in q or "uae" in q:
        return """### **India-UAE Comprehensive Economic Partnership Agreement (CEPA) Overview**

Under the India-UAE CEPA (effective May 2022), Indian exporters enjoy zero-duty preferential tariff access into the UAE across over 90% of tariff lines:

1. **Key Tariff Advantages**:
   - **Textiles & Apparel (HS 6109, 6204)**: 5.0% standard MFN duty eliminated to **0.0%**.
   - **Gems & Jewellery**: 5% duty removed on Indian finished jewelry consignments.
   - **Engineering & Electrical Machinery**: Instant 5% duty elimination.

2. **Rules of Origin Requirements**:
   - Minimum value addition of **40% (CTSH)** within India.
   - Consignments must be accompanied by an official **Digital Certificate of Origin (COO)** issued by the Directorate General of Foreign Trade (DGFT) Trade Portal.

3. **Logistics & Ports**:
   - Direct sailings from **Nhava Sheva (JNPT)** or **Mundra** to **Jebel Ali Port (Dubai)** take approximately 3 to 5 ocean sailing days.
"""

    if "incoterm" in q or "cif" in q or "fob" in q:
        return """### **Incoterms 2020: CIF vs FOB Comparison for Exporters**

Choosing between **FOB (Free on Board)** and **CIF (Cost, Insurance & Freight)** affects your financial liability and margin control:

| Parameter | FOB (Free On Board) | CIF (Cost, Insurance, Freight) |
| :--- | :--- | :--- |
| **Exporter Scope** | Delivery till loaded on vessel at Indian load port | Delivery till destination arrival port + Ocean freight + Marine insurance |
| **Risk Transfer** | When goods pass ship's rail at origin port | When goods pass ship's rail at origin port (buyer bears voyage transit risk) |
| **Freight Control** | Buyer nominates shipping line and pays ocean freight | Exporter negotiates ocean contract & secures freight margins |
| **Best Used When** | Buyer has massive regional freight volume contracts | Exporter wants end-to-end pricing control & turnkey landed quote |

**Recommendation**: For established overseas buyers, **CIF** is preferred as it delivers a predictable landed price at their regional port of entry.
"""

    if "lc" in q or "payment" in q or "letter of credit" in q:
        return """### **Export Payment Security: Protecting Cross-Border Receivables**

When exporting to new or unrated overseas counterparties, securing your payment instrument is critical:

1. **Confirmed Irrevocable Letter of Credit (LC)**:
   - **Mechanism**: An Indian Tier-1 confirming bank guarantees payment upon presentation of clean shipping documents (Bill of Lading, Commercial Invoice, Certificate of Origin).
   - **Protection**: Eliminates both buyer commercial default risk and foreign sovereign risk.

2. **Cash Against Documents (CAD) / Documents Against Payment (DP)**:
   - Original shipping documents are released only when the importer's bank collects payment.
   - Suitable for buyers with verified repeat customs transaction history in our database.

3. **ECGC Comprehensive Export Credit Insurance**:
   - Covers up to 90% of commercial and political risks on deferred payment (DA 30/60 days).
"""

    return f"""### **ForeTrade Trade Advisory Summary**

Based on our institutional customs data and bilateral trade frameworks:

1. **Market & Tariff Positioning**:
   - Review your target corridor's Free Trade Agreement (FTA) schedules to leverage preferential tariff margins against competing origin hubs.
   - Ensure complete compliance with destination mandatory accreditations before loading container consignments.

2. **Operational Alignment**:
   - Align batch production cycles with container TEU capacities (FCL vs LCL) to minimize freight overhead.
   - Route shipments through high-frequency origin gateways like Nhava Sheva (JNPT) or Mundra to guarantee reliable sailing schedules.

*Ask specific questions on UAE CEPA, Australia ECTA, Letter of Credit structuring, or HS Code classifications for deep insights.*
"""
