import hashlib, secrets
from dataclasses import dataclass
from sqlalchemy.orm import Session
from app.core.security import hash_password, verify_password
from app.models.user import User
@dataclass(frozen=True)
class RegisteredUser: id: str; email: str
def register_user(session: Session, email: str, password: str) -> RegisteredUser:
    normalized=email.strip().lower()
    if session.query(User).filter_by(email=normalized).first(): raise ValueError("email_already_registered")
    user=User(email=normalized,password_hash=hash_password(password)); session.add(user); session.commit(); session.refresh(user)
    return RegisteredUser(id=user.id,email=user.email)
def authenticate_password(session: Session,email:str,password:str)->User|None:
    user=session.query(User).filter_by(email=email.strip().lower()).first()
    return user if user and verify_password(password,user.password_hash) else None
def issue_session_token()->str:return secrets.token_urlsafe(32)
def hash_token(token:str)->str:return hashlib.sha256(token.encode()).hexdigest()
