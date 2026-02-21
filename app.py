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
from engine.ltr_ranker import train_ltr_ranker, get_ltr_metrics, get_feedback_stats
from engine.nlp_engine import initialize_nlp, compute_nlp_sentiment, get_nlp_stats
from engine.graph_embeddings import train_graph_embeddings, get_embedding_stats
from engine.model_cache import cache_exists, load_cache, save_cache
from engine.explainer import generate_explanation, generate_match_card_text
from ui.swipe import render_swipe_interface, inject_card_css
from ui.dashboard import render_match_analytics, render_algorithm_workflow, render_outreach_panel
from engine.news_engine import NewsEngine
from ui.auth import render_login_page, logout
from ui.pages import (
    render_dashboard_page,
    render_approved_leads_page,
    render_conversations_page,
    render_profile_page,
)
from utils.constants import SCORING_WEIGHTS, PRODUCT_CATEGORIES
from engine.user_profile import build_user_exporter_profile

# Sentinel for real exporters (no dataset mapping — profile from user data)
USER_SELF_EXPORTER_ID = "USER_SELF"


def _get_demo_emails() -> set:
    """Demo accounts from config — no hardcoding. Comma-separated in .env."""
    raw = os.environ.get("FORETRADE_DEMO_EMAILS", "").strip()
    if not raw:
        return set()
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


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


@st.cache_resource
def get_news_engine():
    """Initialise the NewsEngine (class-based, cached as resource)."""
    news_csv = os.path.join(DATA_DIR, "global_news.csv")
    if os.path.exists(news_csv):
        return NewsEngine(news_csv)
    return None


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
    "🌐 Global Risk",
    "🔄 Algorithm",
    "🧪 Model Performance",
    "📧 Outreach",
    "👤 Profile",
]

def _is_exporter_self_view() -> bool:
    """True if the logged-in user is an exporter viewing their own data (hide exporter dropdown)."""
    user = st.session_state.get("user", {})
    email = (user.get("email") or "").strip().lower()
    demo_emails = _get_demo_emails()
    return bool(email and email not in demo_emails)


def _exporter_id_for_user(exporters: pd.DataFrame) -> str:
    """For real exporters: return USER_SELF so we use their profile. Demo accounts use sidebar picker."""
    if _is_exporter_self_view():
        return USER_SELF_EXPORTER_ID
    return exporters["exporter_id"].iloc[0] if len(exporters) else "E001"


def render_sidebar(exporters: pd.DataFrame) -> dict:
    """Sidebar with logo, navigation, exporter picker (only for demo accounts), weight sliders."""
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

    # Exporter: show dropdown only for demo accounts; for signed-up exporters, use their profile
    if _is_exporter_self_view():
        selected_id = _exporter_id_for_user(exporters)
        st.sidebar.markdown("##### Your export profile")
        user = st.session_state.get("user", {})
        display_name = (user.get("company") or "").strip() or (user.get("first_name") or "").strip()
        if not display_name:
            exp_name = exporters[exporters["exporter_id"] == selected_id]["company_name"]
            display_name = exp_name.iloc[0] if not exp_name.empty else "Your company"
        st.sidebar.success(f"**Viewing as:** {display_name}")
    else:
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
        selected_id = exporter_options.get(selected_label, exporters["exporter_id"].iloc[0] if len(exporters) else "E001")
        exp_name = exporters[exporters["exporter_id"] == selected_id]["company_name"]
        if not exp_name.empty:
            st.sidebar.success(f"**Viewing as:** {exp_name.iloc[0]}")

    # Reset swipe/matches on exporter change (keep connected — filter by exporter when displaying)
    prev = st.session_state.get("selected_exporter")
    if prev is None:
        st.session_state.selected_exporter = selected_id
    elif prev != selected_id:
        st.session_state.selected_exporter = selected_id
        st.session_state.card_index = 0
        st.session_state.swipe_history = []
        st.session_state.current_matches = []
        for k in list(st.session_state.keys()):
            if k.startswith("_raw_cache_"):
                del st.session_state[k]

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
    """Swipe-to-approve matchmaking page. Uses user profile for real exporters (model-driven)."""
    st.title("Approve Leads")
    st.caption("Review AI-curated leads. Approve, reject, or skip for later.")

    is_user_self = exporter_id == USER_SELF_EXPORTER_ID
    if is_user_self:
        user = st.session_state.get("user", {})
        exp_profile = build_user_exporter_profile(user)
        exp = exp_profile  # For header display
    else:
        exp = exporters[exporters["exporter_id"] == exporter_id]
        if exp.empty:
            st.error("Exporter not found")
            return
        exp = exp.iloc[0]
        exp_profile = None  # Built below from exporter_profiles

    # KPI row
    matches_list = st.session_state.get("current_matches", [])
    total_leads = len(matches_list) if matches_list else "..."
    all_connected = st.session_state.get("connected", [])
    approved_ct = len([
        c for c in all_connected
        if (c.get("exporter_id") or c.get("_exporter_id") or "") == exporter_id
    ])
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

    # Exporter info header — use YOUR company name when in "exporter self" view
    user = st.session_state.get("user", {})
    if _is_exporter_self_view():
        display_company = (user.get("company") or "").strip() or (user.get("first_name") or "").strip()
        if not display_company:
            display_company = exp["company_name"]
        industry_display = (user.get("industry") or exp.get("primary_hs") or "Trade").strip()
        header_subtitle = f"📍 Your industry: {industry_display} — AI-matched buyers below"
    else:
        display_company = exp["company_name"]
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
        header_subtitle = f"""📍 {exp['country']}{_state_str} &nbsp;·&nbsp;
🏭 {PRODUCT_CATEGORIES.get(str(exp.get('primary_hs', '')), exp.get('primary_hs', 'Unknown'))} &nbsp;·&nbsp;
👥 {_emp} &nbsp;·&nbsp; 💰 {_rev_str}{_cert_str}{_hire_str}{_pay_str}"""

    st.markdown(f"""<div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%);padding:20px 24px;border-radius:14px;color:white;margin-bottom:12px;box-shadow:0 4px 16px rgba(15,23,42,0.25);position:relative;overflow:hidden;">
<div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(14,165,233,0.08);border-radius:50%;"></div>
<h4 style="margin:0;color:#f1f5f9;font-size:1.15em;font-weight:700;">{display_company}</h4>
<p style="margin:5px 0 0;color:#94a3b8;font-size:0.85em;line-height:1.5;">
{header_subtitle}
</p>
</div>""", unsafe_allow_html=True)

    # Build profiles & generate matches
    exporter_profiles, buyer_profiles, graph = build_profiles_and_graph(exporters, buyers, transactions)
    if not is_user_self:
        exp_profile = exporter_profiles[exporter_profiles["exporter_id"] == exporter_id]
        if exp_profile.empty:
            st.error("Exporter profile not found")
            return
        exp_profile = exp_profile.iloc[0]
    # exp_profile already set from build_user_exporter_profile when is_user_self

    news_df = load_news_data()

    # Cache raw signals (user profile is stable per session — cache by USER_SELF)
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
                # EXIM buyer-readiness signals
                "hiring_growth":      buyer_profile.get("hiring_growth"),
                "funding_event":      buyer_profile.get("funding_event"),
                "response_probability": buyer_profile.get("response_probability"),
                # EXIM geo-political risk signals
                "tariff_news":        buyer_profile.get("tariff_news"),
                "stockmarket_shock":  buyer_profile.get("stockmarket_shock"),
                "war_event":          buyer_profile.get("war_event"),
                "natural_calamity":   buyer_profile.get("natural_calamity"),
                "currency_fluctuation": buyer_profile.get("currency_fluctuation"),
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
        render_swipe_interface(matches, exporter_id=exporter_id)

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
    eid = st.session_state.get("selected_exporter", "")
    all_connected = st.session_state.get("connected", [])
    connected = [
        c for c in all_connected
        if (c.get("exporter_id") or c.get("_exporter_id") or "") == eid
    ]
    render_outreach_panel(connected)


def page_global_risk():
    """🌐 Global Risk page — NewsEngine alerts overview."""
    st.title("🌐 Global Risk Monitor")
    st.caption("Analyse how global events impact your trade leads — powered by 8 000 geopolitical signals")

    ne = get_news_engine()

    if ne is None:
        st.error("News data not found. Ensure `data/global_news.csv` exists.")
        return

    industries = sorted(ne.df["Affected_Industry"].unique().tolist())

    # Collect alerts across all industries
    all_alerts = []
    for ind in industries:
        _, alerts = ne.calculate_modifier(ind)
        for a in alerts:
            a["industry"] = ind
            all_alerts.append(a)

    # ── KPI row (alert counts) ────────────────────────────────────────
    n_risk = len([a for a in all_alerts if a["type"] == "error"])
    n_warn = len([a for a in all_alerts if a["type"] == "warning"])
    n_opp  = len([a for a in all_alerts if a["type"] == "success"])
    k1, k2, k3, k4 = st.columns(4)
    kpis = [
        ("Industries Tracked", str(len(industries)), "From global news data", "#0ea5e9"),
        ("Risk Alerts", str(n_risk), "Wars, calamities, crashes", "#ef4444"),
        ("Warnings", str(n_warn), "Tariff changes, volatility", "#f59e0b"),
        ("Opportunities", str(n_opp), "Trade agreements, growth", "#22c55e"),
    ]
    for col, (lbl, val, sub, clr) in zip([k1, k2, k3, k4], kpis):
        col.markdown(f"""<div style="background:rgba(255,255,255,0.05);border-left:4px solid {clr};
        border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,.15);min-height:95px;">
        <div style="font-size:.78em;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">{lbl}</div>
        <div style="font-size:1.7em;font-weight:800;color:#f1f5f9;">{val}</div>
        <div style="font-size:.75em;color:#64748b;margin-top:2px;">{sub}</div>
        </div>""", unsafe_allow_html=True)

    st.markdown("")
    st.divider()

    # ── Active Global Alerts (interactive cards) ──────────────────────
    st.markdown("#### ⚠️ Active Global Alerts")

    # De-dup alerts by message
    seen_msgs = set()
    unique_alerts = []
    for a in all_alerts:
        if a["message"] not in seen_msgs:
            seen_msgs.add(a["message"])
            unique_alerts.append(a)

    if not unique_alerts:
        st.info("No significant global alerts at this time.")
        return

    # ── Filter controls ───────────────────────────────────────────────
    fc1, fc2, fc3 = st.columns([1.5, 1.5, 1])
    type_map = {"🔴 Risk": "error", "🟡 Warning": "warning", "🟢 Opportunity": "success"}
    with fc1:
        sel_types = st.multiselect(
            "Alert type",
            list(type_map.keys()),
            default=list(type_map.keys()),
            key="gr_alert_type",
        )
    regions_in = sorted({a.get("region", "Global") for a in unique_alerts})
    with fc2:
        sel_regions = st.multiselect("Region", regions_in, default=regions_in, key="gr_region")
    severity_opts = ["High", "Medium", "Low"]
    with fc3:
        sel_sev = st.multiselect("Severity", severity_opts, default=severity_opts, key="gr_sev")

    active_types = {type_map[t] for t in sel_types}
    filtered = [
        a for a in unique_alerts
        if a["type"] in active_types
        and a.get("region", "Global") in sel_regions
        and a.get("severity", "Medium") in sel_sev
    ]

    st.caption(f"Showing {len(filtered)} of {len(unique_alerts)} alerts")
    st.markdown("")

    # ── Card colour map ───────────────────────────────────────────────
    colour = {
        "error":   {"bg": "rgba(239,68,68,0.08)", "border": "#ef4444", "badge_bg": "#ef4444", "badge_txt": "#fff", "label": "RISK"},
        "warning": {"bg": "rgba(245,158,11,0.08)", "border": "#f59e0b", "badge_bg": "#f59e0b", "badge_txt": "#000", "label": "WARNING"},
        "success": {"bg": "rgba(34,197,94,0.08)",  "border": "#22c55e", "badge_bg": "#22c55e", "badge_txt": "#000", "label": "OPPORTUNITY"},
    }

    ALERTS_PER_PAGE = 6
    total_pages = max(1, -(-len(filtered) // ALERTS_PER_PAGE))
    page_num = st.number_input("Page", min_value=1, max_value=total_pages, value=1, step=1, key="gr_page", label_visibility="collapsed") if total_pages > 1 else 1
    page_slice = filtered[(page_num - 1) * ALERTS_PER_PAGE : page_num * ALERTS_PER_PAGE]

    # ── Render alert cards (2 per row) ────────────────────────────────
    for i in range(0, len(page_slice), 2):
        cols = st.columns(2)
        for ci, col in enumerate(cols):
            idx = i + ci
            if idx >= len(page_slice):
                break
            a = page_slice[idx]
            c = colour.get(a["type"], colour["warning"])
            region_tag = a.get("region", "")
            date_tag   = a.get("date", "")
            severity   = a.get("severity", "")
            link       = a.get("search_url", "#")
            sev_color  = "#ef4444" if severity == "High" else "#f59e0b" if severity == "Medium" else "#94a3b8"
            col.markdown(f"""
<div style="background:{c['bg']};border-left:4px solid {c['border']};border-radius:12px;
padding:20px 22px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,.12);min-height:170px;
display:flex;flex-direction:column;justify-content:space-between;">
  <div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span style="background:{c['badge_bg']};color:{c['badge_txt']};font-size:.65em;font-weight:700;
      padding:3px 8px;border-radius:4px;letter-spacing:.5px;">{c['label']}</span>
      <span style="font-size:.72em;color:{sev_color};font-weight:600;">{severity} Impact</span>
    </div>
    <div style="font-size:1.05em;font-weight:700;color:#f1f5f9;line-height:1.35;margin-bottom:8px;">
      {a.get('icon','')} {a['message']}
    </div>
    <div style="font-size:.78em;color:#94a3b8;margin-bottom:6px;">
      {a.get('impact','')}
    </div>
    <div style="display:flex;gap:14px;font-size:.72em;color:#64748b;">
      <span>🌍 {region_tag}</span>
      <span>📅 {date_tag}</span>
      <span>🏭 {a.get('industry','')}</span>
    </div>
  </div>
  <div style="margin-top:14px;">
    <a href="{link}" target="_blank" rel="noopener noreferrer"
       style="font-size:.78em;color:{c['border']};text-decoration:none;font-weight:600;
       border:1px solid {c['border']};border-radius:6px;padding:5px 14px;
       transition:background .15s;">
       Read more →
    </a>
  </div>
</div>""", unsafe_allow_html=True)

    if total_pages > 1:
        st.caption(f"Page {page_num} of {total_pages}")


# ==========================================================================
# MODEL PERFORMANCE PAGE
# ==========================================================================
def page_model_performance():
    """🧪 Model Performance — comprehensive ML evaluation dashboard."""
    import plotly.graph_objects as go
    import plotly.express as px

    st.title("🧪 Model Performance")
    st.caption("Deep-dive into every ML component powering ForeTrade's matching intelligence")

    # ── Collect metrics from all models ──────────────────────────────
    gb_metrics = get_ml_metrics()
    ltr_metrics = get_ltr_metrics()
    nlp_stats = get_nlp_stats()
    ge_stats = get_embedding_stats()
    fb_stats = get_feedback_stats()

    # ── Hero KPI row ─────────────────────────────────────────────────
    k1, k2, k3, k4, k5 = st.columns(5)
    hero_kpis = [
        ("GB+RF AUC", f"{gb_metrics.get('auc', 0):.3f}", "Match Quality", "#0ea5e9"),
        ("LTR NDCG@10", f"{ltr_metrics.get('ndcg_at_10', 0):.3f}", "Ranking Quality", "#8b5cf6"),
        ("NLP Docs", str(nlp_stats.get('n_documents', 0)), "News Indexed", "#22c55e"),
        ("Graph Nodes", str(ge_stats.get('n_embedded', 0)), "Embedded", "#f59e0b"),
        ("RLHF Buffer", f"{fb_stats.get('buffer_size', 0)}/{fb_stats.get('retrain_threshold', 15)}", "Swipe feedback", "#ef4444"),
    ]
    for col, (lbl, val, sub, clr) in zip([k1, k2, k3, k4, k5], hero_kpis):
        col.markdown(f"""<div style="background:rgba(255,255,255,0.05);border-left:4px solid {clr};
        border-radius:10px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.15);min-height:90px;">
        <div style="font-size:.72em;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">{lbl}</div>
        <div style="font-size:1.5em;font-weight:800;color:#f1f5f9;">{val}</div>
        <div style="font-size:.7em;color:#64748b;margin-top:2px;">{sub}</div>
        </div>""", unsafe_allow_html=True)

    st.markdown("")

    # ── Generalisation & Overfitting Diagnostics ─────────────────────
    st.markdown("#### 🛡️ Generalisation & Overfitting Diagnostics")
    st.caption("Proves this model works on **unseen data** — not just memorisation of the training set")

    gb_result = st.session_state.get("ml_gb", {})
    ltr_res   = st.session_state.get("ml_ltr", {})

    # -- Overfitting gap gauges
    og1, og2, og3 = st.columns(3)

    gb_gap  = gb_result.get("overfit_gap",  gb_metrics.get("overfit_gap", 0))
    ltr_gap = ltr_res.get("overfit_gap", ltr_metrics.get("overfit_gap", 0))

    def _gap_colour(gap):
        if gap <= 0.05: return "#22c55e", "Excellent"
        if gap <= 0.10: return "#84cc16", "Good"
        if gap <= 0.15: return "#f59e0b", "Acceptable"
        return "#ef4444", "High — auto-tightened"

    clr_gb, lbl_gb = _gap_colour(gb_gap)
    clr_ltr, lbl_ltr = _gap_colour(ltr_gap)

    with og1:
        st.markdown(f"""<div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px 18px;border:1px solid {clr_gb}40;">
        <div style="font-size:.75em;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">GB+RF Overfit Gap</div>
        <div style="font-size:1.7em;font-weight:800;color:{clr_gb};">{gb_gap*100:.1f}%</div>
        <div style="font-size:.72em;color:#64748b;">{lbl_gb} · Train R²={gb_result.get('train_r2', gb_metrics.get('train_r2', 0)):.3f} → Test R²={gb_result.get('r2', gb_metrics.get('r2', 0)):.3f}</div>
        </div>""", unsafe_allow_html=True)

    with og2:
        train_ndcg = ltr_res.get("train_ndcg", ltr_metrics.get("train_ndcg", 0))
        test_ndcg  = ltr_res.get("ndcg_at_10", ltr_metrics.get("ndcg_at_10", 0))
        st.markdown(f"""<div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px 18px;border:1px solid {clr_ltr}40;">
        <div style="font-size:.75em;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">LTR Overfit Gap</div>
        <div style="font-size:1.7em;font-weight:800;color:{clr_ltr};">{ltr_gap*100:.1f}%</div>
        <div style="font-size:.72em;color:#64748b;">{lbl_ltr} · Train NDCG={train_ndcg:.3f} → Test NDCG={test_ndcg:.3f}</div>
        </div>""", unsafe_allow_html=True)

    with og3:
        gb_holdout  = gb_result.get("holdout_pct", "20%")
        ltr_holdout = ltr_res.get("holdout_pct", "20%")
        gb_auto  = "✅ Yes" if gb_result.get("auto_tightened") else "—"
        ltr_auto = "✅ Yes" if ltr_res.get("auto_tightened") else "—"
        st.markdown(f"""<div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px 18px;border:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:.75em;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;">Holdout Config</div>
        <div style="font-size:.82em;color:#e2e8f0;margin-top:8px;line-height:1.8;">
        GB+RF holdout: <strong>{gb_holdout}</strong>  ·  Auto-tightened: {gb_auto}<br>
        LTR holdout: <strong>{ltr_holdout}</strong>  ·  Auto-tightened: {ltr_auto}<br>
        Augmentation: feature-masking 10% + noise ±5%
        </div></div>""", unsafe_allow_html=True)

    st.divider()
    st.markdown("#### 🏗️ ML-First Scoring Architecture")
    st.markdown("""
<div style="background:rgba(255,255,255,0.03);border-radius:14px;padding:20px 24px;border:1px solid rgba(255,255,255,0.06);margin-bottom:20px;">
<div style="font-size:.88em;color:#e2e8f0;line-height:1.7;">

**Final Score = 30% Weighted-Sum + 35% LTR LambdaRank + 25% GB+RF Ensemble + 10% Graph Embedding**

| Component | Weight | Model | What it learns |
|:---|:---:|:---|:---|
| 📐 Weighted-Sum | 30% | 9 hand-crafted signals | Explainable baseline — product fit, geography, trust |
| 🎯 LTR LambdaRank | 35% | LightGBM (listwise ranking) | Optimal buyer *ordering* — trained on trade history with NDCG |
| 🤖 GB+RF Ensemble | 25% | Gradient Boosting + Random Forest | Match *quality* regression — continuous score prediction |
| 🕸️ Graph Embedding | 10% | Node2Vec + Word2Vec (Skip-Gram) | Network structure — multi-hop trade relationships |

**Feedback Loop (RLHF):** Every swipe trains the LTR model — right swipes = positive signal, left = negative. After 15 swipes the ranker retrains with human preferences incorporated.

</div></div>
""", unsafe_allow_html=True)

    st.divider()

    # ── Tab layout for each model ────────────────────────────────────
    tab_gb, tab_ltr, tab_nlp, tab_graph, tab_rlhf = st.tabs([
        "🤖 GB+RF Ensemble", "🎯 LTR LambdaRank", "🧠 NLP Pipeline", "🕸️ Graph Embedding", "🔄 RLHF Loop"
    ])

    # ── TAB 1: GB+RF Ensemble ────────────────────────────────────────
    with tab_gb:
        st.markdown("##### Gradient Boosting + Random Forest Regression Ensemble")
        if gb_metrics:
            gb_result = st.session_state.get("ml_gb", {})

            # Holdout test metrics (primary)
            st.markdown("###### 🎯 Held-out Test Metrics (20% unseen data)")
            m1, m2, m3, m4, m5 = st.columns(5)
            m1.metric("AUC-ROC", f"{gb_metrics.get('auc', 0):.4f}")
            m2.metric("F1 Score", f"{gb_metrics.get('f1', 0):.4f}")
            m3.metric("R² Score", f"{gb_metrics.get('r2', 0):.4f}")
            m4.metric("MAE", f"{gb_metrics.get('mae', 0):.4f}")
            gap_val = gb_metrics.get('overfit_gap', gb_result.get('overfit_gap', 0))
            gap_clr = "#22c55e" if gap_val <= 0.10 else "#f59e0b" if gap_val <= 0.15 else "#ef4444"
            m5.markdown(f"""<div style="text-align:center;padding-top:6px;">
            <div style="font-size:.72em;color:#94a3b8;">Overfit Gap</div>
            <div style="font-size:1.4em;font-weight:800;color:{gap_clr};">{gap_val*100:.1f}%</div>
            </div>""", unsafe_allow_html=True)

            mc1, mc2 = st.columns(2)
            with mc1:
                st.markdown("###### All Metrics (Test + CV)")
                display_items = []
                for k, v in gb_metrics.items():
                    if k in ("feature_importance", "fold_scores"):
                        continue
                    display_items.append({
                        "Metric": k.replace("_", " ").title(),
                        "Value": f"{v:.4f}" if isinstance(v, float) else str(v),
                    })
                # Add CV metrics from result
                for cv_key in ("cv_accuracy", "cv_auc", "cv_f1", "cv_r2", "cv_mae"):
                    cv_val = gb_result.get(cv_key)
                    if cv_val is not None:
                        display_items.append({
                            "Metric": cv_key.replace("_", " ").title(),
                            "Value": f"{cv_val:.4f}" if isinstance(cv_val, float) else str(cv_val),
                        })
                for meta_key in ("train_size", "test_size", "holdout_pct", "augmentation"):
                    meta_val = gb_result.get(meta_key)
                    if meta_val is not None:
                        display_items.append({
                            "Metric": meta_key.replace("_", " ").title(),
                            "Value": str(meta_val),
                        })
                st.dataframe(pd.DataFrame(display_items), use_container_width=True, hide_index=True)

            with mc2:
                st.markdown("###### Feature Importance")
                fi = gb_result.get("feature_importance", {})
                if fi:
                    fi_df = pd.DataFrame({"Feature": list(fi.keys()), "Importance": list(fi.values())})
                    fi_df = fi_df.sort_values("Importance", ascending=True)
                    fig = px.bar(fi_df, x="Importance", y="Feature", orientation="h",
                                 color="Importance", color_continuous_scale=["#64748b", "#0ea5e9"])
                    fig.update_layout(height=350, margin=dict(l=10, r=10, t=10, b=10),
                                      plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)")
                    st.plotly_chart(fig, use_container_width=True)

            # Fold scores
            fold_scores = gb_result.get("fold_scores", [])
            if fold_scores:
                st.markdown("###### 5-Fold Cross-Validation (on 80% train split)")
                fold_df = pd.DataFrame(fold_scores)
                st.dataframe(fold_df, use_container_width=True, hide_index=True)
        else:
            st.info("GB+RF model not trained yet.")

    # ── TAB 2: LTR LambdaRank ───────────────────────────────────────
    with tab_ltr:
        st.markdown("##### LightGBM LambdaRank — Learning to Rank")
        if ltr_metrics and "error" not in ltr_metrics:
            l1, l2, l3, l4, l5 = st.columns(5)
            l1.metric("Test NDCG@10", f"{ltr_metrics.get('ndcg_at_10', 0):.4f}")
            l2.metric("CV NDCG@10", f"{ltr_metrics.get('cv_ndcg_at_10', ltr_metrics.get('ndcg_at_10', 0)):.4f}")
            l3.metric("Train Groups", str(ltr_metrics.get("n_train_groups", ltr_metrics.get("n_groups", 0))))
            l4.metric("Test Groups", str(ltr_metrics.get("n_test_groups", 0)))
            ltr_gap_val = ltr_metrics.get("overfit_gap", 0)
            ltr_gap_clr = "#22c55e" if ltr_gap_val <= 0.10 else "#f59e0b" if ltr_gap_val <= 0.15 else "#ef4444"
            l5.markdown(f"""<div style="text-align:center;padding-top:6px;">
            <div style="font-size:.72em;color:#94a3b8;">Overfit Gap</div>
            <div style="font-size:1.4em;font-weight:800;color:{ltr_gap_clr};">{ltr_gap_val*100:.1f}%</div>
            </div>""", unsafe_allow_html=True)

            lc1, lc2 = st.columns(2)
            with lc1:
                st.markdown("###### Per-Fold NDCG@10")
                fold_ndcg = ltr_metrics.get("fold_ndcg", [])
                if fold_ndcg:
                    fold_data = [{"Fold": i + 1, "NDCG@10": n} for i, n in enumerate(fold_ndcg)]
                    fig_fold = px.bar(pd.DataFrame(fold_data), x="Fold", y="NDCG@10",
                                      color="NDCG@10", color_continuous_scale=["#ef4444", "#22c55e"])
                    fig_fold.update_layout(height=300, margin=dict(l=10, r=10, t=10, b=10),
                                           plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)")
                    st.plotly_chart(fig_fold, use_container_width=True)

            with lc2:
                st.markdown("###### LTR Feature Importance (Gain)")
                ltr_fi = ltr_metrics.get("feature_importance", {})
                if ltr_fi:
                    ltr_fi_df = pd.DataFrame({"Feature": list(ltr_fi.keys()), "Importance": list(ltr_fi.values())})
                    ltr_fi_df = ltr_fi_df.sort_values("Importance", ascending=True)
                    fig_lfi = px.bar(ltr_fi_df, x="Importance", y="Feature", orientation="h",
                                     color="Importance", color_continuous_scale=["#64748b", "#8b5cf6"])
                    fig_lfi.update_layout(height=350, margin=dict(l=10, r=10, t=10, b=10),
                                          plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)")
                    st.plotly_chart(fig_lfi, use_container_width=True)

            st.markdown(f"""
<div style="background:rgba(139,92,246,0.08);border-left:4px solid #8b5cf6;border-radius:10px;padding:14px 18px;">
<div style="font-weight:700;font-size:.88em;color:#e2e8f0;">Why LambdaRank?</div>
<div style="font-size:.82em;color:#94a3b8;line-height:1.6;">
Unlike regression models that predict a score, LambdaRank directly optimises the <strong>ranking</strong> — 
it learns which buyer should appear before another. The NDCG metric measures whether 
high-value trade partners are ranked at the top. This is the same algorithm used by 
search engines and recommendation systems at scale.
</div></div>""", unsafe_allow_html=True)
        else:
            st.info("LTR model not trained yet.")

    # ── TAB 3: NLP Pipeline ──────────────────────────────────────────
    with tab_nlp:
        st.markdown("##### Sentence-Transformer + TF-IDF News Intelligence")
        if nlp_stats.get("initialized"):
            n1, n2, n3 = st.columns(3)
            n1.metric("Documents Indexed", str(nlp_stats.get("n_documents", 0)))
            n2.metric("TF-IDF Features", str(nlp_stats.get("tfidf_features", 0)))
            n3.metric("SBERT Available", "✅ Yes" if nlp_stats.get("sbert_available") else "❌ TF-IDF Only")

            if nlp_stats.get("sbert_available"):
                st.metric("Embedding Dimension", str(nlp_stats.get("embedding_dim", 0)))

            st.markdown(f"""
<div style="background:rgba(34,197,94,0.08);border-left:4px solid #22c55e;border-radius:10px;padding:14px 18px;">
<div style="font-weight:700;font-size:.88em;color:#e2e8f0;">NLP Architecture</div>
<div style="font-size:.82em;color:#94a3b8;line-height:1.6;">
<strong>Layer 1 — TF-IDF:</strong> Extracts 5,000 keyword features from 8,000 news events using 
bi-gram term frequency–inverse document frequency. Captures lexical overlap between 
trade context and news headlines.<br>
<strong>Layer 2 — all-MiniLM-L6-v2:</strong> Pre-trained sentence-transformer (22M parameters) encodes 
news events into 384-dimensional dense vectors. Cosine similarity captures <em>semantic</em> 
meaning — "trade embargo" is similar to "import restrictions" even without word overlap.<br>
<strong>Blending:</strong> 60% SBERT + 40% TF-IDF combines semantic understanding with keyword precision.
Recency-weighted aggregation with exponential decay (half-life = 90 days).
</div></div>""", unsafe_allow_html=True)
        else:
            st.info("NLP pipeline not initialised yet.")

    # ── TAB 4: Graph Embedding ───────────────────────────────────────
    with tab_graph:
        st.markdown("##### Node2Vec Graph Embeddings")
        if ge_stats and "error" not in ge_stats:
            g1, g2, g3, g4 = st.columns(4)
            g1.metric("Nodes Embedded", str(ge_stats.get("n_embedded", 0)))
            g2.metric("Embedding Dim", str(ge_stats.get("embedding_dim", 0)))
            g3.metric("Random Walks", str(ge_stats.get("n_walks", 0)))
            g4.metric("Walk Length", str(ge_stats.get("walk_length", 0)))

            st.markdown(f"""
<div style="background:rgba(245,158,11,0.08);border-left:4px solid #f59e0b;border-radius:10px;padding:14px 18px;">
<div style="font-weight:700;font-size:.88em;color:#e2e8f0;">Graph Embedding Architecture</div>
<div style="font-size:.82em;color:#94a3b8;line-height:1.6;">
<strong>Step 1 — Biased Random Walks:</strong> {ge_stats.get('n_walks', 0):,} walks of length {ge_stats.get('walk_length', 0)} 
with return parameter p={ge_stats.get('p', 1.0)} and in-out parameter q={ge_stats.get('q', 0.5)}. 
The bias favours BFS-like exploration to capture industry clusters.<br>
<strong>Step 2 — Skip-Gram Word2Vec:</strong> Treats node sequences as "sentences" and learns 
{ge_stats.get('embedding_dim', 64)}-dimensional dense vectors such that nodes co-occurring in walks 
have similar embeddings.<br>
<strong>Step 3 — Cosine Similarity:</strong> cos(exporter_embedding, buyer_embedding) captures multi-hop 
structural relationships that simple common-neighbours misses. Method: <code>{ge_stats.get('method', 'N/A')}</code>
</div></div>""", unsafe_allow_html=True)
        else:
            st.info("Graph embeddings not trained yet.")

    # ── TAB 5: RLHF Loop ────────────────────────────────────────────
    with tab_rlhf:
        st.markdown("##### Reinforcement Learning from Human Feedback")
        rc1, rc2, rc3 = st.columns(3)
        rc1.metric("Swipe Buffer", f"{fb_stats.get('buffer_size', 0)} / {fb_stats.get('retrain_threshold', 15)}")
        rc2.metric("Progress", f"{fb_stats.get('progress_pct', 0):.0f}%")
        rc3.metric("Next Retrain", f"After {max(0, fb_stats.get('retrain_threshold', 15) - fb_stats.get('buffer_size', 0))} swipes")

        # Progress bar
        progress = fb_stats.get("progress_pct", 0) / 100
        st.progress(min(progress, 1.0), text=f"RLHF retraining at {fb_stats.get('retrain_threshold', 15)} swipes")

        st.markdown("""
<div style="background:rgba(239,68,68,0.08);border-left:4px solid #ef4444;border-radius:10px;padding:14px 18px;">
<div style="font-weight:700;font-size:.88em;color:#e2e8f0;">How RLHF Works in ForeTrade</div>
<div style="font-size:.82em;color:#94a3b8;line-height:1.6;">
<strong>1. Collect:</strong> Every swipe right (approve) = relevance 4, swipe left (reject) = relevance 0. 
These are stored as pairwise ranking preferences.<br>
<strong>2. Accumulate:</strong> Feedback is buffered until the threshold is reached (15 swipes). 
This prevents noisy single-swipe retraining.<br>
<strong>3. Retrain:</strong> The LTR LambdaRank model is retrained with swipe feedback appended 
to the historical trade data. The model learns which features the user actually cares about.<br>
<strong>4. Deploy:</strong> Updated model is immediately used for the next batch of leads. 
The weight-sum signal weights are also adjusted via gradient feedback.<br>
<strong>Result:</strong> The more you swipe, the better ForeTrade understands your Ideal Customer Profile.
</div></div>""", unsafe_allow_html=True)


# ==========================================================================
# MAIN ENTRY POINT
# ==========================================================================
def main():
    # ── DB init (optional: app works without DB) ───────────────────────
    if "_db_ready" not in st.session_state:
        try:
            from db import init_db, init_demo_accounts
            init_db()
            init_demo_accounts()
            st.session_state["_db_ready"] = True
        except Exception:
            st.session_state["_db_ready"] = False

    # ── Auth gate ─────────────────────────────────────────────────────
    if not st.session_state.get("authenticated"):
        render_login_page()
        return

    # ── Authenticated — load app ──────────────────────────────────────
    inject_global_css()
    inject_card_css()

    # Load approved leads from DB for this user (persist across logout/login)
    uid = st.session_state.get("user_id")
    if uid and not st.session_state.get("_connected_loaded_from_db"):
        try:
            from db import get_user_approved_leads
            leads = get_user_approved_leads(uid)
            hydrated = []
            for lead in leads:
                bd = lead.get("buyer_details") or {}
                ma = lead.get("match_analysis") or {}
                importer_details = {k: v for k, v in bd.items() if k not in ("buyer_name", "buyer_country")}
                hydrated.append({
                    "buyer_id": lead["buyer_id"],
                    "buyer_name": bd.get("buyer_name") or lead["buyer_id"],
                    "buyer_country": bd.get("buyer_country") or "—",
                    "score": ma.get("score") or 0,
                    "breakdown": ma.get("breakdown") or {},
                    "importer_details": importer_details,
                    "lead_id": lead["id"],
                    "exporter_id": lead.get("exporter_id", ""),
                })
            st.session_state["connected"] = hydrated
            st.session_state["_connected_loaded_from_db"] = True
        except Exception:
            st.session_state["_connected_loaded_from_db"] = True  # avoid retry loop on DB error

    exporters, buyers, transactions = load_data()

    # Build profiles & graph (cached)
    exporter_profiles, buyer_profiles, graph = build_profiles_and_graph(exporters, buyers, transactions)
    news_df = load_news_data()

    # ── ML Model Loading (disk-cached for instant restarts) ────────────
    if "ml_seg" not in st.session_state:
        if cache_exists("ml_seg_gb"):
            with st.spinner("⚡ Loading cached ML models…"):
                cached = load_cache("ml_seg_gb")
                if cached:
                    st.session_state["ml_seg"] = cached["seg"]
                    st.session_state["ml_gb"] = cached["gb"]
                    # Restore model objects into ml_models module
                    from engine.ml_models import _restore_models
                    _restore_models(cached["gb"])
        if "ml_seg" not in st.session_state:
            with st.spinner("🤖 Training ML models (K-Means + GB+RF)… first run only"):
                seg_result, gb_result = train_ml_models(exporter_profiles, buyer_profiles, transactions, graph, news_df)
                st.session_state["ml_seg"] = seg_result
                st.session_state["ml_gb"] = gb_result
                save_cache("ml_seg_gb", {"seg": seg_result, "gb": gb_result})

    if "ml_ltr" not in st.session_state:
        if cache_exists("ml_ltr"):
            with st.spinner("⚡ Loading cached LTR model…"):
                cached_ltr = load_cache("ml_ltr")
                if cached_ltr:
                    from engine.ltr_ranker import restore_from_cache as ltr_restore
                    ltr_restore(cached_ltr)
                    st.session_state["ml_ltr"] = cached_ltr
        if "ml_ltr" not in st.session_state:
            with st.spinner("🎯 Training LTR model… first run only"):
                ltr_result = train_ltr_ranker(exporter_profiles, buyer_profiles, transactions, graph, news_df)
                st.session_state["ml_ltr"] = ltr_result
                save_cache("ml_ltr", ltr_result)

    if "ml_graph_emb" not in st.session_state:
        if cache_exists("ml_graph_emb"):
            with st.spinner("⚡ Loading cached graph embeddings…"):
                cached_ge = load_cache("ml_graph_emb")
                if cached_ge:
                    from engine.graph_embeddings import restore_from_cache as ge_restore
                    ge_restore(cached_ge)
                    st.session_state["ml_graph_emb"] = cached_ge
        if "ml_graph_emb" not in st.session_state:
            with st.spinner("🕸️ Learning graph embeddings… first run only"):
                ge_result = train_graph_embeddings(graph)
                st.session_state["ml_graph_emb"] = ge_result
                save_cache("ml_graph_emb", ge_result)

    if "ml_nlp" not in st.session_state and news_df is not None:
        if cache_exists("ml_nlp"):
            with st.spinner("⚡ Loading cached NLP pipeline…"):
                cached_nlp = load_cache("ml_nlp")
                if cached_nlp and cached_nlp.get("_news_texts"):
                    from engine.nlp_engine import restore_from_cache as nlp_restore
                    nlp_restore(cached_nlp)
                    st.session_state["ml_nlp"] = cached_nlp
        if "ml_nlp" not in st.session_state:
            with st.spinner("🧠 Initialising NLP pipeline… first run only"):
                nlp_result = initialize_nlp(news_df)
                st.session_state["ml_nlp"] = nlp_result
                save_cache("ml_nlp", nlp_result)

    # ── RLHF: If swipe buffer is full, retrain LTR from human feedback ───
    from engine.ltr_ranker import get_feedback_stats, maybe_retrain_from_feedback
    fb = get_feedback_stats()
    if fb["buffer_size"] >= fb["retrain_threshold"]:
        rlhf_result = maybe_retrain_from_feedback(
            exporter_profiles, buyer_profiles, transactions, graph, news_df
        )
        if rlhf_result and "error" not in rlhf_result:
            st.session_state["ml_ltr"] = rlhf_result
            save_cache("ml_ltr", rlhf_result)

    config = render_sidebar(exporters)
    page = config["page"]

    if page == "🏠 Dashboard":
        eid = config["exporter_id"]
        all_connected = st.session_state.get("connected", [])
        connected_for_exporter = [
            c for c in all_connected
            if (c.get("exporter_id") or c.get("_exporter_id") or "") == eid
        ]
        render_dashboard_page(
            st.session_state.get("current_matches", []),
            connected_for_exporter,
            st.session_state.get("swipe_history", []),
        )

    elif page == "👍 Approve Leads":
        page_approve_leads(config["exporter_id"], exporters, buyers, transactions, config["weights"])

    elif page == "✅ Approved Leads":
        eid = config["exporter_id"]
        all_connected = st.session_state.get("connected", [])
        connected_for_exporter = [
            c for c in all_connected
            if (c.get("exporter_id") or c.get("_exporter_id") or "") == eid
        ]
        render_approved_leads_page(connected_for_exporter)

    elif page == "💬 Conversations":
        eid = config["exporter_id"]
        all_connected = st.session_state.get("connected", [])
        connected_for_exporter = [
            c for c in all_connected
            if (c.get("exporter_id") or c.get("_exporter_id") or "") == eid
        ]
        if eid == USER_SELF_EXPORTER_ID:
            user = st.session_state.get("user", {})
            company = (user.get("company") or "").strip() or (user.get("first_name") or "").strip() or "Your Company"
        else:
            exp_name = exporters[exporters["exporter_id"] == eid]["company_name"]
            company = exp_name.iloc[0] if not exp_name.empty else "Your Company"
        render_conversations_page(connected_for_exporter, company)

    elif page == "📊 Analytics":
        page_analytics()

    elif page == "🌐 Global Risk":
        page_global_risk()

    elif page == "🔄 Algorithm":
        page_algorithm()

    elif page == "🧪 Model Performance":
        page_model_performance()

    elif page == "📧 Outreach":
        page_outreach()

    elif page == "👤 Profile":
        render_profile_page()


if __name__ == "__main__":
    main()
