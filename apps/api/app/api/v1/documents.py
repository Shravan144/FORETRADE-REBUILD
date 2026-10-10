"""API endpoints for Export Documentation Suite (Proforma Invoices & Commercial Packing Lists)."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_csrf, require_workspace_role
from app.db.session import get_db
from app.models.domain import CommercialDocument, Lead, LeadEvent
from app.models.user import User
from app.services.document_service import (
    auto_populate_document_data,
    generate_document_pdf,
)

router = APIRouter(prefix="/api/v1/workspaces", tags=["commercial-documents"])


class GenerateDocumentRequest(BaseModel):
    document_type: str = Field(default="proforma_invoice", description="'proforma_invoice' or 'packing_list'")
    incoterm: str | None = Field(default=None, description="EXW, FOB, CFR, CIF, DDP")
    unit_price: float | None = Field(default=None, gt=0, description="Unit price in currency")
    quantity: float | None = Field(default=None, gt=0, description="Order quantity")
    unit: str | None = Field(default=None, description="Unit description (e.g. MT, Units, Yards)")
    product_description: str | None = Field(default=None, description="Cargo / merchandise description")
    container_type: str | None = Field(default=None, description="20ft or 40ft_hc")
    destination_port: str | None = Field(default=None, description="Port of Discharge")
    payment_terms: str | None = Field(default=None, description="Commercial payment terms")
    notes: str | None = Field(default=None, description="Special buyer or bank clauses")
    buyer_contact_name: str | None = Field(default=None, description="Attention / Decision-maker recipient name")
    buyer_contact_email: str | None = Field(default=None, description="Buyer contact email")
    buyer_contact_phone: str | None = Field(default=None, description="Buyer contact phone")
    buyer_contact_title: str | None = Field(default=None, description="Buyer contact job title")


class DocumentWritePayload(BaseModel):
    document_type: str
    document_number: str | None = None
    status: str = "draft"
    currency: str = "USD"
    incoterm: str = "CIF"
    issue_date: str | None = None
    validity_date: str | None = None
    port_of_loading: str = "Nhava Sheva (JNPT), India"
    port_of_discharge: str = ""
    payment_terms: str = "30% Advance T/T, 70% against B/L copy"
    exporter_details: dict = {}
    buyer_details: dict = {}
    bank_details: dict = {}
    line_items: list = []
    logistics_details: dict = {}
    notes: str | None = None


def serialize_document(doc: CommercialDocument) -> dict:
    return {
        "id": doc.id,
        "workspace_id": doc.workspace_id,
        "lead_id": doc.lead_id,
        "company_id": doc.company_id,
        "created_by_user_id": doc.created_by_user_id,
        "document_type": doc.document_type,
        "document_number": doc.document_number,
        "status": doc.status,
        "currency": doc.currency,
        "incoterm": doc.incoterm,
        "issue_date": doc.issue_date,
        "validity_date": doc.validity_date,
        "port_of_loading": doc.port_of_loading,
        "port_of_discharge": doc.port_of_discharge,
        "payment_terms": doc.payment_terms,
        "exporter_details": doc.exporter_details or {},
        "buyer_details": doc.buyer_details or {},
        "bank_details": doc.bank_details or {},
        "line_items": doc.line_items or [],
        "logistics_details": doc.logistics_details or {},
        "notes": doc.notes,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }


def get_document_or_404(db: Session, workspace_id: str, document_id: str) -> CommercialDocument:
    doc = db.scalar(
        select(CommercialDocument).where(
            CommercialDocument.id == document_id,
            CommercialDocument.workspace_id == workspace_id,
        )
    )
    if not doc:
        raise HTTPException(status_code=404, detail="commercial_document_not_found")
    return doc


@router.get("/{workspace_id}/documents")
def list_workspace_documents(
    workspace_id: str,
    document_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Lists all commercial documents across the entire workspace."""
    require_workspace_role(workspace_id, user, db, "viewer")
    query = select(CommercialDocument).where(CommercialDocument.workspace_id == workspace_id)
    if document_type:
        query = query.where(CommercialDocument.document_type == document_type)
    if status:
        query = query.where(CommercialDocument.status == status)
    docs = db.scalars(query.order_by(CommercialDocument.created_at.desc())).all()
    return {"items": [serialize_document(d) for d in docs]}


