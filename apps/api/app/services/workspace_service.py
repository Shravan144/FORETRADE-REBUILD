from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.exporter_profile import ExporterProfileVersion


def create_profile_version(session: Session, workspace_id: str, payload: dict, actor_id: str | None = None) -> ExporterProfileVersion:
    previous = session.scalar(
        select(ExporterProfileVersion)
        .where(ExporterProfileVersion.workspace_id == workspace_id)
        .order_by(ExporterProfileVersion.version.desc())
    )
    item = ExporterProfileVersion(
        workspace_id=workspace_id,
        version=(previous.version if previous else 0) + 1,
        payload=payload,
        created_by_user_id=actor_id,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def get_latest_profile_version(session: Session, workspace_id: str) -> ExporterProfileVersion | None:
    return session.scalar(
        select(ExporterProfileVersion)
        .where(ExporterProfileVersion.workspace_id == workspace_id)
        .order_by(ExporterProfileVersion.version.desc())
    )


def list_profile_versions(session: Session, workspace_id: str) -> list[ExporterProfileVersion]:
    return list(
        session.scalars(
            select(ExporterProfileVersion)
            .where(ExporterProfileVersion.workspace_id == workspace_id)
            .order_by(ExporterProfileVersion.version.desc())
        )
    )


def seed_starter_companies_for_workspace(session: Session, new_workspace_id: str) -> None:
    from app.models.domain import Company, ScoreSnapshot

    existing_companies = list(session.scalars(select(Company).limit(30)))
    if not existing_companies:
        return

    for old_comp in existing_companies:
        new_comp = Company(
            workspace_id=new_workspace_id,
            name=old_comp.name,
            normalized_name=old_comp.normalized_name,
            country_code=old_comp.country_code,
            website=old_comp.website,
            product_or_industry=old_comp.product_or_industry,
            contact_name=old_comp.contact_name,
            contact_email=old_comp.contact_email,
            contact_phone=old_comp.contact_phone,
            provenance=old_comp.provenance,
            attributes=dict(old_comp.attributes or {}),
        )
        session.add(new_comp)
        session.flush()

        old_score = session.scalar(
            select(ScoreSnapshot)
            .where(ScoreSnapshot.company_id == old_comp.id)
            .order_by(ScoreSnapshot.created_at.desc())
        )
        if old_score:
            new_score = ScoreSnapshot(
                workspace_id=new_workspace_id,
                company_id=new_comp.id,
                algorithm_version=old_score.algorithm_version,
                score=old_score.score,
                tier=old_score.tier,
                reason_codes=list(old_score.reason_codes or []),
                feature_values=dict(old_score.feature_values or {}),
                profile_version=old_score.profile_version,
            )
            session.add(new_score)

    session.commit()


