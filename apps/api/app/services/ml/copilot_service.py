"""
Model 5: AI Cross-Border Trade Copilot Service
Provides intelligent export advisory, tariff analysis, documentation guidance,
and commercial negotiation strategies powered by dual-engine AI:
1. Google Gemini 2.0 Flash (ultra-fast, dedicated)
2. NVIDIA Nemotron 3 Ultra via OpenRouter
Grounded in real-time ForeTrade database tool execution.
"""

import os
import json
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.services.ml.copilot_tools import detect_and_execute_tools
from app.services.workspace_service import get_latest_profile_version

logger = logging.getLogger(__name__)


def build_copilot_context(db: Session, workspace_id: str, query: str) -> str:
    """
    Dynamically combines active exporter profile with real-time tool execution
    results from tariffs, global buyers, country risks, and HS taxonomy.
    """
    context_parts = []

    # 1. Exporter Profile
    profile_record = get_latest_profile_version(db, workspace_id)
    if profile_record and profile_record.payload:
        p = profile_record.payload
        exp_info = (
            f"[ACTIVE EXPORTER PROFILE]: Company: '{p.get('company_name', 'Indian Manufacturer')}', "
            f"Origin Country: {p.get('origin_country', 'IN')}, "
            f"Monthly Capacity: {p.get('capacity_tons', 150)} MT, "
            f"Target Markets: {', '.join(p.get('target_countries', ['US', 'AE', 'DE']))}, "
            f"Sectors: {', '.join(p.get('product_categories', ['Textiles', 'Apparel']))}, "
            f"Certifications: {', '.join(p.get('certifications', ['ISO 9001']))}."
        )
        context_parts.append(exp_info)

    # 2. Real-time dynamic tool execution
    tool_results = detect_and_execute_tools(db, query)
    if tool_results:
        context_parts.append(tool_results)

    return "\n\n".join(context_parts)


