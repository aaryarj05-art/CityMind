from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.config.risk_weights import INCIDENT_PRIORITY_WEIGHTS, RISK_WEIGHTS
from app.main import app
from app.services.incident_priority import calculate_incident_priority, classify_priority
from app.services.risk_engine import (build_explanation, calculate_resource_shortage,
    calculate_risk_score, classify_risk, combine_incident_scores, normalize_complaints,
    normalize_hospital_load, normalize_incident_severity, normalize_rainfall,
    normalize_traffic, rank_top_factors)


def test_weight_totals():
    assert sum(RISK_WEIGHTS.values()) == pytest.approx(1)
    assert sum(INCIDENT_PRIORITY_WEIGHTS.values()) == pytest.approx(1)


@pytest.mark.parametrize('value,expected', [(-1, 0), (0, 0), (50, 50), (100, 100), (150, 100)])
def test_rainfall_normalization_and_clamping(value, expected):
    assert normalize_rainfall(value) == expected


def test_normalization_rules():
    assert [normalize_traffic(x) for x in ('Low', 'Moderate', 'Heavy', 'Gridlock')] == [20, 45, 75, 100]
    assert normalize_traffic(120) == 100
    assert normalize_complaints(25) == normalize_complaints(30) == 100
    assert normalize_incident_severity('Medium') == 45
    assert normalize_hospital_load(100, 25) == 75
    assert normalize_hospital_load(0, 0) == 50
    assert combine_incident_scores([75, 75]) == 93.75
    assert combine_incident_scores([100, 100]) == 100


def test_resource_shortage():
    resources = [SimpleNamespace(resource_type=t, status=s) for t, s in [
        ('Ambulance', 'Available'), ('Police Vehicle', 'Dispatched'),
        ('Fire Engine', 'Available'), ('Municipal Unit', 'Available')]]
    assert calculate_resource_shortage(resources) == 25
    assert calculate_resource_shortage([]) == 100


@pytest.mark.parametrize('score,expected', [(0,'Low'),(30,'Low'),(30.01,'Moderate'),(60,'Moderate'),(60.01,'High'),(80,'High'),(80.01,'Critical'),(100,'Critical')])
def test_risk_boundaries(score, expected):
    assert classify_risk(score) == expected


@pytest.mark.parametrize('score,expected', [(0,'Routine'),(30,'Routine'),(30.01,'Elevated'),(60,'Elevated'),(60.01,'Urgent'),(80,'Urgent'),(80.01,'Immediate'),(100,'Immediate')])
def test_priority_boundaries(score, expected):
    assert classify_priority(score) == expected


def test_score_clamping_top_factors_and_explanation():
    score, _ = calculate_risk_score({factor: 200 for factor in RISK_WEIGHTS})
    assert score == 100
    scores = {'traffic':100,'rainfall':80,'incidents':70,'complaints':10,'hospital_load':10,'resource_shortage':10}
    _, contributions = calculate_risk_score(scores)
    top = rank_top_factors(scores, contributions)
    assert [x['factor'] for x in top] == ['traffic', 'rainfall', 'incidents']
    expected = 'Kuvempunagar is classified as High because traffic congestion, rainfall, and active incident severity are the largest contributors to the current risk score.'
    assert build_explanation('Kuvempunagar', 'High', top) == expected


def test_incident_priority_calculation():
    now = datetime(2026, 7, 2, 12, tzinfo=timezone.utc)
    incident = SimpleNamespace(id=7,title='Test fire',area_id=1,severity='Critical',status='Reported',reported_at=now-timedelta(minutes=30))
    result = calculate_incident_priority(incident, {'risk_score':80}, [SimpleNamespace(status='Available')], 'Kuvempunagar', now)
    assert result['priority_score'] == 93
    assert result['priority_level'] == 'Immediate'
    assert len(result['reasons']) == 3


def test_area_risk_api_filters_sorting_and_not_found():
    with TestClient(app) as client:
        data = client.get('/api/risk/areas').json()
        assert len(data) >= 10
        assert [x['risk_score'] for x in data] == sorted([x['risk_score'] for x in data], reverse=True)
        first = data[0]
        assert {'factor_scores','factor_weights','weighted_contributions','top_contributing_factors','explanation','last_calculated'} <= first.keys()
        assert client.get(f"/api/risk/areas/{first['area_id']}").status_code == 200
        assert client.get('/api/risk/areas/999999').status_code == 404
        assert client.get('/api/risk/areas?min_score=101').status_code == 422
        assert client.get('/api/risk/areas?sort_order=asc').json()[0]['risk_score'] <= first['risk_score']
        assert all(x['risk_level'] == first['risk_level'] for x in client.get('/api/risk/areas', params={'risk_level':first['risk_level']}).json())
        assert client.get('/api/risk/areas', params={'search':first['area_name'][:4]}).json()


def test_incident_risk_api_filters_and_not_found():
    with TestClient(app) as client:
        data = client.get('/api/risk/incidents').json()
        assert len(data) >= 15
        assert [x['priority_score'] for x in data] == sorted([x['priority_score'] for x in data], reverse=True)
        first = data[0]
        assert client.get(f"/api/risk/incidents/{first['incident_id']}").status_code == 200
        assert client.get('/api/risk/incidents/999999').status_code == 404
        assert all(x['area_id'] == first['area_id'] for x in client.get('/api/risk/incidents', params={'area_id':first['area_id']}).json())
        assert all(x['status'] == first['status'] for x in client.get('/api/risk/incidents', params={'status':first['status']}).json())
        assert all(x['priority_level'] == first['priority_level'] for x in client.get('/api/risk/incidents', params={'priority_level':first['priority_level']}).json())


def test_risk_summary_api():
    with TestClient(app) as client:
        response = client.get('/api/risk/summary')
        assert response.status_code == 200
        assert {'critical_area_count','high_risk_area_count','average_city_risk_score','highest_risk_area','top_contributing_factor_city_wide','immediate_priority_incident_count','last_calculated'} <= response.json().keys()