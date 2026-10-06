import base64
from datetime import datetime, timedelta, timezone
import hashlib
import json
import secrets
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest, urlopen

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_csrf
from app.core.config import settings
from app.db.session import get_db
from app.models.session import LoginRateLimit, OAuthAuthorization, SessionToken
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, UserProfileUpdate
from app.services.auth_service import authenticate_password, find_or_create_google_user, hash_token, issue_session_token, register_user, session_expiry

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
LOGIN_WINDOW = timedelta(minutes=15)
LOGIN_MAX_ATTEMPTS = 10


def exchange_google_authorization(code: str, verifier: str, nonce: str) -> dict:
    """Exchange a one-time code and verify the Google ID token signature and claims."""
    request_data = urlencode({"code": code, "client_id": settings.google_client_id, "client_secret": settings.google_client_secret, "redirect_uri": settings.google_redirect_uri, "grant_type": "authorization_code", "code_verifier": verifier}).encode("utf-8")
    try:
        request = UrlRequest("https://oauth2.googleapis.com/token", data=request_data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        with urlopen(request, timeout=10) as response:
            token_response = json.loads(response.read().decode("utf-8"))
        import jwt
        key_client = jwt.PyJWKClient("https://www.googleapis.com/oauth2/v3/certs")
        signing_key = key_client.get_signing_key_from_jwt(token_response["id_token"])
        claims = jwt.decode(token_response["id_token"], signing_key.key, algorithms=["RS256"], audience=settings.google_client_id, issuer=["https://accounts.google.com", "accounts.google.com"])
    except Exception as error:
        raise ValueError("google_identity_verification_failed") from error
    if claims.get("nonce") != nonce or not claims.get("email_verified") or not claims.get("email") or not claims.get("sub"):
        raise ValueError("google_identity_verification_failed")
    return claims


def _rate_limit_key(email: str, request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    client_host = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    return hashlib.sha256(f"{email.strip().lower()}:{client_host}".encode("utf-8")).hexdigest()


def _login_rate_limited(db: Session, key_hash: str, now: datetime) -> bool:
    record = db.get(LoginRateLimit, key_hash)
    if not record:
        return False
    started = record.window_started_at.replace(tzinfo=timezone.utc) if record.window_started_at.tzinfo is None else record.window_started_at
    if started + LOGIN_WINDOW <= now:
        record.window_started_at = now
        record.attempt_count = 0
        db.commit()
        return False
    return record.attempt_count >= LOGIN_MAX_ATTEMPTS


def _record_login_failure(db: Session, key_hash: str, now: datetime) -> None:
    record = db.get(LoginRateLimit, key_hash)
    if not record:
        db.add(LoginRateLimit(key_hash=key_hash, attempt_count=1, window_started_at=now))
    else:
        started = record.window_started_at.replace(tzinfo=timezone.utc) if record.window_started_at.tzinfo is None else record.window_started_at
        if started + LOGIN_WINDOW <= now:
            record.window_started_at = now
            record.attempt_count = 1
        else:
            record.attempt_count += 1
    db.commit()


@router.post("/register", status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> dict[str, str | None]:
    try:
        user = register_user(db, payload.email, payload.password, payload.full_name, payload.company_name)
    except ValueError:
        raise HTTPException(status_code=409, detail="email_already_registered")
    return {"email": user.email, "id": user.id, "full_name": user.full_name}


@router.post("/login")
def login(payload: LoginRequest, response: Response, request: Request, db: Session = Depends(get_db)) -> dict[str, str]:
    now = datetime.now(timezone.utc)
    rate_key = _rate_limit_key(payload.email, request)
    if _login_rate_limited(db, rate_key, now):
        raise HTTPException(status_code=429, detail="login_rate_limited")
    user = authenticate_password(db, payload.email, payload.password)
    if not user:
        _record_login_failure(db, rate_key, now)
        raise HTTPException(status_code=401, detail="invalid_credentials")
    token = issue_session_token()
    csrf = secrets.token_urlsafe(32)
    db.query(SessionToken).filter(SessionToken.user_id == user.id, SessionToken.revoked_at.is_(None)).update({SessionToken.revoked_at: datetime.now(timezone.utc)}, synchronize_session=False)
    existing_limit = db.get(LoginRateLimit, rate_key)
    if existing_limit:
        existing_limit.attempt_count = 0
        existing_limit.window_started_at = now
    db.add(SessionToken(user_id=user.id, token_hash=hash_token(token), csrf_token=csrf, expires_at=session_expiry(settings.session_ttl_hours)))
    db.commit()
    response.set_cookie(settings.session_cookie_name, token, httponly=True, samesite="lax", secure=settings.cookie_secure, max_age=settings.session_ttl_hours * 3600)
    response.set_cookie("foretrade_csrf", csrf, httponly=False, samesite="lax", secure=settings.cookie_secure, max_age=settings.session_ttl_hours * 3600)
    return {"csrf_token": csrf}


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> None:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        record = db.scalar(select(SessionToken).where(SessionToken.token_hash == hash_token(token)))
        if record and not record.revoked_at:
            record.revoked_at = datetime.now(timezone.utc)
            db.commit()
    response.delete_cookie(settings.session_cookie_name)
    response.delete_cookie("foretrade_csrf")
    return None


@router.get("/me")
def me(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str | None]:
    token = request.cookies.get(settings.session_cookie_name)
    session = db.scalar(select(SessionToken).where(SessionToken.token_hash == hash_token(token))) if token else None
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "job_title": user.job_title,
        "csrf_token": session.csrf_token if session else None,
    }


@router.patch("/me")
def update_me(payload: UserProfileUpdate, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict[str, str | None]:
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip() if payload.full_name.strip() else None
    if payload.job_title is not None:
        user.job_title = payload.job_title.strip() if payload.job_title.strip() else None
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "job_title": user.job_title,
    }


@router.get("/google/start")
def google_start(db: Session = Depends(get_db)):
    if not (settings.google_client_id and settings.google_client_secret and settings.google_redirect_uri):
        return JSONResponse(status_code=503, content={"code": "google_oauth_unconfigured"})
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    nonce = secrets.token_urlsafe(32)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")
    db.add(OAuthAuthorization(state_hash=hash_token(state), code_verifier=verifier, nonce=nonce, expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)))
    db.commit()
    query = urlencode({"client_id": settings.google_client_id, "redirect_uri": settings.google_redirect_uri, "response_type": "code", "scope": "openid email profile", "state": state, "nonce": nonce, "code_challenge": challenge, "code_challenge_method": "S256", "access_type": "offline", "prompt": "select_account"})
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{query}", status_code=302)


@router.get("/google/callback")
def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    db: Session = Depends(get_db),
):
    if not (settings.google_client_id and settings.google_client_secret and settings.google_redirect_uri):
        return JSONResponse(status_code=503, content={"code": "google_oauth_unconfigured"})
    authorization = db.scalar(select(OAuthAuthorization).where(OAuthAuthorization.state_hash == hash_token(state or "")))
    expiry = authorization.expires_at.replace(tzinfo=timezone.utc) if authorization and authorization.expires_at.tzinfo is None else authorization.expires_at if authorization else None
    if not code or not state or not authorization or authorization.consumed_at or expiry <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="invalid_google_oauth_state")
    authorization.consumed_at = datetime.now(timezone.utc)
    db.commit()
    try:
        claims = exchange_google_authorization(code, authorization.code_verifier, authorization.nonce)
        user = find_or_create_google_user(db, claims["email"], claims["sub"])
    except ValueError as error:
        raise HTTPException(status_code=401, detail=str(error))
    token = issue_session_token()
    csrf = secrets.token_urlsafe(32)
    db.add(SessionToken(user_id=user.id, token_hash=hash_token(token), csrf_token=csrf, expires_at=session_expiry(settings.session_ttl_hours)))
    db.commit()

    # Browser navigation receives redirect to onboarding, API client receives JSON
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        response = RedirectResponse(f"{settings.frontend_url}/onboarding", status_code=303)
    else:
        response = JSONResponse({"csrf_token": csrf, "email": user.email})

    response.set_cookie(settings.session_cookie_name, token, httponly=True, samesite="lax", secure=settings.cookie_secure, max_age=settings.session_ttl_hours * 3600)
    response.set_cookie("foretrade_csrf", csrf, httponly=False, samesite="lax", secure=settings.cookie_secure, max_age=settings.session_ttl_hours * 3600)
    return response
