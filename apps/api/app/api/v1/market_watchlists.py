from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_csrf, require_workspace_role
from app.db.session import get_db
from app.models.domain import MarketWatchlistItem
from app.models.user import User

router = APIRouter(prefix="/api/v1/workspaces", tags=["market-watchlists"])


class WatchlistWrite(BaseModel):
    country_code: str = Field(min_length=2, max_length=2)
    hs_code: str = Field(min_length=2, max_length=12)


def serialize(item: MarketWatchlistItem) -> dict:
    return {"id": item.id, "country_code": item.country_code, "hs_code": item.hs_code, "created_at": item.created_at.isoformat() if item.created_at else None}


@router.post("/{workspace_id}/market-watchlist", status_code=201)
def add(workspace_id: str, payload: WatchlistWrite, user: User = Depends(require_csrf), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db, "editor")
    item = MarketWatchlistItem(workspace_id=workspace_id, country_code=payload.country_code.upper(), hs_code=payload.hs_code.strip())
    db.add(item)
    try:
        db.commit(); db.refresh(item)
    except IntegrityError:
        db.rollback()
        item = db.scalar(select(MarketWatchlistItem).where(MarketWatchlistItem.workspace_id == workspace_id, MarketWatchlistItem.country_code == payload.country_code.upper(), MarketWatchlistItem.hs_code == payload.hs_code.strip()))
    return serialize(item)


@router.get("/{workspace_id}/market-watchlist")
def list_items(workspace_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_workspace_role(workspace_id, user, db)
    items = db.scalars(select(MarketWatchlistItem).where(MarketWatchlistItem.workspace_id == workspace_id).order_by(MarketWatchlistItem.created_at.desc()))
    return {"items": [serialize(item) for item in items]}
