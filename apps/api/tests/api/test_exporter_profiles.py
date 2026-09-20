from fastapi.testclient import TestClient
from app.main import app
def test_profile_update_creates_a_new_version():
 c=TestClient(app); wid="workspace-test"; first=c.post(f"/api/v1/workspaces/{wid}/exporter-profile",json={"capacity_tons":100}); second=c.put(f"/api/v1/workspaces/{wid}/exporter-profile",json={"capacity_tons":200}); assert second.json()["version"]==first.json()["version"]+1
