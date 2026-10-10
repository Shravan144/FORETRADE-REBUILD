"""
API Endpoints for Importer Procurement Desks, Sourcing RFQs, and Inbound Proposals
Provides the bilateral counterweight to ForeTrade's Exporter OS:
- Importer Profile registration with real statutory IDs (EIN, EORI, TRN, ABN)
- Sourcing RFQ publication (which syncs into Demand Radar & Matchmaking)
- Inbound Proposals & Proforma Invoices management
"""

import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_csrf, require_workspace_role
from app.db.session import get_db
from app.models.importer import ImporterProfile, SourcingRfq, InboundProposal, NegotiationMessage
from app.models.trade_intelligence import GlobalBuyerCatalog, MarketDemandSignal
from app.models.user import User
from app.services.deduplication import normalized_name

router = APIRouter(prefix="/api/v1/workspaces", tags=["importer-procurement"])


# ── STATUTORY VALIDATORS FOR OVERSEAS TAX IDENTIFIERS ──
def validate_statutory_tax_id(tax_type: str, tax_value: str, country_code: str) -> bool:
    """Validates international corporate customs/tax credentials."""
    t_val = tax_value.strip().upper()
    c_code = country_code.strip().upper()

    if tax_type == "EIN" or c_code == "US":
        # US IRS Employer Identification Number: 9 digits, e.g. 12-3456789 or 123456789
        clean = re.sub(r"[^0-9]", "", t_val)
        return len(clean) == 9

    if tax_type == "EORI" or c_code in ["DE", "FR", "NL", "IT", "ES", "BE", "PL"]:
        # EU Economic Operators Registration and Identification: 2-char country + up to 15 alphanumeric
        return bool(re.match(r"^[A-Z]{2}[A-Z0-9]{8,15}$", t_val))

    if tax_type == "UK_EORI" or c_code == "GB":
        # UK EORI: GB followed by 12 digits
        return bool(re.match(r"^GB[0-9]{12}$", t_val))

    if tax_type == "TRN" or c_code == "AE":
        # UAE Federal Tax Authority Tax Registration Number: 15 digits
        clean = re.sub(r"[^0-9]", "", t_val)
        return len(clean) == 15

    if tax_type == "ABN" or c_code == "AU":
        # Australian Business Number: 11 digits
        clean = re.sub(r"[^0-9]", "", t_val)
        return len(clean) == 11

    # Standard fallback for other jurisdictions (minimum 6 alphanumeric chars)
    return len(t_val) >= 6


# ── REQUEST & RESPONSE SCHEMAS ──

class ImporterProfilePayload(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=300)
    trade_name_dba: Optional[str] = Field(None, max_length=300)
    country_code: str = Field(..., min_length=2, max_length=2)
    city: str = Field(..., min_length=2, max_length=100)
    headquarters_address: Optional[str] = Field(None, max_length=500)
    corporate_website: Optional[str] = Field(None, max_length=500)
    duns_number: Optional[str] = Field(None, max_length=9)
    tax_identifier_type: str = Field("EIN", max_length=50)
    tax_identifier_value: str = Field(..., min_length=4, max_length=100)

    contact_name: str = Field(..., min_length=2, max_length=200)
    contact_title: str = Field("Global Sourcing Director", max_length=150)
    contact_email: str = Field(..., max_length=320)
    contact_phone: Optional[str] = Field(None, max_length=50)

    primary_discharge_port: str = Field(..., min_length=3, max_length=10)
    secondary_discharge_port: Optional[str] = Field(None, max_length=10)
    customs_broker_name: Optional[str] = Field(None, max_length=200)
    preferred_container_type: str = Field("40ft_hc", max_length=50)
    warehouse_dock_type: Optional[str] = Field("palletized_forklift", max_length=50)

    primary_sector: str = Field(..., min_length=2, max_length=100)
    target_hs_codes: List[str] = Field(default_factory=list)
    annual_sourcing_budget_usd: float = Field(5000000.0, ge=10000.0)
    order_cycle_days: int = Field(30, ge=5, le=365)
    min_order_quantity_mt: float = Field(20.0, ge=0.5)
    consignee_name_on_bol: Optional[str] = Field(None, max_length=300)

    required_certifications: List[str] = Field(default_factory=list)
    preferred_incoterm: str = Field("CIF", max_length=10)
    payment_terms: str = Field("letter_of_credit", max_length=100)
    issuing_bank_name: Optional[str] = Field(None, max_length=200)
    issuing_bank_swift: Optional[str] = Field(None, max_length=11)
    currency: str = Field("USD", max_length=3)
    is_publicly_discoverable: bool = Field(True)


