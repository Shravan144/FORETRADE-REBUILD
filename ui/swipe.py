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
=============================================================================
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
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

    # Buyer Readiness badge (hiring + funding + response prob)
    hiring = details.get("hiring_growth", 0) or 0
    funding = details.get("funding_event", 0) or 0
    resp_prob = details.get("response_probability")
    readiness_signals = int(bool(hiring)) + int(bool(funding)) + (1 if _is_num(resp_prob) and float(resp_prob) > 0.6 else 0)
    if readiness_signals >= 2:
        readiness_badge = '<span style="background:rgba(34,197,94,0.12);color:#16a34a;padding:4px 12px;border-radius:20px;font-size:0.76em;font-weight:600;">🚀 Growth Ready</span>'
    else:
        readiness_badge = ''

    # Geo Risk badge (tariff + stock shock + war + calamity)
    tariff = int(details.get("tariff_news", 0) or 0)
    shock = int(details.get("stockmarket_shock", 0) or 0)
    war = int(details.get("war_event", 0) or 0)
    calamity = int(details.get("natural_calamity", 0) or 0)
    risk_count = tariff + shock + war + calamity
    if risk_count >= 3:
        risk_badge = '<span style="background:rgba(239,68,68,0.12);color:#dc2626;padding:4px 12px;border-radius:20px;font-size:0.76em;font-weight:600;">⚠️ High Risk</span>'
    elif risk_count >= 1:
        risk_badge = '<span style="background:rgba(245,158,11,0.1);color:#d97706;padding:4px 12px;border-radius:20px;font-size:0.76em;font-weight:600;">⚡ Moderate Risk</span>'
    else:
        risk_badge = '<span style="background:rgba(34,197,94,0.08);color:#16a34a;padding:4px 12px;border-radius:20px;font-size:0.76em;font-weight:600;">✅ Low Risk</span>'

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
{news_badge} {intent_badge} {seg_badge} {readiness_badge} {risk_badge}
</div>
</div>

<div style="padding:20px 26px 24px;">
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
            # Explanation text
            explanation = match.get("explanation", "")
            if explanation:
                st.write(explanation)
                st.markdown("---")

            # Score contribution breakdown
            if match.get("breakdown"):
                st.markdown("**Score Breakdown:**")
                for signal, data in match["breakdown"].items():
                    signal_name = signal.replace("_", " ").title()
                    raw = data.get("raw", 0)
                    contrib = data.get("contribution", 0)
                    st.progress(min(raw, 1.0), text=f"{signal_name}: {contrib:.1f}%")

            # EXIM Risk & Readiness panel
            st.markdown("---")
            r_col1, r_col2 = st.columns(2)
            with r_col1:
                st.markdown("**Buyer Readiness**")
                _h = "✅" if hiring else "—"
                _f = "✅" if funding else "—"
                _r = f"{float(resp_prob):.0%}" if _is_num(resp_prob) else "N/A"
                st.markdown(f"Hiring Growth: {_h}  \nFunding Event: {_f}  \nResponse Prob: {_r}")
            with r_col2:
                st.markdown("**Geo Risk Flags**")
                _flags = []
                if tariff: _flags.append("📋 Tariff Change")
                if shock:  _flags.append("📉 Stock Shock")
                if war:    _flags.append("⚔️ Conflict")
                if calamity: _flags.append("🌊 Natural Calamity")
                fx = details.get("currency_fluctuation", 0)
                if _is_num(fx) and abs(float(fx)) > 0.3:
                    _flags.append(f"💱 FX Shift ({float(fx):+.0%})")
                st.markdown("  \n".join(_flags) if _flags else "✅ No risk flags")

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


