from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_csrf, require_workspace_role
from app.db.session import get_db
from app.models.domain import Company, ScoreSnapshot
from app.models.exporter_profile import ExporterProfileVersion
from app.models.user import User
from app.services.scoring_service import ALGORITHM_VERSION, score_company

router = APIRouter(prefix="/api/v1/workspaces", tags=["companies", "scoring"])


def serialize(company: Company) -> dict:
    return {"id": company.id, "name": company.name, "country_code": company.country_code, "website": company.website, "product_or_industry": company.product_or_industry, "contact_name": company.contact_name, "contact_email": company.contact_email, "contact_phone": company.contact_phone, "attributes": company.attributes, "provenance": company.provenance, "created_at": company.created_at.isoformat() if company.created_at else None}


@router.get("/{workspace_id}/companies")
def list_companies(workspace_id: str, country_code: str | None = None, query: str | None = None, limit: int = 100, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db)
    statement = select(Company).where(Company.workspace_id == workspace_id).order_by(Company.name).limit(min(max(limit, 1), 250))
    if country_code:
        statement = statement.where(Company.country_code == country_code.upper())
    if query:
        statement = statement.where(Company.name.ilike(f"%{query.strip()}%"))
    return {"items": [serialize(company) for company in db.scalars(statement)]}


@router.get("/{workspace_id}/companies/{company_id}")
def get_company(workspace_id: str, company_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db)
    company = db.scalar(select(Company).where(Company.id == company_id, Company.workspace_id == workspace_id))
    if not company:
        raise HTTPException(status_code=404, detail="company_not_found")
    return serialize(company)


