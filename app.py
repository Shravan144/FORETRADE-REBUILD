"""
=============================================================================
FORETRADE — Main Streamlit Application  (v2 — Full Platform)
=============================================================================
Run with:   streamlit run app.py

NAVIGATION (matches ProExport prototype):
    1. 🏠 Dashboard          — KPIs, pipeline, activity feed
    2. 👍 Approve Leads      — Swipe-to-approve matchmaking cards
    3. ✅ Approved Leads     — Track accepted leads through pipeline
    4. 💬 Conversations      — AI-generated outreach chat per lead
    5. 📊 Analytics          — Match analytics & charts
    6. 🔄 Algorithm          — Visual scoring pipeline explanation
    7. 📧 Outreach           — Email templates & outreach actions
    8. 👤 Profile            — User/company settings
=============================================================================
"""

import streamlit as st
import pandas as pd
import os
from typing import Tuple
from dotenv import load_dotenv

# Load environment variables (.env for GEMINI_API_KEY etc.)
load_dotenv()

# --- Page Config (MUST be first Streamlit command) ---
st.set_page_config(
    page_title="ForeTrade — Swipe to Export",
    page_icon="🌍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- Imports ---
from engine.cleaner import clean_transactions, clean_exporters, clean_buyers, detect_high_intent_buyers
from engine.features import build_exporter_profiles, build_buyer_profiles
from engine.graph import build_trade_graph, get_graph_stats
from engine.scorer import rank_matches_for_exporter, get_adjusted_weights, _compute_raw_signals
from engine.ml_models import train_buyer_segments, train_match_predictor, get_segment_for_buyer, get_segment_label, get_ml_metrics
from engine.explainer import generate_explanation, generate_match_card_text
from ui.swipe import render_swipe_interface, inject_card_css
from ui.dashboard import render_match_analytics, render_algorithm_workflow, render_outreach_panel
from ui.auth import render_login_page, logout
from ui.pages import (
    render_dashboard_page,
    render_approved_leads_page,
    render_conversations_page,
    render_profile_page,
)
from utils.constants import SCORING_WEIGHTS, PRODUCT_CATEGORIES


# ==========================================================================
# DATA LOADING
# ==========================================================================
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
EXIM_XLSX_BASENAME = "EXIM_DatasetAlgo_Hackathon.xlsx"
EXIM_XLSX_PATH = os.path.join(DATA_DIR, EXIM_XLSX_BASENAME)
MAX_TRANSACTIONS = 20_000


@st.cache_data
def load_data():
    """Load dataset — prefer pre-built CSVs (fast) over re-generating from Excel (slow)."""
    try:
        csv_exp = os.path.join(DATA_DIR, "exporters.csv")
        csv_buy = os.path.join(DATA_DIR, "buyers.csv")
        csv_txn = os.path.join(DATA_DIR, "transactions.csv")

        csvs_exist = all(os.path.exists(p) for p in [csv_exp, csv_buy, csv_txn])

        if csvs_exist and os.path.getsize(csv_txn) > 1000:
            # Fast path: read pre-built CSVs (skips Excel + synthetic tx generation)
            exporters = pd.read_csv(csv_exp)
            buyers = pd.read_csv(csv_buy)
            transactions = pd.read_csv(csv_txn)
        elif os.path.exists(EXIM_XLSX_PATH):
            # Slow path: generate from Excel (first run only)
            from data.load_exim_hackathon_dataset import run as load_exim_dataset
            exporters, buyers, transactions, _news = load_exim_dataset(
                output_dir=DATA_DIR, excel_path=EXIM_XLSX_PATH, build_synthetic_txn=True,
            )
        else:
            st.error("⚠️ No data found. Place 'EXIM_DatasetAlgo_Hackathon.xlsx' in data/")
            st.stop()

        if len(transactions) > MAX_TRANSACTIONS:
            transactions = transactions.sample(n=MAX_TRANSACTIONS, random_state=42).reset_index(drop=True)

        transactions = clean_transactions(transactions)
        exporters = clean_exporters(exporters)
        buyers = clean_buyers(buyers)
        buyers = detect_high_intent_buyers(buyers, transactions)
        return exporters, buyers, transactions

    except FileNotFoundError:
        st.error("⚠️ Organizer dataset not found. Place 'EXIM_DatasetAlgo_Hackathon.xlsx' in data/")
        st.stop()
    except Exception as e:
        st.error(f"⚠️ Error loading data: {e}")
        st.stop()


@st.cache_data
def load_news_data():
    news_path = os.path.join(DATA_DIR, "global_news.csv")
    if os.path.exists(news_path):
        from engine.news import load_news
        return load_news(news_path)
    return pd.DataFrame()


@st.cache_data
def build_profiles_and_graph(exporters, buyers, transactions):
    exporter_profiles = build_exporter_profiles(exporters, transactions)
    buyer_profiles = build_buyer_profiles(buyers, transactions)
    graph = build_trade_graph(transactions)
    return exporter_profiles, buyer_profiles, graph


@st.cache_data
def train_ml_models(_exporter_profiles, _buyer_profiles, _transactions, _graph, _news_df):
    """Train buyer segmentation (K-Means) and match predictor (GB + RF ensemble)."""
    seg_result = train_buyer_segments(_buyer_profiles)
    gb_result = train_match_predictor(
        _exporter_profiles, _buyer_profiles, _transactions, _graph, _news_df,
        sample_size=800,
    )
    return seg_result, gb_result


# ==========================================================================
# SESSION STATE
# ==========================================================================
def init_session_state():
    defaults = {
        "card_index": 0,
        "swipe_history": [],
        "connected": [],
        "current_matches": [],
        "selected_exporter": None,
    }
    for key, val in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = val

init_session_state()


# ==========================================================================
# GLOBAL CSS
# ==========================================================================
def inject_global_css():
    """Premium, hand-crafted CSS — dark sidebar, clean main area."""
    st.markdown("""
<style>
/* ═══════════════════════════════════════════════════════════
   FORETRADE — PREMIUM CSS (dark side-nav, bright workspace)
   ═══════════════════════════════════════════════════════════ */

/* ── Typography ─────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
html, body, p, h1, h2, h3, h4, h5, h6, span, div, label, input, textarea, select, button,
[data-testid="stMarkdownContainer"], .stButton, .stTextInput, .stSelectbox {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
}
/* Preserve Material Icons font for Streamlit internal icons */
.material-symbols-rounded,
.material-symbols-outlined,
[data-testid="stIcon"],
[data-testid="stIconMaterial"],
span[class*="material"],
[data-baseweb="icon"] {
    font-family: 'Material Symbols Rounded', 'Material Icons' !important;
}

/* ── Body / Main Area ───────────────────────────────────── */
.stApp { background: #0f172a !important; }
section.main > div { max-width: 1120px; margin: 0 auto; }

/* ── Dark Sidebar ───────────────────────────────────────── */
[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%) !important;
    border-right: none !important;
    box-shadow: 4px 0 24px rgba(0,0,0,0.15);
}
[data-testid="stSidebar"] p,
[data-testid="stSidebar"] span,
[data-testid="stSidebar"] label,
[data-testid="stSidebar"] div:not([data-testid]):not([class*="material"]),
[data-testid="stSidebar"] li,
[data-testid="stSidebar"] input {
    color: #cbd5e1 !important;
}
/* Keep icon fonts untouched */
[data-testid="stSidebar"] .material-symbols-rounded,
[data-testid="stSidebar"] [data-testid="stIcon"] {
    color: #94a3b8 !important;
    font-family: 'Material Symbols Rounded' !important;
}
[data-testid="stSidebar"] h1, [data-testid="stSidebar"] h2,
[data-testid="stSidebar"] h3, [data-testid="stSidebar"] h4,
[data-testid="stSidebar"] h5, [data-testid="stSidebar"] strong {
    color: #f1f5f9 !important;
}
[data-testid="stSidebar"] hr {
    border-color: rgba(255,255,255,0.08) !important;
}
[data-testid="stSidebar"] [data-testid="stMarkdownContainer"] p {
    font-size: 0.88em;
}

/* Sidebar radio → vertical menu */
[data-testid="stSidebar"] .stRadio > div { gap: 0 !important; }
[data-testid="stSidebar"] .stRadio > div > label {
    padding: 11px 16px !important;
    border-radius: 8px;
    margin: 2px 0;
    cursor: pointer;
    transition: all 0.2s;
    color: #94a3b8 !important;
    font-weight: 500;
}
[data-testid="stSidebar"] .stRadio > div > label:hover {
    background: rgba(14,165,233,0.12) !important;
    color: #e2e8f0 !important;
}
[data-testid="stSidebar"] .stRadio > div > label[data-checked="true"],
[data-testid="stSidebar"] .stRadio > div > label[aria-checked="true"] {
    background: rgba(14,165,233,0.18) !important;
    color: #38bdf8 !important;
    font-weight: 600;
    border-left: 3px solid #0ea5e9;
}

/* Sidebar select boxes */
[data-testid="stSidebar"] .stSelectbox > div > div {
    background: rgba(255,255,255,0.06) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 8px;
}
[data-testid="stSidebar"] .stSelectbox label {
    color: #94a3b8 !important;
}

/* Sidebar sliders */
[data-testid="stSidebar"] .stSlider [role="slider"] {
    background: #0ea5e9 !important;
}
[data-testid="stSidebar"] .stSlider [data-testid="stThumbValue"] {
    color: #e2e8f0 !important;
}

/* Sidebar expander */
[data-testid="stSidebar"] .streamlit-expanderHeader {
    color: #94a3b8 !important;
    font-size: 0.9em;
}
[data-testid="stSidebar"] .streamlit-expanderContent {
    background: rgba(0,0,0,0.15) !important;
    border-radius: 8px;
}

/* Sidebar success box */
[data-testid="stSidebar"] [data-testid="stAlert"] {
    background: rgba(34,197,94,0.1) !important;
    border: 1px solid rgba(34,197,94,0.2) !important;
    color: #86efac !important;
}

/* Sidebar button */
[data-testid="stSidebar"] .stButton > button {
    background: rgba(239,68,68,0.12) !important;
    border: 1px solid rgba(239,68,68,0.25) !important;
    color: #fca5a5 !important;
    border-radius: 8px;
    font-weight: 600;
}
[data-testid="stSidebar"] .stButton > button:hover {
    background: rgba(239,68,68,0.22) !important;
    color: #fecaca !important;
}

/* ── Buttons (main area) ────────────────────────────────── */
.stButton > button {
    border-radius: 10px;
    font-weight: 600;
    letter-spacing: 0.2px;
    padding: 10px 22px;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.stButton > button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.stButton > button[kind="primary"] {
    background: linear-gradient(135deg, #0ea5e9, #0284c7) !important;
    border: none !important;
    color: white !important;
}
.stButton > button[kind="primary"]:hover {
    background: linear-gradient(135deg, #38bdf8, #0ea5e9) !important;
}

/* ── Progress bar ───────────────────────────────────────── */
.stProgress > div > div > div > div {
    background: linear-gradient(90deg, #0ea5e9, #22c55e) !important;
    border-radius: 8px;
}

/* ── Tabs ───────────────────────────────────────────────── */
.stTabs [data-baseweb="tab"] {
    font-weight: 600;
    color: #64748b;
    border-bottom-color: transparent;
    transition: all 0.2s;
}
.stTabs [data-baseweb="tab"]:hover { color: #0ea5e9; }
.stTabs [data-baseweb="tab"][aria-selected="true"] {
    color: #0ea5e9 !important;
    border-bottom-color: #0ea5e9 !important;
}

/* ── Expanders ──────────────────────────────────────────── */
.streamlit-expanderHeader { font-weight: 600; font-size: 0.95em; }
details { border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 12px !important; }

/* ── Data tables ────────────────────────────────────────── */
.stDataFrame { border-radius: 12px; overflow: hidden; }

/* ── Metrics ────────────────────────────────────────────── */
[data-testid="stMetric"] {
    background: rgba(255,255,255,0.05);
    padding: 14px 18px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.1);
}

/* ── Text inputs ────────────────────────────────────────── */
.stTextInput > div > div {
    border-radius: 10px !important;
    border-color: rgba(255,255,255,0.15) !important;
}
.stTextInput > div > div:focus-within {
    border-color: #0ea5e9 !important;
    box-shadow: 0 0 0 2px rgba(14,165,233,0.15) !important;
}

/* ── Select box ─────────────────────────────────────────── */
.stSelectbox > div > div {
    border-radius: 10px !important;
}

/* ── Custom scrollbar ───────────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* ── Alerts ─────────────────────────────────────────────── */
[data-testid="stAlert"] { border-radius: 10px !important; }

/* ── Hide Streamlit branding ────────────────────────────── */
#MainMenu { visibility: hidden; }
footer { visibility: hidden; }
header[data-testid="stHeader"] { background: transparent !important; }

/* ── Preserve ALL icon fonts globally ───────────────────── */
.material-symbols-rounded,
.material-symbols-outlined,
span[class*="material"] {
    font-family: 'Material Symbols Rounded', 'Material Icons' !important;
    -webkit-font-feature-settings: 'liga' !important;
    font-feature-settings: 'liga' !important;
}

/* ── Animations ─────────────────────────────────────────── */
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
}
section.main .block-container { animation: fadeInUp 0.35s ease-out; }
</style>
""", unsafe_allow_html=True)


# ==========================================================================
# SIDEBAR — new navigation matching prototype structure
# ==========================================================================
NAV_PAGES = [
    "🏠 Dashboard",
    "👍 Approve Leads",
    "✅ Approved Leads",
    "💬 Conversations",
    "📊 Analytics",
    "🔄 Algorithm",
    "📧 Outreach",
    "👤 Profile",
]


def render_sidebar(exporters: pd.DataFrame) -> dict:
    """Sidebar with logo, navigation, exporter picker, weight sliders."""
    # Logo
    st.sidebar.markdown("""<div style="display:flex;align-items:center;gap:12px;padding:12px 4px 20px;">
<div style="width:40px;height:40px;background:linear-gradient(135deg,#0ea5e9,#22c55e);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.2em;box-shadow:0 2px 8px rgba(14,165,233,0.3);">
🌍</div>
<div>
<div style="font-weight:800;font-size:1.15em;color:#f1f5f9 !important;line-height:1.2;letter-spacing:-0.3px;">ForeTrade</div>
<div style="font-size:0.72em;color:#64748b !important;letter-spacing:0.5px;text-transform:uppercase;">AI Export Engine</div>
</div>
</div>""", unsafe_allow_html=True)

    # Navigation
    page = st.sidebar.radio("Navigate", NAV_PAGES, index=0, label_visibility="collapsed")

    st.sidebar.divider()

    # Exporter selector
    st.sidebar.markdown("##### Select Exporter")
    exporter_options = dict(
        zip(
            exporters["exporter_id"] + " — " + exporters["company_name"],
            exporters["exporter_id"],
        )
    )
    selected_label = st.sidebar.selectbox(
        "Choose an exporter:", options=list(exporter_options.keys()), label_visibility="collapsed",
    )
    selected_id = exporter_options.get(selected_label, "E001")

    # Reset swipe state on exporter change
    prev = st.session_state.get("selected_exporter")
    if prev is None:
        st.session_state.selected_exporter = selected_id
    elif prev != selected_id:
        st.session_state.selected_exporter = selected_id
        st.session_state.card_index = 0
        st.session_state.swipe_history = []
        st.session_state.connected = []
        st.session_state.current_matches = []
        # Clear raw signal cache for the old exporter
        for k in list(st.session_state.keys()):
            if k.startswith("_raw_cache_"):
                del st.session_state[k]

    exp_name = exporters[exporters["exporter_id"] == selected_id]["company_name"]
    if not exp_name.empty:
        st.sidebar.success(f"**Viewing as:** {exp_name.iloc[0]}")

    st.sidebar.divider()

    # Weight sliders (collapsible)
    weights = SCORING_WEIGHTS.copy()
    with st.sidebar.expander("⚙️ Scoring Weights", expanded=False):
        st.caption("Adjust to see real-time match changes")
        for key, default_val in SCORING_WEIGHTS.items():
            label = key.replace("_", " ").title()
            weights[key] = st.slider(label, 0.0, 1.0, default_val, 0.05, key=f"w_{key}")
        total = sum(weights.values())
        if total > 0:
            weights = {k: round(v / total, 3) for k, v in weights.items()}

    # Logout
    st.sidebar.divider()
    user = st.session_state.get("user", {})
    st.sidebar.markdown(f"""<div style="font-size:0.82em;color:#64748b !important;padding:2px 4px;">
👤 <span style="color:#94a3b8 !important;">{user.get('first_name', '')} {user.get('last_name', '')}</span>
</div>""", unsafe_allow_html=True)
    if st.sidebar.button("🚪 Logout", width="stretch"):
        logout()
        st.rerun()

    return {
        "exporter_id": selected_id,
        "weights": weights,
        "page": page,
    }


# ==========================================================================
# PAGE: APPROVE LEADS  (the swipe page)
# ==========================================================================
def page_approve_leads(exporter_id: str, exporters: pd.DataFrame, buyers: pd.DataFrame,
                       transactions: pd.DataFrame, weights: dict):
    """Swipe-to-approve matchmaking page."""
    st.title("Approve Leads")
    st.caption("Review AI-curated leads. Approve, reject, or skip for later.")

    exp = exporters[exporters["exporter_id"] == exporter_id]
    if exp.empty:
        st.error("Exporter not found")
        return
    exp = exp.iloc[0]

    # KPI row
    matches_list = st.session_state.get("current_matches", [])
    total_leads = len(matches_list) if matches_list else "..."
    approved_ct = len(st.session_state.get("connected", []))
    rejected_ct = len([h for h in st.session_state.get("swipe_history", []) if h.get("direction") == "left"])

    k_cols = st.columns(4)
    kpi_data = [
        ("Weekly Leads", str(total_leads), "AI-matched", "#0ea5e9"),
        ("Approved", str(approved_ct), "This session", "#22c55e"),
        ("Rejected", str(rejected_ct), "This session", "#ef4444"),
        ("Skipped", "0", "Review later", "#f59e0b"),
    ]
    for col, (label, val, sub, clr) in zip(k_cols, kpi_data):
        col.markdown(f"""<div style="background:rgba(255,255,255,0.05);border-left:4px solid {clr};border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,.15);min-height:85px;">
<div style="font-size:0.78em;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">{label}</div>
<div style="font-size:1.7em;font-weight:800;color:#f1f5f9;">{val}</div>
<div style="font-size:0.75em;color:#64748b;">{sub}</div>
</div>""", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Exporter info header
    _cert = exp.get('certification', '')
    _cert_str = f" | 🏅 {_cert}" if _cert and str(_cert).lower() not in ('', 'nan', 'none') else ''
    _hire = exp.get('hiring_signal', 0)
    _hire_str = ' | 🚀 Hiring' if _hire == 1 else ''
    _pay = exp.get('good_payment_terms', 0)
    _pay_str = ' | ✅ Trusted Payer' if _pay == 1 else ''
    _emp = exp.get('employees', 'N/A')
    _rev = exp.get('annual_volume', None)
    try:
        _rev_str = f"${float(_rev):,.0f}" if _rev is not None and float(_rev) == float(_rev) else 'N/A'
    except (ValueError, TypeError):
        _rev_str = 'N/A'
    _state = exp.get('state', '')
    _state_str = f", {_state}" if _state and str(_state).lower() not in ('', 'nan') else ''

    st.markdown(f"""<div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%);padding:20px 24px;border-radius:14px;color:white;margin-bottom:12px;box-shadow:0 4px 16px rgba(15,23,42,0.25);position:relative;overflow:hidden;">
<div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(14,165,233,0.08);border-radius:50%;"></div>
<h4 style="margin:0;color:#f1f5f9;font-size:1.15em;font-weight:700;">{exp['company_name']}</h4>
<p style="margin:5px 0 0;color:#94a3b8;font-size:0.85em;line-height:1.5;">
📍 {exp['country']}{_state_str} &nbsp;·&nbsp;
🏭 {PRODUCT_CATEGORIES.get(str(exp.get('primary_hs', '')), exp.get('primary_hs', 'Unknown'))} &nbsp;·&nbsp;
👥 {_emp} &nbsp;·&nbsp; 💰 {_rev_str}{_cert_str}{_hire_str}{_pay_str}
</p>
</div>""", unsafe_allow_html=True)

    # Build profiles & generate matches
    exporter_profiles, buyer_profiles, graph = build_profiles_and_graph(exporters, buyers, transactions)
    exp_profile = exporter_profiles[exporter_profiles["exporter_id"] == exporter_id]
    if exp_profile.empty:
        st.error("Exporter profile not found")
        return
    exp_profile = exp_profile.iloc[0]

    news_df = load_news_data()

    # Cache raw signals so weight changes don't re-compute everything
    cache_key = f"_raw_cache_{exporter_id}"
    if cache_key not in st.session_state:
        st.session_state[cache_key] = _compute_raw_signals(
            exporter_id, exp_profile, buyer_profiles, graph, news_df
        )
    raw_cache = st.session_state[cache_key]

    matches = rank_matches_for_exporter(
        exporter_id, exp_profile, buyer_profiles, graph, weights,
        news_df=news_df, _raw_cache=raw_cache,
    )

    for match in matches:
        buyer_profile = buyer_profiles[buyer_profiles["buyer_id"] == match["buyer_id"]]
        if not buyer_profile.empty:
            buyer_profile = buyer_profile.iloc[0]
            match["explanation"] = generate_explanation(
                exp_profile.to_dict(), buyer_profile.to_dict(), match["score"], match["breakdown"]
            )
            match["importer_details"] = {
                "industry":           buyer_profile.get("industry", "—"),
                "country":            match.get("buyer_country", "—"),
                "preferred_channel":  buyer_profile.get("preferred_channel", "Email"),
                "intent_score":       buyer_profile.get("intent_score"),
                "revenue_usd":        buyer_profile.get("revenue_size_usd"),
                "team_size":          buyer_profile.get("team_size"),
                "good_payment":       buyer_profile.get("good_payment_history"),
                "engagement_spike":   buyer_profile.get("engagement_spike"),
                "decision_maker_change": buyer_profile.get("decision_maker_change"),
                "avg_order_tons":     buyer_profile.get("avg_order_tons"),
                "prompt_response":    buyer_profile.get("prompt_response"),
            }

            # Add ML segment label & confidence
            seg_id = get_segment_for_buyer(buyer_profile)
            seg_label, seg_color = get_segment_label(seg_id)
            match["importer_details"]["segment"] = seg_label
            match["importer_details"]["segment_color"] = seg_color
            match["ml_confidence_display"] = match.get("ml_confidence", 0.5)
            top_signal = max(match["breakdown"].items(), key=lambda x: x[1]["contribution"])[0]
            match["card_text"] = generate_match_card_text(
                match["buyer_name"], match["buyer_country"],
                match.get("buyer_type", "Unknown"), match["score"], top_signal,
            )

    st.session_state.current_matches = matches

    if matches:
        render_swipe_interface(matches)

        # Learning banner
        st.markdown("""<div style="background:rgba(14,165,233,0.1);border-left:4px solid #0ea5e9;border-radius:10px;padding:14px 18px;margin-top:12px;display:flex;align-items:center;gap:12px;">
<span style="font-size:1.3em;">🧠</span>
<div>
<div style="font-weight:700;font-size:0.9em;color:#e2e8f0;">Adaptive Learning Active</div>
<div style="font-size:0.82em;color:#94a3b8;">Each swipe adjusts the 9 signal weights in real-time — your ICP sharpens with every decision</div>
</div>
</div>""", unsafe_allow_html=True)
    else:
        st.warning("No matches found. Try adjusting scoring weights.")


# ==========================================================================
# PAGE ROUTERS
# ==========================================================================
def page_analytics():
    st.title("📊 Analytics")
    st.caption("Track your AI-powered export growth performance")
    matches = st.session_state.get("current_matches", [])
    render_match_analytics(matches)


def page_algorithm():
    st.title("🔄 How ForeTrade Works")
    render_algorithm_workflow()


def page_outreach():
    st.title("📧 Outreach Center")
    connected = st.session_state.get("connected", [])
    render_outreach_panel(connected)


# ==========================================================================
# MAIN ENTRY POINT
# ==========================================================================
def main():
    # ── Auth gate ─────────────────────────────────────────────────────
    if not st.session_state.get("authenticated"):
        render_login_page()
        return

    # ── Authenticated — load app ──────────────────────────────────────
    inject_global_css()
    inject_card_css()

    exporters, buyers, transactions = load_data()

    # Build profiles & graph (cached)
    exporter_profiles, buyer_profiles, graph = build_profiles_and_graph(exporters, buyers, transactions)
    news_df = load_news_data()

    # Train ML models once (spinner on first load only)
    if "ml_seg" not in st.session_state:
        with st.spinner("🤖 Training ML models (K-Means + Gradient Boosting ensemble)…"):
            seg_result, gb_result = train_ml_models(exporter_profiles, buyer_profiles, transactions, graph, news_df)
            st.session_state["ml_seg"] = seg_result
            st.session_state["ml_gb"] = gb_result

    config = render_sidebar(exporters)
    page = config["page"]

    if page == "🏠 Dashboard":
        render_dashboard_page(
            st.session_state.get("current_matches", []),
            st.session_state.get("connected", []),
            st.session_state.get("swipe_history", []),
        )

    elif page == "👍 Approve Leads":
        page_approve_leads(config["exporter_id"], exporters, buyers, transactions, config["weights"])

    elif page == "✅ Approved Leads":
        render_approved_leads_page(st.session_state.get("connected", []))

    elif page == "💬 Conversations":
        exp_name = exporters[exporters["exporter_id"] == config["exporter_id"]]["company_name"]
        company = exp_name.iloc[0] if not exp_name.empty else "Your Company"
        render_conversations_page(st.session_state.get("connected", []), company)

    elif page == "📊 Analytics":
        page_analytics()

    elif page == "🔄 Algorithm":
        page_algorithm()

    elif page == "📧 Outreach":
        page_outreach()

    elif page == "👤 Profile":
        render_profile_page()


if __name__ == "__main__":
    main()
