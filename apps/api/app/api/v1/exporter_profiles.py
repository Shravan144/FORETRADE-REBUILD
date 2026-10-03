from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api.dependencies import require_csrf, require_workspace_role
from app.db.session import get_db
from app.models.exporter_profile import ExporterProfileVersion
from app.services.workspace_service import create_profile_version
from app.models.user import User
router=APIRouter(prefix="/api/v1/workspaces",tags=["exporter-profiles"])
class ExporterProfileWrite(BaseModel): capacity_tons:int=0; product_categories:list[str]=[]
@router.post('/{workspace_id}/exporter-profile')
def create(workspace_id:str,payload:ExporterProfileWrite,user:User=Depends(require_csrf),db:Session=Depends(get_db)):
 require_workspace_role(workspace_id,user,db,"editor"); item=create_profile_version(db,workspace_id,payload.model_dump(),user.id);return {"version":item.version,"workspace_id":item.workspace_id}
@router.put('/{workspace_id}/exporter-profile')
def update(workspace_id:str,payload:ExporterProfileWrite,user:User=Depends(require_csrf),db:Session=Depends(get_db)):
 require_workspace_role(workspace_id,user,db,"editor"); item=create_profile_version(db,workspace_id,payload.model_dump(),user.id);return {"version":item.version,"workspace_id":item.workspace_id}