def _render_risk_panel(alerts: list, modifier: float, original_score: float, adjusted_score: float) -> None:
    """Render the Global Risk Assessment panel from NewsEngine alerts."""
    # Modifier badge colour
    if modifier >= 1.1:
        mod_bg = "rgba(34,197,94,0.12)"; mod_clr = "#16a34a"; mod_label = "Boosted"
    elif modifier <= 0.9:
        mod_bg = "rgba(239,68,68,0.1)"; mod_clr = "#dc2626"; mod_label = "Risk Adjusted"
    else:
        mod_bg = "rgba(245,158,11,0.1)"; mod_clr = "#d97706"; mod_label = "Neutral"

    delta = adjusted_score - original_score
    delta_sign = "+" if delta >= 0 else ""

    st.markdown(f"""<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);
    border-radius:14px;padding:16px 20px;margin:8px 0;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-weight:700;font-size:0.95em;color:#f1f5f9;">🌐 Global Risk Assessment</div>
        <div style="display:flex;gap:8px;align-items:center;">
            <span style="background:{mod_bg};color:{mod_clr};padding:4px 12px;border-radius:20px;font-size:0.76em;font-weight:600;">
                {modifier:.2f}x · {mod_label}
            </span>
            <span style="font-size:0.82em;color:#94a3b8;">
                {original_score:.0f}% → <strong style="color:{mod_clr};">{adjusted_score:.1f}%</strong>
                ({delta_sign}{delta:.1f})
            </span>
        </div>
    </div>""", unsafe_allow_html=True)

    for a in alerts:
        a_type = a.get("type", "info")
        if a_type == "error":
            bg = "rgba(239,68,68,0.08)"; border = "rgba(239,68,68,0.25)"; clr = "#fca5a5"
        elif a_type == "warning":
            bg = "rgba(245,158,11,0.08)"; border = "rgba(245,158,11,0.25)"; clr = "#fde68a"
        else:
            bg = "rgba(34,197,94,0.08)"; border = "rgba(34,197,94,0.25)"; clr = "#86efac"
        st.markdown(f"""<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
        background:{bg};border:1px solid {border};border-radius:10px;margin:4px 0;">
        <span style="font-size:1.2em;">{a.get('icon','ℹ️')}</span>
        <div style="flex:1;">
            <div style="font-weight:600;font-size:0.85em;color:{clr};">{a.get('message','')}</div>
            <div style="font-size:0.75em;color:#94a3b8;">{a.get('impact','')}</div>
        </div>
        </div>""", unsafe_allow_html=True)

    st.markdown("</div>", unsafe_allow_html=True)


