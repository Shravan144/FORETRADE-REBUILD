from fastapi import Request, HTTPException
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.session import SessionToken
from app.models.user import User
from app.services.auth_service import hash_token
def require_user(request:Request,db:Session)->User:
    token=request.cookies.get("foretrade_session")
    if not token: raise HTTPException(401,"authentication_required")
    record=db.query(SessionToken).filter_by(token_hash=hash_token(token)).first()
    expiry = record.expires_at.replace(tzinfo=timezone.utc) if record and record.expires_at.tzinfo is None else record.expires_at
    if not record or record.revoked_at or expiry <= datetime.now(timezone.utc): raise HTTPException(401,"authentication_required")
    user=db.get(User,record.user_id)
    if not user: raise HTTPException(401,"authentication_required")
    return user
