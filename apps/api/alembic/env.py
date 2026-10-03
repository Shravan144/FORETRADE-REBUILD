from alembic import context
from sqlalchemy import engine_from_config, pool
import os
from app.db.base import Base
from app.models.audit_event import AuditEvent
from app.models.domain import Company, CompanySourceRecord, ExportJob, ImportJob, ImportRow, Lead, LeadEvent, MarketSnapshot, MarketWatchlistItem, OutreachDraft, ScoreSnapshot
from app.models.exporter_profile import ExporterProfileVersion
from app.models.session import LoginRateLimit, OAuthAuthorization, SessionToken
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMembership
config = context.config
if database_url := os.getenv("DATABASE_URL"):
    config.set_main_option("sqlalchemy.url", database_url)
target_metadata = Base.metadata
def run_migrations_offline():
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction(): context.run_migrations()
def run_migrations_online():
    connectable=engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction(): context.run_migrations()
if context.is_offline_mode(): run_migrations_offline()
else: run_migrations_online()