def render_simulation_widget(matches: List[dict], news_engine) -> None:
    """
    Live event simulation widget — lets users pick a hypothetical global
    event and see how it shifts match scores in real-time.
    """
    st.markdown("""<div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);
    border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:20px 24px;margin:16px 0;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
        <span style="font-size:1.3em;">🧪</span>
        <span style="font-weight:700;font-size:1.05em;color:#f1f5f9;">Live Event Simulation</span>
    </div>
    <div style="font-size:0.82em;color:#94a3b8;margin-bottom:12px;">
        What happens to your leads if a global event strikes? Pick an event and industry to simulate.
    </div>
    </div>""", unsafe_allow_html=True)

    if not matches:
        st.info("No matches to simulate. Score some leads first.")
        return

    # Build matches DataFrame for simulation
    sim_rows = []
    for m in matches:
        details = m.get("importer_details") or {}
        sim_rows.append({
            "buyer_name": m.get("buyer_name", "Unknown"),
            "buyer_country": m.get("buyer_country", ""),
            "Industry": details.get("industry", "Trade"),
            "score": m.get("score", 0),
        })
    sim_df = pd.DataFrame(sim_rows)

    # Controls
    ev_col, ind_col = st.columns(2)
    event_types = ["War Alert", "Trade Agreement", "Tariff Hike",
                   "Tariff Reduction", "Natural Calamity", "Stock Crash"]
    industries = sorted(sim_df["Industry"].unique().tolist())

    with ev_col:
        event = st.selectbox("📌 Event Type", event_types, key="sim_event")
    with ind_col:
        industry = st.selectbox("🏭 Affected Industry", industries, key="sim_industry")

    if st.button("⚡ Simulate Impact", type="primary", key="sim_btn"):
        result = news_engine.simulate_event(sim_df, event, industry)
        affected = result[result["score_change"] != 0]
        unaffected = result[result["score_change"] == 0]

        # KPI row
        k1, k2, k3, k4 = st.columns(4)
        n_affected = len(affected)
        avg_change = affected["score_change"].mean() if n_affected > 0 else 0
        worst = affected["score_change"].min() if n_affected > 0 else 0
        best = affected["score_change"].max() if n_affected > 0 else 0

        kdata = [
            ("Leads Affected", str(n_affected), f"of {len(result)} total", "#0ea5e9"),
            ("Avg Score Change", f"{'+' if avg_change >= 0 else ''}{avg_change:.1f}", event, "#f59e0b"),
            ("Worst Impact", f"{worst:.1f}", "Single lead", "#ef4444"),
            ("Best Impact", f"{'+' if best >= 0 else ''}{best:.1f}", "Single lead", "#22c55e"),
        ]
        for col, (lbl, val, sub, clr) in zip([k1, k2, k3, k4], kdata):
            col.markdown(f"""<div style="background:rgba(255,255,255,0.05);border-left:4px solid {clr};
            border-radius:10px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.15);">
            <div style="font-size:.75em;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">{lbl}</div>
            <div style="font-size:1.4em;font-weight:800;color:#f1f5f9;">{val}</div>
            <div style="font-size:.72em;color:#64748b;">{sub}</div>
            </div>""", unsafe_allow_html=True)

        st.markdown("")

        # Before / After chart
        if n_affected > 0:
            chart_df = affected.head(15).copy()
            fig = go.Figure()
            fig.add_trace(go.Bar(
                name="Original Score", x=chart_df["buyer_name"],
                y=chart_df["score"], marker_color="#334155", opacity=0.7,
            ))
            fig.add_trace(go.Bar(
                name="Simulated Score", x=chart_df["buyer_name"],
                y=chart_df["simulated_score"],
                marker_color=["#22c55e" if c >= 0 else "#ef4444" for c in chart_df["score_change"]],
                opacity=0.85,
            ))
            fig.update_layout(
                barmode="group", height=340,
                margin=dict(t=10, b=30, l=40, r=10),
                plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
                xaxis=dict(gridcolor="rgba(255,255,255,0.08)"),
                yaxis=dict(gridcolor="rgba(255,255,255,0.08)", title="Match Score"),
                legend=dict(orientation="h", y=-0.2, font=dict(size=10)),
            )
            fig.update_xaxes(tickangle=20)
            st.plotly_chart(fig, use_container_width=True)

            # Detailed table
            with st.expander(f"📋 Full simulation results ({len(result)} leads)"):
                display_df = result[["buyer_name", "buyer_country", "Industry", "score",
                                     "simulated_score", "score_change"]].copy()
                display_df.columns = ["Buyer", "Country", "Industry", "Original", "Simulated", "Change"]
                st.dataframe(display_df.style.applymap(
                    lambda v: "color: #22c55e" if isinstance(v, (int, float)) and v > 0
                              else "color: #ef4444" if isinstance(v, (int, float)) and v < 0
                              else "", subset=["Change"]
                ), use_container_width=True, hide_index=True)
        else:
            st.info(f"No leads in **{industry}** — try a different industry.")


