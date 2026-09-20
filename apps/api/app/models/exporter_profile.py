import uuid
from sqlalchemy import Integer,JSON,String
from sqlalchemy.orm import Mapped,mapped_column
from app.db.base import Base
class ExporterProfileVersion(Base):
 __tablename__="exporter_profile_versions"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid.uuid4())); workspace_id:Mapped[str]=mapped_column(String(36),index=True); version:Mapped[int]=mapped_column(Integer); payload:Mapped[dict]=mapped_column(JSON)
