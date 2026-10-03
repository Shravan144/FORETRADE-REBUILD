from app.models.exporter_profile import ExporterProfileVersion
from sqlalchemy.orm import Session
def create_profile_version(session:Session,workspace_id:str,payload:dict,actor_id:str|None=None)->ExporterProfileVersion:
 previous=session.query(ExporterProfileVersion).filter_by(workspace_id=workspace_id).order_by(ExporterProfileVersion.version.desc()).first(); item=ExporterProfileVersion(workspace_id=workspace_id,version=(previous.version if previous else 0)+1,payload=payload,created_by_user_id=actor_id);session.add(item);session.commit();session.refresh(item);return item
