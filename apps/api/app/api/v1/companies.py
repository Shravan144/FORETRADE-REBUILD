from fastapi import APIRouter, Depends, HTTPException
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
