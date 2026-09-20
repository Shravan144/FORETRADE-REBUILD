from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.db.base import Base
from app.db.session import get_db
from app.models.session import SessionToken
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.auth_service import authenticate_password, hash_token, issue_session_token, register_user
import secrets
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
def ensure_schema(db:Session)->None: Base.metadata.create_all(db.bind)
@router.post("/register", status_code=201)
def register(payload:RegisterRequest, db:Session=Depends(get_db))->dict[str,str]:
    ensure_schema(db)
    try: user=register_user(db,payload.email,payload.password)
    except ValueError: raise HTTPException(409,"email_already_registered")
    return {"email":user.email,"id":user.id}
@router.post("/login")
def login(payload:LoginRequest,response:Response,db:Session=Depends(get_db))->dict[str,str]:
    ensure_schema(db); user=authenticate_password(db,payload.email,payload.password)
    if not user: raise HTTPException(401,"invalid_credentials")
    token=issue_session_token(); csrf=secrets.token_urlsafe(24)
    db.add(SessionToken(user_id=user.id,token_hash=hash_token(token),csrf_token=csrf));db.commit()
    response.set_cookie("foretrade_session",token,httponly=True,samesite="lax",secure=False)
    return {"csrf_token":csrf}
@router.post("/logout",status_code=204)
def logout(response:Response)->None: response.delete_cookie("foretrade_session")
@router.get("/google/start")
def google_start()->JSONResponse: return JSONResponse(status_code=503,content={"code":"google_oauth_unconfigured"})
@router.get("/google/callback")
def google_callback()->JSONResponse: return JSONResponse(status_code=503,content={"code":"google_oauth_unconfigured"})
