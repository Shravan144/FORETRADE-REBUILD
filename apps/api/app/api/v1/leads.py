from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_csrf, require_workspace_role
from app.db.session import get_db
from app.models.domain import Company, CompanySourceRecord, Lead, LeadEvent, OutreachDraft, ScoreSnapshot
from app.models.trade_intelligence import GlobalBuyerCatalog, TariffSchedule
from app.models.user import User
from app.services.lead_service import REQUIRED_EVENT_FOR_STAGE
from app.services.ml.pitch_generator import generate_export_pitch
from app.services.workspace_service import get_latest_profile_version

router = APIRouter(prefix="/api/v1/workspaces", tags=["leads"])
VALID_STAGES = {"new", "qualified", "contacted", "replied", "meeting", "won", "lost"}


class LeadCreate(BaseModel):
    company_id: str
    notes: str | None = Field(default=None, max_length=10000)


class LeadStageChange(BaseModel):
    stage: str
    note: str | None = Field(default=None, max_length=10000)


class LeadEventWrite(BaseModel):
    event_type: str = Field(min_length=2, max_length=50)
    payload: dict = {}


class DraftWrite(BaseModel):
    channel: str = Field(min_length=2, max_length=30)
    subject: str | None = Field(default=None, max_length=500)
    body: str = Field(min_length=1, max_length=20000)


class GeneratePitchRequest(BaseModel):
    channel: str = Field(default="email", description="email, linkedin, or proposal")
    custom_notes: str | None = Field(default=None, max_length=2000)


def serialize(lead: Lead) -> dict:
    return {
        "id": lead.id,
        "company_id": lead.company_id,
        "stage": lead.stage,
        "owner_user_id": lead.owner_user_id,
        "notes": lead.notes,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
    }


def serialize_draft(draft: OutreachDraft) -> dict:
    return {
        "id": draft.id,
        "lead_id": draft.lead_id,
        "created_by_user_id": draft.created_by_user_id,
        "channel": draft.channel,
        "subject": draft.subject,
        "body": draft.body,
        "status": draft.status,
        "created_at": draft.created_at.isoformat() if draft.created_at else None,
    }


def get_lead(db: Session, workspace_id: str, lead_id: str) -> Lead:
    lead = db.scalar(select(Lead).where(Lead.id == lead_id, Lead.workspace_id == workspace_id))
    if not lead:
        raise HTTPException(status_code=404, detail="lead_not_found")
    return lead


@router.get("/{workspace_id}/leads")
def list_leads(workspace_id: str, stage: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db)
    query = select(Lead).where(Lead.workspace_id == workspace_id).order_by(Lead.updated_at.desc())
    if stage:
        query = query.where(Lead.stage == stage)
    return {"items": [serialize(item) for item in db.scalars(query)]}


