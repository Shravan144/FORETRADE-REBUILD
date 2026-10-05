"""
FastAPI Router for Model 2: Matchmaking Engine & "Swipe to Export" Deck.
"""

from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_csrf, require_workspace_role
from app.db.session import get_db
from app.models.audit_event import AuditEvent, record_audit_event
from app.models.domain import Company, CompanySourceRecord, Lead, LeadEvent, ScoreSnapshot
from app.models.trade_intelligence import GlobalBuyerCatalog
from app.models.user import User
from app.services.ml.matchmaking_engine import rank_buyer_recommendations
from app.services.workspace_service import get_latest_profile_version

router = APIRouter(prefix="/api/v1/workspaces", tags=["matchmaking"])


class SwipeActionRequest(BaseModel):
    direction: Literal["right", "left"]


@router.get("/{workspace_id}/recommendations")
def get_recommendations(
    workspace_id: str,
    top_k: int = 20,
    exclude_swiped: bool = True,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Model 2: Two-Tower Hybrid Recommender
    Returns ranked buyer recommendation cards for the workspace's exporter profile.
    Automatically excludes already swiped or converted buyers if exclude_swiped is True.
    """
    require_workspace_role(workspace_id, user, db, "viewer")

    profile_record = get_latest_profile_version(db, workspace_id)
    profile_payload = profile_record.payload if profile_record else {
        "product_categories": ["textiles", "apparel"],
        "capacity_tons": 100,
        "target_countries": ["US", "DE", "GB", "AE"],
        "certifications": ["ISO 9001"],
    }

    excluded_ids: set[str] = set()
    if exclude_swiped:
        # 1. Audit events for swiped recommendations in this workspace (dismissed or saved)
        swiped_audit = db.scalars(
            select(AuditEvent.entity_id).where(
                AuditEvent.workspace_id == workspace_id,
                AuditEvent.entity_type == "buyer_catalog",
                AuditEvent.action.in_(["recommendation.dismissed", "recommendation.swiped_right"]),
            )
        ).all()
        for eid in swiped_audit:
            if eid:
                excluded_ids.add(eid)

        # 2. Existing companies in this workspace (normalize & match)
        existing_companies = db.execute(
            select(Company.normalized_name, Company.country_code).where(
                Company.workspace_id == workspace_id
            )
        ).all()
        existing_pairs = {(row[0], row[1]) for row in existing_companies if row[0] and row[1]}

        # Check source records for direct buyer_catalog_id
        source_records = db.scalars(
            select(CompanySourceRecord.raw_data).join(
                Company, Company.id == CompanySourceRecord.company_id
            ).where(Company.workspace_id == workspace_id)
        ).all()
        for sr in source_records:
            if isinstance(sr, dict) and "buyer_catalog_id" in sr:
                excluded_ids.add(sr["buyer_catalog_id"])

        if existing_pairs:
            matched_buyers = db.execute(
                select(GlobalBuyerCatalog.id, GlobalBuyerCatalog.normalized_name, GlobalBuyerCatalog.country_code)
            ).all()
            for b_id, norm_name, c_code in matched_buyers:
                if (norm_name, c_code) in existing_pairs:
                    excluded_ids.add(b_id)

    recs = rank_buyer_recommendations(db, profile_payload, top_k=top_k, exclude_buyer_ids=excluded_ids)
    return {
        "workspace_id": workspace_id,
        "total_recommendations": len(recs),
        "excluded_count": len(excluded_ids),
        "items": [r.to_dict() for r in recs],
    }


@router.post("/{workspace_id}/recommendations/{buyer_id}/swipe")
def swipe_buyer_recommendation(
    workspace_id: str,
    buyer_id: str,
    payload: SwipeActionRequest,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict:
    """
    Swipe to Export Action:
    - Swipe Left: Dismisses recommendation.
    - Swipe Right: Automatically converts Global Buyer into an active Workspace Company & CRM Lead.
    """
    require_workspace_role(workspace_id, user, db, "editor")

    buyer = db.get(GlobalBuyerCatalog, buyer_id)
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found in global catalog.")

    if payload.direction == "left":
        record_audit_event(
            db,
            workspace_id=workspace_id,
            actor_user_id=user.id,
            action="recommendation.dismissed",
            entity_type="buyer_catalog",
            entity_id=buyer_id,
            metadata={"company_name": buyer.company_name},
        )
        db.commit()
        return {"action": "dismissed", "buyer_id": buyer_id, "status": "ok"}

    # Swipe Right: Promote to active CRM Lead
    # 1. Create or fetch workspace company
    existing_company = db.scalar(
        select(Company).where(
            Company.workspace_id == workspace_id,
            Company.normalized_name == buyer.normalized_name,
            Company.country_code == buyer.country_code,
        )
    )

    if not existing_company:
        existing_company = Company(
            workspace_id=workspace_id,
            name=buyer.company_name,
            normalized_name=buyer.normalized_name,
            country_code=buyer.country_code,
            website=buyer.website,
            product_or_industry=buyer.primary_sector,
            contact_name=buyer.contact_name,
            contact_email=buyer.contact_email,
            provenance="swipe_to_export",
            attributes={
                "annual_import_volume_usd": buyer.annual_import_volume_usd,
                "avg_order_tons": buyer.avg_order_tons,
                "required_certifications": buyer.required_certifications,
                "preferred_incoterms": buyer.preferred_incoterms,
                "customs_provenance": buyer.customs_manifest_provenance,
            },
        )
        db.add(existing_company)
        db.flush()

        # Add Source Record
        db.add(
            CompanySourceRecord(
                company_id=existing_company.id,
                source_type="global_buyer_catalog",
                source_reference=buyer.customs_manifest_provenance,
                raw_data={"buyer_catalog_id": buyer.id},
            )
        )

    # 2. Re-compute compatibility score snapshot
    profile_record = get_latest_profile_version(db, workspace_id)
    profile_payload = profile_record.payload if profile_record else {}
    recs = rank_buyer_recommendations(db, profile_payload, top_k=50)
    matched_rec = next((r for r in recs if r.buyer_id == buyer_id), None)
    score_val = matched_rec.compatibility_score if matched_rec else 85.0
    tier_val = matched_rec.match_tier if matched_rec else "Strong Match"
    factors = matched_rec.factor_breakdown.__dict__ if matched_rec else {}

    db.add(
        ScoreSnapshot(
            workspace_id=workspace_id,
            company_id=existing_company.id,
            score=score_val,
            tier=tier_val,
            feature_values=factors,
            reason_codes=matched_rec.reasons if matched_rec else [],
            algorithm_version="two_tower_v2",
        )
    )

    # 3. Create active CRM Lead
    existing_lead = db.scalar(
        select(Lead).where(
            Lead.workspace_id == workspace_id,
            Lead.company_id == existing_company.id,
        )
    )

    if not existing_lead:
        existing_lead = Lead(
            workspace_id=workspace_id,
            company_id=existing_company.id,
            stage="new",
        )
        db.add(existing_lead)
        db.flush()

        db.add(
            LeadEvent(
                lead_id=existing_lead.id,
                actor_user_id=user.id,
                event_type="lead_created_from_swipe",
                payload={
                    "from_stage": None,
                    "to_stage": "new",
                    "notes": f"Converted from Swipe to Export match ({score_val:.1f}% compatibility).",
                },
            )
        )

    record_audit_event(
        db,
        workspace_id=workspace_id,
        actor_user_id=user.id,
        action="recommendation.swiped_right",
        entity_type="buyer_catalog",
        entity_id=buyer.id,
        metadata={"company_name": buyer.company_name, "score": score_val, "lead_id": existing_lead.id},
    )

    db.commit()
    return {
        "action": "saved_to_crm",
        "company_id": existing_company.id,
        "lead_id": existing_lead.id,
        "stage": existing_lead.stage,
        "compatibility_score": score_val,
    }


@router.post("/{workspace_id}/recommendations/reset-dismissed")
def reset_dismissed_recommendations(
    workspace_id: str,
    user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict:
    """
    Resets passed/dismissed recommendations for the workspace so they can be re-evaluated.
    Does not affect saved CRM leads.
    """
    require_workspace_role(workspace_id, user, db, "editor")
    stmt = delete(AuditEvent).where(
        AuditEvent.workspace_id == workspace_id,
        AuditEvent.action == "recommendation.dismissed",
        AuditEvent.entity_type == "buyer_catalog",
    )
    result = db.execute(stmt)
    db.commit()
    return {"status": "ok", "reset_count": result.rowcount}

