"""Persist one-time OIDC authorization state and PKCE verifiers."""

from alembic import op
import sqlalchemy as sa

revision = "0004_oauth_authorizations"
down_revision = "0003_domain"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "oauth_authorizations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("state_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("code_verifier", sa.String(128), nullable=False),
        sa.Column("nonce", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_oauth_authorizations_state_hash", "oauth_authorizations", ["state_hash"])


def downgrade() -> None:
    op.drop_index("ix_oauth_authorizations_state_hash", table_name="oauth_authorizations")
    op.drop_table("oauth_authorizations")
