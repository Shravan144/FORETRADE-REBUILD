"""Create users, workspaces, and session records."""

from alembic import op
import sqlalchemy as sa

revision = "0002_auth"
down_revision = "0001_platform"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("users", sa.Column("id", sa.String(36), primary_key=True), sa.Column("email", sa.String(320), nullable=False), sa.Column("password_hash", sa.String(512)), sa.Column("google_subject", sa.String(255)), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("email"), sa.UniqueConstraint("google_subject"))
    op.create_index("ix_users_email", "users", ["email"]); op.create_index("ix_users_google_subject", "users", ["google_subject"])
    op.create_table("workspaces", sa.Column("id", sa.String(36), primary_key=True), sa.Column("name", sa.String(200), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("workspace_memberships", sa.Column("id", sa.String(36), primary_key=True), sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("role", sa.String(20), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"))
    op.create_index("ix_workspace_memberships_workspace_id", "workspace_memberships", ["workspace_id"]); op.create_index("ix_workspace_memberships_user_id", "workspace_memberships", ["user_id"])
    op.create_table("session_tokens", sa.Column("id", sa.String(36), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("token_hash", sa.String(64), nullable=False, unique=True), sa.Column("csrf_token", sa.String(128), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("revoked_at", sa.DateTime(timezone=True)), sa.Column("last_seen_at", sa.DateTime(timezone=True)))
    op.create_index("ix_session_tokens_user_id", "session_tokens", ["user_id"])
    op.create_table("exporter_profile_versions", sa.Column("id", sa.String(36), primary_key=True), sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False), sa.Column("version", sa.Integer(), nullable=False), sa.Column("payload", sa.JSON(), nullable=False), sa.Column("created_by_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("workspace_id", "version", name="uq_profile_workspace_version"))
    op.create_index("ix_exporter_profile_versions_workspace_id", "exporter_profile_versions", ["workspace_id"])


def downgrade() -> None:
    op.drop_table("exporter_profile_versions"); op.drop_table("session_tokens"); op.drop_table("workspace_memberships"); op.drop_table("workspaces"); op.drop_table("users")
