from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_csrf, require_workspace_role
from app.db.session import get_db
from app.models.audit_event import record_audit_event
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMembership, WorkspaceRole

router = APIRouter(prefix="/api/v1/workspaces", tags=["workspaces"])


class WorkspaceWrite(BaseModel):
    name: str = Field(min_length=2, max_length=200)


class MembershipWrite(BaseModel):
    email: str
    role: WorkspaceRole


@router.get("")
def list_workspaces(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    rows = db.execute(select(Workspace, WorkspaceMembership.role).join(WorkspaceMembership).where(WorkspaceMembership.user_id == user.id).order_by(Workspace.created_at)).all()
    return {"items": [{"id": workspace.id, "name": workspace.name, "role": role} for workspace, role in rows]}


@router.post("", status_code=201)
def create_workspace(payload: WorkspaceWrite, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    from app.services.workspace_service import seed_starter_companies_for_workspace
    workspace = Workspace(name=payload.name.strip())
    db.add(workspace); db.flush()
    db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER.value))
    record_audit_event(db, workspace_id=workspace.id, actor_user_id=user.id, action="workspace.created", entity_type="workspace", entity_id=workspace.id, metadata={})
    db.commit()
    seed_starter_companies_for_workspace(db, workspace.id)
    return {"id": workspace.id, "name": workspace.name, "role": WorkspaceRole.OWNER.value}


@router.get("/{workspace_id}")
def get_workspace(workspace_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    membership = require_workspace_role(workspace_id, user, db)
    workspace = db.get(Workspace, workspace_id)
    return {"id": workspace.id, "name": workspace.name, "role": membership.role}


@router.get("/{workspace_id}/members")
def list_members(workspace_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "viewer")
    rows = db.execute(
        select(WorkspaceMembership, User.email)
        .join(User, WorkspaceMembership.user_id == User.id)
        .where(WorkspaceMembership.workspace_id == workspace_id)
        .order_by(WorkspaceMembership.created_at)
    ).all()
    return {
        "items": [
            {
                "id": membership.id,
                "user_id": membership.user_id,
                "email": email,
                "role": membership.role,
                "created_at": membership.created_at.isoformat() if membership.created_at else None,
            }
            for membership, email in rows
        ]
    }


@router.post("/{workspace_id}/members", status_code=201)
def add_member(workspace_id: str, payload: MembershipWrite, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "owner")
    invitee = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not invitee:
        raise HTTPException(status_code=404, detail="user_not_found")
    existing = db.scalar(select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == invitee.id))
    if existing:
        existing.role = payload.role.value
    else:
        db.add(WorkspaceMembership(workspace_id=workspace_id, user_id=invitee.id, role=payload.role.value))
    record_audit_event(db, workspace_id=workspace_id, actor_user_id=user.id, action="workspace.member_upserted", entity_type="user", entity_id=invitee.id, metadata={"role": payload.role.value})
    db.commit()
    return {"user_id": invitee.id, "role": payload.role.value}
