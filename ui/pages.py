"""
=============================================================================
PAGES MODULE — ForeTrade  (v3 — 100 % data-driven, custom UI)
=============================================================================
Every number on screen comes from engine/metrics.py or session state.
Zero hardcoded percentages.
=============================================================================
"""

import streamlit as st
import os
import pandas as pd
from datetime import datetime
from engine.metrics import (
    compute_session_metrics,
    compute_channel_metrics,
    compute_segment_metrics,
    compute_news_metrics,
    compute_signal_metrics,
    compute_pipeline_state,
    generate_conversation,
)
from engine.llm import get_llm_reply


# ═══════════════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def _kpi(label, value, sub="", accent="#0ea5e9"):
    """Minimal KPI card — accent left border, dark-theme aware."""
    return f"""<div style="background:rgba(255,255,255,0.05);border-left:4px solid {accent};border-radius:10px;padding:18px 20px;box-shadow:0 1px 4px rgba(0,0,0,.15);min-height:100px;">
<div style="font-size:.78em;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:6px;">{label}</div>
<div style="font-size:1.8em;font-weight:800;color:#f1f5f9;line-height:1.1;">{value}</div>
<div style="font-size:.78em;color:#64748b;margin-top:4px;">{sub}</div>
</div>"""


def _status_pill(status):
    colors = {
        "New":              ("rgba(14,165,233,0.15)", "#38bdf8"),
        "Contacted":        ("rgba(234,179,8,0.15)", "#facc15"),
        "Responded":        ("rgba(34,197,94,0.15)", "#4ade80"),
        "Meeting Scheduled":("rgba(99,102,241,0.15)", "#818cf8"),
    }
    bg, fg = colors.get(status, ("rgba(255,255,255,0.1)", "#94a3b8"))
    return f'<span style="background:{bg};color:{fg};padding:3px 12px;border-radius:20px;font-size:.8em;font-weight:600;">{status}</span>'


def _progress_ring(pct, color="#0ea5e9", size=56):
    """SVG ring chart for percentage."""
    r = size // 2 - 5
    circ = 2 * 3.14159 * r
    offset = circ * (1 - pct / 100)
    return f'''<svg width="{size}" height="{size}" style="vertical-align:middle;">
<circle cx="{size//2}" cy="{size//2}" r="{r}" fill="none" stroke="#e2e8f0" stroke-width="5"/>
<circle cx="{size//2}" cy="{size//2}" r="{r}" fill="none" stroke="{color}" stroke-width="5"
 stroke-dasharray="{circ}" stroke-dashoffset="{offset}" stroke-linecap="round"
 transform="rotate(-90 {size//2} {size//2})"/>
<text x="50%" y="54%" text-anchor="middle" font-size="12" font-weight="700" fill="{color}">{pct:.0f}%</text>
</svg>'''


# ═══════════════════════════════════════════════════════════════════════════
#  1.  DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════

