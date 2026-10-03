"""File storage, parsing, validation, and commit logic for private company imports."""

import csv
import io
import os
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.domain import Company, CompanySourceRecord, ImportJob, ImportRow
from app.services.deduplication import normalized_name
from app.services.import_validation import Issue, validate_row

ALLOWED_FIELDS = {"company_name", "country_code", "website", "product_or_industry", "contact_name", "contact_email", "contact_phone"}


def save_upload(job_id: str, filename: str, content: bytes, upload_dir: str) -> str:
    os.makedirs(upload_dir, exist_ok=True)
    safe_name = os.path.basename(filename).replace(" ", "_")
    path = os.path.join(upload_dir, f"{job_id}-{safe_name}")
    with open(path, "wb") as stream:
        stream.write(content)
    return path


def parse_import(session: Session, job: ImportJob, content: bytes) -> None:
    name = job.filename.lower()
    try:
        if name.endswith(".csv"):
            decoded = content.decode("utf-8-sig")
            rows = list(csv.DictReader(io.StringIO(decoded)))
        elif name.endswith(".xlsx"):
            try:
                import pandas as pd
            except ImportError as error:
                raise ValueError("xlsx_support_not_installed") from error
            frame = pd.read_excel(io.BytesIO(content), dtype=str).fillna("")
            rows = [{str(key): str(value) for key, value in row.items()} for row in frame.to_dict(orient="records")]
        else:
            raise ValueError("unsupported_file_type")
        if not rows:
            raise ValueError("file_has_no_data_rows")
        for number, row in enumerate(rows, start=2):
            session.add(ImportRow(import_job_id=job.id, row_number=number, raw_data=row, canonical_data={}, issues=[], accepted=False))
        job.row_count = len(rows)
        job.status = "parsed"
        job.completed_at = datetime.now(timezone.utc)
    except (UnicodeDecodeError, csv.Error, ValueError) as error:
        job.status = "failed"
        job.error_message = str(error)
        job.completed_at = datetime.now(timezone.utc)
    session.commit()


def normalize_mapping(mapping: dict[str, str], sample_columns: set[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for source, target in mapping.items():
        if source not in sample_columns or target not in ALLOWED_FIELDS or target in result.values():
            raise ValueError("invalid_column_mapping")
        result[source] = target
    if "company_name" not in result.values():
        raise ValueError("company_name_mapping_required")
    return result


def commit_import(session: Session, job: ImportJob, mapping: dict[str, str]) -> dict[str, int]:
    rows = list(session.scalars(select(ImportRow).where(ImportRow.import_job_id == job.id).order_by(ImportRow.row_number)))
    if not rows:
        raise ValueError("import_has_no_rows")
    normalized_mapping = normalize_mapping(mapping, set(rows[0].raw_data))
    created = updated = invalid = 0
    for row in rows:
        result = validate_row(row.row_number, row.raw_data, normalized_mapping)
        canonical = result.canonical
        country = str(canonical.get("country_code") or "").strip().upper() or None
        if country and len(country) != 2:
            result.issues.append(Issue("invalid_country_code"))
        row.canonical_data = canonical
        row.issues = [issue.code for issue in result.issues]
        row.accepted = not result.issues
        if result.issues:
            invalid += 1
            continue
        normalized = normalized_name(str(canonical["company_name"]))
        company = session.scalar(select(Company).where(Company.workspace_id == job.workspace_id, Company.normalized_name == normalized, Company.country_code == country))
        fields = {
            "name": str(canonical["company_name"]).strip(), "country_code": country,
            "website": canonical.get("website") or None, "product_or_industry": canonical.get("product_or_industry") or None,
            "contact_name": canonical.get("contact_name") or None, "contact_email": canonical.get("contact_email") or None,
            "contact_phone": canonical.get("contact_phone") or None,
        }
        if company:
            for key, value in fields.items():
                if value:
                    setattr(company, key, value)
            updated += 1
        else:
            company = Company(workspace_id=job.workspace_id, normalized_name=normalized, attributes={}, provenance="user_import", **fields)
            session.add(company); session.flush(); created += 1
        session.add(CompanySourceRecord(company_id=company.id, import_job_id=job.id, source_type="user_import", source_reference=job.filename, raw_data=row.raw_data))
    job.status = "committed"
    job.valid_row_count = created + updated
    job.invalid_row_count = invalid
    job.completed_at = datetime.now(timezone.utc)
    session.commit()
    return {"created": created, "updated": updated, "invalid": invalid}
