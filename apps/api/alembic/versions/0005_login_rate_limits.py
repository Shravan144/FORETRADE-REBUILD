"""Add shared database-backed login rate limits."""

from alembic import op
import sqlalchemy as sa

revision = "0005_login_rate_limits"
down_revision = "0004_oauth_authorizations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "login_rate_limits",
        sa.Column("key_hash", sa.String(64), primary_key=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("login_rate_limits")