@router.post("/{workspace_id}/companies/{company_id}/scores", status_code=201)
def calculate_score(workspace_id: str, company_id: str, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    company = db.scalar(select(Company).where(Company.id == company_id, Company.workspace_id == workspace_id))
    if not company:
        raise HTTPException(status_code=404, detail="company_not_found")
    profile = db.scalar(select(ExporterProfileVersion).where(ExporterProfileVersion.workspace_id == workspace_id).order_by(ExporterProfileVersion.version.desc()))
    result = score_company(profile.payload if profile else {}, serialize(company))
    snapshot = ScoreSnapshot(workspace_id=workspace_id, company_id=company.id, profile_version=profile.version if profile else None, score=result.score, tier=result.tier, reason_codes=result.reasons, feature_values=result.features, algorithm_version=ALGORITHM_VERSION)
    db.add(snapshot); db.commit(); db.refresh(snapshot)
    return {"id": snapshot.id, "company_id": company.id, "score": snapshot.score, "tier": snapshot.tier, "reason_codes": snapshot.reason_codes, "feature_values": snapshot.feature_values, "algorithm_version": snapshot.algorithm_version}


@router.get("/{workspace_id}/companies/{company_id}/scores")
def get_company_scores(workspace_id: str, company_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "viewer")
    snapshots = db.scalars(
        select(ScoreSnapshot)
        .where(ScoreSnapshot.workspace_id == workspace_id, ScoreSnapshot.company_id == company_id)
        .order_by(ScoreSnapshot.created_at.desc())
    ).all()
    return {
        "items": [
            {
                "id": s.id,
                "company_id": s.company_id,
                "score": s.score,
                "tier": s.tier,
                "reason_codes": s.reason_codes,
                "feature_values": s.feature_values,
                "algorithm_version": s.algorithm_version,
                "profile_version": s.profile_version,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in snapshots
        ]
    }


@router.get("/{workspace_id}/companies/{company_id}/contacts")
def get_company_contacts_endpoint(
    workspace_id: str,
    company_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Retrieves or enriches verified procurement & sourcing decision-makers for a workspace company.
    """
    require_workspace_role(workspace_id, user, db, "viewer")
    from app.services.contact_enrichment import get_or_enrich_company_contacts

    contacts = get_or_enrich_company_contacts(db, workspace_id, company_id, force_refresh=False)
    return {"company_id": company_id, "total": len(contacts), "contacts": contacts}


@router.post("/{workspace_id}/companies/{company_id}/enrich-contacts")
def enrich_company_contacts_endpoint(
    workspace_id: str,
    company_id: str,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict:
    """
    Forces a live re-enrichment of verified procurement & sourcing decision-makers for a workspace company.
    """
    require_workspace_role(workspace_id, user, db, "editor")
    from app.services.contact_enrichment import get_or_enrich_company_contacts

    contacts = get_or_enrich_company_contacts(db, workspace_id, company_id, force_refresh=True)
    return {"company_id": company_id, "total": len(contacts), "contacts": contacts}


class BatchPromoteRequest(BaseModel):
    buyer_ids: list[str]


@router.post("/{workspace_id}/companies/batch-promote-buyers")
def batch_promote_buyers(
    workspace_id: str,
    payload: BatchPromoteRequest,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict:
    """
    Bulk Action Endpoint: Converts multiple selected Global Buyer Catalog entries
    into active workspace Companies and CRM Leads in a single atomic transaction.
    """
    require_workspace_role(workspace_id, user, db, "editor")
    from app.models.domain import Company, CompanySourceRecord, Lead, LeadEvent
    from app.models.trade_intelligence import GlobalBuyerCatalog
    from app.models.audit_event import record_audit_event

    promoted_companies = []
    promoted_leads = []

    for buyer_id in payload.buyer_ids:
        buyer = db.get(GlobalBuyerCatalog, buyer_id)
        if not buyer:
            continue

        # 1. Fetch or create Company
        company = db.scalar(
            select(Company).where(
                Company.workspace_id == workspace_id,
                Company.normalized_name == buyer.normalized_name,
                Company.country_code == buyer.country_code,
            )
        )
        if not company:
            company = Company(
                workspace_id=workspace_id,
                name=buyer.company_name,
                normalized_name=buyer.normalized_name,
                country_code=buyer.country_code,
                website=buyer.website,
                product_or_industry=buyer.primary_sector,
                contact_name=buyer.contact_name,
                contact_email=buyer.contact_email,
                provenance="customs_directory_batch",
                attributes={
                    "annual_import_volume_usd": buyer.annual_import_volume_usd,
                    "avg_order_tons": buyer.avg_order_tons,
                    "required_certifications": buyer.required_certifications,
                    "preferred_incoterms": buyer.preferred_incoterms,
                    "customs_provenance": buyer.customs_manifest_provenance,
                    "avg_container_teu": buyer.avg_container_teu,
                },
            )
            db.add(company)
            db.flush()

            db.add(
                CompanySourceRecord(
                    company_id=company.id,
                    source_type="global_buyer_catalog",
                    source_reference=buyer.customs_manifest_provenance,
                    raw_data={"buyer_catalog_id": buyer.id},
                )
            )

        # 2. Fetch or create Lead
        lead = db.scalar(
            select(Lead).where(
                Lead.workspace_id == workspace_id,
                Lead.company_id == company.id,
            )
        )
        if not lead:
            lead = Lead(
                workspace_id=workspace_id,
                company_id=company.id,
                stage="new",
            )
            db.add(lead)
            db.flush()

            db.add(
                LeadEvent(
                    lead_id=lead.id,
                    actor_user_id=user.id,
                    event_type="lead_created_from_batch_import",
                    payload={"from_stage": None, "to_stage": "new", "notes": "Batch promoted from Global Customs Directory."},
                )
            )

        record_audit_event(
            db,
            workspace_id=workspace_id,
            actor_user_id=user.id,
            action="recommendation.swiped_right",
            entity_type="buyer_catalog",
            entity_id=buyer.id,
            metadata={"company_name": buyer.company_name, "lead_id": lead.id, "source": "batch_promote"},
        )

        promoted_companies.append(company.id)
        promoted_leads.append(lead.id)

    db.commit()
    return {
        "status": "ok",
        "promoted_count": len(promoted_leads),
        "company_ids": promoted_companies,
        "lead_ids": promoted_leads,
    }