def render_swipe_interface(matches: List[dict], exporter_id: Optional[str] = None) -> None:
    """
    Render the full swipe interface with navigation.
    When DB is available and user is logged in via DB, swipes and approved leads are persisted.
    """
    from engine.scorer import update_weights_from_swipe

    # Optional: persist to DB when user has user_id (logged in via DB)
    def _persist_swipe(direction: str, current: dict) -> None:
        uid = st.session_state.get("user_id")
        if not uid or not exporter_id:
            return
        try:
            from db import save_swipe, save_approved_lead
            save_swipe(
                user_id=uid,
                exporter_id=exporter_id,
                buyer_id=current["buyer_id"],
                direction=direction,
                match_score=current.get("score"),
                breakdown=current.get("breakdown"),
            )
            if direction == "right":
                # Include buyer_name and buyer_country so we can restore session from DB on next login
                buyer_details = dict(current.get("importer_details") or {})
                buyer_details["buyer_name"] = current.get("buyer_name", "")
                buyer_details["buyer_country"] = current.get("buyer_country", "")
                lead = save_approved_lead(
                    user_id=uid,
                    exporter_id=exporter_id,
                    buyer_id=current["buyer_id"],
                    buyer_details=buyer_details,
                    match_analysis={"score": current.get("score"), "breakdown": current.get("breakdown")},
                    pipeline_status="pending",
                )
                current["lead_id"] = lead["id"]
        except Exception:
            pass  # don't crash app if DB fails

    # Initialize session state
    if "card_index" not in st.session_state:
        st.session_state.card_index = 0
    if "swipe_history" not in st.session_state:
        st.session_state.swipe_history = []
    if "connected" not in st.session_state:
        st.session_state.connected = []
    if "matches_to_show" not in st.session_state:
        st.session_state.matches_to_show = 10  # Start with 10, can load more

    if not matches:
        st.warning("No matches found for this exporter. Try adjusting the scoring weights or selecting a different exporter.")
        return

    # Limit matches based on user preference
    visible_matches = matches[:st.session_state.matches_to_show]

    # Show current match
    if st.session_state.card_index < len(visible_matches):
        current = visible_matches[st.session_state.card_index]
        action = render_swipe_card(current)

        if action == "right":
            _persist_swipe("right", current)
            lead_item = dict(current)
            lead_item["exporter_id"] = lead_item.get("_exporter_id") or exporter_id
            # Avoid duplicates in session state
            existing_ids = {c.get("buyer_id") for c in st.session_state.connected}
            if lead_item["buyer_id"] not in existing_ids:
                st.session_state.connected.append(lead_item)
            st.session_state.swipe_history.append({
                "buyer_id": current["buyer_id"],
                "direction": "right"
            })
            update_weights_from_swipe(current, "right")
            st.session_state.card_index += 1
            st.rerun()
        elif action == "left":
            _persist_swipe("left", current)
            st.session_state.swipe_history.append({
                "buyer_id": current["buyer_id"],
                "direction": "left"
            })
            update_weights_from_swipe(current, "left")
            st.session_state.card_index += 1
            st.rerun()
        elif action == "skip":
            _persist_swipe("skip", current)
            st.session_state.swipe_history.append({
                "buyer_id": current["buyer_id"],
                "direction": "skip"
            })
            st.session_state.card_index += 1
            st.rerun()
        
        # Show progress
        reviewed = min(st.session_state.card_index + 1, len(visible_matches))
        total = len(visible_matches)
        progress = reviewed / total
        st.markdown(f"""<div style="text-align:center;font-size:0.88em;color:#6b7280;margin-top:8px;">
{reviewed} of {total} leads reviewed
</div>""", unsafe_allow_html=True)
        st.progress(progress)
    else:
        # Finished current batch
        st.success(f"🎉 You've reviewed all {len(visible_matches)} matches!")
        st.write(f"✅ Approved {len(st.session_state.connected)} buyers")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("🔄 Review Again", use_container_width=True):
                st.session_state.card_index = 0
                st.rerun()
        with col2:
            # Show Load More if there are more matches available
            if st.session_state.matches_to_show < len(matches):
                remaining = len(matches) - st.session_state.matches_to_show
                if st.button(f"➕ Load More ({remaining} remaining)", type="primary", use_container_width=True):
                    st.session_state.matches_to_show += 10  # Load 10 more
                    st.rerun()
            else:
                st.info("No more matches available. Try adjusting weights for different results.")


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
