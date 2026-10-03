"""Shared request dependencies for authenticated, workspace-scoped endpoints."""

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.session import SessionToken
from app.models.user import User
from app.models.workspace import WorkspaceMembership
from app.services.auth_service import hash_token


ROLE_RANK = {"viewer": 1, "editor": 2, "owner": 3}


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="authentication_required")
    session = db.scalar(select(SessionToken).where(SessionToken.token_hash == hash_token(token)))
    now = datetime.now(timezone.utc)
    if not session or session.revoked_at or _as_utc(session.expires_at) <= now:
        raise HTTPException(status_code=401, detail="authentication_required")
    user = db.get(User, session.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="authentication_required")
    session.last_seen_at = now
    db.commit()
    return user


def require_csrf(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.session_cookie_name)
    session = db.scalar(select(SessionToken).where(SessionToken.token_hash == hash_token(token)))
    supplied = request.headers.get("X-CSRF-Token")
    if not session or not supplied or supplied != session.csrf_token:
        raise HTTPException(status_code=403, detail="csrf_validation_failed")
    return user


def require_workspace_role(workspace_id: str, user: User, db: Session, minimum_role: str = "viewer") -> WorkspaceMembership:
    membership = db.scalar(select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == user.id))
    if not membership:
        raise HTTPException(status_code=404, detail="workspace_not_found")
    if ROLE_RANK.get(membership.role, 0) < ROLE_RANK[minimum_role]:
        raise HTTPException(status_code=403, detail="workspace_permission_denied")
    return membership