class SourcingRfqCreatePayload(BaseModel):
    title: str = Field(..., min_length=5, max_length=300)
    commodity_description: str = Field(..., min_length=10)
    product_category: str = Field(..., min_length=2, max_length=100)
    hs_code: str = Field(..., min_length=2, max_length=10)

    target_quantity: float = Field(..., gt=0)
    quantity_unit: str = Field("Metric Tons (MT)", max_length=50)
    target_budget_usd: Optional[float] = Field(None, gt=0)
    target_unit_price_usd: Optional[float] = Field(None, gt=0)

    destination_country: Optional[str] = Field(None, max_length=2)
    destination_port: Optional[str] = Field(None, max_length=10)
    preferred_incoterm: Optional[str] = Field("CIF", max_length=10)
    preferred_container_type: Optional[str] = Field("40ft_hc", max_length=50)

    required_certifications: List[str] = Field(default_factory=list)
    inspection_agency_allowed: Optional[str] = Field("SGS / Bureau Veritas", max_length=100)
    special_technical_clauses: Optional[str] = None
    deadline_date: Optional[str] = Field(None, max_length=50)
    target_delivery_date: Optional[str] = Field(None, max_length=50)


class RespondProposalPayload(BaseModel):
    status: str = Field(..., description="accepted, sample_requested, declined, reviewed")
    feedback_notes: Optional[str] = None


