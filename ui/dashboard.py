"""
=============================================================================
DASHBOARD COMPONENT — ForeTrade
=============================================================================
Analytics and visualization views for the Streamlit app.

PAGES TO BUILD:
    1. Scoring Weights Dashboard — sliders to adjust weights in real-time
    2. Match Analytics — charts showing match distribution, top matches
    3. Trade Graph Visualization — interactive network graph
    4. Algorithm Workflow — visual explanation of how matches are generated

TODO CHECKLIST:
    [ ] HOUR 10-12: Implement render_weight_sliders()
    [ ] HOUR 12:    Implement render_match_analytics()
    [ ] HOUR 14:    Implement render_algorithm_workflow()
    [ ] HOUR 15:    (Optional) Implement render_graph_viz()
    [ ] HOUR 16:    (Optional) Implement render_outreach_panel()
=============================================================================
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from typing import List, Dict
from utils.constants import SCORING_WEIGHTS


def render_weight_sliders() -> dict:
    """
    ⭐ REAL-TIME ADAPTABILITY DEMO
    
    Render sliders that let users adjust scoring weights live.
    This directly demonstrates "system adapts in real-time."
    
    Returns:
        Dict of adjusted weights (same keys as SCORING_WEIGHTS)
    
    TODO (HOUR 10-12): Implement this
    
    HINT:
        st.sidebar.header("⚙️ Scoring Weights")
        weights = {}
        for key, default_val in SCORING_WEIGHTS.items():
            label = key.replace("_", " ").title()
            weights[key] = st.sidebar.slider(
                label, 0.0, 1.0, default_val, 0.05,
                help=f"Weight for {label} in match scoring"
            )
        
        # Normalize
        total = sum(weights.values())
        if total > 0:
            weights = {k: v/total for k, v in weights.items()}
        
        # Show normalized weights
        st.sidebar.markdown("**Normalized:**")
        for k, v in weights.items():
            st.sidebar.text(f"  {k}: {v:.2f}")
        
        return weights
    """
    # TODO: Implement weight sliders
    return SCORING_WEIGHTS.copy()  # Placeholder


def render_match_analytics(matches: List[dict]) -> None:
    """
    Show charts and analytics about the generated matches.
    
    Charts to display:
        1. Score distribution histogram
        2. Top matches bar chart
        3. Match by country pie chart
        4. Signal contribution stacked bar
    """
    if not matches:
        st.warning("No matches to analyze. Generate matches first by selecting an exporter.")
        return
    
    df = pd.DataFrame(matches)
    
    # Score distribution
    fig1 = px.histogram(
        df, 
        x="score", 
        nbins=20, 
        title="Match Score Distribution",
        labels={"score": "Match Score", "count": "Number of Matches"}
    )
    st.plotly_chart(fig1, use_container_width=True)
    
    # Top matches
    top = df.nlargest(10, "score")
    fig2 = px.bar(
        top, 
        x="buyer_name", 
        y="score",
        title="Top 10 Matches", 
        color="score",
        color_continuous_scale="Greens",
        labels={"buyer_name": "Buyer", "score": "Match Score"}
    )
    fig2.update_xaxes(tickangle=45)
    st.plotly_chart(fig2, use_container_width=True)
    
    # Country distribution
    if "buyer_country" in df.columns:
        fig3 = px.pie(
            df, 
            names="buyer_country", 
            title="Matches by Country",
            values=[1] * len(df)  # Count occurrences
        )
        st.plotly_chart(fig3, use_container_width=True)
    
    # Signal contribution (if breakdown available)
    if matches and "breakdown" in matches[0]:
        signal_data = []
        for match in matches:
            breakdown = match.get("breakdown", {})
            for signal, data in breakdown.items():
                signal_data.append({
                    "match": match.get("buyer_name", "Unknown"),
                    "signal": signal.replace("_", " ").title(),
                    "contribution": data.get("contribution", 0)
                })
        
        if signal_data:
            signal_df = pd.DataFrame(signal_data)
            fig4 = px.bar(
                signal_df,
                x="match",
                y="contribution",
                color="signal",
                title="Signal Contribution by Match",
                labels={"match": "Buyer", "contribution": "Contribution (%)"},
                barmode="stack"
            )
            fig4.update_xaxes(tickangle=45)
            st.plotly_chart(fig4, use_container_width=True)


def render_algorithm_workflow() -> None:
    """
    ⭐ VISUAL EXPLANATION — Judges specifically asked for this.
    
    Show a visual flowchart/diagram of how the algorithm works.
    
    Display:
        Raw Data → Cleaning → Feature Eng. → Graph → Scoring → Matches
    """
    st.markdown('''
    ## 🔄 How ForeTrade Generates Matches
    
    ```
    📦 Raw EXIM Data (2000+ transactions)
        ↓
    🧹 Data Cleaning & Normalization
        • Remove missing values (median imputation)
        • Remove outliers (top 1%)
        • Standardize trade values (MinMaxScaler)
        • Detect high-intent buyers
        ↓
    🔬 Feature Engineering
        • Build exporter profiles (volume, diversity, growth)
        • Build buyer profiles (frequency, recency, intent)
        • Compute pairwise compatibility features
        ↓
    🕸️ Graph Analysis (NetworkX)
        • Build bipartite trade network
        • Compute structural similarity (Jaccard coefficient)
        • Find common trade connections
        ↓
    ⚖️ Multi-Signal Scoring
        • Product Compatibility (30%)
        • Geography Fit (20%)
        • Graph Affinity (20%)
        • Trade Frequency (15%)
        • Buyer Activity (15%)
        ↓
    🎯 Ranked Match Suggestions
        • Score threshold filtering (min 30%)
        • Top-K selection (top 10 matches)
        • Explanation generation
        ↓
    📱 Swipe to Export Interface
        • Card-based browsing
        • Right = Connect, Left = Skip
        ↓
    🔄 Adaptive Feedback Loop
        • Swipe data adjusts weights
        • System learns user preferences
        • Matches improve over time
    ```
    ''')
    
    st.divider()
    
    st.markdown('''
    ## 📊 Scoring Formula
    
    $$
    \\text{Match Score} = \\sum_{i=1}^{5} w_i \\times s_i \\times 100
    $$
    
    Where:
    - $w_i$ = weight for signal $i$ (adjustable via sidebar sliders)
    - $s_i$ = signal value for signal $i$ (normalized 0–1)
    
    ## 🔄 Real-Time Adaptability
    
    When a user swipes:
    - **Right** → boost weight of top contributing signal by 5%
    - **Left** → reduce weight of top contributing signal by 3%
    
    Weights are re-normalized after each swipe to maintain sum = 1.0.
    ''')


def render_outreach_panel(connected_buyers: List[dict]) -> None:
    """
    Show outreach-ready outputs for buyers the user swiped right on.
    
    Display:
        - Buyer contact info (simulated)
        - Suggested email template
        - "Send via Email" button (simulated)
        - "Connect on LinkedIn" button (simulated)
    
    This satisfies: "Outreach-ready outputs" and "Integrated outreach-ready flow"
    """
    if not connected_buyers:
        st.info("👆 Swipe right on matches to see outreach options here")
        return
    
    st.success(f"✅ Ready to reach out to {len(connected_buyers)} buyers!")
    st.divider()
    
    for buyer in connected_buyers:
        with st.expander(f"📧 {buyer.get('buyer_name', 'Unknown')} — {buyer.get('buyer_country', 'Unknown')} (Score: {buyer.get('score', 0):.1f}%)"):
            st.write(f"**Match Score:** {buyer.get('score', 0):.1f}%")
            st.write(f"**Country:** {buyer.get('buyer_country', 'Unknown')}")
            st.write(f"**Type:** {buyer.get('buyer_type', 'Unknown')}")
            
            # Email template
            st.markdown("**Suggested Email Template:**")
            email = f'''Subject: Export Partnership Opportunity — {buyer.get('buyer_name', 'Business Partnership')}

Dear {buyer.get('buyer_name', 'Team')} team,

We are a leading exporter based on our analysis of global trade patterns. 
Based on our intelligent matchmaking system, we believe there's a strong 
alignment between our export capabilities and your import requirements.

Match Score: {buyer.get('score', 0):.1f}%
Key Compatibility Factors:
{buyer.get('explanation', 'Strong trade compatibility')}

We'd love to discuss a potential partnership and explore how we can 
support your import needs.

Best regards,
[Your Company Name]
[Your Contact Information]
'''
            st.code(email, language="text")
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("📧 Copy Email", key=f"email_{buyer.get('buyer_id', 'unknown')}"):
                    st.success("Email template copied! (Simulated)")
            with col2:
                if st.button("🔗 Connect on LinkedIn", key=f"linkedin_{buyer.get('buyer_id', 'unknown')}"):
                    st.success("LinkedIn connection initiated! (Simulated)")