@router.get("/{workspace_id}/leads/{lead_id}/documents")
def list_lead_documents(
    workspace_id: str,
    lead_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Lists all commercial documents generated for this lead."""
    require_workspace_role(workspace_id, user, db, "viewer")
    docs = db.scalars(
        select(CommercialDocument)
        .where(
            CommercialDocument.workspace_id == workspace_id,
            CommercialDocument.lead_id == lead_id,
        )
        .order_by(CommercialDocument.created_at.desc())
    ).all()
    return {"items": [serialize_document(d) for d in docs]}


@router.post("/{workspace_id}/leads/{lead_id}/documents/generate", status_code=201)
def generate_document_from_lead(
    workspace_id: str,
    lead_id: str,
    payload: GenerateDocumentRequest,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict:
    """One-click smart auto-fill: creates a new Proforma Invoice or Packing List
    synthesizing Lead, Company attributes, Exporter Profile, and Logistics TEU calculations.
    """
    require_workspace_role(workspace_id, user, db, "editor")

    if payload.document_type not in ("proforma_invoice", "packing_list"):
        raise HTTPException(status_code=422, detail="invalid_document_type")

    try:
        populated_data = auto_populate_document_data(
            db=db,
            workspace_id=workspace_id,
            lead_id=lead_id,
            doc_type=payload.document_type,
            custom_incoterm=payload.incoterm,
            custom_unit_price=payload.unit_price,
            custom_quantity=payload.quantity,
            custom_unit=payload.unit,
            custom_product_desc=payload.product_description,
            custom_container_type=payload.container_type,
            custom_dest_port=payload.destination_port,
            custom_payment_terms=payload.payment_terms,
            custom_notes=payload.notes,
            custom_buyer_contact_name=payload.buyer_contact_name,
            custom_buyer_contact_email=payload.buyer_contact_email,
            custom_buyer_contact_phone=payload.buyer_contact_phone,
            custom_buyer_contact_title=payload.buyer_contact_title,
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    doc = CommercialDocument(
        workspace_id=workspace_id,
        lead_id=lead_id,
        company_id=populated_data["company_id"],
        created_by_user_id=user.id,
        document_type=payload.document_type,
        document_number=populated_data["document_number"],
        status="draft",
        currency=populated_data["currency"],
        incoterm=populated_data["incoterm"],
        issue_date=populated_data["issue_date"],
        validity_date=populated_data["validity_date"],
        port_of_loading=populated_data["port_of_loading"],
        port_of_discharge=populated_data["port_of_discharge"],
        payment_terms=populated_data["payment_terms"],
        exporter_details=populated_data["exporter_details"],
        buyer_details=populated_data["buyer_details"],
        bank_details=populated_data["bank_details"],
        line_items=populated_data["line_items"],
        logistics_details=populated_data["logistics_details"],
        notes=populated_data["notes"],
    )
    db.add(doc)

    # Record activity in lead timeline
    event = LeadEvent(
        lead_id=lead_id,
        actor_user_id=user.id,
        event_type="document_generated",
        payload={
            "document_id": doc.id,
            "document_type": doc.document_type,
            "document_number": doc.document_number,
            "incoterm": doc.incoterm,
            "currency": doc.currency,
        },
    )
    db.add(event)

    db.commit()
    db.refresh(doc)
    return serialize_document(doc)


@router.get("/{workspace_id}/documents/{document_id}")
def get_document(
    workspace_id: str,
    document_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Retrieves document detail."""
    require_workspace_role(workspace_id, user, db, "viewer")
    doc = get_document_or_404(db, workspace_id, document_id)
    return serialize_document(doc)


@router.put("/{workspace_id}/documents/{document_id}")
def update_document(
    workspace_id: str,
    document_id: str,
    payload: DocumentWritePayload,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict:
    """Updates document fields, line items, and terms."""
    require_workspace_role(workspace_id, user, db, "editor")
    doc = get_document_or_404(db, workspace_id, document_id)

    doc.document_type = payload.document_type
    if payload.document_number:
        doc.document_number = payload.document_number
    doc.status = payload.status
    doc.currency = payload.currency
    doc.incoterm = payload.incoterm
    if payload.issue_date:
        doc.issue_date = payload.issue_date
    if payload.validity_date:
        doc.validity_date = payload.validity_date
    doc.port_of_loading = payload.port_of_loading
    doc.port_of_discharge = payload.port_of_discharge
    doc.payment_terms = payload.payment_terms
    doc.exporter_details = payload.exporter_details
    doc.buyer_details = payload.buyer_details
    doc.bank_details = payload.bank_details
    doc.line_items = payload.line_items
    doc.logistics_details = payload.logistics_details
    doc.notes = payload.notes

    db.commit()
    db.refresh(doc)
    return serialize_document(doc)


@router.delete("/{workspace_id}/documents/{document_id}")
def delete_document(
    workspace_id: str,
    document_id: str,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict:
    """Deletes document."""
    require_workspace_role(workspace_id, user, db, "editor")
    doc = get_document_or_404(db, workspace_id, document_id)
    db.delete(doc)
    db.commit()
    return {"deleted": True, "id": document_id}


@router.get("/{workspace_id}/documents/{document_id}/pdf")
def download_document_pdf(
    workspace_id: str,
    document_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Renders and streams high-fidelity downloadable vector PDF for the document."""
    require_workspace_role(workspace_id, user, db, "viewer")
    doc = get_document_or_404(db, workspace_id, document_id)

    pdf_bytes = generate_document_pdf(doc)
    filename = f"{doc.document_number}_{doc.document_type}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )
