"""
=============================================================================
FORETRADE — Main Streamlit Application
=============================================================================
This is your entry point. Run with:

    streamlit run app.py

ARCHITECTURE:
    ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
    │  Sidebar     │     │  Main Area   │     │  Analytics   │
    │             │     │              │     │              │
    │ • Exporter  │     │  Swipe Cards │     │  Charts      │
    │   selector  │     │  ┌────────┐  │     │  Graph Viz   │
    │ • Weight    │     │  │ Match  │  │     │  Workflow    │
    │   sliders   │     │  │ Card   │  │     │              │
    │ • Filters   │     │  └────────┘  │     │              │
    │             │     │ [Skip][Match]│     │              │
    └─────────────┘     └──────────────┘     └──────────────┘

PAGE STRUCTURE:
    1. 🏠 Home / Swipe to Export  — main swipe interface
    2. 📊 Analytics               — match analytics & charts
    3. 🔄 Algorithm               — visual workflow explanation
    4. 📧 Outreach                — connected buyers & email templates

TODO CHECKLIST:
    [ ] HOUR 8:  Basic app skeleton runs (just shows title + sidebar)
    [ ] HOUR 9:  Data loading works
    [ ] HOUR 10: Exporter selector works
    [ ] HOUR 11: Swipe cards appear (even with placeholder data)
    [ ] HOUR 12: Weight sliders connected to scoring
    [ ] HOUR 13: Analytics page works
    [ ] HOUR 14: Algorithm workflow page
    [ ] HOUR 15: Outreach page
    [ ] HOUR 16: Polish & CSS
    [ ] HOUR 17: Testing
=============================================================================
"""

import streamlit as st
import pandas as pd
import os

