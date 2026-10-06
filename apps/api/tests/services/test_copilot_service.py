"""
Unit tests for Copilot Service (Trade Advisory Engine).
"""

from app.db.session import SessionLocal
from app.services.data_pipeline.run_pipeline import run_all_pipelines
from app.services.ml.copilot_service import (
    build_copilot_context,
    answer_trade_query,
    generate_suggested_followups,
    generate_grounded_fallback,
)


def test_copilot_context_builder() -> None:
    run_all_pipelines()
    db = SessionLocal()
    try:
        context = build_copilot_context(db, "test-ws-id", "What are the CEPA rules?")
        assert isinstance(context, str)
        assert len(context) > 0
    finally:
        db.close()


def test_copilot_suggested_followups() -> None:
    cepa_followups = generate_suggested_followups("Tell me about UAE CEPA duty rates")
    assert len(cepa_followups) >= 2
    assert any("cepa" in f.lower() or "origin" in f.lower() for f in cepa_followups)

    incoterm_followups = generate_suggested_followups("What is CIF vs FOB?")
    assert len(incoterm_followups) >= 2
    assert any("incoterm" in f.lower() or "freight" in f.lower() or "demurrage" in f.lower() for f in incoterm_followups)


def test_copilot_grounded_fallback() -> None:
    ans = generate_grounded_fallback("Tariff benefits", "Verified FTA Tariff Schedule: 0% Preferential duty.")
    assert "Trade Advisory" in ans
    assert "Preferential duty" in ans


def test_answer_trade_query_execution() -> None:
    db = SessionLocal()
    try:
        res = answer_trade_query(
            db=db,
            workspace_id="test-ws-id",
            user_message="What are the tariff benefits of exporting to UAE?",
        )
        assert "response" in res
        assert len(res["response"]) > 50
        assert "model_used" in res
        assert len(res["suggested_questions"]) > 0
    finally:
        db.close()
