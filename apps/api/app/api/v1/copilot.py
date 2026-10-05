"""
API Router for Cross-Border AI Trade Copilot.
Enables real-time advisory queries on tariffs, FTAs, logistics, payments, and compliance.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_workspace_role
from app.db.session import get_db
from app.models.user import User
from app.services.ml.copilot_service import answer_trade_query

router = APIRouter(prefix="/api/v1/workspaces", tags=["copilot"])


class CopilotChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    conversation_history: list[dict] = Field(default_factory=list)


@router.post("/{workspace_id}/copilot/chat")
def chat_copilot(
    workspace_id: str,
    payload: CopilotChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_workspace_role(workspace_id, user, db, "viewer")
    return answer_trade_query(
        db=db,
        workspace_id=workspace_id,
        user_message=payload.message,
        conversation_history=payload.conversation_history,
    )