def answer_trade_query(
    db: Session,
    workspace_id: str,
    user_message: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Answers any trade question using grounded database tools and dual-engine AI:
    - Gemini 2.0 Flash (Primary if GEMINI_API_KEY available)
    - OpenRouter Nemotron 3 Ultra (Primary if OPENROUTER_API_KEY available and Gemini unconfigured)
    - Auto-failover between both providers
    """
    grounded_context = build_copilot_context(db, workspace_id, user_message)

    system_instruction = (
        "You are ForeTrade's Cross-Border Trade Advisor — an experienced, practical international export business consultant. "
        "Talk directly, warmly, and clearly to the exporter. "
        "NEVER mention AI models, prompts, tokens, or technical parameters. Never say 'I am an AI'. "
        "Always give direct, practical, easy-to-understand advice. "
        "Answer ANY international trade question asked: tariffs, Incoterms, Letters of Credit, customs clearance, finding buyers, shipping routes, or export finance. "
        "If verified database facts are provided in the context, cite them accurately. "
        "Structure your response with: "
        "- A clear direct answer in the very first sentence. "
        "- Short, practical bullet points highlighting numbers, duty rates, or Incoterm rules. "
        "- A concise 'Next Step' recommendation."
    )

    full_user_content = f"""[VERIFIED DATABASE KNOWLEDGE]:
{grounded_context if grounded_context else "Standard WTO & WCO international trade framework."}

[EXPORTER'S QUESTION]:
{user_message}

Please provide a clear, practical, and helpful answer for the exporter:"""

    # Build conversation history
    history_messages = []
    if conversation_history:
        for turn in conversation_history[-6:]:
            role = "user" if turn.get("role") == "user" else "assistant"
            history_messages.append({"role": role, "content": turn.get("content", "")})

    # Load environment keys
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if not (gemini_key or openrouter_key):
        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(Path(__file__).resolve().parents[4] / ".env")
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        openrouter_key = os.getenv("OPENROUTER_API_KEY")

    # --- ENGINE 1: GOOGLE GEMINI 2.0 FLASH (Fast & Reliable) ---
    if gemini_key:
        try:
            gemini_ans = _call_gemini(
                api_key=gemini_key,
                system_instruction=system_instruction,
                history=history_messages,
                user_prompt=full_user_content,
            )
            if gemini_ans:
                return {
                    "response": gemini_ans,
                    "model_used": "ForeTrade Trade Advisor",
                    "suggested_questions": generate_suggested_followups(user_message),
                }
        except Exception as exc:
            logger.warning(f"Gemini Copilot engine error, attempting OpenRouter fallback: {exc}")

    # --- ENGINE 2: OPENROUTER (NVIDIA Nemotron 3 Ultra / Llama) ---
    if openrouter_key:
        try:
            or_ans = _call_openrouter(
                api_key=openrouter_key,
                system_instruction=system_instruction,
                history=history_messages,
                user_prompt=full_user_content,
            )
            if or_ans:
                return {
                    "response": or_ans,
                    "model_used": "ForeTrade Trade Advisor",
                    "suggested_questions": generate_suggested_followups(user_message),
                }
        except Exception as exc:
            logger.warning(f"OpenRouter Copilot query error: {exc}")

    # --- ENGINE 3: GROUNDED FALLBACK (If neither key reached) ---
    fallback_text = generate_grounded_fallback(user_message, grounded_context)
    return {
        "response": fallback_text,
        "model_used": "ForeTrade Trade Advisor",
        "suggested_questions": generate_suggested_followups(user_message),
    }


def _format_gemini_contents(history_messages: List[Dict[str, str]], prompt_text: str) -> List[Dict[str, Any]]:
    """Builds strictly alternating [user, model, user] contents for Gemini 2.0."""
    contents: List[Dict[str, Any]] = []
    found_first_user = False
    valid_history = []
    for h in history_messages:
        role = "user" if h.get("role") == "user" else "model"
        if not found_first_user and role == "user":
            found_first_user = True
        if found_first_user:
            valid_history.append((role, h.get("content", "").strip()))

    for role, text in valid_history:
        if not text:
            continue
        if not contents or contents[-1]["role"] != role:
            contents.append({"role": role, "parts": [{"text": text}]})
        else:
            contents[-1]["parts"].append({"text": text})

    if contents and contents[-1]["role"] == "user":
        contents[-1]["parts"].append({"text": prompt_text})
    else:
        contents.append({"role": "user", "parts": [{"text": prompt_text}]})

    return contents


def _call_gemini(
    api_key: str,
    system_instruction: str,
    history: List[Dict[str, str]],
    user_prompt: str,
) -> Optional[str]:
    """Invokes Google Gemini 2.0 Flash via standard HTTPS REST API."""
    import urllib.request
    import json

    contents = _format_gemini_contents(history, user_prompt)
    payload = {
        "system_instruction": {
            "parts": [{"text": system_instruction}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 1024,
        },
    }

    gemini_models = [
        os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"),
        "gemini-flash-latest",
        "gemini-3.8-flash",
        "gemini-2.5-flash",
    ]

    for model_name in gemini_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and "text" in parts[0]:
                        return parts[0]["text"].strip()
        except Exception as exc:
            logger.warning(f"Gemini model {model_name} failed: {exc}")
            continue

    return None


def _call_openrouter(
    api_key: str,
    system_instruction: str,
    history: List[Dict[str, str]],
    user_prompt: str,
) -> Optional[str]:
    """Invokes OpenRouter model via standard HTTPS REST API without external dependencies."""
    import urllib.request
    import json

    model_name = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free")
    messages = [{"role": "system", "content": system_instruction}]
    for h in history:
        messages.append({"role": "user" if h.get("role") == "user" else "assistant", "content": h.get("content", "")})
    messages.append({"role": "user", "content": user_prompt})

    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 1000,
    }
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": "https://foretrade.ai",
            "X-Title": "ForeTrade Copilot",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=40) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        choices = data.get("choices", [])
        if choices:
            msg = choices[0].get("message", {}).get("content", "").strip()
            if "</thought>" in msg:
                msg = msg.split("</thought>")[-1].strip()
            return msg if msg else None
    return None


def generate_suggested_followups(query: str) -> List[str]:
    """Provides smart follow-up suggestions tailored to the exporter's topic."""
    q = query.lower()
    if "cepa" in q or "uae" in q or "dubai" in q:
        return [
            "How do I apply for a digital Certificate of Origin for the UAE?",
            "What is the ocean transit time from Mundra vs JNPT to Jebel Ali?",
            "What are common payment terms used by Dubai buyers?",
        ]
    elif "lc" in q or "letter of credit" in q or "payment" in q:
        return [
            "What is the difference between a Confirmed LC and Revocable LC?",
            "How does ECGC export credit insurance protect against default?",
            "What documents must be presented to the bank under UCP 600?",
        ]
    elif "incoterm" in q or "cif" in q or "fob" in q:
        return [
            "Who pays container demurrage charges under CIF vs FOB?",
            "Which Incoterm should I offer to first-time buyers in Europe?",
            "How do marine insurance clauses (Clause A vs C) differ?",
        ]
    elif "buyer" in q or "lead" in q or "customer" in q:
        return [
            "How can I pitch certified Indian manufacturing to overseas buyers?",
            "What quality certifications do US and EU buyers require?",
            "Show me top global buyers with verified customs Bill of Lading records",
        ]
    elif "tariff" in q or "duty" in q or "hs" in q:
        return [
            "Show bilateral tariff differential for HS 6109 in the US vs UAE",
            "What are the Rules of Origin value-addition percentages?",
            "How can I look up my 6-digit Harmonized System code?",
        ]
    else:
        return [
            "What are the duty savings under India-UAE CEPA?",
            "How do I choose between CIF and FOB Incoterms?",
            "What is the safest payment term for a new exporter?",
        ]


def generate_grounded_fallback(query: str, grounded_context: str) -> str:
    """Intelligent trade summary synthesized from database tools when API keys are unreachable."""
    if grounded_context:
        return f"""### **Trade Advisory Analysis**

Based on verified database records for your corridor:

{grounded_context}

**Commercial Recommendations:**
- Review your bilateral trade treaty to claim preferential tariff margins over competing export hubs.
- Ensure all mandatory quality test certificates (OEKO-TEX, ISO, or IATF) are pre-cleared before container dispatch.
- Secure payment through an Irrevocable Letter of Credit (LC) or 30% advance with CAD terms.

*Tip: Add your Gemini API key in `.env` (`GEMINI_API_KEY=...`) to unlock full conversational AI answers.*"""

    return """### **ForeTrade Export Advisory**

For cross-border export operations:
- **Tariffs**: Verify whether your destination country has an active Free Trade Agreement (FTA) with India (e.g. CEPA, ECTA) to qualify for 0% duty.
- **Incoterms**: Quote CIF for complete landed-cost pricing control, or FOB if the buyer manages ocean freight.
- **Payment Security**: Use Confirmed Irrevocable Letters of Credit (LC) to eliminate non-payment risk.

*Tip: Add your Gemini API key in `.env` (`GEMINI_API_KEY=...`) to unlock full conversational AI answers.*"""
