from fastapi.testclient import TestClient
from app.main import app
def test_funnel_counts_only_stored_stage_transitions():assert TestClient(app).get('/api/v1/workspaces/a/analytics').json()['pipeline']['replied']==0
