"""
API Integration tests for Copilot Chat endpoint.
"""

from tests.api.test_workspace_flows import authenticated_client


def test_copilot_chat_endpoint_flow() -> None:
    client, user_id, headers = authenticated_client("copilot_tester@foretrade.io")

    # 1. Create Workspace
    ws_res = client.post("/api/v1/workspaces", json={"name": "Pashmina Export Hub"}, headers=headers)
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # 2. Call Copilot Chat Endpoint
    chat_res = client.post(
        f"/api/v1/workspaces/{ws_id}/copilot/chat",
        json={
            "message": "What are the duty savings under the India-UAE CEPA?",
            "conversation_history": [],
        },
        headers=headers,
    )
    assert chat_res.status_code == 200
    data = chat_res.json()
    assert "response" in data
    assert len(data["response"]) > 20
    assert "model_used" in data
    assert "suggested_questions" in data
    assert isinstance(data["suggested_questions"], list)

    # 3. Follow-up query with conversation history
    followup_res = client.post(
        f"/api/v1/workspaces/{ws_id}/copilot/chat",
        json={
            "message": "What about payment security via Letter of Credit?",
            "conversation_history": [
                {"role": "user", "content": "What are the duty savings under the India-UAE CEPA?"},
                {"role": "assistant", "content": data["response"][:100]},
            ],
        },
        headers=headers,
    )
    assert followup_res.status_code == 200
    followup_data = followup_res.json()
    assert "response" in followup_data
    assert len(followup_data["response"]) > 20
