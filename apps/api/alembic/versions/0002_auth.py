from sqlalchemy import create_engine
from app.db.base import Base
from app.models.audit_event import AuditEvent
from app.models.user import User
engine=create_engine("postgresql+psycopg://foretrade:foretrade-local-only@localhost:5433/foretrade")
def upgrade(): Base.metadata.create_all(engine)
def downgrade(): Base.metadata.drop_all(engine)
