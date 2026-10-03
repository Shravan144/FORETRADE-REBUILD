from alembic import op
import sqlalchemy as sa
revision = "0001_platform"
down_revision = None
branch_labels = None
depends_on = None
def upgrade():
    op.create_table("audit_events", sa.Column("id", sa.String(36), primary_key=True), sa.Column("workspace_id", sa.String(36)), sa.Column("actor_user_id", sa.String(36)), sa.Column("action", sa.String(), nullable=False), sa.Column("entity_type", sa.String(), nullable=False), sa.Column("entity_id", sa.String(36)), sa.Column("metadata_json", sa.JSON(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_audit_events_workspace_id", "audit_events", ["workspace_id"])
    op.create_index("ix_audit_events_actor_user_id", "audit_events", ["actor_user_id"])
def downgrade():
    op.drop_index("ix_audit_events_actor_user_id", table_name="audit_events")
    op.drop_index("ix_audit_events_workspace_id", table_name="audit_events")
    op.drop_table("audit_events")
