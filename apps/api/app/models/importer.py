"""
Importer & Global Procurement Domain Models
Supports two-sided cross-border trade operations:
1. ImporterProfile: Real-world statutory credentials, discharge ports, and compliance criteria.
2. SourcingRfq: Active procurement tenders published by overseas importers.
3. InboundProposal: Bidirectional link connecting Exporter pitches and Proforma Invoices to Importers.
"""

from datetime import datetime
import uuid
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _id() -> str:
    return str(uuid.uuid4())


class ImporterProfile(Base):
    """
    Statutory procurement and customs profile of an international importer/buyer.
    Captures country-specific tax identifiers, discharge ports, and target commodities.
    """
    __tablename__ = "importer_profiles"
    __table_args__ = (
        UniqueConstraint("workspace_id", name="uq_workspace_importer_profile"),
        Index("ix_importer_country_sector", "country_code", "primary_sector"),
        Index("ix_importer_port", "primary_discharge_port"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)

    # 1. Statutory & Corporate Identity
    company_name: Mapped[str] = mapped_column(String(300))
    trade_name_dba: Mapped[str | None] = mapped_column(String(300), nullable=True)
    country_code: Mapped[str] = mapped_column(String(2), index=True)  # US, DE, AE, GB, AU, FR, etc.
    city: Mapped[str] = mapped_column(String(100))
    headquarters_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    corporate_website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duns_number: Mapped[str | None] = mapped_column(String(9), nullable=True)  # Dun & Bradstreet 9-digit
    tax_identifier_type: Mapped[str] = mapped_column(String(50), default="EIN")  # EIN, EORI, VAT, TRN, ABN
    tax_identifier_value: Mapped[str] = mapped_column(String(100))  # e.g. 12-3456789 or GB123456789000

    # 2. Decision-Maker Contact
    contact_name: Mapped[str] = mapped_column(String(200))
    contact_title: Mapped[str] = mapped_column(String(150), default="Global Sourcing Director")
    contact_email: Mapped[str] = mapped_column(String(320))
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # 3. Maritime Logistics & Discharge Infrastructure
    primary_discharge_port: Mapped[str] = mapped_column(String(10))  # UN/LOCODE: USLAX, DEHAM, AEDXB, etc.
    secondary_discharge_port: Mapped[str | None] = mapped_column(String(10), nullable=True)
    customs_broker_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    preferred_container_type: Mapped[str] = mapped_column(String(50), default="40ft_hc")  # 20ft, 40ft_hc, reefer, lcl
    warehouse_dock_type: Mapped[str | None] = mapped_column(String(50), default="palletized_forklift")

    # 4. Sourcing Demand & Commodity Matrix
    primary_sector: Mapped[str] = mapped_column(String(100), index=True)
    target_hs_codes: Mapped[list] = mapped_column(JSON, default=list)  # ["6109.10", "6203.42"]
    annual_sourcing_budget_usd: Mapped[float] = mapped_column(Float, default=5000000.0)
    order_cycle_days: Mapped[int] = mapped_column(Float, default=30)
    min_order_quantity_mt: Mapped[float] = mapped_column(Float, default=20.0)
    consignee_name_on_bol: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # 5. Regulatory Compliance & Accreditations Required
    required_certifications: Mapped[list] = mapped_column(JSON, default=list)  # ISO 9001, OEKO-TEX, FDA, CE

    # 6. Commercial & Settlement Terms
    preferred_incoterm: Mapped[str] = mapped_column(String(10), default="CIF")  # CIF, FOB, DDP, CFR
    payment_terms: Mapped[str] = mapped_column(String(100), default="letter_of_credit")  # lc, tt_advance, cad, open_account
    issuing_bank_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issuing_bank_swift: Mapped[str | None] = mapped_column(String(11), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    # Catalog linkage (links this live importer into GlobalBuyerCatalog if published)
    catalog_buyer_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    is_publicly_discoverable: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SourcingRfq(Base):
    """
    Active Sourcing RFQ / Procurement Tender published by an Importer.
    Automatically surfaces in Demand Radar and Two-Tower Matchmaking queues.
    """
    __tablename__ = "sourcing_rfqs"
    __table_args__ = (
        Index("ix_rfq_country_hs", "destination_country", "hs_code"),
        Index("ix_rfq_status_date", "status", "deadline_date"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    importer_profile_id: Mapped[str] = mapped_column(ForeignKey("importer_profiles.id", ondelete="CASCADE"), index=True)
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)

    title: Mapped[str] = mapped_column(String(300))
    commodity_description: Mapped[str] = mapped_column(Text)
    product_category: Mapped[str] = mapped_column(String(100), index=True)
    hs_code: Mapped[str] = mapped_column(String(10), index=True)

    target_quantity: Mapped[float] = mapped_column(Float)
    quantity_unit: Mapped[str] = mapped_column(String(50), default="Metric Tons (MT)")
    target_budget_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_unit_price_usd: Mapped[float | None] = mapped_column(Float, nullable=True)

    destination_country: Mapped[str] = mapped_column(String(2), index=True)
    destination_port: Mapped[str] = mapped_column(String(10))  # UN/LOCODE e.g. USLAX
    preferred_incoterm: Mapped[str] = mapped_column(String(10), default="CIF")
    preferred_container_type: Mapped[str] = mapped_column(String(50), default="40ft_hc")

    required_certifications: Mapped[list] = mapped_column(JSON, default=list)
    inspection_agency_allowed: Mapped[str | None] = mapped_column(String(100), default="SGS / Bureau Veritas")
    special_technical_clauses: Mapped[str | None] = mapped_column(Text, nullable=True)

    deadline_date: Mapped[str | None] = mapped_column(String(50))  # YYYY-MM-DD
    target_delivery_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", index=True)  # ACTIVE, CLOSING_SOON, CLOSED, AWARDED

    # Linkage to Demand Radar MarketDemandSignal
    demand_signal_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class InboundProposal(Base):
    """
    Bidirectional commercial proposal sent by an Exporter to an Importer.
    Contains the Exporter's pitch, readiness credentials, price quote, and optional Proforma Invoice.
    Ready for future multi-turn messaging / in-app negotiation threads.
    """
    __tablename__ = "inbound_proposals"
    __table_args__ = (
        Index("ix_proposal_importer_status", "importer_workspace_id", "status"),
        Index("ix_proposal_exporter", "exporter_workspace_id", "lead_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    importer_workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    exporter_workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    
    rfq_id: Mapped[str | None] = mapped_column(ForeignKey("sourcing_rfqs.id", ondelete="SET NULL"), nullable=True, index=True)
    lead_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    outreach_draft_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    commercial_document_id: Mapped[str | None] = mapped_column(String(36), nullable=True)  # PI reference

    # Exporter snapshot
    exporter_company_name: Mapped[str] = mapped_column(String(300))
    exporter_country_code: Mapped[str] = mapped_column(String(2), default="IN")
    exporter_origin_port: Mapped[str] = mapped_column(String(100), default="Nhava Sheva (JNPT) / Mundra")
    exporter_readiness_score: Mapped[float] = mapped_column(Float, default=85.0)

    # Proposal content
    proposal_channel: Mapped[str] = mapped_column(String(50), default="email")
    subject: Mapped[str] = mapped_column(String(500))
    proposal_body: Mapped[Text] = mapped_column(Text)
    offered_unit_price_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    offered_incoterm: Mapped[str | None] = mapped_column(String(10), default="CIF")
    estimated_transit_days: Mapped[int | None] = mapped_column(Float, nullable=True)
    duty_savings_usd: Mapped[float | None] = mapped_column(Float, default=0.0)

    # Importer workflow state
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)  # pending, reviewed, sample_requested, accepted, declined
    importer_feedback_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Thread identifier for future in-app messaging / real-time negotiation
    negotiation_thread_id: Mapped[str] = mapped_column(String(36), default=_id, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NegotiationMessage(Base):
    """
    Bilateral communication & negotiation message between Exporter and Importer.
    Supports commercial counter-offers, sample requests, and document attachments.
    """
    __tablename__ = "negotiation_messages"
    __table_args__ = (
        Index("ix_negotiation_msg_thread", "thread_id", "created_at"),
        Index("ix_negotiation_msg_proposal", "proposal_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    proposal_id: Mapped[str] = mapped_column(ForeignKey("inbound_proposals.id", ondelete="CASCADE"), index=True)
    thread_id: Mapped[str] = mapped_column(String(36), index=True)
    sender_workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    sender_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    sender_role: Mapped[str] = mapped_column(String(20))  # "exporter" | "importer"
    sender_name: Mapped[str] = mapped_column(String(200))
    sender_company_name: Mapped[str] = mapped_column(String(300))

    message_text: Mapped[str] = mapped_column(Text)
    message_type: Mapped[str] = mapped_column(String(50), default="text")  # text, counter_offer, sample_request, commercial_document
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