def serialize_importer_profile(p: ImporterProfile) -> dict:
    return {
        "id": p.id,
        "workspace_id": p.workspace_id,
        "company_name": p.company_name,
        "trade_name_dba": p.trade_name_dba,
        "country_code": p.country_code,
        "city": p.city,
        "headquarters_address": p.headquarters_address,
        "corporate_website": p.corporate_website,
        "duns_number": p.duns_number,
        "tax_identifier_type": p.tax_identifier_type,
        "tax_identifier_value": p.tax_identifier_value,
        "contact_name": p.contact_name,
        "contact_title": p.contact_title,
        "contact_email": p.contact_email,
        "contact_phone": p.contact_phone,
        "primary_discharge_port": p.primary_discharge_port,
        "secondary_discharge_port": p.secondary_discharge_port,
        "customs_broker_name": p.customs_broker_name,
        "preferred_container_type": p.preferred_container_type,
        "warehouse_dock_type": p.warehouse_dock_type,
        "primary_sector": p.primary_sector,
        "target_hs_codes": p.target_hs_codes or [],
        "annual_sourcing_budget_usd": p.annual_sourcing_budget_usd,
        "order_cycle_days": p.order_cycle_days,
        "min_order_quantity_mt": p.min_order_quantity_mt,
        "consignee_name_on_bol": p.consignee_name_on_bol,
        "required_certifications": p.required_certifications or [],
        "preferred_incoterm": p.preferred_incoterm,
        "payment_terms": p.payment_terms,
        "issuing_bank_name": p.issuing_bank_name,
        "issuing_bank_swift": p.issuing_bank_swift,
        "currency": p.currency,
        "catalog_buyer_id": p.catalog_buyer_id,
        "is_publicly_discoverable": p.is_publicly_discoverable,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def serialize_rfq(r: SourcingRfq) -> dict:
    return {
        "id": r.id,
        "workspace_id": r.workspace_id,
        "importer_profile_id": r.importer_profile_id,
        "title": r.title,
        "commodity_description": r.commodity_description,
        "product_category": r.product_category,
        "hs_code": r.hs_code,
        "target_quantity": r.target_quantity,
        "quantity_unit": r.quantity_unit,
        "target_budget_usd": r.target_budget_usd,
        "target_unit_price_usd": r.target_unit_price_usd,
        "destination_country": r.destination_country,
        "destination_port": r.destination_port,
        "preferred_incoterm": r.preferred_incoterm,
        "preferred_container_type": r.preferred_container_type,
        "required_certifications": r.required_certifications or [],
        "inspection_agency_allowed": r.inspection_agency_allowed,
        "special_technical_clauses": r.special_technical_clauses,
        "deadline_date": r.deadline_date,
        "target_delivery_date": r.target_delivery_date,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def serialize_proposal(p: InboundProposal) -> dict:
    return {
        "id": p.id,
        "importer_workspace_id": p.importer_workspace_id,
        "exporter_workspace_id": p.exporter_workspace_id,
        "rfq_id": p.rfq_id,
        "lead_id": p.lead_id,
        "outreach_draft_id": p.outreach_draft_id,
        "commercial_document_id": p.commercial_document_id,
        "exporter_company_name": p.exporter_company_name,
        "exporter_country_code": p.exporter_country_code,
        "exporter_origin_port": p.exporter_origin_port,
        "exporter_readiness_score": p.exporter_readiness_score,
        "proposal_channel": p.proposal_channel,
        "subject": p.subject,
        "proposal_body": p.proposal_body,
        "offered_unit_price_usd": p.offered_unit_price_usd,
        "offered_incoterm": p.offered_incoterm,
        "estimated_transit_days": p.estimated_transit_days,
        "duty_savings_usd": p.duty_savings_usd,
        "status": p.status,
        "importer_feedback_notes": p.importer_feedback_notes,
        "negotiation_thread_id": p.negotiation_thread_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ── IMPORTER PROFILE ENDPOINTS ──

@router.get("/{workspace_id}/importer-profile")
def get_importer_profile(
    workspace_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Fetches the registered Importer Profile for this workspace."""
    require_workspace_role(workspace_id, user, db, "viewer")
    profile = db.scalar(select(ImporterProfile).where(ImporterProfile.workspace_id == workspace_id))
    if not profile:
        raise HTTPException(status_code=404, detail="importer_profile_not_found")
    return serialize_importer_profile(profile)


@router.post("/{workspace_id}/importer-profile")
def create_or_update_importer_profile(
    workspace_id: str,
    payload: ImporterProfilePayload,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict:
    """
    Registers or updates the real-world Importer Procurement Dossier.
    Validates international statutory identifiers (EIN, EORI, TRN, ABN).
    Instantly links or creates an active buyer entry in GlobalBuyerCatalog.
    """
    require_workspace_role(workspace_id, user, db, "editor")

    # 1. Statutory ID Check
    if not validate_statutory_tax_id(payload.tax_identifier_type, payload.tax_identifier_value, payload.country_code):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid statutory tax credential format for {payload.tax_identifier_type} in {payload.country_code}."
        )

    profile = db.scalar(select(ImporterProfile).where(ImporterProfile.workspace_id == workspace_id))
    
    # 2. Sync to GlobalBuyerCatalog for instant bilateral discovery
    norm = normalized_name(payload.company_name)
    catalog_buyer = db.scalar(
        select(GlobalBuyerCatalog).where(
            GlobalBuyerCatalog.normalized_name == norm,
            GlobalBuyerCatalog.country_code == payload.country_code.upper(),
        )
    )

    if not catalog_buyer:
        catalog_buyer = GlobalBuyerCatalog(
            company_name=payload.company_name,
            normalized_name=norm,
            country_code=payload.country_code.upper(),
            city=payload.city,
            website=payload.corporate_website,
            contact_name=payload.contact_name,
            contact_email=payload.contact_email,
            primary_sector=payload.primary_sector,
            hs_codes=payload.target_hs_codes,
            annual_import_volume_usd=payload.annual_sourcing_budget_usd,
            avg_order_tons=payload.min_order_quantity_mt,
            required_certifications=payload.required_certifications,
            preferred_incoterms=payload.preferred_incoterm,
            customs_manifest_provenance="Verified ForeTrade Network Direct Buyer",
            reliability_score=98.0,
            shipment_frequency="Monthly FCL Consignment",
            avg_container_teu=4.0 if payload.preferred_container_type == "40ft_hc" else 2.0,
            estimated_order_cycle_days=payload.order_cycle_days,
            top_historical_suppliers=[
                {"origin_country": "IN", "supplier_name": "Indian Exporters Network", "share_pct": 50.0},
                {"origin_country": "CN", "supplier_name": "East Asia Manufacturers", "share_pct": 30.0},
                {"origin_country": "VN", "supplier_name": "ASEAN Sourcing Corp", "share_pct": 20.0},
            ],
        )
        db.add(catalog_buyer)
        db.flush()
    else:
        # Update existing catalog entry with verified contact and procurement data
        catalog_buyer.contact_name = payload.contact_name
        catalog_buyer.contact_email = payload.contact_email
        catalog_buyer.website = payload.corporate_website or catalog_buyer.website
        catalog_buyer.annual_import_volume_usd = payload.annual_sourcing_budget_usd
        catalog_buyer.hs_codes = payload.target_hs_codes
        catalog_buyer.required_certifications = payload.required_certifications
        catalog_buyer.preferred_incoterms = payload.preferred_incoterm
        catalog_buyer.reliability_score = 98.0
        catalog_buyer.customs_manifest_provenance = "Verified ForeTrade Network Direct Buyer"

    if not profile:
        profile = ImporterProfile(
            workspace_id=workspace_id,
            created_by_user_id=user.id,
            company_name=payload.company_name,
            trade_name_dba=payload.trade_name_dba,
            country_code=payload.country_code.upper(),
            city=payload.city,
            headquarters_address=payload.headquarters_address,
            corporate_website=payload.corporate_website,
            duns_number=payload.duns_number,
            tax_identifier_type=payload.tax_identifier_type,
            tax_identifier_value=payload.tax_identifier_value,
            contact_name=payload.contact_name,
            contact_title=payload.contact_title,
            contact_email=payload.contact_email,
            contact_phone=payload.contact_phone,
            primary_discharge_port=payload.primary_discharge_port.upper(),
            secondary_discharge_port=payload.secondary_discharge_port.upper() if payload.secondary_discharge_port else None,
            customs_broker_name=payload.customs_broker_name,
            preferred_container_type=payload.preferred_container_type,
            warehouse_dock_type=payload.warehouse_dock_type,
            primary_sector=payload.primary_sector,
            target_hs_codes=payload.target_hs_codes,
            annual_sourcing_budget_usd=payload.annual_sourcing_budget_usd,
            order_cycle_days=payload.order_cycle_days,
            min_order_quantity_mt=payload.min_order_quantity_mt,
            consignee_name_on_bol=payload.consignee_name_on_bol or payload.company_name,
            required_certifications=payload.required_certifications,
            preferred_incoterm=payload.preferred_incoterm,
            payment_terms=payload.payment_terms,
            issuing_bank_name=payload.issuing_bank_name,
            issuing_bank_swift=payload.issuing_bank_swift,
            currency=payload.currency,
            catalog_buyer_id=catalog_buyer.id,
            is_publicly_discoverable=payload.is_publicly_discoverable,
        )
        db.add(profile)
    else:
        for k, v in payload.model_dump().items():
            if hasattr(profile, k):
                setattr(profile, k, v)
        profile.catalog_buyer_id = catalog_buyer.id

    db.commit()
    db.refresh(profile)
    return serialize_importer_profile(profile)


# ── SOURCING RFQ ENDPOINTS ──

@router.get("/{workspace_id}/rfqs")
def list_workspace_rfqs(
    workspace_id: str,
    status: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Lists all procurement tenders published by this importer."""
    require_workspace_role(workspace_id, user, db, "viewer")
    query = select(SourcingRfq).where(SourcingRfq.workspace_id == workspace_id)
    if status:
        query = query.where(SourcingRfq.status == status.upper())
    rfqs = db.scalars(query.order_by(SourcingRfq.created_at.desc())).all()
    return {"items": [serialize_rfq(r) for r in rfqs], "total": len(rfqs)}


@router.post("/{workspace_id}/rfqs", status_code=201)
def publish_sourcing_rfq(
    workspace_id: str,
    payload: SourcingRfqCreatePayload,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict:
    """
    Publishes an active procurement tender (RFQ).
    Automatically injects the RFQ into the Demand Radar (MarketDemandSignal table)
    so Indian exporters see it instantly in real-time.
    """
    require_workspace_role(workspace_id, user, db, "editor")
    profile = db.scalar(select(ImporterProfile).where(ImporterProfile.workspace_id == workspace_id))
    if not profile:
        raise HTTPException(status_code=400, detail="importer_profile_must_be_completed_before_posting_rfq")

    dest_c = payload.destination_country or profile.country_code
    dest_p = payload.destination_port or profile.primary_discharge_port

    rfq = SourcingRfq(
        workspace_id=workspace_id,
        importer_profile_id=profile.id,
        created_by_user_id=user.id,
        title=payload.title,
        commodity_description=payload.commodity_description,
        product_category=payload.product_category,
        hs_code=payload.hs_code,
        target_quantity=payload.target_quantity,
        quantity_unit=payload.quantity_unit,
        target_budget_usd=payload.target_budget_usd or (payload.target_quantity * (payload.target_unit_price_usd or 1000.0)),
        target_unit_price_usd=payload.target_unit_price_usd,
        destination_country=dest_c.upper(),
        destination_port=dest_p.upper(),
        preferred_incoterm=payload.preferred_incoterm or profile.preferred_incoterm,
        preferred_container_type=payload.preferred_container_type or profile.preferred_container_type,
        required_certifications=payload.required_certifications or profile.required_certifications,
        inspection_agency_allowed=payload.inspection_agency_allowed,
        special_technical_clauses=payload.special_technical_clauses,
        deadline_date=payload.deadline_date,
        target_delivery_date=payload.target_delivery_date,
        status="ACTIVE",
    )
    db.add(rfq)
    db.flush()

    # Automatically broadcast into Demand Radar table
    radar_signal = MarketDemandSignal(
        title=f"{profile.company_name} ({dest_c}): {payload.title}",
        raw_text=f"Direct Buyer RFQ from {profile.company_name} ({dest_c}). Seeking {payload.target_quantity} {payload.quantity_unit} of {payload.commodity_description} (HS {payload.hs_code}). Delivery Port: {dest_p}. Terms: {rfq.preferred_incoterm}. Required: {', '.join(rfq.required_certifications or ['ISO 9001'])}.",
        source_channel="ForeTrade Direct Sourcing Network",
        signal_type="Procurement Tender",
        target_country=dest_c.upper(),
        product_category=payload.product_category,
        hs_code=payload.hs_code,
        estimated_budget_usd=rfq.target_budget_usd,
        deadline_date=payload.deadline_date,
        intent_score=0.99,
        urgency_level="Critical" if "urgent" in payload.title.lower() else "High",
        extracted_entities={
            "buyer_name": profile.company_name,
            "rfq_id": rfq.id,
            "discharge_port": dest_p,
            "quantity": payload.target_quantity,
            "unit": payload.quantity_unit,
            "certifications": rfq.required_certifications,
        },
        external_id=f"rfq_{rfq.id}",
        source_url=f"/workspace/{workspace_id}/rfqs",
        buyer_name=profile.company_name,
        status="ACTIVE",
    )
    db.add(radar_signal)
    db.flush()
    rfq.demand_signal_id = radar_signal.id

    db.commit()
    db.refresh(rfq)
    return serialize_rfq(rfq)


# ── INBOUND PROPOSALS & PROFORMA INVOICES ENDPOINTS ──

@router.get("/{workspace_id}/inbound-proposals")
def list_inbound_proposals(
    workspace_id: str,
    status: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Lists commercial proposals, pitches, and proforma invoices received by this importer."""
    require_workspace_role(workspace_id, user, db, "viewer")
    query = select(InboundProposal).where(InboundProposal.importer_workspace_id == workspace_id)
    if status:
        query = query.where(InboundProposal.status == status.lower())
    proposals = db.scalars(query.order_by(InboundProposal.created_at.desc())).all()
    return {"items": [serialize_proposal(p) for p in proposals], "total": len(proposals)}


@router.patch("/{workspace_id}/inbound-proposals/{proposal_id}/respond")
def respond_to_inbound_proposal(
    workspace_id: str,
    proposal_id: str,
    payload: RespondProposalPayload,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict:
    """Importer accepts quote, requests a physical sample, or provides feedback."""
    require_workspace_role(workspace_id, user, db, "editor")
    prop = db.scalar(
        select(InboundProposal).where(
            InboundProposal.id == proposal_id,
            InboundProposal.importer_workspace_id == workspace_id,
        )
    )
    if not prop:
        raise HTTPException(status_code=404, detail="proposal_not_found")

    valid_statuses = ["reviewed", "sample_requested", "accepted", "declined"]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"invalid_status_must_be_one_of_{valid_statuses}")

    prop.status = payload.status
    if payload.feedback_notes is not None:
        prop.importer_feedback_notes = payload.feedback_notes

    db.commit()
    db.refresh(prop)
    return serialize_proposal(prop)


# ── BILATERAL NEGOTIATION & IN-APP DEAL ROOM MESSAGING ──

class NegotiationMessageCreatePayload(BaseModel):
    message_text: str = Field(..., min_length=1, max_length=5000)
    message_type: str = Field("text", max_length=50)  # text, counter_offer, sample_request, commercial_document
    payload: Optional[dict] = None


def serialize_negotiation_message(m: NegotiationMessage) -> dict:
    return {
        "id": m.id,
        "proposal_id": m.proposal_id,
        "thread_id": m.thread_id,
        "sender_workspace_id": m.sender_workspace_id,
        "sender_user_id": m.sender_user_id,
        "sender_role": m.sender_role,
        "sender_name": m.sender_name,
        "sender_company_name": m.sender_company_name,
        "message_text": m.message_text,
        "message_type": m.message_type,
        "payload": m.payload,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


@router.get("/{workspace_id}/negotiations/{proposal_id}/messages")
def list_negotiation_messages(
    workspace_id: str,
    proposal_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Fetches all multi-turn conversation messages in a bilateral trade deal room."""
    require_workspace_role(workspace_id, user, db, "viewer")
    prop = db.get(InboundProposal, proposal_id)
    if not prop:
        raise HTTPException(status_code=404, detail="proposal_not_found")

    if workspace_id not in [prop.importer_workspace_id, prop.exporter_workspace_id]:
        raise HTTPException(status_code=403, detail="access_denied_to_this_negotiation_thread")

    messages = db.scalars(
        select(NegotiationMessage)
        .where(NegotiationMessage.proposal_id == proposal_id)
        .order_by(NegotiationMessage.created_at.asc())
    ).all()

    return {"items": [serialize_negotiation_message(m) for m in messages], "total": len(messages)}


@router.post("/{workspace_id}/negotiations/{proposal_id}/messages", status_code=201)
def send_negotiation_message(
    workspace_id: str,
    proposal_id: str,
    payload: NegotiationMessageCreatePayload,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict:
    """
    Sends a commercial message, counter-offer, physical sample request, or attached PI
    between the Exporter and the Importer in the trade deal room.
    """
    require_workspace_role(workspace_id, user, db, "editor")
    prop = db.get(InboundProposal, proposal_id)
    if not prop:
        raise HTTPException(status_code=404, detail="proposal_not_found")

    if workspace_id not in [prop.importer_workspace_id, prop.exporter_workspace_id]:
        raise HTTPException(status_code=403, detail="access_denied_to_this_negotiation_thread")

    is_importer = (workspace_id == prop.importer_workspace_id)
    sender_role = "importer" if is_importer else "exporter"

    if is_importer:
        importer_prof = db.scalar(select(ImporterProfile).where(ImporterProfile.workspace_id == workspace_id))
        sender_company_name = importer_prof.company_name if importer_prof else "Global Importer Desk"
    else:
        sender_company_name = prop.exporter_company_name

    sender_name = user.full_name or user.email.split("@")[0]

    # Handle counter offer or status updates
    if payload.message_type == "counter_offer" and payload.payload:
        if "counter_unit_price_usd" in payload.payload:
            prop.offered_unit_price_usd = float(payload.payload["counter_unit_price_usd"])
        if "incoterm" in payload.payload:
            prop.offered_incoterm = str(payload.payload["incoterm"])
    elif payload.message_type == "sample_request":
        prop.status = "sample_requested"
    elif payload.message_type == "commercial_document" and payload.payload:
        if "document_id" in payload.payload:
            prop.commercial_document_id = str(payload.payload["document_id"])

    msg = NegotiationMessage(
        proposal_id=proposal_id,
        thread_id=prop.negotiation_thread_id,
        sender_workspace_id=workspace_id,
        sender_user_id=user.id,
        sender_role=sender_role,
        sender_name=sender_name,
        sender_company_name=sender_company_name,
        message_text=payload.message_text,
        message_type=payload.message_type,
        payload=payload.payload,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return serialize_negotiation_message(msg)


@router.get("/{workspace_id}/leads/{lead_id}/proposal")
def get_lead_proposal(
    workspace_id: str,
    lead_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Fetches the active commercial proposal linked to a CRM lead (for Exporter view)."""
    require_workspace_role(workspace_id, user, db, "viewer")
    prop = db.scalar(
        select(InboundProposal)
        .where(
            InboundProposal.lead_id == lead_id,
            InboundProposal.exporter_workspace_id == workspace_id,
        )
        .order_by(InboundProposal.created_at.desc())
    )
    if not prop:
        raise HTTPException(status_code=404, detail="no_proposal_for_this_lead")
    return serialize_proposal(prop)


