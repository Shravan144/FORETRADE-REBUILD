from enum import StrEnum
import uuid
from sqlalchemy import String
from sqlalchemy.orm import Mapped,mapped_column
from app.db.base import Base
class WorkspaceRole(StrEnum): OWNER="owner"; EDITOR="editor"; VIEWER="viewer"
class Workspace(Base):
 __tablename__="workspaces"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid.uuid4())); name:Mapped[str]=mapped_column(String(200))
