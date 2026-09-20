from fastapi.testclient import TestClient
from app.main import app
def test_rejects_non_tabular_upload():
 r=TestClient(app).post('/api/v1/workspaces/a/imports',files={'file':('payload.exe',b'MZ','application/octet-stream')});assert r.status_code==422
