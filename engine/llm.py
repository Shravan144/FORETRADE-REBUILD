"""
=============================================================================
ENGINE / LLM  — Gemini-powered conversational AI with smart fallback
=============================================================================
Provides:
    get_llm_reply(user_msg, buyer_context, chat_history) -> str
    build_system_prompt(buyer, exporter_name) -> str

Falls back to template replies when Gemini is unavailable / quota exceeded.
=============================================================================
"""

import os
import re
import random
from typing import List, Dict, Optional

# ─── Gemini client (lazy init) ────────────────────────────────────────────
_client = None
_MODEL = "gemini-2.5-flash-lite"


def _get_client():
    global _client
    if _client is not None:
        return _client
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return None
    try:
        from google import genai
        _client = genai.Client(api_key=api_key)
        return _client
    except Exception:
        return None


def build_system_prompt(buyer: dict, exporter_name: str) -> str:
    """Build a system prompt that grounds the LLM in real buyer data."""
    details = buyer.get("importer_details") or {}
    buyer_name = buyer.get("buyer_name", "Unknown")
    buyer_country = buyer.get("buyer_country", "")
    industry = details.get("industry", "Trade")
    channel = details.get("preferred_channel", "Email")
    score = buyer.get("score", 0)
    bd = buyer.get("breakdown", {})
    news = buyer.get("news_flags") or {}

    top_signals = sorted(bd.items(), key=lambda x: x[1].get("contribution", 0), reverse=True)[:3]
    signals_str = ", ".join(f"{k.replace('_',' ')} ({v.get('contribution',0):.0f}%)" for k, v in top_signals)

    rev = details.get("revenue_usd")
    try:
        rev_str = f"${float(rev):,.0f}" if rev is not None else "Unknown"
    except (ValueError, TypeError):
        rev_str = "Unknown"

    risks = ", ".join(news.get("risk", [])) or "None identified"
    opps = ", ".join(news.get("opportunity", [])) or "None identified"

    return f"""You are an AI trade outreach assistant for {exporter_name}, an Indian export company.
You are conversing with {buyer_name} from {buyer_country} in the {industry} sector.

MATCH CONTEXT (from our scoring engine):
- Compatibility score: {score:.0f}%
- Top signals: {signals_str}
- Preferred channel: {channel}
- Buyer revenue: {rev_str}
- Intent score: {(details.get('intent_score') or 0)*100:.0f}%
- Market sentiment: {news.get('sentiment', 0.5):.0%}
- Risks: {risks}
- Opportunities: {opps}

RULES:
- Be professional, warm, and concise (2-4 sentences).
- Reference real data points (score, signals, market conditions) naturally.
- When the user (exporter) asks you to draft something, write it.
- When the user types as if they are the exporter, generate the next buyer reply.
- Never make up data not in the context above.
- If asked about pricing, give realistic ranges for {industry} exports from India.
- Always keep the tone suitable for B2B international trade."""


def _call_gemini(user_msg: str, buyer: dict, exporter_name: str, history: List[Dict]) -> Optional[str]:
    """Try Gemini API. Returns reply text or None on failure."""
    client = _get_client()
    if client is None:
        return None
    try:
        system = build_system_prompt(buyer, exporter_name)

        # Build conversation for context
        contents = []
        for m in history[-8:]:  # last 8 messages for context window
            role = "user" if m["role"] in ("user", "buyer") else "model"
            contents.append({"role": role, "parts": [{"text": m["text"]}]})
        contents.append({"role": "user", "parts": [{"text": user_msg}]})

        from google.genai import types
        response = client.models.generate_content(
            model=_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.7,
                max_output_tokens=300,
            ),
        )
        return response.text.strip() if response.text else None
    except Exception as e:
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            return None  # fall back to template
        if "400" in err_str or "403" in err_str:
            return None
        return None


# ─── Smart Fallback Templates ─────────────────────────────────────────────

