import uuid
from datetime import datetime
from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, Session
from app.db.base import Base
class AuditEvent(Base):
    __tablename__="audit_events"
    id: Mapped[str]=mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    action: Mapped[str]=mapped_column(String)
    entity_type: Mapped[str]=mapped_column(String)
    metadata_json: Mapped[dict]=mapped_column(JSON, default=dict)
    workspace_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    actor_user_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
def record_audit_event(session: Session, *, workspace_id=None, actor_user_id=None, action: str, entity_type: str, entity_id=None, metadata: dict[str, object]) -> None:
    session.add(AuditEvent(workspace_id=workspace_id, actor_user_id=actor_user_id, action=action, entity_type=entity_type, entity_id=entity_id, metadata_json=metadata))
