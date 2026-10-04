"""
Landed Cost & Logistics Estimator (Incoterms 2020 Engine)
Calculates real-world export logistics, ocean freight, cargo insurance,
customs tariffs, and Incoterm waterfalls (EXW -> FOB -> CIF -> DDP).
"""

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trade_intelligence import TariffSchedule


@dataclass
class PortInfo:
    code: str
    name: str
    country_code: str
    city: str


# Supported Origin and Destination Seaports
ORIGIN_PORTS: Dict[str, PortInfo] = {
    "IN_NSA": PortInfo(code="IN_NSA", name="Nhava Sheva (JNPT)", country_code="IN", city="Mumbai / Navi Mumbai"),
    "IN_MUN": PortInfo(code="IN_MUN", name="Mundra Port", country_code="IN", city="Kutch, Gujarat"),
    "IN_MAA": PortInfo(code="IN_MAA", name="Chennai Port", country_code="IN", city="Chennai, Tamil Nadu"),
    "IN_CCU": PortInfo(code="IN_CCU", name="Kolkata / Haldia Port", country_code="IN", city="Kolkata, West Bengal"),
    "IN_COK": PortInfo(code="IN_COK", name="Cochin Port", country_code="IN", city="Kochi, Kerala"),
}

DESTINATION_PORTS: Dict[str, PortInfo] = {
    "US_LAX": PortInfo(code="US_LAX", name="Port of Los Angeles / Long Beach", country_code="US", city="Los Angeles, CA"),
    "US_NYC": PortInfo(code="US_NYC", name="Port of New York & New Jersey", country_code="US", city="New York, NY"),
    "DE_HAM": PortInfo(code="DE_HAM", name="Port of Hamburg", country_code="DE", city="Hamburg"),
    "NL_RTM": PortInfo(code="NL_RTM", name="Port of Rotterdam", country_code="NL", city="Rotterdam"),
    "GB_FXT": PortInfo(code="GB_FXT", name="Port of Felixstowe", country_code="GB", city="Felixstowe / London"),
    "AE_DXB": PortInfo(code="AE_DXB", name="Port of Jebel Ali", country_code="AE", city="Dubai"),
    "SG_SIN": PortInfo(code="SG_SIN", name="Port of Singapore", country_code="SG", city="Singapore"),
    "AU_MEL": PortInfo(code="AU_MEL", name="Port of Melbourne", country_code="AU", city="Melbourne"),
    "JP_TYO": PortInfo(code="JP_TYO", name="Port of Tokyo / Yokohama", country_code="JP", city="Tokyo"),
    "EG_SOK": PortInfo(code="EG_SOK", name="Port of Sokhna / Alexandria", country_code="EG", city="Alexandria / Suez"),
}

# Maritime Freight Rates (USD) and Transit Times (Days)
# Base rates for 20ft Standard (TEU), 40ft High Cube (FEU HC), and LCL (per CBM)
SHIPPING_RATES_MATRIX = {
    "US_LAX": {"20ft": 2450.0, "40ft_hc": 3650.0, "lcl_per_cbm": 115.0, "transit_days": 28, "carrier": "Maersk / MSC Pacific Express"},
    "US_NYC": {"20ft": 3150.0, "40ft_hc": 4450.0, "lcl_per_cbm": 135.0, "transit_days": 34, "carrier": "CMA CGM / Hapag-Lloyd Atlantic"},
    "DE_HAM": {"20ft": 1950.0, "40ft_hc": 2850.0, "lcl_per_cbm": 95.0, "transit_days": 24, "carrier": "Hapag-Lloyd Europe Gateway"},
    "NL_RTM": {"20ft": 1850.0, "40ft_hc": 2750.0, "lcl_per_cbm": 90.0, "transit_days": 22, "carrier": "Maersk North Sea Direct"},
    "GB_FXT": {"20ft": 1900.0, "40ft_hc": 2800.0, "lcl_per_cbm": 92.0, "transit_days": 23, "carrier": "ONE / Evergreen UK Shuttle"},
    "AE_DXB": {"20ft": 620.0, "40ft_hc": 920.0, "lcl_per_cbm": 45.0, "transit_days": 4, "carrier": "DP World / Emirates Shipping Gulf Express"},
    "SG_SIN": {"20ft": 720.0, "40ft_hc": 1050.0, "lcl_per_cbm": 50.0, "transit_days": 8, "carrier": "PIL / Ocean Network Express"},
    "AU_MEL": {"20ft": 1550.0, "40ft_hc": 2350.0, "lcl_per_cbm": 85.0, "transit_days": 21, "carrier": "MSC Oceania Link"},
    "JP_TYO": {"20ft": 950.0, "40ft_hc": 1400.0, "lcl_per_cbm": 65.0, "transit_days": 16, "carrier": "NYK Line / MOL Asia Connect"},
    "EG_SOK": {"20ft": 1250.0, "40ft_hc": 1850.0, "lcl_per_cbm": 75.0, "transit_days": 11, "carrier": "Evergreen Suez Express"},
}


