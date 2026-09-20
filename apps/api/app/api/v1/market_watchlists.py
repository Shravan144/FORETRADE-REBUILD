from fastapi import APIRouter
from pydantic import BaseModel
router=APIRouter(prefix="/api/v1/workspaces",tags=["market-watchlists"])
_store:dict[str,list[dict[str,str]]]={}
class WatchlistWrite(BaseModel): country_code:str; hs_code:str
@router.post('/{workspace_id}/market-watchlist',status_code=201)
def add(workspace_id:str,payload:WatchlistWrite):
 item=payload.model_dump(); bucket=_store.setdefault(workspace_id,[])
 if item not in bucket: bucket.append(item)
 return item
@router.get('/{workspace_id}/market-watchlist')
def list_items(workspace_id:str): return {"items":_store.get(workspace_id,[])}
