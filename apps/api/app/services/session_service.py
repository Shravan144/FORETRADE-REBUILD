from fastapi import Request, HTTPException
from sqlalchemy.orm import Session
from app.models.session import SessionToken
from app.models.user import User
from app.services.auth_service import hash_token
def require_user(request:Request,db:Session)->User:
    token=request.cookies.get("foretrade_session")
    if not token: raise HTTPException(401,"authentication_required")
    record=db.query(SessionToken).filter_by(token_hash=hash_token(token)).first()
    if not record: raise HTTPException(401,"authentication_required")
    user=db.get(User,record.user_id)
    if not user: raise HTTPException(401,"authentication_required")
    return user