@dataclass
class CostBreakdown:
    factory_gate_price_usd: float
    inland_trucking_usd: float
    origin_terminal_handling_usd: float
    export_customs_clearance_usd: float
    fob_value_usd: float
    ocean_freight_usd: float
    cfr_value_usd: float
    marine_insurance_usd: float
    cif_value_usd: float
    destination_port_handling_usd: float
    customs_brokerage_usd: float
    customs_import_duty_usd: float
    tariff_rate_applied_pct: float
    is_fta_rate_applied: bool
    tariff_savings_usd: float
    destination_inland_delivery_usd: float
    total_landed_cost_ddp_usd: float
    units: int
    unit_factory_cost_usd: float
    unit_fob_cost_usd: float
    unit_cif_cost_usd: float
    unit_landed_cost_usd: float


@dataclass
class IncotermQuote:
    exw_total_usd: float
    fob_total_usd: float
    cfr_total_usd: float
    cif_total_usd: float
    ddp_total_usd: float
    suggested_cif_quote_with_margin_usd: float
    margin_percentage: float
    cost_percentages: Dict[str, float]


@dataclass
class LandedCostEstimationResult:
    origin_port: PortInfo
    destination_port: PortInfo
    container_type: str
    container_count: int
    transit_days: int
    primary_carrier: str
    hs_code: str
    applied_tariff_agreement: Optional[str]
    breakdown: CostBreakdown
    incoterms: IncotermQuote

    def to_dict(self) -> dict:
        return asdict(self)


def get_available_shipping_routes() -> dict:
    """Returns catalog of supported origin and destination ports with transit times."""
    return {
        "origin_ports": [asdict(p) for p in ORIGIN_PORTS.values()],
        "destination_ports": [asdict(p) for p in DESTINATION_PORTS.values()],
        "container_types": [
            {"code": "20ft", "label": "20ft Standard Dry Container (TEU)", "max_payload_kg": 21700, "volume_cbm": 33.2},
            {"code": "40ft_hc", "label": "40ft High Cube Container (FEU HC)", "max_payload_kg": 26500, "volume_cbm": 76.2},
            {"code": "lcl", "label": "Less than Container Load (LCL - per CBM)", "max_payload_kg": 5000, "volume_cbm": 15.0},
        ],
    }


