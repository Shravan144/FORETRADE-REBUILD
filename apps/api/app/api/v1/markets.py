from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.domain import MarketSnapshot

router = APIRouter(prefix="/api/v1/markets", tags=["markets"])


def serialize(item: MarketSnapshot) -> dict:
    return {"id": item.id, "country_code": item.country_code, "hs_code": item.hs_code, "export_value_usd": item.export_value_usd, "growth_pct": item.growth_pct, "source_name": item.source_name, "source_url": item.source_url, "source_period": item.source_period, "dataset_version": item.dataset_version, "refreshed_at": item.refreshed_at.isoformat() if item.refreshed_at else None}


@router.get("")
def markets(hs_code: str | None = None, country_code: str | None = None, limit: int = 100, db: Session = Depends(get_db)) -> dict:
    query = select(MarketSnapshot).order_by(MarketSnapshot.export_value_usd.desc().nullslast(), MarketSnapshot.country_code).limit(min(max(limit, 1), 250))
    if hs_code:
        query = query.where(MarketSnapshot.hs_code == hs_code.strip())
    if country_code:
        query = query.where(MarketSnapshot.country_code == country_code.upper())
    return {"items": [serialize(item) for item in db.scalars(query)]}


@router.get("/{country_code}")
def market(country_code: str, hs_code: str | None = None, db: Session = Depends(get_db)) -> dict:
    query = select(MarketSnapshot).where(MarketSnapshot.country_code == country_code.upper()).order_by(MarketSnapshot.refreshed_at.desc())
    if hs_code:
        query = query.where(MarketSnapshot.hs_code == hs_code.strip())
    item = db.scalar(query)
    if not item:
        raise HTTPException(status_code=404, detail="market_snapshot_not_found")
    return serialize(item)
