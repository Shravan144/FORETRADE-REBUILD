from enum import StrEnum
from fastapi import HTTPException
class WorkspaceRole(StrEnum): OWNER="owner"; EDITOR="editor"; VIEWER="viewer"
def require_workspace_member(workspace_id:str,minimum_role:WorkspaceRole=WorkspaceRole.VIEWER):
    raise HTTPException(status_code=404,detail="Workspace not found")
