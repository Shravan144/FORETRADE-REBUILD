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
    [ ] HOUR 8-10: Implement render_swipe_card()
    [ ] HOUR 10:   Implement render_swipe_interface()
    [ ] HOUR 10:   Wire up swipe callbacks to scorer.update_weights_from_swipe()
    [ ] HOUR 15:   Polish card styling with custom CSS
=============================================================================
"""

import streamlit as st
from typing import List, Optional


def render_swipe_card(match: dict) -> Optional[str]:
    """
    Render a single match card with swipe-like buttons.
    
    Args:
        match: Dict containing:
            - buyer_id, buyer_name, buyer_country
            - score, breakdown
            - explanation (from explainer)
            - card_text (from explainer.generate_match_card_text)
    
    Returns:
        "right" if user clicked Connect, "left" if Skip, None if no action
    """
    card = match.get("card_text", {})
    score = match.get("score", 0)
    
    # Score color
    if score >= 80:
        score_color = "#2ecc71"  # Green
    elif score >= 60:
        score_color = "#f39c12"  # Orange
    else:
        score_color = "#e74c3c"  # Red
    
    with st.container():
        st.markdown(f"""
        <div style="border: 2px solid #e0e0e0; border-radius: 16px; 
                    padding: 24px; margin: 16px 0; background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="margin:0; color: #2c3e50;">{card.get('title', 'Unknown')}</h2>
            <p style="color: #666; margin: 4px 0; font-size: 1.1em;">{card.get('subtitle', '')}</p>
            <div style="font-size: 2.5em; font-weight: bold; color: {score_color}; 
                        text-align: center; margin: 20px 0">
                {card.get('score_text', '?% Match')}
            </div>
            <div style="text-align: center; margin: 12px 0">
                <span style="background: #fff3cd; padding: 6px 12px; border-radius: 8px; 
                             font-size: 0.95em; font-weight: 500;">{card.get('badge', '')}</span>
            </div>
            <p style="margin-top: 16px; font-style: italic; color: #444; text-align: center; font-size: 1.05em;">
                {card.get('highlight', '')}
            </p>
        </div>
        """, unsafe_allow_html=True)
        
        # Explanation expander
        with st.expander("🔍 Why this match?"):
            st.write(match.get("explanation", "Explanation not available"))
            
            # Show score breakdown
            if match.get("breakdown"):
                breakdown = match["breakdown"]
                st.markdown("**Score Breakdown:**")
                for signal, data in breakdown.items():
                    signal_name = signal.replace("_", " ").title()
                    st.progress(
                        data["raw"], 
                        text=f"{signal_name}: {data['contribution']:.1f}% (weight: {data['weight']:.2f})"
                    )
        
        # Swipe buttons
        col1, col2 = st.columns(2)
        with col1:
            if st.button("✖ Skip", key=f"skip_{match['buyer_id']}", 
                          use_container_width=True, type="secondary"):
                return "left"
        with col2:
            if st.button("✔ Connect", key=f"connect_{match['buyer_id']}", 
                          type="primary", use_container_width=True):
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
        
        # Show progress
        progress = (st.session_state.card_index + 1) / len(matches)
        st.progress(progress, text=f"Match {st.session_state.card_index + 1} of {len(matches)}")
    else:
        st.success("🎉 You've reviewed all matches!")
        st.write(f"✅ Connected with {len(st.session_state.connected)} buyers")
        
        if st.button("🔄 Review Again"):
            st.session_state.card_index = 0
            st.rerun()


def inject_card_css() -> None:
    """
    Inject custom CSS for card styling.
    Call this once at the top of your app.
    
    TODO (HOUR 15): Customize colors, animations, shadows
    """
    st.markdown("""
    <style>
        /* Card hover effect */
        .stContainer > div {
            transition: transform 0.2s ease;
        }
        .stContainer > div:hover {
            transform: translateY(-2px);
        }
        
        /* Score color coding */
        .score-high   { color: #2ecc71; }
        .score-medium { color: #f39c12; }
        .score-low    { color: #e74c3c; }
        
        /* Button styling */
        .stButton > button {
            border-radius: 12px;
            font-size: 1.1em;
            padding: 12px 24px;
        }
    </style>
    """, unsafe_allow_html=True)
