"""
Unit and Integration Tests for Model 5: Semantic HS Code Auto-Classifier.
"""

import pytest
from app.db.session import SessionLocal
from app.services.data_pipeline.run_pipeline import run_all_pipelines
from app.services.ml.hs_classifier import classify_product_description


@pytest.fixture(autouse=True)
def setup_pipeline_data():
    run_all_pipelines()


def test_classify_cotton_apparel_query() -> None:
    session = SessionLocal()
    try:
        query = "180 GSM combed organic cotton round-neck t-shirts"
        preds = classify_product_description(session, query, top_k=3)
        assert len(preds) > 0

        top = preds[0]
        # Must map to 6109 or 610910
        assert top.hs_code in ["6109", "610910"]
        assert top.category_name == "Textiles & Apparel"
        assert top.confidence_pct >= 60.0
        assert "cotton" in top.matched_keywords or len(top.matched_keywords) > 0
        assert top.chapter_code == "61"
    finally:
        session.close()


def test_classify_solar_module_query() -> None:
    session = SessionLocal()
    try:
        query = "monocrystalline photovoltaic solar panels and solar modules"
        preds = classify_product_description(session, query, top_k=3)
        assert len(preds) > 0

        top = preds[0]
        assert top.hs_code in ["8541", "854140"]
        assert "Solar" in top.category_name or "Renewables" in top.category_name
        assert top.confidence_pct >= 65.0
    finally:
        session.close()


def test_classify_pharma_query() -> None:
    session = SessionLocal()
    try:
        query = "generic therapeutic medicaments tablets and capsules"
        preds = classify_product_description(session, query, top_k=3)
        assert len(preds) > 0

        top = preds[0]
        assert top.hs_code in ["3004", "30"]
        assert top.category_name == "Pharmaceuticals"
    finally:
        session.close()


def test_classify_automotive_query() -> None:
    session = SessionLocal()
    try:
        query = "automotive gear boxes suspension shock absorbers and brakes"
        preds = classify_product_description(session, query, top_k=3)
        assert len(preds) > 0

        top = preds[0]
        assert top.hs_code in ["8708", "8483"]
        assert "Automotive" in top.category_name or "Components" in top.category_name
    finally:
        session.close()


def test_classify_empty_query() -> None:
    session = SessionLocal()
    try:
        preds = classify_product_description(session, "   ", top_k=3)
        assert preds == []
    finally:
        session.close()