def _fallback_reply(user_msg: str, buyer: dict, exporter_name: str) -> str:
    """Intelligent template-based reply when Gemini is unavailable."""
    details = buyer.get("importer_details") or {}
    buyer_name = buyer.get("buyer_name", "Unknown")
    buyer_country = buyer.get("buyer_country", "")
    industry = details.get("industry", "Trade")
    score = buyer.get("score", 0)
    news = buyer.get("news_flags") or {}
    opps = news.get("opportunity", [])

    msg_lower = user_msg.lower()

    # Detect intent patterns
    if any(w in msg_lower for w in ["price", "pricing", "cost", "quote", "rate"]):
        return (f"Based on current {industry.lower()} export rates from India to {buyer_country}, "
                f"I can prepare a competitive quote tailored to your volume requirements. "
                f"Shall I send a detailed price sheet with FOB and CIF options?")

    if any(w in msg_lower for w in ["meeting", "call", "schedule", "zoom", "teams"]):
        return (f"I'll schedule a call with {buyer_name}. Based on the {buyer_country} timezone, "
                f"I suggest a 30-minute slot this week. I'll prepare a custom proposal "
                f"covering our top compatibility areas and logistics to {buyer_country}.")

    if any(w in msg_lower for w in ["catalog", "product", "specification", "spec", "moq"]):
        return (f"Sending our full {industry.lower()} product catalog to {buyer_name}. "
                f"It includes specifications, MOQ details, and certifications relevant to "
                f"{buyer_country} import standards. Our {score:.0f}% match score suggests strong product alignment.")

    if any(w in msg_lower for w in ["ship", "logistics", "delivery", "freight", "transport"]):
        return (f"For shipments to {buyer_country}, we typically use CIF/FOB terms with "
                f"established freight partners. Average transit time is 15-25 days depending on port. "
                f"I can provide detailed logistics and Incoterms options.")

    if any(w in msg_lower for w in ["follow up", "followup", "remind", "nudge", "ping"]):
        return (f"Sending a follow-up to {buyer_name}. Given their intent score of "
                f"{(details.get('intent_score') or 0)*100:.0f}%, I'll reference "
                f"{'recent market opportunities' if opps else 'our strong compatibility'} "
                f"to keep the conversation warm.")

    if any(w in msg_lower for w in ["draft", "write", "compose", "email", "message"]):
        return (f"Here's a draft for {buyer_name}:\n\n"
                f"\"Dear {buyer_name} team,\n\n"
                f"Following up on our {industry.lower()} export partnership discussion. "
                f"Our AI analysis shows {score:.0f}% compatibility between our companies. "
                f"{'We also note ' + opps[0].lower() + ' in your market. ' if opps else ''}"
                f"Would you be available for a brief call this week?\n\n"
                f"Best regards,\n{exporter_name}\"")

    # Default contextual reply
    responses = [
        f"I've noted your message. Given {buyer_name}'s {(details.get('intent_score') or 0)*100:.0f}% "
        f"intent score and our {score:.0f}% match, I recommend a direct approach focusing on "
        f"our {industry.lower()} product strengths.",

        f"Good input! I'll incorporate this into our outreach strategy for {buyer_name}. "
        f"Their preferred channel is {details.get('preferred_channel', 'Email')}, "
        f"and market sentiment in {buyer_country} is "
        f"{'favourable' if news.get('sentiment', 0.5) >= 0.6 else 'cautious'}.",

        f"Understood. For {buyer_name} in {buyer_country}, our top match signals are "
        f"product compatibility and trade trust. I'll tailor the next message accordingly.",
    ]
    return random.choice(responses)


# ─── Public API ────────────────────────────────────────────────────────────

def get_llm_reply(
    user_msg: str,
    buyer: dict,
    exporter_name: str,
    history: Optional[List[Dict]] = None,
) -> tuple:
    """
    Returns (reply_text, source) where source is 'gemini' or 'smart-template'.
    """
    history = history or []

    # Try Gemini first
    reply = _call_gemini(user_msg, buyer, exporter_name, history)
    if reply:
        return reply, "gemini"

    # Fallback
    return _fallback_reply(user_msg, buyer, exporter_name), "smart-template"
