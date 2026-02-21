"""
=============================================================================
FORETRADE — Database Layer (Public API)
=============================================================================
Production-ready SQLite + SQLAlchemy 2.0 for Streamlit.
All functions return native Python types (dict/list/primitives).

Usage:
    from db import init_db, get_db, verify_user, save_swipe, ...

    init_db()
    init_demo_accounts()
    user = verify_user("shravan@foretrade.ai", "shravan123")
"""
from db.models import Base, User, SwipeDecision, ApprovedLead, Conversation, UserWeights, AnalyticsCache
from db.operations import (
    init_db,
    get_db,
    _sanitize_for_json,
    verify_user,
    create_user,
    save_swipe,
    save_approved_lead,
    get_user_approved_leads,
    update_lead_status,
    save_conversation_message,
    get_conversation_history,
    save_user_weights,
    get_user_weights,
    get_user_analytics,
    set_analytics_cache,
    get_analytics_cache,
    init_demo_accounts,
    get_user_by_email,
)

__all__ = [
    # Models (for advanced use)
    "Base",
    "User",
    "SwipeDecision",
    "ApprovedLead",
    "Conversation",
    "UserWeights",
    "AnalyticsCache",
    # Core
    "init_db",
    "get_db",
    "_sanitize_for_json",
    # Auth
    "verify_user",
    "create_user",
    "get_user_by_email",
    # Swipes
    "save_swipe",
    # Leads
    "save_approved_lead",
    "get_user_approved_leads",
    "update_lead_status",
    # Conversation
    "save_conversation_message",
    "get_conversation_history",
    # Weights
    "save_user_weights",
    "get_user_weights",
    # Analytics
    "get_user_analytics",
    "set_analytics_cache",
    "get_analytics_cache",
    # Demo
    "init_demo_accounts",
]
