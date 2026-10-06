"""Persistent domain records used by the importer, intelligence, and CRM APIs."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _id() -> str:
    return str(uuid.uuid4())


class MarketSnapshot(Base):
    __tablename__ = "market_snapshots"
    __table_args__ = (UniqueConstraint("country_code", "hs_code", "source_name", "source_period", "dataset_version", name="uq_market_snapshot_version"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    country_code: Mapped[str] = mapped_column(String(2), index=True)
    hs_code: Mapped[str] = mapped_column(String(12), index=True)
    export_value_usd: Mapped[float | None] = mapped_column(Float)
    growth_pct: Mapped[float | None] = mapped_column(Float)
    source_name: Mapped[str] = mapped_column(String(255))
    source_url: Mapped[str | None] = mapped_column(String(1000))
    source_period: Mapped[str] = mapped_column(String(50))
    dataset_version: Mapped[str] = mapped_column(String(100))
    refreshed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MarketWatchlistItem(Base):
    __tablename__ = "market_watchlist_items"
    __table_args__ = (UniqueConstraint("workspace_id", "country_code", "hs_code", name="uq_market_watchlist_item"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    country_code: Mapped[str] = mapped_column(String(2))
    hs_code: Mapped[str] = mapped_column(String(12))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ImportJob(Base):
    __tablename__ = "import_jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    filename: Mapped[str] = mapped_column(String(512))
    content_type: Mapped[str | None] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(1000), unique=True)
    status: Mapped[str] = mapped_column(String(30), default="queued", index=True)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    valid_row_count: Mapped[int] = mapped_column(Integer, default=0)
    invalid_row_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ImportRow(Base):
    __tablename__ = "import_rows"
    __table_args__ = (UniqueConstraint("import_job_id", "row_number", name="uq_import_row_number"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    import_job_id: Mapped[str] = mapped_column(ForeignKey("import_jobs.id", ondelete="CASCADE"), index=True)
    row_number: Mapped[int] = mapped_column(Integer)
    raw_data: Mapped[dict] = mapped_column(JSON, default=dict)
    canonical_data: Mapped[dict] = mapped_column(JSON, default=dict)
    issues: Mapped[list] = mapped_column(JSON, default=list)
    accepted: Mapped[bool] = mapped_column(default=False)


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (UniqueConstraint("workspace_id", "normalized_name", "country_code", name="uq_workspace_company_identity"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(500))
    normalized_name: Mapped[str] = mapped_column(String(500), index=True)
    country_code: Mapped[str | None] = mapped_column(String(2), index=True)
    website: Mapped[str | None] = mapped_column(String(1000))
    product_or_industry: Mapped[str | None] = mapped_column(String(500))
    contact_name: Mapped[str | None] = mapped_column(String(300))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    contact_phone: Mapped[str | None] = mapped_column(String(100))
    attributes: Mapped[dict] = mapped_column(JSON, default=dict)
    provenance: Mapped[str] = mapped_column(String(30), default="user_import")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CompanySourceRecord(Base):
    __tablename__ = "company_source_records"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    import_job_id: Mapped[str | None] = mapped_column(ForeignKey("import_jobs.id", ondelete="SET NULL"), index=True)
    source_type: Mapped[str] = mapped_column(String(30))
    source_reference: Mapped[str | None] = mapped_column(String(1000))
    raw_data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ScoreSnapshot(Base):
    __tablename__ = "score_snapshots"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    profile_version: Mapped[int | None] = mapped_column(Integer)
    score: Mapped[float] = mapped_column(Float)
    tier: Mapped[str] = mapped_column(String(30))
    reason_codes: Mapped[list] = mapped_column(JSON, default=list)
    feature_values: Mapped[dict] = mapped_column(JSON, default=dict)
    algorithm_version: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (UniqueConstraint("workspace_id", "company_id", name="uq_workspace_company_lead"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    stage: Mapped[str] = mapped_column(String(30), default="new", index=True)
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LeadEvent(Base):
    __tablename__ = "lead_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    event_type: Mapped[str] = mapped_column(String(50), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OutreachDraft(Base):
    __tablename__ = "outreach_drafts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    channel: Mapped[str] = mapped_column(String(30))
    subject: Mapped[str | None] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExportJob(Base):
    __tablename__ = "export_jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    resource_type: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(30), default="queued")
    storage_key: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CommercialDocument(Base):
    __tablename__ = "commercial_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True, nullable=True)
    company_id: Mapped[str | None] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=True)
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    document_type: Mapped[str] = mapped_column(String(50), index=True)  # "proforma_invoice" | "packing_list"
    document_number: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    incoterm: Mapped[str] = mapped_column(String(10), default="CIF")
    issue_date: Mapped[str] = mapped_column(String(30), default="")
    validity_date: Mapped[str] = mapped_column(String(30), default="")
    port_of_loading: Mapped[str] = mapped_column(String(255), default="Nhava Sheva (JNPT), India")
    port_of_discharge: Mapped[str] = mapped_column(String(255), default="")
    payment_terms: Mapped[str] = mapped_column(String(500), default="30% Advance T/T, 70% against B/L copy")
    exporter_details: Mapped[dict] = mapped_column(JSON, default=dict)
    buyer_details: Mapped[dict] = mapped_column(JSON, default=dict)
    bank_details: Mapped[dict] = mapped_column(JSON, default=dict)
    line_items: Mapped[list] = mapped_column(JSON, default=list)
    logistics_details: Mapped[dict] = mapped_column(JSON, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

