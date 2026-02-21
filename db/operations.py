"""
=============================================================================
FORETRADE — Database Operations (Streamlit-Safe)
=============================================================================
All functions return native Python types (dict/list/primitives), NOT ORM objects.
Sessions are short-lived; ORM objects are converted to dicts before session close.
Optional Session parameter for reuse; default get_db() when not provided.
=============================================================================
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence, TypeVar

import numpy as np
from sqlalchemy import create_engine, select, and_, func
from sqlalchemy.orm import Session, sessionmaker

from db.models import Base, User, SwipeDecision, ApprovedLead, Conversation, UserWeights, AnalyticsCache

# ---------------------------------------------------------------------------
# Engine & session (lazy init)
# ---------------------------------------------------------------------------
_DATABASE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(_DATABASE_DIR, exist_ok=True)
_DB_PATH = os.environ.get("FORETRADE_DB_PATH", os.path.join(_DATABASE_DIR, "foretrade.db"))

_engine = None
_SessionLocal = None


def _get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(
            f"sqlite:///{_DB_PATH}",
            connect_args={"check_same_thread": False},
            echo=os.environ.get("SQLALCHEMY_ECHO", "").lower() in ("1", "true"),
        )
    return _engine


def _get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=_get_engine(),
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
    return _SessionLocal


# ---------------------------------------------------------------------------
# Session access (Streamlit: fresh session per request)
# ---------------------------------------------------------------------------
@contextmanager
def get_db() -> Session:
    """
    Yield a fresh database session. Caller must not hold the session
    across Streamlit reruns. Use as context manager or call close().
    """
    factory = _get_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Numpy / Pandas type sanitization for JSON
# ---------------------------------------------------------------------------
def _sanitize_for_json(obj: Any) -> Any:
    """
    Recursively convert numpy/pandas types to native Python for JSON serialization.
    Use on all user-provided or DataFrame-sourced data before storing in JSON columns.
    """
    if obj is None:
        return None
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    if isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if hasattr(obj, "item"):  # numpy scalar
        return obj.item()
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(v) for v in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


# ---------------------------------------------------------------------------
# Init DB & demo data
# ---------------------------------------------------------------------------
def init_db() -> None:
    """Create all tables. Safe to call on every app start (idempotent)."""
    Base.metadata.create_all(bind=_get_engine())


def init_demo_accounts() -> None:
    """
    Insert demo user accounts if none exist. Matches existing ForeTrade demo credentials.
    """
    with get_db() as session:
        if session.scalar(select(User).limit(1)) is not None:
            return
        for email, data in _DEMO_ACCOUNTS.items():
            u = User(
                email=email,
                first_name=data["first_name"],
                last_name=data.get("last_name", ""),
                role=data["role"],
                company=data.get("company", ""),
                industry=data.get("industry", ""),
                phone=data.get("phone", ""),
            )
            u.set_password(data["password"])
            session.add(u)
        session.commit()


_DEMO_ACCOUNTS = {
    "shravan@foretrade.ai": {
        "password": "shravan123",
        "first_name": "Shravan",
        "last_name": "",
        "role": "Export Manager",
        "company": "Precision Manufacturing Co.",
        "industry": "Engineering",
        "phone": "+91 98765 43210",
    },
    "admin@foretrade.ai": {
        "password": "Admin123!",
        "first_name": "Priya",
        "last_name": "Sharma",
        "role": "Director",
        "company": "ForeTrade Technologies",
        "industry": "IT Software",
        "phone": "+91 91234 56789",
    },
}


# ---------------------------------------------------------------------------
# User → dict (materialize before session close)
# ---------------------------------------------------------------------------
def _user_to_dict(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "role": u.role,
        "company": u.company,
        "industry": u.industry,
        "phone": u.phone,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "updated_at": u.updated_at.isoformat() if u.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def verify_user(email: str, password: str, session: Optional[Session] = None) -> Optional[dict]:
    """
    Verify credentials. Returns user dict (no password) or None.
    """
    def _run(sess: Session) -> Optional[dict]:
        user = sess.scalar(select(User).where(User.email == email.strip().lower()))
        if user is None or not user.check_password(password):
            return None
        return _user_to_dict(user)

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)


def create_user(
    email: str,
    password: str,
    first_name: str = "",
    last_name: str = "",
    role: str = "Export Manager",
    company: str = "",
    industry: str = "",
    phone: str = "",
    session: Optional[Session] = None,
) -> dict:
    """
    Create a new user. Hashes password with SHA256. Returns user dict.
    Raises ValueError if email already exists.
    """
    email = email.strip().lower()
    if not email or not password:
        raise ValueError("Email and password are required")

    def _run(sess: Session) -> dict:
        if sess.scalar(select(User).where(User.email == email)) is not None:
            raise ValueError("An account with this email already exists")
        u = User(
            email=email,
            first_name=first_name or "",
            last_name=last_name or "",
            role=role or "Export Manager",
            company=company or "",
            industry=industry or "",
            phone=phone or "",
        )
        u.set_password(password)
        sess.add(u)
        sess.flush()
        sess.refresh(u)
        return _user_to_dict(u)

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)


# ---------------------------------------------------------------------------
# Swipe decisions
# ---------------------------------------------------------------------------
def save_swipe(
    user_id: int,
    exporter_id: str,
    buyer_id: str,
    direction: str,
    match_score: Optional[float] = None,
    breakdown: Optional[dict] = None,
    session: Optional[Session] = None,
) -> dict:
    """
    Store one swipe decision. direction: "right" | "left" | "skip".
    breakdown and match_score sanitized for JSON. Returns created row as dict.
    """
    direction = (direction or "").strip().lower()
    if direction not in ("right", "left", "skip"):
        raise ValueError("direction must be 'right', 'left', or 'skip'")
    breakdown = _sanitize_for_json(breakdown) if breakdown is not None else None
    if match_score is not None and isinstance(match_score, (np.floating, np.float64)):
        match_score = float(match_score)

    def _run(sess: Session) -> dict:
        row = SwipeDecision(
            user_id=user_id,
            exporter_id=str(exporter_id),
            buyer_id=str(buyer_id),
            direction=direction,
            match_score=match_score,
            breakdown=breakdown,
        )
        sess.add(row)
        sess.flush()
        sess.refresh(row)
        return {
            "id": row.id,
            "user_id": row.user_id,
            "exporter_id": row.exporter_id,
            "buyer_id": row.buyer_id,
            "direction": row.direction,
            "match_score": row.match_score,
            "breakdown": row.breakdown,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)


# ---------------------------------------------------------------------------
# Approved leads
# ---------------------------------------------------------------------------
def save_approved_lead(
    user_id: int,
    exporter_id: str,
    buyer_id: str,
    buyer_details: Optional[dict] = None,
    match_analysis: Optional[dict] = None,
    pipeline_status: str = "pending",
    session: Optional[Session] = None,
) -> dict:
    """
    Insert or get existing approved lead (unique on user_id, exporter_id, buyer_id).
    buyer_details and match_analysis sanitized for JSON. Returns lead dict.
    """
    pipeline_status = (pipeline_status or "pending").strip().lower()
    if pipeline_status not in ("pending", "contacted", "negotiating", "won", "lost"):
        pipeline_status = "pending"
    buyer_details = _sanitize_for_json(buyer_details) if buyer_details else None
    match_analysis = _sanitize_for_json(match_analysis) if match_analysis else None

    def _run(sess: Session) -> dict:
        existing = sess.scalar(
            select(ApprovedLead).where(
                and_(
                    ApprovedLead.user_id == user_id,
                    ApprovedLead.exporter_id == str(exporter_id),
                    ApprovedLead.buyer_id == str(buyer_id),
                )
            )
        )
        if existing:
            return _lead_to_dict(existing)
        lead = ApprovedLead(
            user_id=user_id,
            exporter_id=str(exporter_id),
            buyer_id=str(buyer_id),
            pipeline_status=pipeline_status,
            buyer_details=buyer_details,
            match_analysis=match_analysis,
        )
        sess.add(lead)
        sess.flush()
        sess.refresh(lead)
        return _lead_to_dict(lead)

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)


def _lead_to_dict(l: ApprovedLead) -> dict:
    return {
        "id": l.id,
        "user_id": l.user_id,
        "exporter_id": l.exporter_id,
        "buyer_id": l.buyer_id,
        "pipeline_status": l.pipeline_status,
        "buyer_details": l.buyer_details,
        "match_analysis": l.match_analysis,
        "created_at": l.created_at.isoformat() if l.created_at else None,
        "updated_at": l.updated_at.isoformat() if l.updated_at else None,
    }


def get_user_approved_leads(
    user_id: int,
    exporter_id: Optional[str] = None,
    pipeline_status: Optional[str] = None,
    session: Optional[Session] = None,
) -> List[dict]:
    """
    List approved leads for a user. Optional filter by exporter_id and/or pipeline_status.
    Returns list of lead dicts (no conversation bodies).
    """
    def _run(sess: Session) -> List[dict]:
        q = select(ApprovedLead).where(ApprovedLead.user_id == user_id)
        if exporter_id is not None:
            q = q.where(ApprovedLead.exporter_id == str(exporter_id))
        if pipeline_status is not None:
            q = q.where(ApprovedLead.pipeline_status == pipeline_status.strip().lower())
        q = q.order_by(ApprovedLead.created_at.desc())
        rows = list(sess.scalars(q))
        return [_lead_to_dict(r) for r in rows]

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)


def update_lead_status(
    lead_id: int,
    pipeline_status: str,
    session: Optional[Session] = None,
) -> Optional[dict]:
    """
    Update pipeline status of an approved lead. Returns updated lead dict or None if not found.
    """
    pipeline_status = (pipeline_status or "").strip().lower()
    if pipeline_status not in ("pending", "contacted", "negotiating", "won", "lost"):
        raise ValueError("pipeline_status must be one of: pending, contacted, negotiating, won, lost")

    def _run(sess: Session) -> Optional[dict]:
        lead = sess.get(ApprovedLead, lead_id)
        if lead is None:
            return None
        lead.pipeline_status = pipeline_status
        sess.flush()
        sess.refresh(lead)
        return _lead_to_dict(lead)

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)


# ---------------------------------------------------------------------------
# Conversation
# ---------------------------------------------------------------------------
def save_conversation_message(
    lead_id: int,
    role: str,
    message: str,
    session: Optional[Session] = None,
) -> dict:
    """
    Append one message to a lead's conversation. role: "user" | "bot".
    Returns created message row as dict.
    """
    role = (role or "").strip().lower()
    if role not in ("user", "bot"):
        raise ValueError("role must be 'user' or 'bot'")
    message = (message or "").strip()

    def _run(sess: Session) -> dict:
        lead = sess.get(ApprovedLead, lead_id)
        if lead is None:
            raise ValueError(f"Lead id {lead_id} not found")
        row = Conversation(lead_id=lead_id, role=role, message=message)
        sess.add(row)
        sess.flush()
        sess.refresh(row)
        return {
            "id": row.id,
            "lead_id": row.lead_id,
            "role": row.role,
            "message": row.message,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)


def get_conversation_history(
    lead_id: int,
    limit: int = 100,
    session: Optional[Session] = None,
) -> List[dict]:
    """
    Get messages for a lead, oldest first. Returns list of message dicts.
    """
    def _run(sess: Session) -> List[dict]:
        q = (
            select(Conversation)
            .where(Conversation.lead_id == lead_id)
            .order_by(Conversation.created_at.asc())
            .limit(max(1, limit))
        )
        rows = list(sess.scalars(q))
        return [
            {
                "id": r.id,
                "lead_id": r.lead_id,
                "role": r.role,
                "message": r.message,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)


# ---------------------------------------------------------------------------
# User weights
# ---------------------------------------------------------------------------
def save_user_weights(
    user_id: int,
    weights: dict,
    version: int = 1,
    session: Optional[Session] = None,
) -> dict:
    """
    Save ML weights for a user. Weights sanitized for JSON. version for A/B or rollback.
    Returns saved row as dict.
    """
    weights = _sanitize_for_json(weights) if weights else {}
    if not isinstance(weights, dict):
        raise ValueError("weights must be a dict")

    def _run(sess: Session) -> dict:
        row = UserWeights(user_id=user_id, weights=weights, version=version)
        sess.add(row)
        sess.flush()
        sess.refresh(row)
        return {
            "id": row.id,
            "user_id": row.user_id,
            "weights": row.weights,
            "version": row.version,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)


def get_user_weights(
    user_id: int,
    version: Optional[int] = None,
    session: Optional[Session] = None,
) -> Optional[dict]:
    """
    Get latest (or specific version) weights for user. Returns weights dict or None.
    """
    def _run(sess: Session) -> Optional[dict]:
        q = select(UserWeights).where(UserWeights.user_id == user_id)
        if version is not None:
            q = q.where(UserWeights.version == version)
        q = q.order_by(UserWeights.created_at.desc()).limit(1)
        row = sess.scalar(q)
        if row is None:
            return None
        return {
            "id": row.id,
            "user_id": row.user_id,
            "weights": row.weights,
            "version": row.version,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)


# ---------------------------------------------------------------------------
# Analytics cache
# ---------------------------------------------------------------------------
def get_user_analytics(
    user_id: int,
    cache_ttl_seconds: Optional[int] = 3600,
    session: Optional[Session] = None,
) -> dict:
    """
    Aggregate analytics for a user: swipe counts, approval rate, lead counts by status.
    Optionally use cached result if cache_ttl_seconds is set and cache is fresh.
    Returns single dict with keys like total_swipes, approved_count, leads_by_status, etc.
    """
    def _run(sess: Session) -> dict:
        # Swipe counts
        swipe_counts = sess.execute(
            select(SwipeDecision.direction, func.count(SwipeDecision.id))
            .where(SwipeDecision.user_id == user_id)
            .group_by(SwipeDecision.direction)
        ).all()
        by_dir = {d: c for d, c in swipe_counts}
        total_swipes = sum(by_dir.values())
        approved_count = by_dir.get("right", 0)
        rejected_count = by_dir.get("left", 0)
        skipped_count = by_dir.get("skip", 0)

        # Lead counts by status
        lead_counts = sess.execute(
            select(ApprovedLead.pipeline_status, func.count(ApprovedLead.id))
            .where(ApprovedLead.user_id == user_id)
            .group_by(ApprovedLead.pipeline_status)
        ).all()
        leads_by_status = {s: c for s, c in lead_counts}
        total_leads = sum(leads_by_status.values())

        approval_rate = round(100.0 * approved_count / total_swipes, 1) if total_swipes else 0.0

        return _sanitize_for_json({
            "user_id": user_id,
            "total_swipes": total_swipes,
            "approved_count": approved_count,
            "rejected_count": rejected_count,
            "skipped_count": skipped_count,
            "approval_rate": approval_rate,
            "total_leads": total_leads,
            "leads_by_status": leads_by_status,
        })

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)


def set_analytics_cache(
    user_id: int,
    cache_key: str,
    cache_value: dict,
    ttl_seconds: Optional[int] = None,
    session: Optional[Session] = None,
) -> None:
    """Write analytics cache. cache_value sanitized for JSON."""
    cache_value = _sanitize_for_json(cache_value) if cache_value else {}
    expires_at = (datetime.utcnow() + timedelta(seconds=ttl_seconds)) if ttl_seconds else None

    def _run(sess: Session) -> None:
        # Upsert: delete old same key, insert new
        sess.execute(
            AnalyticsCache.__table__.delete().where(
                and_(AnalyticsCache.user_id == user_id, AnalyticsCache.cache_key == cache_key)
            )
        )
        row = AnalyticsCache(
            user_id=user_id,
            cache_key=cache_key,
            cache_value=cache_value,
            expires_at=expires_at,
        )
        sess.add(row)

    if session is not None:
        _run(session)
    else:
        with get_db() as sess:
            _run(sess)


def get_analytics_cache(
    user_id: int,
    cache_key: str,
    session: Optional[Session] = None,
) -> Optional[dict]:
    """Read analytics cache if present and not expired. Returns cache_value dict or None."""
    def _run(sess: Session) -> Optional[dict]:
        row = sess.scalar(
            select(AnalyticsCache).where(
                and_(
                    AnalyticsCache.user_id == user_id,
                    AnalyticsCache.cache_key == cache_key,
                )
            )
        )
        if row is None:
            return None
        if row.expires_at and row.expires_at < datetime.utcnow():
            sess.delete(row)
            return None
        return row.cache_value

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)


# ---------------------------------------------------------------------------
# Helpers for Streamlit: get user by email (for session)
# ---------------------------------------------------------------------------
def get_user_by_email(email: str, session: Optional[Session] = None) -> Optional[dict]:
    """Return user dict by email or None."""
    def _run(sess: Session) -> Optional[dict]:
        u = sess.scalar(select(User).where(User.email == email.strip().lower()))
        return _user_to_dict(u) if u else None

    if session is not None:
        return _run(session)
    with get_db() as sess:
        return _run(sess)
