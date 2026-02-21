"""
=============================================================================
FORETRADE — SQLAlchemy 2.0 ORM Models (SQLite)
=============================================================================
Production-ready schema for user management, swipe decisions, approved leads,
conversations, user weights, and analytics cache.

All models use SQLAlchemy 2.0 declarative style with Mapped/mapped_column.
Indexes added on frequently queried columns for performance.
=============================================================================
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String,
    Integer,
    Float,
    DateTime,
    Text,
    ForeignKey,
    Index,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    """Declarative base for all ForeTrade ORM models."""
    pass


# ---------------------------------------------------------------------------
# 1. USER MANAGEMENT
# ---------------------------------------------------------------------------
class User(Base):
    """
    User account: export managers, directors, etc.
    Supports buyer/exporter roles via role field. Authentication via SHA256.
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA256 hex length
    first_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    role: Mapped[str] = mapped_column(String(64), nullable=False, default="Export Manager")
    company: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    industry: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships (lazy so we can materialize before session close)
    swipe_decisions: Mapped[List["SwipeDecision"]] = relationship(
        "SwipeDecision", back_populates="user", lazy="selectin"
    )
    approved_leads: Mapped[List["ApprovedLead"]] = relationship(
        "ApprovedLead", back_populates="user", lazy="selectin"
    )
    user_weights: Mapped[List["UserWeights"]] = relationship(
        "UserWeights", back_populates="user", lazy="selectin"
    )
    analytics_caches: Mapped[List["AnalyticsCache"]] = relationship(
        "AnalyticsCache", back_populates="user", lazy="selectin"
    )

    def set_password(self, password: str) -> None:
        """Hash and set password (SHA256). Never store plain text."""
        self.password_hash = hashlib.sha256(password.encode()).hexdigest()

    def check_password(self, password: str) -> bool:
        """Verify password against stored hash."""
        return self.password_hash == hashlib.sha256(password.encode()).hexdigest()


# ---------------------------------------------------------------------------
# 2. SWIPE DECISIONS
# ---------------------------------------------------------------------------
class SwipeDecision(Base):
    """
    One row per swipe: approve / reject / skip.
    Links to user (who swiped), exporter_id and buyer_id from ForeTrade dataset.
    """
    __tablename__ = "swipe_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exporter_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    buyer_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(16), nullable=False)  # "right" | "left" | "skip"
    match_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    breakdown: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # score breakdown factors
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="swipe_decisions")

    __table_args__ = (
        Index("ix_swipe_user_created", "user_id", "created_at"),
        Index("ix_swipe_exporter_buyer", "exporter_id", "buyer_id"),
    )


# ---------------------------------------------------------------------------
# 3. APPROVED LEADS (pipeline)
# ---------------------------------------------------------------------------
class ApprovedLead(Base):
    """
    Approved buyer opportunity: one per user-approved buyer for an exporter.
    Pipeline status: pending → contacted → negotiating → won/lost.
    JSON fields for buyer details and match analysis from swipe card.
    """
    __tablename__ = "approved_leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exporter_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    buyer_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    pipeline_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending"
    )  # pending | contacted | negotiating | won | lost
    buyer_details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    match_analysis: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # score, breakdown, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="approved_leads")
    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation", back_populates="lead", lazy="selectin", order_by="Conversation.created_at"
    )

    __table_args__ = (
        Index("ix_lead_user_status", "user_id", "pipeline_status"),
        Index("ix_lead_user_created", "user_id", "created_at"),
        UniqueConstraint("user_id", "exporter_id", "buyer_id", name="uq_lead_user_exporter_buyer"),
    )


# ---------------------------------------------------------------------------
# 4. CONVERSATION (multi-turn per lead)
# ---------------------------------------------------------------------------
class Conversation(Base):
    """
    Multi-turn chat history for each approved lead.
    role: "user" | "bot". Message content in message.
    """
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("approved_leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # "user" | "bot"
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lead: Mapped["ApprovedLead"] = relationship("ApprovedLead", back_populates="conversations")

    __table_args__ = (Index("ix_conversation_lead_created", "lead_id", "created_at"),)


# ---------------------------------------------------------------------------
# 5. USER WEIGHTS (ML personalization + A/B)
# ---------------------------------------------------------------------------
class UserWeights(Base):
    """
    ML scoring weights per user for personalization.
    version: for A/B testing or rollback.
    """
    __tablename__ = "user_weights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    weights: Mapped[dict] = mapped_column(JSON, nullable=False)  # e.g. {"product_compatibility": 0.22, ...}
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="user_weights")

    __table_args__ = (
        Index("ix_user_weights_user_version", "user_id", "version"),
    )


# ---------------------------------------------------------------------------
# 6. ANALYTICS / SESSION CACHE
# ---------------------------------------------------------------------------
class AnalyticsCache(Base):
    """
    Cache for user analytics to avoid repeated aggregation.
    cache_key identifies the report (e.g. "session_metrics", "channel_breakdown").
    cache_value: JSON blob. Optional TTL via expires_at.
    """
    __tablename__ = "analytics_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    cache_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    cache_value: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="analytics_caches")

    __table_args__ = (
        Index("ix_analytics_user_key", "user_id", "cache_key"),
    )
