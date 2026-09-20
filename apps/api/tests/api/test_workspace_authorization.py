from fastapi.testclient import TestClient
from app.main import app
def test_user_cannot_read_another_workspace():
 response=TestClient(app).get("/api/v1/workspaces/another-workspace")
 assert response.status_code in {403,404}
