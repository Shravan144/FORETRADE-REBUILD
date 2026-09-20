from fastapi.testclient import TestClient
from app.main import app

def test_watchlist_is_private_to_workspace():
    client=TestClient(app)
    client.post('/api/v1/workspaces/a/market-watchlist',json={'country_code':'AE','hs_code':'6109'})
    assert client.get('/api/v1/workspaces/b/market-watchlist').json()['items']==[]
