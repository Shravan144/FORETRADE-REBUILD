"""
Unit tests for Copilot Service (Trade Advisory Engine).
"""

from app.db.session import SessionLocal
from app.services.data_pipeline.run_pipeline import run_all_pipelines
from app.services.ml.copilot_service import (
    build_copilot_context,
    answer_trade_query,
    generate_suggested_followups,
    generate_deterministic_trade_answer,
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


def test_copilot_deterministic_trade_answer() -> None:
    cepa_answer = generate_deterministic_trade_answer("What are UAE CEPA tariff savings?", "")
    assert "India-UAE" in cepa_answer
    assert "6109" in cepa_answer or "Textiles" in cepa_answer

    incoterm_answer = generate_deterministic_trade_answer("Compare CIF and FOB", "")
    assert "Incoterms 2020" in incoterm_answer
    assert "FOB" in incoterm_answer and "CIF" in incoterm_answer


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