def render_dashboard_page(matches, connected, swipe_history):
    sm = compute_session_metrics(matches, connected, swipe_history)
    ch = compute_channel_metrics(matches)
    seg = compute_segment_metrics(matches, connected)
    news = compute_news_metrics(matches)

    # ── Hero KPIs ─────────────────────────────────────────────
    st.markdown("## Dashboard")
    st.caption("Real-time intelligence from the 9-signal scoring engine")

    cols = st.columns(4)
    kpis = [
        ("AI-Matched Leads", str(sm["total_leads"]), f'{sm["high_quality"]} high-quality (≥70)', "#0ea5e9"),
        ("Approval Rate", f'{sm["approval_rate"]}%', f'{sm["approved"]} of {sm["reviewed"]} reviewed', "#22c55e"),
        ("Avg Match Score", f'{sm["avg_score"]}', f'Approved avg: {sm["avg_approved_score"]}', "#8b5cf6"),
        ("Pending Review", str(sm["pending"]), f'{sm["reviewed"]} already reviewed', "#f59e0b"),
    ]
    for col, (lbl, val, sub, clr) in zip(cols, kpis):
        col.markdown(_kpi(lbl, val, sub, clr), unsafe_allow_html=True)

    st.markdown("")

    # ── Pipeline + Activity ───────────────────────────────────
    left, right = st.columns([3, 2])

    with left:
        st.markdown("#### Pipeline Funnel")
        stages = [
            ("Scored Leads", sm["total_leads"], "#0ea5e9"),
            ("Approved", sm["approved"], "#22c55e"),
            ("High Intent", len([b for b in connected if (b.get("importer_details") or {}).get("intent_score", 0) > 0.6]), "#8b5cf6"),
            ("Engaged (Prompt Resp > 50%)", len([b for b in connected if (b.get("importer_details") or {}).get("prompt_response", 0) > 0.5]), "#f59e0b"),
        ]
        max_v = max(sm["total_leads"], 1)
        for stage_name, val, color in stages:
            pct = min(val / max_v, 1.0) * 100
            st.markdown(f"""<div style="display:flex;align-items:center;margin:8px 0;">
<div style="width:200px;font-size:.85em;font-weight:600;color:#cbd5e1;">{stage_name}</div>
<div style="flex:1;background:rgba(255,255,255,0.08);border-radius:6px;height:22px;overflow:hidden;position:relative;">
<div style="width:{pct:.0f}%;background:{color};height:100%;border-radius:6px;transition:width .4s;"></div>
<span style="position:absolute;right:8px;top:2px;font-size:.75em;font-weight:700;color:#e2e8f0;">{val}</span>
</div>
</div>""", unsafe_allow_html=True)

        # ── Channel Distribution (REAL) ───────────────────────
        st.markdown("")
        st.markdown("#### Preferred Channels")
        if ch:
            ch_cols = st.columns(len(ch))
            for col, c in zip(ch_cols, ch):
                col.markdown(f"""<div style="text-align:center;padding:12px 4px;">
{_progress_ring(c['pct'], c['color'])}
<div style="font-weight:700;font-size:.9em;color:#e2e8f0;margin-top:6px;">{c['icon']} {c['name']}</div>
<div style="font-size:.75em;color:#94a3b8;">{c['count']} leads ({c['pct']}%)</div>
</div>""", unsafe_allow_html=True)
        else:
            st.info("Run scoring to see channel distribution")

    with right:
        st.markdown("#### Activity Feed")
        if connected:
            for i, buyer in enumerate(reversed(connected[-6:])):
                bname = buyer.get("buyer_name", "Unknown")
                score_val = buyer.get("score", 0)
                details = buyer.get("importer_details") or {}
                ch_name = details.get("preferred_channel", "Email")
                intent_val = details.get("intent_score", 0)
                icon = "🟢" if intent_val > 0.6 else "🔵" if intent_val > 0.3 else "⚪"
                st.markdown(f"""<div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
<div style="font-size:1.2em;margin-right:10px;">{icon}</div>
<div style="flex:1;">
<div style="font-weight:600;font-size:.88em;color:#f1f5f9;">{bname}</div>
<div style="font-size:.78em;color:#94a3b8;">Score {score_val:.0f}% · {ch_name} · Intent {intent_val*100:.0f}%</div>
</div>
</div>""", unsafe_allow_html=True)
        else:
            st.markdown("""<div style="padding:24px;text-align:center;color:#94a3b8;">
<div style="font-size:2em;margin-bottom:8px;">🎯</div>
<div style="font-weight:600;">No leads approved yet</div>
<div style="font-size:.85em;">Go to <strong>Approve Leads</strong> to start swiping</div>
</div>""", unsafe_allow_html=True)

    # ── Market Conditions (REAL from news engine) ─────────────
    if sm["total_leads"] > 0:
        st.markdown("")
        st.markdown("#### Market Intelligence")
        n_cols = st.columns(4)
        n_data = [
            ("Avg Sentiment", f'{news["avg_sentiment"]:.2f}', news["sentiment_label"],
             "#22c55e" if news["avg_sentiment"] >= 0.6 else "#ef4444" if news["avg_sentiment"] <= 0.4 else "#f59e0b"),
            ("Favourable Markets", str(news["favourable_markets"]), "Sentiment ≥ 0.6", "#22c55e"),
            ("Risk Markets", str(news["risky_markets"]), "Sentiment ≤ 0.4", "#ef4444"),
            ("Opportunity Flags", str(news["total_opp_flags"]), f'{news["total_risk_flags"]} risk flags', "#0ea5e9"),
        ]
        for col, (lbl, val, sub, clr) in zip(n_cols, n_data):
            col.markdown(_kpi(lbl, val, sub, clr), unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════
#  2.  APPROVED LEADS
# ═══════════════════════════════════════════════════════════════════════════

def render_approved_leads_page(connected):
    st.markdown("## Approved Leads")
    st.caption("Pipeline tracking for your approved matches — statuses derived from buyer signals")

    if not connected:
        st.info("No approved leads yet. Head to **Approve Leads** to start swiping.")
        return

    # Compute real pipeline state
    pipeline = compute_pipeline_state(connected)

    # Status counts
    from collections import Counter
    status_cts = Counter(p["_status"] for p in pipeline)
    total = len(pipeline)

    cols = st.columns(5)
    s_data = [
        ("Total", total, "#0ea5e9"), ("New", status_cts.get("New", 0), "#64748b"),
        ("Contacted", status_cts.get("Contacted", 0), "#f59e0b"),
        ("Responded", status_cts.get("Responded", 0), "#22c55e"),
        ("Meetings", status_cts.get("Meeting Scheduled", 0), "#8b5cf6"),
    ]
    for col, (lbl, val, clr) in zip(cols, s_data):
        col.markdown(_kpi(lbl, str(val), "", clr), unsafe_allow_html=True)

    st.markdown("")

    # Search + filter
    fc1, fc2, fc3 = st.columns([5, 2, 2])
    search_q = fc1.text_input("🔍", placeholder="Search by company, country, industry...", label_visibility="collapsed")
    statuses = ["All"] + list(status_cts.keys())
    status_filter = fc2.selectbox("Filter", statuses, label_visibility="collapsed")
    sort_by = fc3.selectbox("Sort", ["Score (High → Low)", "Intent (High → Low)", "Status"], label_visibility="collapsed")

    filtered = pipeline
    if search_q:
        q = search_q.lower()
        filtered = [l for l in filtered if q in l.get("buyer_name", "").lower()
                    or q in l.get("buyer_country", "").lower()
                    or q in ((l.get("importer_details") or {}).get("industry", "")).lower()]
    if status_filter != "All":
        filtered = [l for l in filtered if l["_status"] == status_filter]
    if sort_by == "Score (High → Low)":
        filtered = sorted(filtered, key=lambda x: x.get("score", 0), reverse=True)
    elif sort_by == "Intent (High → Low)":
        filtered = sorted(filtered, key=lambda x: x.get("_intent", 0), reverse=True)

    # Lead cards
    for lead in filtered:
        score = lead.get("score", 0)
        name = lead.get("buyer_name", "Unknown")
        country = lead.get("buyer_country", "")
        details = lead.get("importer_details") or {}
        industry = details.get("industry", "—")
        intent = lead.get("_intent", 0)
        pr = lead.get("_prompt_response", 0)
        channel = lead.get("_channel", "Email")

        st.markdown(f"""<div style="display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
<div style="flex:1;">
<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
<span style="font-weight:700;color:#f1f5f9;">{name}</span>
{_status_pill(lead['_status'])}
<span style="color:#0ea5e9;font-size:.82em;font-weight:600;">{score:.0f}% match</span>
</div>
<div style="font-size:.82em;color:#94a3b8;margin-top:3px;">
📍 {country} · 🏭 {industry} · {channel}
· Intent: {intent*100:.0f}% · Response: {pr*100:.0f}%
</div>
</div>
<div style="display:flex;gap:6px;font-size:1.1em;">
<span title="Call" style="cursor:pointer;">📞</span>
<span title="Email" style="cursor:pointer;">📧</span>
<span title="Chat" style="cursor:pointer;">💬</span>
</div>
</div>""", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════
#  3.  CONVERSATIONS  (Interactive AI Chat — Gemini-powered)
# ═══════════════════════════════════════════════════════════════════════════

def _render_chat_bubble(msg, channel="Email"):
    """Render a single chat message bubble."""
    role = msg.get("role", "ai")
    text = msg.get("text", "")
    time_str = msg.get("time", "")
    source = msg.get("source", "")

    if role in ("ai", "assistant"):
        source_badge = ""
        if source == "gemini":
            source_badge = ' · <span style="color:#a78bfa;">✨ Gemini</span>'
        elif source == "smart-template":
            source_badge = ' · <span style="color:#fb923c;">⚡ Smart AI</span>'
        st.markdown(f"""<div style="display:flex;justify-content:flex-end;margin:10px 0;">
<div style="max-width:72%;background:linear-gradient(135deg,#0f172a,#1e293b);color:#f8fafc;padding:14px 18px;border-radius:16px 16px 4px 16px;font-size:.9em;line-height:1.55;">
{text}
<div style="font-size:.72em;color:#94a3b8;margin-top:5px;">{time_str} · via {msg.get('channel', channel)}{source_badge}</div>
</div>
</div>""", unsafe_allow_html=True)
    elif role == "user":
        st.markdown(f"""<div style="display:flex;justify-content:flex-end;margin:10px 0;">
<div style="max-width:72%;background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;padding:14px 18px;border-radius:16px 16px 4px 16px;font-size:.9em;line-height:1.55;">
{text}
<div style="font-size:.72em;color:#bfdbfe;margin-top:5px;">{time_str} · You</div>
</div>
</div>""", unsafe_allow_html=True)
    else:  # buyer
        st.markdown(f"""<div style="display:flex;justify-content:flex-start;margin:10px 0;">
<div style="max-width:72%;background:rgba(255,255,255,0.08);color:#e2e8f0;padding:14px 18px;border-radius:16px 16px 16px 4px;font-size:.9em;line-height:1.55;">
{text}
<div style="font-size:.72em;color:#94a3b8;margin-top:5px;">{time_str}</div>
</div>
</div>""", unsafe_allow_html=True)


def render_conversations_page(connected, exporter_name="Your Company"):
    st.markdown("## 💬 Conversations")
    st.caption("Real-time AI outreach — type to take over or let the AI handle it")

    if not connected:
        st.info("No conversations yet. **Approve leads** to start AI outreach.")
        return

    # Initialize conversation store in session
    if "conversations" not in st.session_state:
        st.session_state["conversations"] = {}

    left_col, right_col = st.columns([1, 2.5])

    if "selected_conversation" not in st.session_state:
        st.session_state["selected_conversation"] = 0

    with left_col:
        st.markdown("""<div style="font-size:.75em;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-bottom:8px;font-weight:600;">Active Chats</div>""", unsafe_allow_html=True)
        for i, buyer in enumerate(connected):
            bname = buyer.get("buyer_name", "Unknown")
            score_val = buyer.get("score", 0)
            details = buyer.get("importer_details") or {}
            channel = details.get("preferred_channel", "Email")
            is_selected = (i == st.session_state["selected_conversation"])

            # Count messages
            buyer_id = buyer.get("buyer_id", f"b_{i}")
            msg_count = len(st.session_state["conversations"].get(buyer_id, []))
            unread = " 🔵" if msg_count == 0 else ""

            if st.button(f"{bname}{unread}", key=f"conv_{i}", use_container_width=True,
                         type="primary" if is_selected else "secondary"):
                st.session_state["selected_conversation"] = i
                st.rerun()

            st.markdown(f"""<div style="font-size:.75em;color:#94a3b8;margin-top:-6px;margin-bottom:10px;padding-left:4px;">
{score_val:.0f}% match · {channel} · {msg_count} msgs
</div>""", unsafe_allow_html=True)

    with right_col:
        idx = st.session_state["selected_conversation"]
        if idx < len(connected):
            sel = connected[idx]
            bname = sel.get("buyer_name", "Unknown")
            bcountry = sel.get("buyer_country", "")
            buyer_id = sel.get("buyer_id", f"b_{idx}")
            details = sel.get("importer_details") or {}
            industry = details.get("industry", "Trade") if details else "Trade"
            channel = details.get("preferred_channel", "Email") if details else "Email"
            score_val = sel.get("score", 0)
            news = sel.get("news_flags") or {}

            # Header with action buttons
            sent_val = news.get("sentiment", 0.5)
            sent_clr = "#22c55e" if sent_val >= 0.6 else "#ef4444" if sent_val <= 0.4 else "#f59e0b"
            sent_lbl = "Favourable" if sent_val >= 0.6 else "Risk" if sent_val <= 0.4 else "Neutral"

            # Generate synthetic contact links
            clean_name = bname.lower().replace(" ", "").replace(".", "")
            fake_email = f"trade@{clean_name[:20]}.com"
            linkedin_url = f"https://www.linkedin.com/search/results/companies/?keywords={bname.replace(' ', '%20')}"
            whatsapp_msg = f"Hi {bname} team, I'm reaching out from {exporter_name} regarding a {industry} export partnership."
            wa_url = f"https://wa.me/?text={whatsapp_msg.replace(' ', '%20')}"
            mailto_url = f"mailto:{fake_email}?subject=Export%20Partnership%20—%20{bname.replace(' ', '%20')}&body={whatsapp_msg.replace(' ', '%20')}"

            st.markdown(f"""<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;margin-bottom:8px;border-bottom:2px solid rgba(255,255,255,0.1);">
<div>
<div style="font-weight:700;font-size:1.15em;color:#f1f5f9;">{bname}</div>
<div style="font-size:.85em;color:#64748b;">{industry} · {bcountry} · {score_val:.0f}% match</div>
</div>
<div style="display:flex;gap:6px;align-items:center;">
<span style="background:{sent_clr}18;color:{sent_clr};padding:3px 10px;border-radius:16px;font-size:.78em;font-weight:600;">Market: {sent_lbl}</span>
<a href="{mailto_url}" target="_blank" style="text-decoration:none;background:#3b82f6;color:white;padding:5px 10px;border-radius:8px;font-size:.75em;font-weight:600;">📧 Email</a>
<a href="{linkedin_url}" target="_blank" style="text-decoration:none;background:#0a66c2;color:white;padding:5px 10px;border-radius:8px;font-size:.75em;font-weight:600;">🔗 LinkedIn</a>
<a href="{wa_url}" target="_blank" style="text-decoration:none;background:#25d366;color:white;padding:5px 10px;border-radius:8px;font-size:.75em;font-weight:600;">💬 WhatsApp</a>
</div>
</div>""", unsafe_allow_html=True)

            # Initialize conversation if needed (AI starter messages)
            if buyer_id not in st.session_state["conversations"]:
                starter = generate_conversation(sel, exporter_name)
                st.session_state["conversations"][buyer_id] = starter

            # Render all messages
            messages = st.session_state["conversations"][buyer_id]
            for msg in messages:
                _render_chat_bubble(msg, channel)

            # LLM status indicator
            has_gemini = bool(os.environ.get("GEMINI_API_KEY", ""))
            engine_label = "🟢 Gemini AI connected" if has_gemini else "🟡 Smart templates (no API key)"
            st.markdown(f"""<div style="background:rgba(245,158,11,0.1);border-left:4px solid #f59e0b;border-radius:8px;padding:10px 16px;margin-top:12px;display:flex;align-items:center;gap:10px;">
<span style="font-size:1.1em;">🤖</span>
<div>
<div style="font-weight:600;font-size:.85em;color:#fbbf24;">AI Outreach Active · {engine_label}</div>
<div style="font-size:.78em;color:#d97706;">Type below to take over the conversation. The AI will generate contextual replies.</div>
</div>
</div>""", unsafe_allow_html=True)

            # ─── Interactive chat input ─────────────────────────────────
            user_input = st.chat_input(
                f"Message {bname}... (AI will reply in context)",
                key=f"chat_input_{buyer_id}",
            )

            if user_input:
                now_str = datetime.now().strftime("%I:%M %p")

                # Add user message
                st.session_state["conversations"][buyer_id].append({
                    "role": "user",
                    "text": user_input,
                    "time": now_str,
                })

                # Get AI reply
                reply_text, source = get_llm_reply(
                    user_input, sel, exporter_name,
                    history=st.session_state["conversations"][buyer_id],
                )

                # Add AI reply
                st.session_state["conversations"][buyer_id].append({
                    "role": "ai",
                    "text": reply_text,
                    "time": now_str,
                    "channel": channel,
                    "source": source,
                })

                st.rerun()


# ═══════════════════════════════════════════════════════════════════════════
#  4.  PROFILE
# ═══════════════════════════════════════════════════════════════════════════

def render_profile_page(exporter_row=None):
    st.markdown("## Profile & Settings")
    st.caption("Manage your account and company information")

    user = st.session_state.get("user", {})
    matches = st.session_state.get("current_matches", [])
    connected = st.session_state.get("connected", [])

    left, right = st.columns([1, 1.5])

    with left:
        initials = f"{user.get('first_name','U')[0]}{user.get('last_name','')[0] if user.get('last_name') else ''}"
        total_leads = len(matches)
        approved_ct = len(connected)

        st.markdown(f"""<div style="text-align:center;padding:28px;background:rgba(255,255,255,0.05);border-radius:14px;border:1px solid rgba(255,255,255,0.1);">
<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#3b82f6);color:white;font-size:1.6em;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">{initials}</div>
<div style="font-weight:700;font-size:1.1em;color:#f1f5f9;">{user.get('first_name','')} {user.get('last_name','')}</div>
<div style="font-size:.85em;color:#94a3b8;">{user.get('role','')}</div>
<div style="font-size:.82em;color:#64748b;">{user.get('email','')}</div>
<hr style="margin:16px 0;border-color:rgba(255,255,255,0.1);">
<div style="display:flex;justify-content:space-between;font-size:.85em;color:#94a3b8;">
<span>Leads Scored</span><span style="font-weight:600;color:#0ea5e9;">{total_leads}</span>
</div>
<div style="display:flex;justify-content:space-between;font-size:.85em;color:#94a3b8;margin-top:6px;">
<span>Leads Approved</span><span style="font-weight:600;color:#22c55e;">{approved_ct}</span>
</div>
<div style="display:flex;justify-content:space-between;font-size:.85em;color:#94a3b8;margin-top:6px;">
<span>Company</span><span style="font-weight:600;color:#f1f5f9;">{user.get('company','—')}</span>
</div>
</div>""", unsafe_allow_html=True)

    with right:
        st.markdown("##### Personal Information")
        with st.form("profile_form"):
            pc1, pc2 = st.columns(2)
            first = pc1.text_input("First Name", value=user.get("first_name", ""))
            last = pc2.text_input("Last Name", value=user.get("last_name", ""))
            ec1, ec2 = st.columns(2)
            email = ec1.text_input("Email", value=user.get("email", ""))
            phone = ec2.text_input("Phone", value=user.get("phone", ""))
            role = st.text_input("Role", value=user.get("role", ""))
            if st.form_submit_button("Save Changes", type="primary"):
                st.session_state["user"].update({
                    "first_name": first, "last_name": last,
                    "email": email, "phone": phone, "role": role,
                })
                st.success("Profile updated!")

        st.markdown("")
        st.markdown("##### Company Information")
        with st.form("company_form"):
            cc1, cc2 = st.columns(2)
            company = cc1.text_input("Company Name", value=user.get("company", ""))
            industry_val = cc2.text_input("Industry", value=user.get("industry", ""))
            if st.form_submit_button("Update Company", type="primary"):
                st.session_state["user"].update({"company": company, "industry": industry_val})
                st.success("Company info updated!")
