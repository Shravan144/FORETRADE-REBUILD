from sqlalchemy.orm import Session
from app.api.dependencies import require_workspace_role
from app.models.user import User
from app.models.workspace import WorkspaceMembership, WorkspaceRole


def require_workspace_member(db: Session, user: User, workspace_id: str, minimum_role: WorkspaceRole = WorkspaceRole.VIEWER) -> WorkspaceMembership:
    return require_workspace_role(workspace_id, user, db, minimum_role.value)
