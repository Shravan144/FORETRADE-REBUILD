from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_csrf, require_workspace_role
from app.core.config import settings
from app.db.session import get_db
from app.models.audit_event import record_audit_event
from app.models.domain import ImportJob, ImportRow
from app.models.user import User
from app.services.import_service import commit_import, parse_import, save_upload

router = APIRouter(prefix="/api/v1", tags=["imports"])


class ImportCommit(BaseModel):
    mapping: dict[str, str]


def serialize_job(job: ImportJob) -> dict:
    return {"id": job.id, "workspace_id": job.workspace_id, "filename": job.filename, "status": job.status, "row_count": job.row_count, "valid_row_count": job.valid_row_count, "invalid_row_count": job.invalid_row_count, "error_message": job.error_message}


@router.post("/workspaces/{workspace_id}/imports", status_code=202)
async def upload(workspace_id: str, file: UploadFile = File(...), user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    name = file.filename or "upload"
    if not name.lower().endswith((".csv", ".xlsx")):
        raise HTTPException(status_code=422, detail="only_csv_and_xlsx_supported")
    content = await file.read(settings.max_upload_bytes + 1)
    if not content:
        raise HTTPException(status_code=422, detail="empty_upload")
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="upload_too_large")
    job = ImportJob(workspace_id=workspace_id, created_by_user_id=user.id, filename=name, content_type=file.content_type, storage_key="pending", status="queued")
    db.add(job); db.flush()
    job.storage_key = save_upload(job.id, name, content, settings.upload_dir)
    db.commit(); db.refresh(job)
    parse_import(db, job, content)
    record_audit_event(db, workspace_id=workspace_id, actor_user_id=user.id, action="import.uploaded", entity_type="import_job", entity_id=job.id, metadata={"filename": name, "bytes": len(content)})
    db.commit(); db.refresh(job)
    return serialize_job(job)


@router.get("/jobs/{job_id}")
def job(job_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    item = db.get(ImportJob, job_id)
    if not item:
        raise HTTPException(status_code=404, detail="job_not_found")
    require_workspace_role(item.workspace_id, user, db)
    return serialize_job(item)


@router.get("/jobs/{job_id}/preview")
def preview(job_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    item = db.get(ImportJob, job_id)
    if not item:
        raise HTTPException(status_code=404, detail="job_not_found")
    require_workspace_role(item.workspace_id, user, db)
    rows = db.query(ImportRow).filter_by(import_job_id=job_id).order_by(ImportRow.row_number).limit(50).all()
    return {"job": serialize_job(item), "columns": list(rows[0].raw_data.keys()) if rows else [], "rows": [{"row_number": row.row_number, "data": row.raw_data, "issues": row.issues} for row in rows]}


@router.post("/jobs/{job_id}/commit")
def commit(job_id: str, payload: ImportCommit, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    item = db.get(ImportJob, job_id)
    if not item:
        raise HTTPException(status_code=404, detail="job_not_found")
    require_workspace_role(item.workspace_id, user, db, "editor")
    if item.status != "parsed":
        raise HTTPException(status_code=409, detail="import_not_ready_for_commit")
    try:
        summary = commit_import(db, item, payload.mapping)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    record_audit_event(db, workspace_id=item.workspace_id, actor_user_id=user.id, action="import.committed", entity_type="import_job", entity_id=item.id, metadata=summary)
    db.commit(); db.refresh(item)
    return {"job": serialize_job(item), "summary": summary}
