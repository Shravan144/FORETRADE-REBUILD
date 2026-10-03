import csv
import os
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_csrf, require_workspace_role
from app.core.config import settings
from app.db.session import get_db
from app.models.domain import Company, ExportJob, ImportJob, Lead, ScoreSnapshot
from app.models.user import User

router = APIRouter(prefix="/api/v1/workspaces", tags=["analytics", "exports"])
exports_router = APIRouter(prefix="/api/v1/exports", tags=["exports"])


@router.get("/{workspace_id}/analytics")
def analytics(workspace_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db)
    pipeline = {stage: count for stage, count in db.execute(select(Lead.stage, func.count()).where(Lead.workspace_id == workspace_id).group_by(Lead.stage))}
    scores = {tier: count for tier, count in db.execute(select(ScoreSnapshot.tier, func.count()).where(ScoreSnapshot.workspace_id == workspace_id).group_by(ScoreSnapshot.tier))}
    imported = db.scalar(select(func.count()).select_from(ImportJob).where(ImportJob.workspace_id == workspace_id)) or 0
    rows = db.scalar(select(func.coalesce(func.sum(ImportJob.row_count), 0)).where(ImportJob.workspace_id == workspace_id)) or 0
    rejected = db.scalar(select(func.coalesce(func.sum(ImportJob.invalid_row_count), 0)).where(ImportJob.workspace_id == workspace_id)) or 0
    return {"companies": db.scalar(select(func.count()).select_from(Company).where(Company.workspace_id == workspace_id)) or 0, "pipeline": pipeline, "import_quality": {"jobs": imported, "rows": rows, "invalid_rows": rejected}, "score_distribution": scores}


@router.post("/{workspace_id}/exports/companies", status_code=202)
def export_companies(workspace_id: str, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db)
    companies = list(db.scalars(select(Company).where(Company.workspace_id == workspace_id).order_by(Company.name)))
    output = StringIO(); writer = csv.writer(output)
    writer.writerow(["company_name", "country_code", "website", "product_or_industry", "contact_name", "contact_email", "contact_phone", "provenance"])
    for company in companies:
        writer.writerow([company.name, company.country_code or "", company.website or "", company.product_or_industry or "", company.contact_name or "", company.contact_email or "", company.contact_phone or "", company.provenance])
    job = ExportJob(workspace_id=workspace_id, created_by_user_id=user.id, resource_type="companies", status="completed")
    db.add(job); db.flush()
    exports_dir = os.path.join(settings.upload_dir, "exports"); os.makedirs(exports_dir, exist_ok=True)
    job.storage_key = os.path.join(exports_dir, f"{job.id}.csv")
    with open(job.storage_key, "w", encoding="utf-8", newline="") as file:
        file.write(output.getvalue())
    db.commit()
    return {"job_id": job.id, "status": job.status, "download_url": f"/api/v1/exports/{job.id}/download"}


@exports_router.get("/{job_id}/download")
def export_download(job_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from fastapi.responses import FileResponse
    job = db.get(ExportJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="export_not_found")
    require_workspace_role(job.workspace_id, user, db)
    if job.status != "completed" or not job.storage_key or not os.path.isfile(job.storage_key):
        raise HTTPException(status_code=409, detail="export_not_ready")
    return FileResponse(job.storage_key, media_type="text/csv", filename="foretrade-companies.csv")
