from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.base import Base
from app.db.session import get_db
from app.models.exporter_profile import ExporterProfileVersion
from app.services.workspace_service import create_profile_version
router=APIRouter(prefix="/api/v1/workspaces",tags=["exporter-profiles"])
class ExporterProfileWrite(BaseModel): capacity_tons:int=0; product_categories:list[str]=[]
@router.post('/{workspace_id}/exporter-profile')
def create(workspace_id:str,payload:ExporterProfileWrite,db:Session=Depends(get_db)):
 Base.metadata.create_all(db.bind); item=create_profile_version(db,workspace_id,payload.model_dump());return {"version":item.version,"workspace_id":item.workspace_id}
@router.put('/{workspace_id}/exporter-profile')
def update(workspace_id:str,payload:ExporterProfileWrite,db:Session=Depends(get_db)):
 Base.metadata.create_all(db.bind); item=create_profile_version(db,workspace_id,payload.model_dump());return {"version":item.version,"workspace_id":item.workspace_id}
