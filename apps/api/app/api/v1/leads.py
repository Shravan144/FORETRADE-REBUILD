from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_csrf, require_workspace_role
from app.db.session import get_db
from app.models.domain import Company, Lead, LeadEvent, OutreachDraft
from app.models.user import User

router = APIRouter(prefix="/api/v1/workspaces", tags=["leads"])
VALID_STAGES = {"new", "qualified", "contacted", "replied", "meeting", "won", "lost"}
EVENT_REQUIRED_STAGE = {"replied": "reply_received", "meeting": "meeting"}


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


def serialize(lead: Lead) -> dict:
    return {"id": lead.id, "company_id": lead.company_id, "stage": lead.stage, "owner_user_id": lead.owner_user_id, "notes": lead.notes, "created_at": lead.created_at.isoformat() if lead.created_at else None, "updated_at": lead.updated_at.isoformat() if lead.updated_at else None}


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


@router.post("/{workspace_id}/leads", status_code=201)
def create_lead(workspace_id: str, payload: LeadCreate, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    if not db.scalar(select(Company).where(Company.id == payload.company_id, Company.workspace_id == workspace_id)):
        raise HTTPException(status_code=404, detail="company_not_found")
    lead = Lead(workspace_id=workspace_id, company_id=payload.company_id, owner_user_id=user.id, notes=payload.notes)
    db.add(lead)
    try:
        db.commit(); db.refresh(lead)
    except IntegrityError:
        db.rollback(); raise HTTPException(status_code=409, detail="lead_already_exists")
    return serialize(lead)


@router.post("/{workspace_id}/leads/{lead_id}/events", status_code=201)
def create_event(workspace_id: str, lead_id: str, payload: LeadEventWrite, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    lead = get_lead(db, workspace_id, lead_id)
    event = LeadEvent(lead_id=lead.id, actor_user_id=user.id, event_type=payload.event_type, payload=payload.payload)
    db.add(event); db.commit(); db.refresh(event)
    return {"id": event.id, "event_type": event.event_type, "payload": event.payload, "occurred_at": event.occurred_at.isoformat() if event.occurred_at else None}


@router.patch("/{workspace_id}/leads/{lead_id}/stage")
def change_stage(workspace_id: str, lead_id: str, payload: LeadStageChange, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    if payload.stage not in VALID_STAGES:
        raise HTTPException(status_code=422, detail="invalid_lead_stage")
    lead = get_lead(db, workspace_id, lead_id)
    required_event = EVENT_REQUIRED_STAGE.get(payload.stage)
    if required_event and not db.scalar(select(LeadEvent).where(LeadEvent.lead_id == lead.id, LeadEvent.event_type == required_event)):
        raise HTTPException(status_code=409, detail="required_event_missing")
    lead.stage = payload.stage
    if payload.note is not None:
        lead.notes = payload.note
    db.add(LeadEvent(lead_id=lead.id, actor_user_id=user.id, event_type="stage_changed", payload={"stage": payload.stage}))
    db.commit(); db.refresh(lead)
    return serialize(lead)


@router.get("/{workspace_id}/leads/{lead_id}/events")
def list_events(workspace_id: str, lead_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db); get_lead(db, workspace_id, lead_id)
    items = db.scalars(select(LeadEvent).where(LeadEvent.lead_id == lead_id).order_by(LeadEvent.occurred_at.desc()))
    return {"items": [{"id": item.id, "event_type": item.event_type, "payload": item.payload, "occurred_at": item.occurred_at.isoformat() if item.occurred_at else None} for item in items]}


@router.post("/{workspace_id}/leads/{lead_id}/drafts", status_code=201)
def create_draft(workspace_id: str, lead_id: str, payload: DraftWrite, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor"); lead = get_lead(db, workspace_id, lead_id)
    draft = OutreachDraft(lead_id=lead.id, created_by_user_id=user.id, channel=payload.channel, subject=payload.subject, body=payload.body, status="draft")
    db.add(draft); db.commit(); db.refresh(draft)
    return {"id": draft.id, "channel": draft.channel, "subject": draft.subject, "body": draft.body, "status": draft.status}