@router.get("/{workspace_id}/leads/{lead_id}")
def get_lead_detail(
    workspace_id: str,
    lead_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_workspace_role(workspace_id, user, db, "viewer")
    lead = get_lead(db, workspace_id, lead_id)
    company = db.scalar(select(Company).where(Company.id == lead.company_id, Company.workspace_id == workspace_id))
    score = db.scalar(
        select(ScoreSnapshot)
        .where(ScoreSnapshot.company_id == lead.company_id, ScoreSnapshot.workspace_id == workspace_id)
        .order_by(ScoreSnapshot.created_at.desc())
    )
    res = serialize(lead)
    if company:
        res["company"] = {
            "id": company.id,
            "name": company.name,
            "country_code": company.country_code,
            "product_or_industry": company.product_or_industry,
            "contact_name": company.contact_name,
            "contact_email": company.contact_email,
            "website": company.website,
            "attributes": company.attributes or {},
        }
    if score:
        res["score"] = {
            "score": score.score,
            "tier": score.tier,
            "reasons": score.reason_codes,
            "feature_values": score.feature_values,
        }
    return res


@router.post("/{workspace_id}/leads", status_code=201)
def create_lead(workspace_id: str, payload: LeadCreate, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    if not db.scalar(select(Company).where(Company.id == payload.company_id, Company.workspace_id == workspace_id)):
        raise HTTPException(status_code=404, detail="company_not_found")
    lead = Lead(workspace_id=workspace_id, company_id=payload.company_id, owner_user_id=user.id, notes=payload.notes)
    db.add(lead)
    try:
        db.commit()
        db.refresh(lead)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="lead_already_exists")
    return serialize(lead)


@router.post("/{workspace_id}/leads/{lead_id}/generate-pitch", status_code=201)
def generate_pitch(
    workspace_id: str,
    lead_id: str,
    payload: GeneratePitchRequest,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    lead = get_lead(db, workspace_id, lead_id)
    company = db.scalar(select(Company).where(Company.id == lead.company_id, Company.workspace_id == workspace_id))
    if not company:
        raise HTTPException(status_code=404, detail="company_not_found")

    # Look up catalog buyer details if available
    buyer_catalog = None
    source_record = db.scalar(
        select(CompanySourceRecord).where(
            CompanySourceRecord.company_id == company.id,
            CompanySourceRecord.source_type == "global_buyer_catalog",
        )
    )
    if source_record and source_record.raw_data and source_record.raw_data.get("buyer_catalog_id"):
        catalog_id = source_record.raw_data.get("buyer_catalog_id")
        buyer_catalog = db.scalar(select(GlobalBuyerCatalog).where(GlobalBuyerCatalog.id == catalog_id))

    if not buyer_catalog and company.normalized_name and company.country_code:
        buyer_catalog = db.scalar(
            select(GlobalBuyerCatalog).where(
                GlobalBuyerCatalog.normalized_name == company.normalized_name,
                GlobalBuyerCatalog.country_code == company.country_code,
            )
        )

    # Assemble buyer_data dict
    attrs = company.attributes or {}
    buyer_data = {
        "company_name": buyer_catalog.company_name if buyer_catalog else company.name,
        "contact_name": (buyer_catalog.contact_name if buyer_catalog else None) or company.contact_name or "Procurement Director",
        "country_code": (buyer_catalog.country_code if buyer_catalog else None) or company.country_code or "Target Market",
        "city": (buyer_catalog.city if buyer_catalog else None) or attrs.get("city") or "Main Port",
        "primary_sector": (buyer_catalog.primary_sector if buyer_catalog else None) or company.product_or_industry or "General Merchandise",
        "annual_import_volume_usd": (buyer_catalog.annual_import_volume_usd if buyer_catalog else None) or attrs.get("annual_import_volume_usd", 0.0),
        "avg_order_tons": (buyer_catalog.avg_order_tons if buyer_catalog else None) or attrs.get("avg_order_tons", 50.0),
        "required_certifications": (buyer_catalog.required_certifications if buyer_catalog else None) or attrs.get("required_certifications", ["ISO 9001"]),
        "preferred_incoterms": (buyer_catalog.preferred_incoterms if buyer_catalog else None) or attrs.get("preferred_incoterms", "CIF"),
        "customs_manifest_provenance": (buyer_catalog.customs_manifest_provenance if buyer_catalog else None) or attrs.get("customs_provenance", "Customs Bill of Lading Manifest"),
        "hs_codes": (buyer_catalog.hs_codes if buyer_catalog else None) or attrs.get("hs_codes", []),
    }

    # Exporter Profile
    profile_record = get_latest_profile_version(db, workspace_id)
    profile_payload = profile_record.payload if profile_record else {}
    exporter_profile = {
        "company_name": profile_payload.get("company_name", "Global Export Manufacturer"),
        "capacity_tons": profile_payload.get("capacity_tons", 150.0),
        "certifications": profile_payload.get("certifications", ["ISO 9001"]),
        "origin_port": profile_payload.get("origin_port", "Nhava Sheva (JNPT) / Mundra"),
    }

    # Tariff & FTA lookup
    tariff_data = None
    target_country = (buyer_data.get("country_code") or "").upper()
    exporter_country = (profile_payload.get("origin_country") or "IN").upper()

    tariff_record = db.scalar(
        select(TariffSchedule).where(
            TariffSchedule.exporter_country == exporter_country,
            TariffSchedule.importer_country == target_country,
        )
    )
    if tariff_record:
        savings = max(0.0, float(tariff_record.mfn_applied_rate_pct - tariff_record.preferential_rate_pct))
        tariff_data = {
            "agreement_name": tariff_record.agreement_name or "Bilateral Trade Agreement",
            "tariff_savings_pct": savings,
            "preferential_rate_pct": float(tariff_record.preferential_rate_pct),
        }

    # Generate pitch
    result = generate_export_pitch(
        buyer_data=buyer_data,
        exporter_profile=exporter_profile,
        tariff_data=tariff_data,
        channel=payload.channel,
        custom_notes=payload.custom_notes,
    )

    # Save to OutreachDraft
    draft = OutreachDraft(
        lead_id=lead.id,
        created_by_user_id=user.id,
        channel=payload.channel,
        subject=result.get("subject"),
        body=result.get("body"),
        status="draft",
    )
    db.add(draft)

    # Record LeadEvent
    event = LeadEvent(
        lead_id=lead.id,
        actor_user_id=user.id,
        event_type="outreach_draft_generated",
        payload={
            "channel": payload.channel,
            "model_used": result.get("model_used"),
            "subject": result.get("subject"),
        },
    )
    db.add(event)
    db.commit()
    db.refresh(draft)

    serialized = serialize_draft(draft)
    serialized["model_used"] = result.get("model_used")
    return serialized


@router.post("/{workspace_id}/leads/{lead_id}/events", status_code=201)
def create_event(workspace_id: str, lead_id: str, payload: LeadEventWrite, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    lead = get_lead(db, workspace_id, lead_id)
    event = LeadEvent(lead_id=lead.id, actor_user_id=user.id, event_type=payload.event_type, payload=payload.payload)
    db.add(event)
    db.commit()
    db.refresh(event)
    return {"id": event.id, "event_type": event.event_type, "payload": event.payload, "occurred_at": event.occurred_at.isoformat() if event.occurred_at else None}


@router.patch("/{workspace_id}/leads/{lead_id}/stage")
def change_stage(workspace_id: str, lead_id: str, payload: LeadStageChange, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    if payload.stage not in VALID_STAGES:
        raise HTTPException(status_code=422, detail="invalid_lead_stage")
    lead = get_lead(db, workspace_id, lead_id)
    required_event = REQUIRED_EVENT_FOR_STAGE.get(payload.stage)
    if required_event and not db.scalar(select(LeadEvent).where(LeadEvent.lead_id == lead.id, LeadEvent.event_type == required_event)):
        raise HTTPException(status_code=409, detail="required_event_missing")
    lead.stage = payload.stage
    if payload.note is not None:
        lead.notes = payload.note
    db.add(LeadEvent(lead_id=lead.id, actor_user_id=user.id, event_type="stage_changed", payload={"stage": payload.stage}))
    db.commit()
    db.refresh(lead)
    return serialize(lead)


@router.get("/{workspace_id}/leads/{lead_id}/events")
def list_events(workspace_id: str, lead_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db)
    get_lead(db, workspace_id, lead_id)
    items = db.scalars(select(LeadEvent).where(LeadEvent.lead_id == lead_id).order_by(LeadEvent.occurred_at.desc()))
    return {"items": [{"id": item.id, "event_type": item.event_type, "payload": item.payload, "occurred_at": item.occurred_at.isoformat() if item.occurred_at else None} for item in items]}


@router.post("/{workspace_id}/leads/{lead_id}/drafts", status_code=201)
def create_draft(workspace_id: str, lead_id: str, payload: DraftWrite, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    lead = get_lead(db, workspace_id, lead_id)
    draft = OutreachDraft(lead_id=lead.id, created_by_user_id=user.id, channel=payload.channel, subject=payload.subject, body=payload.body, status="draft")
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return serialize_draft(draft)


@router.get("/{workspace_id}/leads/{lead_id}/drafts")
def list_drafts(workspace_id: str, lead_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db)
    get_lead(db, workspace_id, lead_id)
    drafts = db.scalars(select(OutreachDraft).where(OutreachDraft.lead_id == lead_id).order_by(OutreachDraft.created_at.desc()))
    return {"items": [serialize_draft(draft) for draft in drafts]}
