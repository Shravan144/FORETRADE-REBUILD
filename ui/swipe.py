"""
=============================================================================
SWIPE UI COMPONENT — ForeTrade
=============================================================================
The Tinder-like swipe interface for match suggestions.

This is your KILLER FEATURE — "Swipe to Export."
Make it look good, make it feel simple.

DESIGN:
    ┌──────────────────────────────┐
    │  🏢 Pacific Trading Co.      │
    │  Distributor • Vietnam       │
    │                              │
    │     ⭐ 82% Match             │
    │  🔥 High Intent              │
    │                              │
    │  "Imports Electronics monthly │
    │   from Southeast Asia"       │
    │                              │
    │  ┌─────────┐  ┌───────────┐ │
    │  │  ✖ Skip  │  │ ✔ Connect│ │
    │  └─────────┘  └───────────┘ │
    └──────────────────────────────┘

TODO CHECKLIST:
    [x] HOUR 8-10: Implement render_swipe_card()
    [x] HOUR 10:   Implement render_swipe_interface()
    [x] HOUR 10:   Wire up swipe callbacks to scorer.update_weights_from_swipe()
    [x] HOUR 15:   Polish card styling with custom CSS
=============================================================================
"""

import streamlit as st
from typing import List, Optional
import numbers


def _is_num(v):
    """Check if v is a real number (handles numpy int64/float64 + NaN)."""
    if v is None:
        return False
    if isinstance(v, numbers.Number):
        try:
            return float(v) == float(v)  # False for NaN
        except (ValueError, TypeError):
            return False
    return False


