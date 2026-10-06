from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_csrf, require_workspace_role
from app.db.session import get_db
from app.models.user import User
from app.services.workspace_service import (
    create_profile_version,
    get_latest_profile_version,
    list_profile_versions,
)

router = APIRouter(prefix="/api/v1/workspaces", tags=["exporter-profiles"])


class ExporterProfileWrite(BaseModel):
    company_name: str | None = None
    company_address: str | None = None
    origin_country: str | None = "IN"
    origin_port: str | None = None
    iec_code: str | None = None
    tax_id: str | None = None
    contact_person: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    capacity_tons: int = 0
    product_categories: list[str] = []
    target_countries: list[str] = []
    certifications: list[str] = []
    min_order_value_usd: float = 0.0
    bank_name: str | None = None
    bank_branch: str | None = None
    bank_account: str | None = None
    bank_swift: str | None = None
    bank_iban: str | None = None


def serialize_profile(item) -> dict:
    return {
        "id": item.id,
        "workspace_id": item.workspace_id,
        "version": item.version,
        "payload": item.payload,
        "created_by_user_id": item.created_by_user_id,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@router.get("/{workspace_id}/exporter-profile")
def get_current_profile(workspace_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "viewer")
    item = get_latest_profile_version(db, workspace_id)
    if not item:
        raise HTTPException(status_code=404, detail="exporter_profile_not_found")
    return serialize_profile(item)


@router.get("/{workspace_id}/exporter-profile/history")
def get_profile_history(workspace_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "viewer")
    items = list_profile_versions(db, workspace_id)
    return {"items": [serialize_profile(item) for item in items]}


@router.post("/{workspace_id}/exporter-profile")
def create(workspace_id: str, payload: ExporterProfileWrite, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    item = create_profile_version(db, workspace_id, payload.model_dump(), user.id)
    return {"version": item.version, "workspace_id": item.workspace_id, "payload": item.payload}


@router.put("/{workspace_id}/exporter-profile")
def update(workspace_id: str, payload: ExporterProfileWrite, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    item = create_profile_version(db, workspace_id, payload.model_dump(), user.id)
    return {"version": item.version, "workspace_id": item.workspace_id, "payload": item.payload}
