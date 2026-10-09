import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_analytics_endpoint():
    res = client.get("/api/analytics")
    assert res.status_code == 200
    data = res.json()
    assert "total_sessions" in data
    assert "avg_seconds_to_tier" in data
    assert "tier_distribution" in data
    assert "override_stats" in data
    assert "override_rate_pct" in data["override_stats"]
    assert "accept_rate_pct" in data["override_stats"]
    assert "languages" in data
    assert "asr_metrics" in data
