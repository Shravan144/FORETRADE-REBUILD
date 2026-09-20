from alembic import op
import sqlalchemy as sa
revision = "0001_platform"
down_revision = None
branch_labels = None
depends_on = None
def upgrade():
    op.create_table("audit_events", sa.Column("id", sa.String(), primary_key=True), sa.Column("action", sa.String(), nullable=False), sa.Column("entity_type", sa.String(), nullable=False), sa.Column("metadata_json", sa.JSON(), nullable=False))
def downgrade():
    op.drop_table("audit_events")