# --- Page Config (MUST be first Streamlit command) ---
st.set_page_config(
    page_title="ForeTrade — Swipe to Export",
    page_icon="🌍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- Imports from your modules ---
from engine.cleaner import clean_transactions, clean_exporters, clean_buyers, detect_high_intent_buyers
from engine.features import build_exporter_profiles, build_buyer_profiles
from engine.graph import build_trade_graph, get_graph_stats
from engine.scorer import rank_matches_for_exporter, get_adjusted_weights
from engine.explainer import generate_explanation, generate_match_card_text
from ui.swipe import render_swipe_interface, inject_card_css
from ui.dashboard import render_match_analytics, render_algorithm_workflow, render_outreach_panel
from utils.constants import SCORING_WEIGHTS, PRODUCT_CATEGORIES


# ==========================================================================
# DATA LOADING (cached so it doesn't reload on every interaction)
# ==========================================================================
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# Max transactions to load (keeps app fast; 334k+ rows was freezing)
MAX_TRANSACTIONS = 40_000

@st.cache_data
def load_data():
    """
    Load CSVs from the data/ folder and apply cleaning pipeline.
    Samples transactions if too large so the app doesn't hang.
    """
    try:
        exporters    = pd.read_csv(os.path.join(DATA_DIR, "exporters.csv"))
        buyers       = pd.read_csv(os.path.join(DATA_DIR, "buyers.csv"))
        transactions = pd.read_csv(os.path.join(DATA_DIR, "transactions.csv"))
        
        # Sample if too many rows (otherwise load_data() hangs on 300k+ rows)
        if len(transactions) > MAX_TRANSACTIONS:
            transactions = transactions.sample(n=MAX_TRANSACTIONS, random_state=42).reset_index(drop=True)
        
        # Apply cleaning pipeline
        transactions = clean_transactions(transactions)
        exporters = clean_exporters(exporters)
        buyers = clean_buyers(buyers)
        buyers = detect_high_intent_buyers(buyers, transactions)
        
        return exporters, buyers, transactions
    except FileNotFoundError:
        st.error("⚠️ Data files not found! Run `python data/generate_synthetic.py` first.")
        st.stop()
    except Exception as e:
        st.error(f"⚠️ Error loading data: {str(e)}")
        st.stop()


# ==========================================================================
# SESSION STATE INITIALIZATION
# ==========================================================================
def init_session_state():
    """Initialize session state variables."""
    defaults = {
        "card_index":     0,
        "swipe_history":  [],
        "connected":      [],
        "current_matches": [],
        "selected_exporter": None,
    }
    for key, val in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = val

init_session_state()


# ==========================================================================
# SIDEBAR
# ==========================================================================
def render_sidebar(exporters: pd.DataFrame) -> dict:
    """
    Render the sidebar with controls.
    
    Returns:
        Dict with user selections: {exporter_id, weights, page}
    """
    st.sidebar.title("🌍 ForeTrade")
    st.sidebar.caption("Swipe to Export — Intelligent Matchmaking")
    
    # Page navigation
    page = st.sidebar.radio(
        "Navigate",
        ["🏠 Swipe to Export", "📊 Analytics", "🔄 Algorithm", "📧 Outreach"],
        index=0,
    )
    
    st.sidebar.divider()
    
    # Exporter selector
    st.sidebar.header("Select Exporter")
    exporter_options = dict(
        zip(
            exporters["exporter_id"] + " — " + exporters["company_name"],
            exporters["exporter_id"],
        )
    )
    selected_label = st.sidebar.selectbox(
        "Choose an exporter to find matches for:",
        options=list(exporter_options.keys()),
    )
    selected_id = exporter_options.get(selected_label, "E001")
    
    # Show "Viewing as" (exporter dashboard feel — no login needed)
    exp_name = exporters[exporters["exporter_id"] == selected_id]["company_name"]
    if not exp_name.empty:
        st.sidebar.success(f"**Viewing as:** {exp_name.iloc[0]}")
    
    st.sidebar.divider()
    
    # Weight sliders
    st.sidebar.header("⚙️ Scoring Weights")
    st.sidebar.caption("Adjust to see how matches change in real-time")
    
    weights = {}
    for key, default_val in SCORING_WEIGHTS.items():
        label = key.replace("_", " ").title()
        weights[key] = st.sidebar.slider(
            label, 0.0, 1.0, default_val, 0.05,
        )
    
    # Normalize weights
    total = sum(weights.values())
    if total > 0:
        weights = {k: round(v / total, 3) for k, v in weights.items()}
    
    return {
        "exporter_id": selected_id,
        "weights": weights,
        "page": page,
    }


# ==========================================================================
# MAIN PAGES
# ==========================================================================
@st.cache_data
def build_profiles_and_graph(exporters, buyers, transactions):
    """Build profiles and graph (cached for performance)."""
    exporter_profiles = build_exporter_profiles(exporters, transactions)
    buyer_profiles = build_buyer_profiles(buyers, transactions)
    graph = build_trade_graph(transactions)
    return exporter_profiles, buyer_profiles, graph


def page_swipe(exporter_id: str, exporters: pd.DataFrame, buyers: pd.DataFrame, 
               transactions: pd.DataFrame, weights: dict):
    """
    Main swipe page.
    """
    st.title("🏠 Swipe to Export")
    
    exp = exporters[exporters["exporter_id"] == exporter_id]
    if exp.empty:
        st.error("Exporter not found")
        return
    exp = exp.iloc[0]
    
    # Exporter info header
    st.markdown(f"""
    **{exp['company_name']}** | {exp['country']} | 
    Primary: {PRODUCT_CATEGORIES.get(str(exp.get('primary_hs', '')), exp.get('primary_hs', 'Unknown'))} | 
    Employees: {exp.get('employees', 'N/A')}
    """)
    
    st.divider()
    
    # Build profiles and graph
    exporter_profiles, buyer_profiles, graph = build_profiles_and_graph(
        exporters, buyers, transactions
    )
    
    # Get exporter profile
    exp_profile = exporter_profiles[exporter_profiles["exporter_id"] == exporter_id]
    if exp_profile.empty:
        st.error("Exporter profile not found")
        return
    exp_profile = exp_profile.iloc[0]
    
    # Generate matches
    matches = rank_matches_for_exporter(
        exporter_id, exp_profile, buyer_profiles, graph, weights
    )
    
    # Add explanations, card text, and full importer details to matches
    for match in matches:
        buyer_profile = buyer_profiles[buyer_profiles["buyer_id"] == match["buyer_id"]]
        if not buyer_profile.empty:
            buyer_profile = buyer_profile.iloc[0]
            match["explanation"] = generate_explanation(
                exp_profile.to_dict(), buyer_profile.to_dict(), 
                match["score"], match["breakdown"]
            )
            
            # Full importer details for the card (industry, channel, intent, etc.)
            match["importer_details"] = {
                "industry": buyer_profile.get("industry", "—"),
                "country": match.get("buyer_country", "—"),
                "preferred_channel": buyer_profile.get("preferred_channel", "Email"),
                "intent_score": buyer_profile.get("intent_score"),
                "revenue_usd": buyer_profile.get("revenue_size_usd"),
                "team_size": buyer_profile.get("team_size"),
            }
            
            # Find top signal
            top_signal = max(match["breakdown"].items(), key=lambda x: x[1]["contribution"])[0]
            match["card_text"] = generate_match_card_text(
                match["buyer_name"],
                match["buyer_country"],
                match.get("buyer_type", "Unknown"),
                match["score"],
                top_signal
            )
    
    # Store matches in session state
    st.session_state.current_matches = matches
    
    # Render swipe interface
    if matches:
        render_swipe_interface(matches)
    else:
        st.warning("No matches found for this exporter. Try adjusting the scoring weights.")


def page_analytics():
    """
    Analytics page.
    """
    st.title("📊 Match Analytics")
    matches = st.session_state.get("current_matches", [])
    render_match_analytics(matches)


def page_algorithm():
    """
    Algorithm workflow page.
    """
    st.title("🔄 How ForeTrade Works")
    render_algorithm_workflow()


def page_outreach():
    """
    Outreach page.
    """
    st.title("📧 Outreach Center")
    connected = st.session_state.get("connected", [])
    render_outreach_panel(connected)


# ==========================================================================
# APP ENTRY POINT
# ==========================================================================
def main():
    # Inject CSS
    inject_card_css()
    
    # Load data
    exporters, buyers, transactions = load_data()
    
    # Render sidebar and get user selections
    config = render_sidebar(exporters)
    
    # Route to selected page
    page = config["page"]
    
    if page == "🏠 Swipe to Export":
        page_swipe(config["exporter_id"], exporters, buyers, transactions, config["weights"])
    elif page == "📊 Analytics":
        page_analytics()
    elif page == "🔄 Algorithm":
        page_algorithm()
    elif page == "📧 Outreach":
        page_outreach()


if __name__ == "__main__":
    main()