def render_swipe_card(match: dict) -> Optional[str]:
    """
    Render a premium match card with real data.
    3 action buttons: Reject / Skip / Approve.
    Returns "right" → Approve, "left" → Reject, None → no action.
    """
    card = match.get("card_text", {})
    score = match.get("score", 0)
    details = match.get("importer_details") or {}
    buyer_name = card.get("title", "Unknown")
    industry = details.get("industry", "Trade")
    country = details.get("country", match.get("buyer_country", ""))

    # Revenue / Company Size
    rev = details.get("revenue_usd")
    rev_str = f"${float(rev):,.0f}" if _is_num(rev) else "N/A"
    team = details.get("team_size")
    team_str = str(int(float(team))) if _is_num(team) else "N/A"

    # Score badge color + gradient
    if score >= 80:
        badge_bg = "linear-gradient(135deg,#22c55e,#16a34a)"
        score_label = "Excellent"
    elif score >= 60:
        badge_bg = "linear-gradient(135deg,#f59e0b,#d97706)"
        score_label = "Good"
    else:
        badge_bg = "linear-gradient(135deg,#ef4444,#dc2626)"
        score_label = "Fair"

    # News market indicator
    news_flags = match.get("news_flags") or {}
    news_sent = news_flags.get("sentiment", 0.5)
    if news_sent >= 0.6:
        news_badge = '<span style="background:rgba(34,197,94,0.12);color:#16a34a;padding:4px 12px;border-radius:20px;font-size:0.76em;font-weight:600;">🟢 Favourable Market</span>'
    elif news_sent <= 0.4:
        news_badge = '<span style="background:rgba(239,68,68,0.1);color:#dc2626;padding:4px 12px;border-radius:20px;font-size:0.76em;font-weight:600;">🔴 Market Risk</span>'
    else:
        news_badge = '<span style="background:rgba(245,158,11,0.1);color:#d97706;padding:4px 12px;border-radius:20px;font-size:0.76em;font-weight:600;">🟡 Neutral</span>'

    # Intent indicator
    intent = details.get("intent_score", 0)
    if _is_num(intent) and float(intent) > 0.6:
        intent_badge = '<span style="background:rgba(139,92,246,0.1);color:#7c3aed;padding:4px 12px;border-radius:20px;font-size:0.76em;font-weight:600;">🔥 High Intent</span>'
    else:
        intent_badge = ''

    # ML segment badge
    seg_label = details.get("segment", "")
    seg_color = details.get("segment_color", "#94a3b8")
    seg_badge = f'<span style="background:rgba(255,255,255,0.08);color:{seg_color};padding:4px 12px;border-radius:20px;font-size:0.76em;font-weight:600;">{seg_label}</span>' if seg_label else ''

    # ML confidence
    ml_conf = match.get("ml_confidence_display", match.get("ml_confidence", 0.5))
    ml_pct = int(float(ml_conf) * 100) if _is_num(ml_conf) else 50

    # Top signal
    bd = match.get("breakdown", {})
    top_signal = ""
    if bd:
        top_sig = max(bd.items(), key=lambda x: x[1].get("contribution", 0))
        top_signal = top_sig[0].replace("_", " ").title()

    with st.container():
        # ── Main Card ────────────────────────────────────────────────
        card_html = f"""<div style="border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:0;margin:8px 0;
background:rgba(255,255,255,0.03);box-shadow:0 4px 20px rgba(0,0,0,0.2);overflow:hidden;">

<div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:22px 26px 18px;position:relative;">
<div style="position:absolute;top:16px;right:20px;background:{badge_bg};color:white;
padding:8px 18px;border-radius:22px;font-size:0.9em;font-weight:700;
box-shadow:0 2px 8px rgba(0,0,0,0.2);">
{score:.0f}% · {score_label}
</div>
<h2 style="margin:0;color:#f1f5f9;font-size:1.3em;font-weight:700;">{buyer_name}</h2>
<p style="color:#94a3b8;margin:5px 0 0;font-size:0.88em;">
🏭 {industry} &nbsp;&nbsp; 📍 {country}
</p>
<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
{news_badge} {intent_badge} {seg_badge}
</div>
</div>

<div style="padding:20px 26px 24px;">
<div style="display:flex;gap:12px;margin-bottom:16px;">
<div style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);padding:14px 16px;border-radius:12px;">
<div style="font-size:0.75em;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Preferred Channel</div>
<div style="font-weight:700;color:#f1f5f9;margin-top:3px;">{details.get('preferred_channel','Email')}</div>
</div>
<div style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);padding:14px 16px;border-radius:12px;">
<div style="font-size:0.75em;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Top Signal</div>
<div style="font-weight:700;color:#0ea5e9;margin-top:3px;">{top_signal}</div>
</div>
<div style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);padding:14px 16px;border-radius:12px;">
<div style="font-size:0.75em;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">ML Confidence</div>
<div style="font-weight:700;color:#8b5cf6;margin-top:3px;">{ml_pct}%</div>
</div>
</div>

<div style="display:flex;gap:12px;">
<div style="flex:1;background:linear-gradient(135deg,#0f172a,#1e293b);color:white;padding:16px;border-radius:12px;">
<div style="font-size:0.73em;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Team Size</div>
<div style="font-size:1.35em;font-weight:800;color:#f1f5f9;margin-top:2px;">{team_str}</div>
</div>
<div style="flex:1;background:linear-gradient(135deg,#0f172a,#1e293b);color:white;padding:16px;border-radius:12px;">
<div style="font-size:0.73em;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Est. Revenue</div>
<div style="font-size:1.35em;font-weight:800;color:#f1f5f9;margin-top:2px;">{rev_str}</div>
</div>
</div>
</div>
</div>"""
        st.markdown(card_html, unsafe_allow_html=True)

        # ── View Full Details (expandable) ───────────────────────────
        with st.expander("ℹ️ View Full Details"):
            # Explanation
            st.write(match.get("explanation", ""))
            st.markdown("---")

            # Score breakdown
            if match.get("breakdown"):
                st.markdown("**Score Breakdown:**")
                for signal, data in match["breakdown"].items():
                    signal_name = signal.replace("_", " ").title()
                    st.progress(data["raw"], text=f"{signal_name}: {data['contribution']:.1f}%")

            st.markdown("---")

            # Importer details grid
            c1, c2, c3 = st.columns(3)
            with c1:
                st.markdown(f"**Industry**  \n{details.get('industry', '—')}")
                ch = details.get("preferred_channel", "—")
                st.markdown(f"**Preferred contact**  \n{ch}")
                pr = details.get("prompt_response")
                pr_txt = f"{int(100 * float(pr))}%" if _is_num(pr) else "—"
                st.markdown(f"**Response rate**  \n{pr_txt}")
            with c2:
                intent = details.get("intent_score")
                intent_txt = f"{int(100 * float(intent))}%" if _is_num(intent) else "—"
                st.markdown(f"**Intent score**  \n{intent_txt}")
                avg_t = details.get("avg_order_tons")
                avg_txt = f"{float(avg_t):,.0f} t" if _is_num(avg_t) else "—"
                st.markdown(f"**Avg order**  \n{avg_txt}")
                st.markdown(f"**Revenue (USD)**  \n{rev_str}")
            with c3:
                gp = details.get("good_payment")
                st.markdown(f"**Payment history**  \n{'✅ Good' if gp == 1 else '❌ Poor' if gp == 0 else '—'}")
                es = details.get("engagement_spike")
                st.markdown(f"**Engagement spike**  \n{'🔥 Yes' if es == 1 else 'No' if es == 0 else '—'}")
                dm = details.get("decision_maker_change")
                st.markdown(f"**Decision-maker change**  \n{'⚡ Yes' if dm == 1 else 'No' if dm == 0 else '—'}")

            # News intelligence
            nf = match.get("news_flags") or {}
            risks = nf.get("risk", [])
            opps  = nf.get("opportunity", [])
            if risks or opps:
                st.markdown("---")
                st.markdown("**📰 Market Intelligence**")
                for o in (opps or []):
                    st.markdown(f"🟢 {o}")
                for r in (risks or []):
                    st.markdown(f"🔴 {r}")

        # ── 3 Action Buttons: Reject / Skip / Approve ───────────────
        col1, col2, col3 = st.columns(3)
        with col1:
            if st.button("✖ Reject", key=f"reject_{match['buyer_id']}",
                          width="stretch", type="secondary"):
                return "left"
        with col2:
            if st.button("⏭ Skip", key=f"skip_{match['buyer_id']}",
                          width="stretch", type="secondary"):
                return "skip"  # neutral — advance without penalising
        with col3:
            if st.button("✔ Approve", key=f"approve_{match['buyer_id']}",
                          type="primary", width="stretch"):
                return "right"
    
    return None


