import hashlib, secrets
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from sqlalchemy.orm import Session
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMembership, WorkspaceRole
@dataclass(frozen=True)
class RegisteredUser:
    id: str
    email: str
    full_name: str | None = None

def register_user(session: Session, email: str, password: str, full_name: str | None = None, company_name: str | None = None) -> RegisteredUser:
    normalized = email.strip().lower()
    if session.query(User).filter_by(email=normalized).first():
        raise ValueError("email_already_registered")
    cleaned_name = full_name.strip() if full_name and full_name.strip() else None
    user = User(email=normalized, password_hash=hash_password(password), full_name=cleaned_name)
    session.add(user)
    session.flush()
    ws_name = f"{company_name.strip()} Workspace" if company_name and company_name.strip() else f"{normalized.split('@')[0]}'s workspace"
    workspace = Workspace(name=ws_name)
    session.add(workspace)
    session.flush()
    session.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER.value))
    if company_name and company_name.strip():
        from app.models.exporter_profile import ExporterProfileVersion
        profile = ExporterProfileVersion(
            workspace_id=workspace.id,
            version=1,
            payload={"company_name": company_name.strip(), "origin_country": "IN"},
            created_by_user_id=user.id,
        )
        session.add(profile)
    session.commit()
    session.refresh(user)
    return RegisteredUser(id=user.id, email=user.email, full_name=user.full_name)
def authenticate_password(session: Session,email:str,password:str)->User|None:
    user=session.query(User).filter_by(email=email.strip().lower()).first()
    return user if user and verify_password(password,user.password_hash) else None
def issue_session_token()->str:return secrets.token_urlsafe(32)
def hash_token(token:str)->str:return hashlib.sha256(token.encode()).hexdigest()
def session_expiry(hours: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def find_or_create_google_user(session: Session, email: str, subject: str) -> User:
    normalized = email.strip().lower()
    user = session.query(User).filter((User.google_subject == subject) | (User.email == normalized)).first()
    if user:
        if user.google_subject and user.google_subject != subject:
            raise ValueError("google_account_conflict")
        user.google_subject = subject
        session.commit(); session.refresh(user)
        return user
    user = User(email=normalized, google_subject=subject)
    session.add(user); session.flush()
    workspace = Workspace(name=f"{normalized.split('@')[0]}'s workspace")
    session.add(workspace); session.flush()
    session.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER.value))
    session.commit(); session.refresh(user)
    return user
