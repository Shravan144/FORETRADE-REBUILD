import uuid
from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column, Session
from app.db.base import Base
class AuditEvent(Base):
    __tablename__="audit_events"
    id: Mapped[str]=mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    action: Mapped[str]=mapped_column(String)
    entity_type: Mapped[str]=mapped_column(String)
    metadata_json: Mapped[dict]=mapped_column(JSON, default=dict)
def record_audit_event(session: Session, *, workspace_id=None, actor_user_id=None, action: str, entity_type: str, entity_id=None, metadata: dict[str, object]) -> None:
    session.add(AuditEvent(action=action, entity_type=entity_type, metadata_json=metadata))
