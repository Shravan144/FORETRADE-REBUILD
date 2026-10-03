import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer,JSON,String, UniqueConstraint, func
from sqlalchemy.orm import Mapped,mapped_column
from app.db.base import Base
class ExporterProfileVersion(Base):
    __tablename__ = "exporter_profile_versions"
    __table_args__ = (UniqueConstraint("workspace_id", "version", name="uq_profile_workspace_version"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
