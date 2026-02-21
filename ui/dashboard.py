"""
=============================================================================
DASHBOARD / ANALYTICS — ForeTrade  (v3 — 100 % data-driven)
=============================================================================
Every chart + KPI fed from engine/metrics.py and real match data.
=============================================================================
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from typing import List
from utils.constants import SCORING_WEIGHTS
from engine.metrics import (
    compute_session_metrics,
    compute_channel_metrics,
    compute_segment_metrics,
    compute_country_metrics,
    compute_signal_metrics,
    compute_news_metrics,
)


# ─────────────────────────────────────────────────────────────────────────
#  ANALYTICS PAGE  (📊)
# ─────────────────────────────────────────────────────────────────────────

def render_match_analytics(matches: List[dict]) -> None:
    if not matches:
        st.warning("No matches to analyse. Go to **Approve Leads** first.")
        return

    connected = st.session_state.get("connected", [])
    swipe_history = st.session_state.get("swipe_history", [])
    sm = compute_session_metrics(matches, connected, swipe_history)
    ch_metrics = compute_channel_metrics(matches)
    seg_metrics = compute_segment_metrics(matches, connected)
    country_metrics = compute_country_metrics(matches)
    sig_metrics = compute_signal_metrics(matches)
    news_metrics = compute_news_metrics(matches)

    df = pd.DataFrame(matches)

    # ── KPIs ──────────────────────────────────────────────────
    cols = st.columns(4)
    kdata = [
        ("Total Leads Scored", str(sm["total_leads"]),
         f'{sm["high_quality_pct"]}% above 70 score', "#0ea5e9"),
        ("Approval Rate", f'{sm["approval_rate"]}%',
         f'{sm["approved"]} approved · {sm["rejected"]} rejected', "#22c55e"),
        ("Avg Match Score", f'{sm["avg_score"]}',
         f'Range: {df["score"].min():.0f} – {df["score"].max():.0f}', "#8b5cf6"),
        ("Market Sentiment", f'{news_metrics["avg_sentiment"]:.2f}',
         f'{news_metrics["favourable_markets"]} favourable · {news_metrics["risky_markets"]} risky', "#f59e0b"),
    ]
    for col, (lbl, val, sub, clr) in zip(cols, kdata):
        col.markdown(f"""<div style="background:#fff;border-left:4px solid {clr};border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,.04);min-height:95px;">
<div style="font-size:.78em;text-transform:uppercase;letter-spacing:.5px;color:#64748b;">{lbl}</div>
<div style="font-size:1.7em;font-weight:800;color:#0f172a;">{val}</div>
<div style="font-size:.75em;color:#94a3b8;margin-top:2px;">{sub}</div>
</div>""", unsafe_allow_html=True)

    st.markdown("")

    # ── Channel Distribution (REAL) ───────────────────────────
    st.markdown("#### Channel Distribution (from buyer preferred channels)")
    if ch_metrics:
        ch_cols = st.columns(len(ch_metrics))
        for col, c in zip(ch_cols, ch_metrics):
            bar_pct = c["pct"]
            col.markdown(f"""<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;text-align:center;">
<div style="font-size:1.5em;">{c['icon']}</div>
<div style="font-weight:700;font-size:1.05em;color:#0f172a;margin:6px 0 4px;">{c['name']}</div>
<div style="font-size:.82em;color:#64748b;">Leads: <strong>{c['count']}</strong></div>
<div style="background:#e2e8f0;border-radius:4px;height:8px;margin-top:8px;overflow:hidden;">
<div style="width:{bar_pct:.0f}%;background:{c['color']};height:100%;border-radius:4px;"></div>
</div>
<div style="font-size:.78em;font-weight:700;color:{c['color']};margin-top:4px;">{c['pct']}%</div>
</div>""", unsafe_allow_html=True)

    st.markdown("")

    # ── Score Distribution + ICP Buckets ──────────────────────
    left, right = st.columns(2)

    with left:
        st.markdown("#### Score Distribution")
        fig1 = px.histogram(
            df, x="score", nbins=15,
            labels={"score": "Match Score", "count": "Leads"},
            color_discrete_sequence=["#0ea5e9"],
        )
        fig1.update_layout(
            height=320, margin=dict(t=10, b=30, l=40, r=10),
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            xaxis=dict(gridcolor="#f1f5f9"), yaxis=dict(gridcolor="#f1f5f9"),
        )
        st.plotly_chart(fig1, use_container_width=True)

    with right:
        st.markdown("#### ICP Match Buckets")
        buckets = sm["score_buckets"]
        max_b = max(buckets.values()) or 1
        for label, count in buckets.items():
            if count == 0:
                continue
            pct = count / max_b * 100
            st.markdown(f"""<div style="display:flex;align-items:center;margin:6px 0;">
