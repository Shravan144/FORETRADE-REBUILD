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
        col.markdown(f"""<div style="background:rgba(255,255,255,0.05);border-left:4px solid {clr};border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,.15);min-height:95px;">
<div style="font-size:.78em;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">{lbl}</div>
<div style="font-size:1.7em;font-weight:800;color:#f1f5f9;">{val}</div>
<div style="font-size:.75em;color:#64748b;margin-top:2px;">{sub}</div>
</div>""", unsafe_allow_html=True)

    st.markdown("")

    # ── Channel Distribution (REAL) ───────────────────────────
    st.markdown("#### Channel Distribution (from buyer preferred channels)")
    if ch_metrics:
        ch_cols = st.columns(len(ch_metrics))
        for col, c in zip(ch_cols, ch_metrics):
            bar_pct = c["pct"]
            col.markdown(f"""<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:18px;text-align:center;">
<div style="font-size:1.5em;">{c['icon']}</div>
<div style="font-weight:700;font-size:1.05em;color:#f1f5f9;margin:6px 0 4px;">{c['name']}</div>
<div style="font-size:.82em;color:#94a3b8;">Leads: <strong>{c['count']}</strong></div>
<div style="background:rgba(255,255,255,0.08);border-radius:4px;height:8px;margin-top:8px;overflow:hidden;">
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
            xaxis=dict(gridcolor="rgba(255,255,255,0.08)"), yaxis=dict(gridcolor="rgba(255,255,255,0.08)"),
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
<div style="width:80px;font-size:.82em;font-weight:600;color:#cbd5e1;">{label}</div>
<div style="flex:1;background:rgba(255,255,255,0.08);border-radius:4px;height:12px;overflow:hidden;">
<div style="width:{pct:.0f}%;background:#0ea5e9;height:100%;border-radius:4px;"></div>
</div>
<div style="width:55px;text-align:right;font-size:.82em;font-weight:700;color:#f1f5f9;">{count}</div>
</div>""", unsafe_allow_html=True)

    st.markdown("")

    # ── Segments + Countries ──────────────────────────────────
    left2, right2 = st.columns(2)

    with left2:
        st.markdown("#### Top Segments (by industry)")
        for seg in seg_metrics[:6]:
            conv_txt = f"{seg['conversion_pct']}% approved" if seg['conversion_pct'] > 0 else "—"
            st.markdown(f"""<div style="display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.08);">
<div style="font-size:1.2em;margin-right:10px;">{seg['icon']}</div>
<div style="flex:1;">
<div style="font-weight:600;font-size:.9em;color:#f1f5f9;">{seg['industry']}</div>
<div style="font-size:.78em;color:#94a3b8;">{seg['total']} leads · Avg score {seg['avg_score']} · {conv_txt}</div>
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
                polar=dict(radialaxis=dict(visible=True, range=[0, 1], gridcolor="rgba(255,255,255,0.08)")),
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

    # ── ML Model Insights ─────────────────────────────────────
    st.divider()
    st.markdown("#### 🤖 Machine Learning Insights")
    st.caption("Real-time output from K-Means clustering & GB+RF Regression Ensemble")

    ml_seg = st.session_state.get("ml_seg")
    ml_gb = st.session_state.get("ml_gb")

    if ml_gb and "accuracy" in ml_gb:
        # KPI row — 2 rows of 4
        ml_cols = st.columns(4)
        kpi_ml = [
            ("Ensemble Accuracy", f'{ml_gb["accuracy"]*100:.1f}%',
             f'{ml_gb.get("train_size",0)} samples · {ml_gb.get("neg_strategy","random")}', "#8b5cf6"),
            ("ROC-AUC", f'{ml_gb["auc"]:.3f}', "5-fold CV", "#0ea5e9"),
            ("R² Score", f'{ml_gb.get("r2",0):.3f}',
             f'MAE={ml_gb.get("mae",0):.3f} · Regression quality', "#22c55e"),
            ("Buyer Segments", "4", "K-Means clusters", "#f59e0b"),
        ]
        for col, (lbl, val, sub, clr) in zip(ml_cols, kpi_ml):
            col.markdown(f"""<div style="background:rgba(255,255,255,0.05);border-left:4px solid {clr};border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,.15);min-height:95px;">
<div style="font-size:.78em;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">{lbl}</div>
<div style="font-size:1.7em;font-weight:800;color:#f1f5f9;">{val}</div>
<div style="font-size:.75em;color:#64748b;margin-top:2px;">{sub}</div>
</div>""", unsafe_allow_html=True)

        # Per-fold scores table
        fold_scores = ml_gb.get("fold_scores")
        if fold_scores:
            st.markdown("")
            st.markdown("##### 5-Fold Cross-Validation Breakdown")
            fold_df = pd.DataFrame(fold_scores)
            if "r2" in fold_df.columns:
                fold_df.columns = ["Fold", "Accuracy", "AUC", "R²"]
                fold_df["R²"] = fold_df["R²"].apply(lambda x: f"{x:.4f}")
            else:
                fold_df.columns = ["Fold", "Accuracy", "AUC"]
            fold_df["Accuracy"] = fold_df["Accuracy"].apply(lambda x: f"{x*100:.1f}%")
            fold_df["AUC"] = fold_df["AUC"].apply(lambda x: f"{x:.4f}")
            st.dataframe(fold_df, use_container_width=True, hide_index=True)

        st.markdown("")

        ml_left, ml_right = st.columns(2)

        with ml_left:
            # Feature importance bar chart
            fi = ml_gb.get("feature_importance", {})
            if fi:
                st.markdown("##### Ensemble Feature Importance (GB + RF avg)")
                fi_sorted = sorted(fi.items(), key=lambda x: x[1], reverse=True)
                fi_df = pd.DataFrame(fi_sorted, columns=["Signal", "Importance"])
                fi_df["Signal"] = fi_df["Signal"].str.replace("_", " ").str.title()
                fig_fi = px.bar(
                    fi_df, x="Importance", y="Signal", orientation="h",
                    color="Importance", color_continuous_scale="viridis",
                )
                fig_fi.update_layout(
                    height=360, margin=dict(t=10, b=10, l=10, r=10),
                    plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
                    yaxis=dict(autorange="reversed"),
                    showlegend=False,
                )
                st.plotly_chart(fig_fi, use_container_width=True)

        with ml_right:
            # Buyer segment distribution (pie)
            if ml_seg and "labels" in ml_seg:
                st.markdown("##### Buyer Segment Distribution (K-Means)")
                from engine.ml_models import get_segment_label
                import numpy as _np
                labels_arr = ml_seg["labels"]
                seg_counts = {}
                for cid in range(ml_seg.get("n_clusters", 4)):
                    lbl, clr = get_segment_label(cid)
                    seg_counts[lbl] = int(_np.sum(labels_arr == cid))
                seg_df = pd.DataFrame(list(seg_counts.items()), columns=["Segment", "Count"])
                fig_seg = px.pie(
                    seg_df, values="Count", names="Segment",
                    color_discrete_sequence=["#22c55e", "#0ea5e9", "#f59e0b", "#8b5cf6"],
                    hole=0.4,
                )
                fig_seg.update_layout(
                    height=360, margin=dict(t=10, b=10),
                    plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
                )
                st.plotly_chart(fig_seg, use_container_width=True)

        # ML confidence distribution across current matches
        if matches and matches[0].get("ml_confidence") is not None:
            st.markdown("##### ML Confidence Distribution (current matches)")
            ml_data = []
            for m in matches:
                ml_data.append({
                    "buyer": m.get("buyer_name", "?")[:18],
                    "ml_confidence": m.get("ml_confidence", 0.5) * 100,
                    "weighted_sum": m.get("weighted_sum_score", m.get("score", 0)),
                    "blended": m.get("score", 0),
                })
            ml_df = pd.DataFrame(ml_data)
            fig_ml = go.Figure()
            fig_ml.add_trace(go.Bar(name="Weighted Sum", x=ml_df["buyer"], y=ml_df["weighted_sum"],
                                     marker_color="#0ea5e9", opacity=0.7))
            fig_ml.add_trace(go.Bar(name="ML Confidence", x=ml_df["buyer"], y=ml_df["ml_confidence"],
                                     marker_color="#8b5cf6", opacity=0.7))
            fig_ml.add_trace(go.Scatter(name="Blended Score", x=ml_df["buyer"], y=ml_df["blended"],
                                         mode="markers+lines", marker=dict(color="#22c55e", size=8),
                                         line=dict(color="#22c55e", width=2)))
            fig_ml.update_layout(
                barmode="group", height=350, margin=dict(t=10, b=30),
                plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
                xaxis=dict(gridcolor="rgba(255,255,255,0.08)"),
                yaxis=dict(gridcolor="rgba(255,255,255,0.08)", title="Score / %"),
                legend=dict(font=dict(size=10), orientation="h", y=-0.2),
            )
            fig_ml.update_xaxes(tickangle=20)
            st.plotly_chart(fig_ml, use_container_width=True)
    else:
        st.info("ML models are training… refresh the page in a moment.")


# ─────────────────────────────────────────────────────────────────────────
#  ALGORITHM PAGE  (🔄)
# ─────────────────────────────────────────────────────────────────────────

def render_algorithm_workflow() -> None:
    """Visual explanation of the 4-Layer ML Ensemble."""

    st.markdown("#### System Architecture")

    st.markdown('''
```
┌─────────────────────────────────────────────────────────────────────────┐
│  📥  DATA LAYER                                                         │
│  Organiser EXIM Dataset (3 sheets)                                      │
│  • Exporter Live Signals  (6 682 exporters)                             │
│  • Importer Live Signals  (10 695 buyers)                               │
│  • Global News Signals    (8 000 events)                                │
└─────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  🔬  FEATURE ENGINEERING                                                │
│  Exporter profiles · Buyer profiles · Trade graph · News signals        │
└─────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚖️  4-LAYER ML ENSEMBLE                                                │
│  Final Score = Σ (layer_weight × layer_output) × 100                    │
└─────────────────────────────────────────────────────────────────────────┘
            │
      ┌─────┼──────────────────────────────────────────────┐
      │     │                                              │
      ▼     ▼                                              ▼
┌──────────────┐  ┌──────────────────────┐  ┌────────────────────────────┐
│ Layer 1      │  │ Layer 2              │  │ Layer 3                    │
│ Weighted-Sum │  │ LTR LambdaRank       │  │ GB + RF Ensemble           │
│ 30%          │  │ 35%                  │  │ 25%                        │
│ Σ wᵢ × sᵢ    │  │ LightGBM pairwise    │  │ GradientBoost +            │
│ (7 signals)  │  │ ranking (NDCG)       │  │ RandomForest regression    │
└──────────────┘  └──────────────────────┘  └────────────────────────────┘
      │                    │                           │
      └────────────────────┼───────────────────────────┘
                           │
                           ▼
              ┌──────────────────────────────┐
              │ Layer 4                      │
              │ Graph Embeddings             │
              │ 10%                          │
              │ Node2Vec + Jaccard affinity  │
              └──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  🔀  FINAL BLENDED SCORE  (0-100)                                       │
│  = 0.30×WeightedSum + 0.35×LTR + 0.25×GBRF + 0.10×Graph                 │
└─────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  📱  SWIPE TO EXPORT  →  🔄  RLHF FEEDBACK LOOP                         │
│  • Right → boost top signal +5%                                         │
│  • Left  → reduce top signal −3%                                        │
│  • Every 15 swipes → retrain LTR model on user preferences              │
│  • Σ w = 1.0 always (adaptive weights)                                  │
└─────────────────────────────────────────────────────────────────────────┘
```
    ''')

    st.divider()

    st.markdown('''
#### 4-Layer Ensemble Architecture

| Layer | Model | Weight | Purpose | Key Features |
|-------|-------|--------|---------|--------------|
| 1 | **Weighted-Sum** | 30% | Baseline rule-based scoring | 7 signals: product, geo, frequency, activity, readiness, geo_risk, payment |
| 2 | **LTR LambdaRank** | 35% | Learning-to-rank with user feedback | LightGBM pairwise ranking, NDCG optimization, RLHF retraining every 15 swipes |
| 3 | **GB + RF Ensemble** | 25% | Supervised match quality prediction | GradientBoosting + RandomForest, 12 features, anti-overfitting (3% gap target) |
| 4 | **Graph Embeddings** | 10% | Network structure affinity | Node2Vec embeddings + Jaccard similarity on trade graph |

**Why 4 layers?**
- Weighted-Sum provides interpretable baseline
- LTR learns from user preferences (RLHF loop)
- GB+RF captures non-linear feature interactions
- Graph captures network effects (who trades with whom)

---

#### Layer 1: Weighted-Sum Scoring

$$
\\text{WeightedSum} = \\sum_{i=1}^{7} w_i \\times s_i
$$

| Signal | Weight | Formula |
|--------|--------|---------|
| Product Compatibility | 22% | Exact HS match=1.0, Same chapter=0.7, Different=0.3 |
| Geography Fit | 14% | Trade corridor strength from constants.py |
| Trade Frequency | 10% | min(freq₁, freq₂) / max(freq₁, freq₂) |
| Buyer Activity | 10% | 0.6 × activity + 0.4 × intent |
| Buyer Readiness | 16% | 0.3 × hiring + 0.3 × funding + 0.4 × response_prob |
| Geo Risk | 14% | 1.0 − (risk_sum / 5.0) |
| Payment Trust | 14% | 0.5 × good_payment + 0.5 × prompt_response |

---

#### Layer 2: LTR LambdaRank (RLHF)

**LightGBM LambdaRank** with pairwise ranking:
- **Objective:** Optimize NDCG (Normalized Discounted Cumulative Gain)
- **Input:** 7 profile features + user swipe history
- **Training:** Every 15 swipes, retrain on (approved=1, rejected=0) pairs
- **Anti-overfitting:** 25% feature masking, early stopping

---

#### Layer 3: GB + RF Ensemble

**Anti-Overfitting Design:**
- Train R² computed on ORIGINAL (non-augmented) data
- Test R² on held-out 20% validation set
- Target: ≤5% overfit gap (currently ~3%)
- 5-fold cross-validation for robustness

**Architecture:**
- GradientBoostingRegressor (n_estimators=15, max_depth=2)
- RandomForestRegressor (n_estimators=15, max_depth=2)
- Ensemble: 0.6 × GB + 0.4 × RF

---

#### Layer 4: Graph Embeddings

**Trade Graph Analysis:**
- Bipartite graph: Exporters ↔ Buyers
- Node2Vec embeddings (64-dim)
- Jaccard similarity for common neighbors
- Shortest path analysis

---

#### RLHF Feedback Loop

**Real-Time Adaptation:**
1. User swipes → captures implicit preference
2. Every 15 swipes → trigger LTR retraining
3. Model learns: "User likes buyers with high X, low Y"
4. Next batch → personalized ranking

**Weight Adjustment:**
- Right swipe → top signal weight +5%
- Left swipe → top signal weight −3%
- Re-normalize to Σ = 1.0
    ''')

    # Show live weights
    from engine.scorer import get_adjusted_weights
    live_weights = get_adjusted_weights()

    st.divider()
    st.markdown("#### Live Signal Weights")
    st.caption("Current adaptive weights based on your swipe feedback")

    weight_data = []
    for sig, default_w in SCORING_WEIGHTS.items():
        live_w = live_weights.get(sig, default_w)
        change = live_w - default_w
        weight_data.append({
            "Signal": sig.replace("_", " ").title(),
            "Default": f"{default_w*100:.0f}%",
            "Current": f"{live_w*100:.1f}%",
            "Change": f"{'+'if change>=0 else ''}{change*100:.1f}%",
        })

    st.dataframe(pd.DataFrame(weight_data), use_container_width=True, hide_index=True)

    # Show live ML model metrics
    ml_gb = st.session_state.get("ml_gb")
    if ml_gb and "accuracy" in ml_gb:
        st.divider()
        st.markdown("#### Live ML Model Metrics")
        
        # Primary metrics only (as per user preference)
        mc1, mc2 = st.columns(2)
        mc1.metric("AUC-ROC", f'{ml_gb["auc"]:.3f}')
        
        # Compute overfit gap if available
        train_r2 = ml_gb.get("train_r2", ml_gb.get("r2", 0))
        test_r2 = ml_gb.get("test_r2", ml_gb.get("r2", 0))
        overfit_gap = abs(train_r2 - test_r2) / max(abs(train_r2), 0.01) * 100
        mc2.metric("Overfit Gap", f'{overfit_gap:.1f}%', 
                   delta="Good" if overfit_gap <= 5 else "Check",
                   delta_color="normal" if overfit_gap <= 5 else "off")


# ─────────────────────────────────────────────────────────────────────────
#  OUTREACH PAGE  (📧)
# ─────────────────────────────────────────────────────────────────────────

def render_outreach_panel(connected_buyers: List[dict]) -> None:
    if not connected_buyers:
        st.info("Swipe right on matches to see outreach options here")
        return

    # Get exporter name from session
    user = st.session_state.get("user", {})
    exporter_name = user.get("company", "Your Company")

    st.success(f"Ready to reach out to **{len(connected_buyers)}** approved buyers")

    # Quick-action bar
    st.markdown(f"""<div style="display:flex;gap:12px;margin:12px 0 20px;">
<div style="flex:1;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:14px 18px;text-align:center;">
<div style="font-size:1.4em;">📧</div>
<div style="font-weight:700;font-size:1.1em;color:#60a5fa;">{len(connected_buyers)}</div>
<div style="font-size:.78em;color:#93c5fd;">Email Ready</div>
</div>
<div style="flex:1;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);border-radius:10px;padding:14px 18px;text-align:center;">
<div style="font-size:1.4em;">🔗</div>
<div style="font-weight:700;font-size:1.1em;color:#4ade80;">{sum(1 for b in connected_buyers if (b.get('importer_details') or {}).get('preferred_channel')=='LinkedIn')}</div>
<div style="font-size:.78em;color:#86efac;">LinkedIn Leads</div>
</div>
<div style="flex:1;background:rgba(234,179,8,0.12);border:1px solid rgba(234,179,8,0.25);border-radius:10px;padding:14px 18px;text-align:center;">
<div style="font-size:1.4em;">💬</div>
<div style="font-weight:700;font-size:1.1em;color:#facc15;">{len(connected_buyers)}</div>
<div style="font-size:.78em;color:#fde68a;">WhatsApp Ready</div>
</div>
</div>""", unsafe_allow_html=True)

    st.divider()

    for buyer in connected_buyers:
        details = buyer.get("importer_details") or {}
        channel = details.get("preferred_channel", "Email") if details else "Email"
        score = buyer.get("score", 0)
        bname = buyer.get("buyer_name", "Unknown")
        country = buyer.get("buyer_country", "Unknown")
        industry = details.get("industry", "Trade")
        news = buyer.get("news_flags") or {}

        # Generate synthetic contact info
        clean_name = bname.lower().replace(" ", "").replace(".", "")
        fake_email = f"trade@{clean_name[:20]}.com"
        linkedin_url = f"https://www.linkedin.com/search/results/companies/?keywords={bname.replace(' ', '%20')}"
        intro_msg = f"Hi {bname} team, I'm reaching out from {exporter_name} regarding a {industry.lower()} export partnership. Our AI system shows {score:.0f}% compatibility."
        wa_url = f"https://wa.me/?text={intro_msg.replace(' ', '%20').replace('&', '%26')}"

        email_subject = f"Export Partnership Opportunity — {exporter_name} × {bname}"
        email_body = f"""Dear {bname} team,

I'm reaching out from {exporter_name}. Our AI-powered trade matching platform identified a {score:.0f}% compatibility between our companies in the {industry.lower()} sector.

{buyer.get('explanation', f'Our analysis shows strong alignment across product compatibility, trade trust, and geography fit for the {country} market.')}

Key highlights:
- Match Score: {score:.0f}%
- Target Market: {country}
- Industry: {industry}

We would love to schedule a brief call to explore a partnership.

Best regards,
{exporter_name}"""

        mailto_url = f"mailto:{fake_email}?subject={email_subject.replace(' ', '%20').replace('&', '%26')}&body={email_body.replace(chr(10), '%0A').replace(' ', '%20').replace('&', '%26')}"

        with st.expander(f"{'📧' if channel == 'Email' else '🔗' if channel == 'LinkedIn' else '💬'} {bname} — {country} ({score:.0f}% match)", expanded=False):
            # Info cards row
            c1, c2, c3 = st.columns(3)
            with c1:
                st.write(f"**Score:** {score:.0f}%")
                st.write(f"**Country:** {country}")
                st.write(f"**Industry:** {industry}")
            with c2:
                st.write(f"**Channel:** {channel}")
                intent = (details.get("intent_score") or 0) * 100
                st.write(f"**Intent:** {intent:.0f}%")
                sent = news.get("sentiment", 0.5)
                st.write(f"**Sentiment:** {'🟢' if sent >= 0.6 else '🔴' if sent <= 0.4 else '🟡'} {sent:.0%}")
            with c3:
                bd = buyer.get("breakdown", {})
                top_3 = sorted(bd.items(), key=lambda x: x[1].get("contribution", 0), reverse=True)[:3]
                if top_3:
                    st.write("**Top signals:**")
                    for sig, d in top_3:
                        st.write(f"• {sig.replace('_', ' ').title()}: {d['contribution']:.1f}%")

            st.markdown("---")

            # Email preview
            st.markdown("**📧 Email Draft** (click to open in your email client)")
            st.code(email_body, language="text")

            # Action buttons with real links
            st.markdown(f"""<div style="display:flex;gap:10px;margin:12px 0;">
<a href="{mailto_url}" target="_blank" style="text-decoration:none;background:#3b82f6;color:white;padding:10px 20px;border-radius:8px;font-weight:600;font-size:.9em;display:flex;align-items:center;gap:6px;">📧 Send Email</a>
<a href="{linkedin_url}" target="_blank" style="text-decoration:none;background:#0a66c2;color:white;padding:10px 20px;border-radius:8px;font-weight:600;font-size:.9em;display:flex;align-items:center;gap:6px;">🔗 Find on LinkedIn</a>
<a href="{wa_url}" target="_blank" style="text-decoration:none;background:#25d366;color:white;padding:10px 20px;border-radius:8px;font-weight:600;font-size:.9em;display:flex;align-items:center;gap:6px;">💬 WhatsApp</a>

</div>""", unsafe_allow_html=True)
