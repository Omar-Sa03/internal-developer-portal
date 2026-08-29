from fastapi.testclient import TestClient

from src.main import app


client = TestClient(app)


def test_root():
    response = client.get("/")

    assert response.status_code == 200

    data = response.json()

    assert data["service"] == "${{ values.service_name }}"
    assert data["environment"] == "${{ values.environment }}"
    assert data["status"] == "healthy"


def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_metrics():
    response = client.get("/metrics")

    assert response.status_code == 200
    assert "http_requests_total" in response.text
    assert "http_request_duration_seconds" in response.text