def render_swipe_interface(matches: List[dict]) -> None:
    """
    Render the full swipe interface with navigation.
    
    Uses st.session_state to track:
        - current_card_index: which match card is shown
        - swipe_history: list of {buyer_id, direction} for feedback
        - connected_buyers: list of buyer_ids the user swiped right on
    """
    from engine.scorer import update_weights_from_swipe
    
    # Initialize session state
    if "card_index" not in st.session_state:
        st.session_state.card_index = 0
    if "swipe_history" not in st.session_state:
        st.session_state.swipe_history = []
    if "connected" not in st.session_state:
        st.session_state.connected = []
    
    if not matches:
        st.warning("No matches found for this exporter. Try adjusting the scoring weights or selecting a different exporter.")
        return
    
    # Show current match
    if st.session_state.card_index < len(matches):
        current = matches[st.session_state.card_index]
        action = render_swipe_card(current)
        
        if action == "right":
            st.session_state.connected.append(current)
            st.session_state.swipe_history.append({
                "buyer_id": current["buyer_id"],
                "direction": "right"
            })
            update_weights_from_swipe(current, "right")
            st.session_state.card_index += 1
            st.rerun()
        elif action == "left":
            st.session_state.swipe_history.append({
                "buyer_id": current["buyer_id"],
                "direction": "left"
            })
            update_weights_from_swipe(current, "left")
            st.session_state.card_index += 1
            st.rerun()
        elif action == "skip":
            # Neutral skip — advance card without adjusting weights
            st.session_state.swipe_history.append({
                "buyer_id": current["buyer_id"],
                "direction": "skip"
            })
            st.session_state.card_index += 1
            st.rerun()
        
        # Show progress
        reviewed = min(st.session_state.card_index + 1, len(matches))
        total = len(matches)
        progress = reviewed / total
        st.markdown(f"""<div style="text-align:center;font-size:0.88em;color:#6b7280;margin-top:8px;">
{reviewed} of {total} leads reviewed
</div>""", unsafe_allow_html=True)
        st.progress(progress)
    else:
        st.success("🎉 You've reviewed all matches!")
        st.write(f"✅ Approved {len(st.session_state.connected)} buyers")
        st.write(f"Go to **Approved Leads** to manage your pipeline, or **Conversations** to see AI outreach.")
        
        if st.button("🔄 Review Again"):
            st.session_state.card_index = 0
            st.rerun()


def inject_card_css() -> None:
    """Card-specific CSS for the swipe buttons."""
    st.markdown("""
<style>
/* Reject button — red outline with hover fill */
div[data-testid="stHorizontalBlock"] > div:first-child .stButton > button {
    border: 2px solid #ef4444 !important;
    color: #ef4444 !important;
    background: transparent !important;
    font-weight: 700 !important;
    border-radius: 12px !important;
    transition: all 0.2s !important;
}
div[data-testid="stHorizontalBlock"] > div:first-child .stButton > button:hover {
    background: #ef4444 !important;
    color: white !important;
}
/* Approve button — green gradient */
div[data-testid="stHorizontalBlock"] > div:last-child .stButton > button[kind="primary"],
div[data-testid="stHorizontalBlock"] > div:last-child .stButton > button {
    background: linear-gradient(135deg, #22c55e, #16a34a) !important;
    border-color: #22c55e !important;
    color: white !important;
    font-weight: 700 !important;
    border-radius: 12px !important;
    box-shadow: 0 2px 8px rgba(34,197,94,0.3) !important;
    transition: all 0.2s !important;
}
div[data-testid="stHorizontalBlock"] > div:last-child .stButton > button:hover {
    box-shadow: 0 4px 16px rgba(34,197,94,0.4) !important;
    transform: translateY(-1px);
}
/* Skip button — neutral with hover */
div[data-testid="stHorizontalBlock"] > div:nth-child(2) .stButton > button {
    border: 1px solid rgba(255,255,255,0.15) !important;
    color: #94a3b8 !important;
    background: transparent !important;
    border-radius: 12px !important;
    transition: all 0.2s !important;
}
div[data-testid="stHorizontalBlock"] > div:nth-child(2) .stButton > button:hover {
    background: rgba(255,255,255,0.08) !important;
    color: #e2e8f0 !important;
}
</style>
""", unsafe_allow_html=True)
