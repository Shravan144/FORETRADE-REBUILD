from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.domain import MarketSnapshot
from app.models.user import User

router = APIRouter(prefix="/api/v1/markets", tags=["markets"])


def compute_market_score(item: MarketSnapshot) -> dict:
    missing_inputs = []
    if item.export_value_usd is None:
        missing_inputs.append("export_value_usd")
        val_score = 50.0
    else:
        val_score = min(max(item.export_value_usd / 15_000_000.0, 15.0), 100.0)

    if item.growth_pct is None:
        missing_inputs.append("growth_pct")
        growth_score = 50.0
    else:
        growth_score = min(max(50.0 + item.growth_pct * 2.5, 10.0), 100.0)

    diversification_score = 75.0
    preference_fit = 80.0

    score = round(
        0.40 * val_score + 0.30 * growth_score + 0.15 * diversification_score + 0.15 * preference_fit,
        1,
    )
    confidence = "low" if missing_inputs else "high"
    return {
        "score": score,
        "confidence": confidence,
        "missing_inputs": missing_inputs,
    }


def serialize(item: MarketSnapshot) -> dict:
    score_info = compute_market_score(item)
    return {
        "id": item.id,
        "country_code": item.country_code,
        "hs_code": item.hs_code,
        "export_value_usd": item.export_value_usd,
        "growth_pct": item.growth_pct,
        "source_name": item.source_name,
        "source_url": item.source_url,
        "source_period": item.source_period,
        "dataset_version": item.dataset_version,
        "refreshed_at": item.refreshed_at.isoformat() if item.refreshed_at else None,
        "score": score_info["score"],
        "confidence": score_info["confidence"],
        "missing_inputs": score_info["missing_inputs"],
    }


@router.get("")
def markets(hs_code: str | None = None, country_code: str | None = None, limit: int = 100, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    query = select(MarketSnapshot).order_by(MarketSnapshot.export_value_usd.desc().nullslast(), MarketSnapshot.country_code).limit(min(max(limit, 1), 250))
    if hs_code:
        query = query.where(MarketSnapshot.hs_code == hs_code.strip())
    if country_code:
        query = query.where(MarketSnapshot.country_code == country_code.upper())
    return {"items": [serialize(item) for item in db.scalars(query)]}


@router.get("/{country_code}")
def market(country_code: str, hs_code: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    query = select(MarketSnapshot).where(MarketSnapshot.country_code == country_code.upper()).order_by(MarketSnapshot.refreshed_at.desc())
    if hs_code:
        query = query.where(MarketSnapshot.hs_code == hs_code.strip())
    item = db.scalar(query)
    if not item:
        raise HTTPException(status_code=404, detail="market_snapshot_not_found")
    return serialize(item)