<div style="width:80px;font-size:.82em;font-weight:600;color:#334155;">{label}</div>
<div style="flex:1;background:#f1f5f9;border-radius:4px;height:12px;overflow:hidden;">
<div style="width:{pct:.0f}%;background:#0ea5e9;height:100%;border-radius:4px;"></div>
</div>
<div style="width:55px;text-align:right;font-size:.82em;font-weight:700;color:#0f172a;">{count}</div>
</div>""", unsafe_allow_html=True)

    st.markdown("")

    # ── Segments + Countries ──────────────────────────────────
    left2, right2 = st.columns(2)

    with left2:
        st.markdown("#### Top Segments (by industry)")
        for seg in seg_metrics[:6]:
            conv_txt = f"{seg['conversion_pct']}% approved" if seg['conversion_pct'] > 0 else "—"
            st.markdown(f"""<div style="display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid #f1f5f9;">
<div style="font-size:1.2em;margin-right:10px;">{seg['icon']}</div>
<div style="flex:1;">
<div style="font-weight:600;font-size:.9em;color:#0f172a;">{seg['industry']}</div>
<div style="font-size:.78em;color:#64748b;">{seg['total']} leads · Avg score {seg['avg_score']} · {conv_txt}</div>
</div>
</div>""", unsafe_allow_html=True)

    with right2:
        st.markdown("#### Geographic Spread")
        if country_metrics:
            c_df = pd.DataFrame(country_metrics[:10])
            fig_c = px.bar(
                c_df, x="count", y="country", orientation="h",
                color="avg_score", color_continuous_scale="tealgrn",
                labels={"count": "Leads", "country": "", "avg_score": "Avg Score"},
            )
            fig_c.update_layout(
                height=300, margin=dict(t=10, b=10, l=10, r=10),
                plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
                yaxis=dict(autorange="reversed"),
            )
            st.plotly_chart(fig_c, use_container_width=True)

    st.markdown("")
    st.divider()

    # ── Signal Analysis (REAL from 9-signal engine) ───────────
    st.markdown("#### 9-Signal Engine Analysis")
    st.caption("Average signal contribution across all scored leads")

    s_left, s_right = st.columns([1, 1])

    with s_left:
        # Radar chart — average signal strengths
        if sig_metrics:
            cats = [k.replace("_", " ").title() for k in sig_metrics]
            vals = [sig_metrics[k]["avg_raw"] for k in sig_metrics]
            fig_radar = go.Figure(data=go.Scatterpolar(
                r=vals + [vals[0]], theta=cats + [cats[0]],
                fill="toself",
                fillcolor="rgba(14,165,233,0.15)",
                line_color="#0ea5e9",
                name="Avg Signal Strength",
            ))
            fig_radar.update_layout(
                polar=dict(radialaxis=dict(visible=True, range=[0, 1], gridcolor="#f1f5f9")),
                showlegend=False, height=360,
                margin=dict(t=30, b=30),
                plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            )
            st.plotly_chart(fig_radar, use_container_width=True)

    with s_right:
        # Signal contribution breakdown for top 5
        if matches and "breakdown" in matches[0]:
            signal_data = []
            for match in matches[:5]:
                bd = match.get("breakdown", {})
                for signal, data in bd.items():
                    signal_data.append({
                        "buyer": match.get("buyer_name", "Unknown")[:18],
                        "signal": signal.replace("_", " ").title(),
                        "contribution": data.get("contribution", 0),
                    })
            if signal_data:
                sdf = pd.DataFrame(signal_data)
                fig4 = px.bar(
                    sdf, x="buyer", y="contribution", color="signal",
                    barmode="stack",
                    labels={"buyer": "", "contribution": "Score %"},
                    color_discrete_sequence=px.colors.qualitative.Set3,
                )
                fig4.update_xaxes(tickangle=20)
                fig4.update_layout(
                    height=360, margin=dict(t=10, b=30),
                    legend=dict(font=dict(size=9), orientation="h", y=-0.25),
                    plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
                )
                st.plotly_chart(fig4, use_container_width=True)

    # ── News Sentiment Chart ──────────────────────────────────
    if matches and matches[0].get("news_flags"):
        st.markdown("#### Market Sentiment by Lead")
        sentiments = []
        for m in matches:
            nf = m.get("news_flags", {})
            sentiments.append({
                "buyer": m["buyer_name"][:18],
                "country": m["buyer_country"],
                "sentiment": nf.get("sentiment", 0.5),
            })
        sdf = pd.DataFrame(sentiments)
        fig_sent = px.bar(
            sdf, x="buyer", y="sentiment", color="country",
            labels={"buyer": "", "sentiment": "Sentiment (0–1)"},
            color_discrete_sequence=px.colors.qualitative.Pastel,
        )
        fig_sent.add_hline(y=0.5, line_dash="dash", line_color="#94a3b8",
                           annotation_text="Neutral")
        fig_sent.add_hline(y=0.6, line_dash="dot", line_color="#22c55e",
                           annotation_text="Favourable")
        fig_sent.update_xaxes(tickangle=25)
        fig_sent.update_layout(
            height=320, margin=dict(t=10, b=30),
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
        )
        st.plotly_chart(fig_sent, use_container_width=True)


# ─────────────────────────────────────────────────────────────────────────
#  ALGORITHM PAGE  (🔄)
# ─────────────────────────────────────────────────────────────────────────

def render_algorithm_workflow() -> None:
    """Visual explanation of the 9-signal scoring pipeline."""

    st.markdown("#### System Architecture")

    st.markdown('''
```
┌─────────────────────────────────────────────────────────┐
│  📥  DATA LAYER                                         │
│  Organiser EXIM Dataset (3 sheets)                      │
│  • Exporter Live Signals  (6 682 exporters)             │
│  • Importer Live Signals  (10 695 buyers)               │
│  • Global News Signals    (8 000 events)                │
└─────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│  🧹  CLEANING & NORMALISATION                           │
│  Deduplicate · MinMaxScaler · Outlier removal           │
│  High-intent buyer detection (recency + growth)         │
└─────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│  🔬  FEATURE ENGINEERING                                │
│  Exporter profiles  ·  Buyer profiles  ·  Trade graph   │
└─────────────────────────────────────────────────────────┘
            │
      ┌─────┴──────────────────────────────────┐
      ▼                                        ▼
┌──────────────────────┐    ┌──────────────────────┐
│ 🕸  GRAPH ANALYSIS   │    │ 📰  NEWS INTEL       │
│ Bipartite network    │    │ 8 000 events         │
│ Jaccard similarity   │    │ Sigmoid sentiment    │
└──────────────────────┘    └──────────────────────┘
      │                                        │
      └────────────────┬───────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  ⚖️  9-SIGNAL SCORING ENGINE                            │
│  score = Σ wᵢ × sᵢ × 100   (0 – 100)                  │
└─────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│  📱  SWIPE TO EXPORT  →  🔄  ADAPTIVE FEEDBACK LOOP    │
│  Right → boost top signal +5 %                          │
│  Left  → reduce top signal −3 %                         │
│  Σ w = 1.0 always                                       │
└─────────────────────────────────────────────────────────┘
```
    ''')

    st.divider()

    # Show LIVE weights (not just the defaults)
    from engine.scorer import get_adjusted_weights
    live_weights = get_adjusted_weights()

    st.markdown("#### Live Scoring Weights")
    st.caption("These weights update in real-time as you swipe — showing current adjusted values")

    weight_data = []
    descriptions = {
        "product_compatibility": "Industry / HS-code alignment between exporter and buyer",
        "trust_score": "Payment reliability, certifications, prompt responses",
        "geography_fit": "Trade corridor strength between countries/regions",
        "graph_affinity": "Jaccard coefficient + path analysis on trade graph (NetworkX)",
        "size_compatibility": "Log-ratio of exporter capacity vs buyer import volume",
        "intent_momentum": "Engagement spikes, hiring signals, decision-maker changes",
        "trade_frequency": "How actively the buyer imports in this category",
        "buyer_activity": "Recency of last trade + current activity level",
        "news_sentiment": "8 000 geopolitical events → sigmoid sentiment per (industry, region)",
    }

    for sig, default_w in SCORING_WEIGHTS.items():
        live_w = live_weights.get(sig, default_w)
        change = live_w - default_w
        weight_data.append({
            "Signal": sig.replace("_", " ").title(),
            "Default": f"{default_w*100:.0f}%",
            "Current": f"{live_w*100:.1f}%",
            "Change": f"{'+'if change>=0 else ''}{change*100:.1f}%",
            "Description": descriptions.get(sig, ""),
        })

    st.dataframe(
        pd.DataFrame(weight_data),
        use_container_width=True,
        hide_index=True,
        column_config={
            "Signal": st.column_config.TextColumn(width="medium"),
            "Default": st.column_config.TextColumn(width="small"),
            "Current": st.column_config.TextColumn(width="small"),
            "Change": st.column_config.TextColumn(width="small"),
            "Description": st.column_config.TextColumn(width="large"),
        },
    )

    st.divider()

    st.markdown('''
#### Scoring Formula

$$
\\text{Match Score} = \\sum_{i=1}^{9} w_i \\times s_i \\times 100
$$

| # | Signal | Default Weight | Source |
|---|--------|---------------|--------|
| 1 | Product Compatibility | 20% | Industry alignment (exact/chapter/partial) |
| 2 | Trust Score | 15% | `Good_Payment_Terms`, `Good_Payment_History`, `Prompt_Response` |
| 3 | Geography Fit | 12% | Trade-corridor strength matrix |
| 4 | Graph Affinity | 12% | Jaccard + shortest-path on bipartite graph |
| 5 | Size Compatibility | 10% | Log-ratio of revenue/capacity |
| 6 | Intent Momentum | 10% | `Engagement_Spike`, `Hiring_Signal`, `Intent_Score` |
| 7 | Trade Frequency | 8% | Normalised import frequency |
| 8 | Buyer Activity | 8% | Recency + activity overlay |
| 9 | News Sentiment | 5% | 8 000 events → sigmoid sentiment |

---

#### Real-Time Adaptability

**Automatic (swipe feedback):**
- Right → top signal weight **+5%**, Left → top signal **−3%**
- Re-normalised after every swipe (Σ = 1.0)

**Manual (sidebar sliders):**
- Each weight exposed as 0–1 slider, changes apply instantly
    ''')


# ─────────────────────────────────────────────────────────────────────────
#  OUTREACH PAGE  (📧)
# ─────────────────────────────────────────────────────────────────────────

def render_outreach_panel(connected_buyers: List[dict]) -> None:
    if not connected_buyers:
        st.info("Swipe right on matches to see outreach options here")
        return

    st.success(f"Ready to reach out to **{len(connected_buyers)}** approved buyers")
    st.divider()

    for buyer in connected_buyers:
        details = buyer.get("importer_details") or {}
        channel = details.get("preferred_channel", "Email") if details else "Email"
        score = buyer.get("score", 0)
        bname = buyer.get("buyer_name", "Unknown")
        country = buyer.get("buyer_country", "Unknown")
        industry = details.get("industry", "Trade")

        with st.expander(f"📧 {bname} — {country} ({score:.0f}% match)"):
            c1, c2 = st.columns(2)
            with c1:
                st.write(f"**Score:** {score:.0f}%")
                st.write(f"**Country:** {country}")
                st.write(f"**Industry:** {industry}")
                st.write(f"**Channel:** {channel}")
            with c2:
                bd = buyer.get("breakdown", {})
                top_3 = sorted(bd.items(), key=lambda x: x[1].get("contribution", 0), reverse=True)[:3]
                if top_3:
                    st.write("**Top match signals:**")
                    for sig, d in top_3:
                        st.write(f"• {sig.replace('_',' ').title()}: {d['contribution']:.1f}%")

            st.info(f"📣 Preferred outreach: **{channel}**")

            email_text = f"""Subject: Export Partnership — {bname}

Dear {bname} team,

We are a leading exporter specialising in {industry.lower()} products.
Our AI matchmaking system identified a {score:.0f}% compatibility
between our companies.

{buyer.get('explanation', 'Strong compatibility across multiple trade dimensions.')}

We would love to schedule a call to explore a partnership.

Best regards,
[Your Company]"""

            st.code(email_text, language="text")

            col1, col2 = st.columns(2)
            with col1:
                if st.button("📧 Copy Email", key=f"email_{buyer.get('buyer_id','')}"):
                    st.success("Copied!")
            with col2:
                if st.button(f"🔗 {channel}", key=f"ch_{buyer.get('buyer_id','')}"):
                    st.success(f"{channel} outreach initiated!")