def calculate_landed_cost(
    db: Session,
    factory_price_usd: float,
    cargo_units: int,
    origin_port_code: str = "IN_NSA",
    destination_port_code: str = "US_LAX",
    container_type: str = "20ft",
    container_count: int = 1,
    hs_code: str = "6109.10",
    apply_fta: bool = False,
    target_margin_pct: float = 15.0,
    cbm_volume: float = 15.0,
) -> LandedCostEstimationResult:
    """
    Computes rigorous landed cost breakdown from Factory Gate to Overseas Customer Warehouse.
    """
    origin_port = ORIGIN_PORTS.get(origin_port_code, ORIGIN_PORTS["IN_NSA"])
    dest_port = DESTINATION_PORTS.get(destination_port_code, DESTINATION_PORTS["US_LAX"])
    lane_info = SHIPPING_RATES_MATRIX.get(dest_port.code, SHIPPING_RATES_MATRIX["US_LAX"])

    # 1. Inland Logistics (Factory to Seaport Drayage)
    if container_type == "40ft_hc":
        inland_trucking = 650.0 * container_count
        origin_thc = 320.0 * container_count
        export_clearance = 150.0
    elif container_type == "lcl":
        inland_trucking = 180.0
        origin_thc = 95.0
        export_clearance = 110.0
    else:  # 20ft
        inland_trucking = 420.0 * container_count
        origin_thc = 220.0 * container_count
        export_clearance = 140.0

    # 2. FOB Calculation
    fob_value = factory_price_usd + inland_trucking + origin_thc + export_clearance

    # 3. Ocean Freight
    if container_type == "40ft_hc":
        ocean_freight = lane_info["40ft_hc"] * container_count
    elif container_type == "lcl":
        ocean_freight = lane_info["lcl_per_cbm"] * max(cbm_volume, 1.0)
    else:  # 20ft
        ocean_freight = lane_info["20ft"] * container_count

    # 4. CFR Calculation
    cfr_value = fob_value + ocean_freight

    # 5. Marine Cargo Insurance (Institute Cargo Clauses A: 0.35% of CIF * 110%)
    marine_insurance = round((cfr_value * 1.10) * 0.0035, 2)

    # 6. CIF Calculation
    cif_value = cfr_value + marine_insurance

    # 7. Destination Customs Duties & Tariffs lookup from DB
    tariff_entry = db.scalar(
        select(TariffSchedule).where(
            TariffSchedule.exporter_country == origin_port.country_code,
            TariffSchedule.importer_country == dest_port.country_code,
            TariffSchedule.hs_code.like(f"{hs_code[:4]}%"),
        )
    )

    mfn_rate = tariff_entry.mfn_applied_rate_pct if tariff_entry else 10.0
    pref_rate = tariff_entry.preferential_rate_pct if tariff_entry else mfn_rate
    fta_agreement = tariff_entry.agreement_name if tariff_entry else None

    # Determine duty applied
    if apply_fta and pref_rate < mfn_rate:
        applied_rate = pref_rate
        is_fta = True
    else:
        applied_rate = mfn_rate
        is_fta = False

    customs_import_duty = round(cif_value * (applied_rate / 100.0), 2)
    mfn_duty_cost = round(cif_value * (mfn_rate / 100.0), 2)
    tariff_savings = max(0.0, round(mfn_duty_cost - customs_import_duty, 2))

    # 8. Destination Port Handling & Inland Delivery (DDP components)
    if container_type == "40ft_hc":
        dest_port_thc = 620.0 * container_count
        customs_brokerage = 220.0
        dest_inland_delivery = 580.0 * container_count
    elif container_type == "lcl":
        dest_port_thc = 190.0
        customs_brokerage = 160.0
        dest_inland_delivery = 250.0
    else:  # 20ft
        dest_port_thc = 440.0 * container_count
        customs_brokerage = 190.0
        dest_inland_delivery = 450.0 * container_count

    # 9. Total Landed Cost (DDP)
    total_landed_cost_ddp = (
        cif_value
        + dest_port_thc
        + customs_brokerage
        + customs_import_duty
        + dest_inland_delivery
    )

    # 10. Unit Costs
    safe_units = max(cargo_units, 1)
    unit_factory = round(factory_price_usd / safe_units, 2)
    unit_fob = round(fob_value / safe_units, 2)
    unit_cif = round(cif_value / safe_units, 2)
    unit_landed = round(total_landed_cost_ddp / safe_units, 2)

    breakdown = CostBreakdown(
        factory_gate_price_usd=round(factory_price_usd, 2),
        inland_trucking_usd=round(inland_trucking, 2),
        origin_terminal_handling_usd=round(origin_thc, 2),
        export_customs_clearance_usd=round(export_clearance, 2),
        fob_value_usd=round(fob_value, 2),
        ocean_freight_usd=round(ocean_freight, 2),
        cfr_value_usd=round(cfr_value, 2),
        marine_insurance_usd=round(marine_insurance, 2),
        cif_value_usd=round(cif_value, 2),
        destination_port_handling_usd=round(dest_port_thc, 2),
        customs_brokerage_usd=round(customs_brokerage, 2),
        customs_import_duty_usd=round(customs_import_duty, 2),
        tariff_rate_applied_pct=round(applied_rate, 2),
        is_fta_rate_applied=is_fta,
        tariff_savings_usd=tariff_savings,
        destination_inland_delivery_usd=round(dest_inland_delivery, 2),
        total_landed_cost_ddp_usd=round(total_landed_cost_ddp, 2),
        units=cargo_units,
        unit_factory_cost_usd=unit_factory,
        unit_fob_cost_usd=unit_fob,
        unit_cif_cost_usd=unit_cif,
        unit_landed_cost_usd=unit_landed,
    )

    # Suggested Quotation: CIF + Exporter Target Margin
    suggested_cif_quote = round(cif_value * (1.0 + (target_margin_pct / 100.0)), 2)

    # Percentage breakdown of DDP Landed Cost
    tot = max(total_landed_cost_ddp, 1.0)
    cost_percentages = {
        "factory_goods_pct": round((factory_price_usd / tot) * 100.0, 1),
        "ocean_freight_pct": round((ocean_freight / tot) * 100.0, 1),
        "customs_duties_pct": round((customs_import_duty / tot) * 100.0, 1),
        "inland_and_port_handling_pct": round(
            ((inland_trucking + origin_thc + export_clearance + dest_port_thc + customs_brokerage + dest_inland_delivery) / tot) * 100.0, 1
        ),
        "marine_insurance_pct": round((marine_insurance / tot) * 100.0, 1),
    }

    incoterms = IncotermQuote(
        exw_total_usd=round(factory_price_usd, 2),
        fob_total_usd=round(fob_value, 2),
        cfr_total_usd=round(cfr_value, 2),
        cif_total_usd=round(cif_value, 2),
        ddp_total_usd=round(total_landed_cost_ddp, 2),
        suggested_cif_quote_with_margin_usd=suggested_cif_quote,
        margin_percentage=target_margin_pct,
        cost_percentages=cost_percentages,
    )

    return LandedCostEstimationResult(
        origin_port=origin_port,
        destination_port=dest_port,
        container_type=container_type,
        container_count=container_count,
        transit_days=lane_info["transit_days"],
        primary_carrier=lane_info["carrier"],
        hs_code=hs_code,
        applied_tariff_agreement=fta_agreement if is_fta else None,
        breakdown=breakdown,
        incoterms=incoterms,
    )
