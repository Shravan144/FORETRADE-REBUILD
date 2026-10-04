"""
Unit Tests for Landed Cost & Logistics Estimator (Incoterms 2020)
"""

from app.db.session import SessionLocal
from app.services.data_pipeline.run_pipeline import run_all_pipelines
from app.services.ml.landed_cost_calculator import (
    calculate_landed_cost,
    get_available_shipping_routes,
    ORIGIN_PORTS,
    DESTINATION_PORTS,
)


def test_shipping_routes_catalog() -> None:
    routes = get_available_shipping_routes()
    assert len(routes["origin_ports"]) >= 4
    assert len(routes["destination_ports"]) >= 6
    assert any(p["code"] == "IN_NSA" for p in routes["origin_ports"])
    assert any(p["code"] == "US_LAX" for p in routes["destination_ports"])
    assert any(c["code"] == "20ft" for c in routes["container_types"])


def test_calculate_landed_cost_us_apparel_mfn_vs_fta() -> None:
    run_all_pipelines()
    db = SessionLocal()
    try:
        # Test 1: Cotton t-shirts to US under MFN
        result_mfn = calculate_landed_cost(
            db=db,
            factory_price_usd=50000.0,
            cargo_units=10000,
            origin_port_code="IN_NSA",
            destination_port_code="US_LAX",
            container_type="20ft",
            container_count=1,
            hs_code="6109.10",
            apply_fta=False,
            target_margin_pct=20.0,
        )

        assert result_mfn.origin_port.code == "IN_NSA"
        assert result_mfn.destination_port.code == "US_LAX"
        assert result_mfn.transit_days == 28
        assert result_mfn.breakdown.factory_gate_price_usd == 50000.0
        # FOB should be EXW + inland + origin THC + export clearance
        assert result_mfn.breakdown.fob_value_usd > 50000.0
        # CIF should be FOB + freight + insurance
        assert result_mfn.breakdown.cif_value_usd > result_mfn.breakdown.fob_value_usd
        # DDP Landed Cost should include duties and port delivery
        assert result_mfn.breakdown.total_landed_cost_ddp_usd > result_mfn.breakdown.cif_value_usd
        assert result_mfn.breakdown.unit_landed_cost_usd > 0
        assert result_mfn.incoterms.suggested_cif_quote_with_margin_usd > result_mfn.breakdown.cif_value_usd

        # Test 2: Rice or Cotton to UAE with CEPA FTA
        result_uae = calculate_landed_cost(
            db=db,
            factory_price_usd=40000.0,
            cargo_units=5000,
            origin_port_code="IN_NSA",
            destination_port_code="AE_DXB",
            container_type="20ft",
            container_count=1,
            hs_code="6109.10",
            apply_fta=True,
        )
        assert result_uae.destination_port.code == "AE_DXB"
        assert result_uae.transit_days == 4
        # Under CEPA, preferential rate should be applied if defined
        assert result_uae.breakdown.total_landed_cost_ddp_usd > 40000.0
    finally:
        db.close()
