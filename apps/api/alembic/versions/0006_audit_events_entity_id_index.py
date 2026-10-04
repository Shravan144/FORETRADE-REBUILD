from alembic import op
import sqlalchemy as sa

revision = "0006_audit_events_entity_id_index"
down_revision = "0005_login_rate_limits"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_audit_events_entity_id", "audit_events", ["entity_id"])


def downgrade():
    op.drop_index("ix_audit_events_entity_id", table_name="audit_events")
