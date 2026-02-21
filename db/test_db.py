"""
=============================================================================
FORETRADE — Database layer tests / examples
=============================================================================
Run from project root:  python -m db.test_db
Uses a temporary DB (FORETRADE_DB_PATH=test_foretrade.db) so production data is untouched.
=============================================================================
"""

import os
import sys

# Use a test DB so we don't touch production
os.environ.setdefault("FORETRADE_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "test_foretrade.db"))

# Ensure project root on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import (
    init_db,
    init_demo_accounts,
    verify_user,
    create_user,
    get_user_by_email,
    save_swipe,
    save_approved_lead,
    get_user_approved_leads,
    update_lead_status,
    save_conversation_message,
    get_conversation_history,
    save_user_weights,
    get_user_weights,
    get_user_analytics,
    _sanitize_for_json,
)


def test_sanitize():
    """Validate numpy type conversion for JSON."""
    import numpy as np
    raw = {"a": np.int64(1), "b": np.float64(2.5), "c": [np.int32(3)]}
    out = _sanitize_for_json(raw)
    assert out == {"a": 1, "b": 2.5, "c": [3]}
    assert isinstance(out["a"], int)
    assert isinstance(out["b"], float)
    print("  _sanitize_for_json: OK")


def test_init_and_demo():
    init_db()
    init_demo_accounts()
    print("  init_db + init_demo_accounts: OK")


def test_verify_user():
    u = verify_user("shravan@foretrade.ai", "shravan123")
    assert u is not None
    assert u["email"] == "shravan@foretrade.ai"
    assert "password_hash" not in u
    assert verify_user("nobody@x.com", "wrong") is None
    print("  verify_user: OK")


def test_create_user():
    try:
        u = create_user(
            "test_db_user@foretrade.ai",
            "testpass123",
            first_name="Test",
            last_name="User",
            company="Test Co.",
        )
        assert u["email"] == "test_db_user@foretrade.ai"
        assert u["first_name"] == "Test"
    except ValueError as e:
        if "already exists" in str(e).lower():
            pass  # idempotent run
        else:
            raise
    print("  create_user: OK")


def test_save_swipe():
    u = get_user_by_email("shravan@foretrade.ai")
    assert u is not None
    r = save_swipe(
        user_id=u["id"],
        exporter_id="E001",
        buyer_id="B001",
        direction="right",
        match_score=82.5,
        breakdown={"product_compatibility": 0.9, "geography_fit": 0.7},
    )
    assert r["id"] is not None
    assert r["direction"] == "right"
    assert r["match_score"] == 82.5
    try:
        save_swipe(u["id"], "E001", "B002", "invalid", session=None)
    except ValueError:
        pass
    print("  save_swipe: OK")


def test_approved_leads():
    u = get_user_by_email("shravan@foretrade.ai")
    lead = save_approved_lead(
        user_id=u["id"],
        exporter_id="E001",
        buyer_id="B001",
        buyer_details={"industry": "Electronics", "country": "USA"},
        match_analysis={"score": 85, "breakdown": {}},
        pipeline_status="pending",
    )
    assert lead["id"] is not None
    assert lead["pipeline_status"] == "pending"
    leads = get_user_approved_leads(u["id"], exporter_id="E001")
    assert len(leads) >= 1
    updated = update_lead_status(lead["id"], "contacted")
    assert updated is not None
    assert updated["pipeline_status"] == "contacted"
    assert update_lead_status(999999, "won") is None
    print("  save_approved_lead / get_user_approved_leads / update_lead_status: OK")


def test_conversation():
    u = get_user_by_email("shravan@foretrade.ai")
    leads = get_user_approved_leads(u["id"])
    if not leads:
        lead = save_approved_lead(u["id"], "E001", "B002", pipeline_status="pending")
        lead_id = lead["id"]
    else:
        lead_id = leads[0]["id"]
    m1 = save_conversation_message(lead_id, "user", "Hello, we have an offer.")
    m2 = save_conversation_message(lead_id, "bot", "Thanks! I'll share with the team.")
    assert m1["role"] == "user"
    assert m2["role"] == "bot"
    history = get_conversation_history(lead_id)
    assert len(history) >= 2
    print("  save_conversation_message / get_conversation_history: OK")


def test_user_weights():
    u = get_user_by_email("shravan@foretrade.ai")
    save_user_weights(u["id"], {"product_compatibility": 0.25, "geography_fit": 0.15}, version=1)
    w = get_user_weights(u["id"])
    assert w is not None
    assert w["weights"]["product_compatibility"] == 0.25
    assert get_user_weights(999999) is None
    print("  save_user_weights / get_user_weights: OK")


def test_get_user_analytics():
    u = get_user_by_email("shravan@foretrade.ai")
    a = get_user_analytics(u["id"])
    assert "total_swipes" in a
    assert "approved_count" in a
    assert "approval_rate" in a
    assert "leads_by_status" in a
    assert "user_id" in a
    print("  get_user_analytics: OK")


def main():
    print("Running ForeTrade DB tests (test DB)...")
    test_sanitize()
    test_init_and_demo()
    test_verify_user()
    test_create_user()
    test_save_swipe()
    test_approved_leads()
    test_conversation()
    test_user_weights()
    test_get_user_analytics()
    print("All tests passed.")


if __name__ == "__main__":
    main()
