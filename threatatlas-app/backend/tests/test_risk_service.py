"""Unit tests for inherent and manually reassessed residual risk scoring."""

import pytest

from app.services import risk_service as rs
from app.routers.diagram_threats import calculate_risk_score_and_severity


@pytest.mark.parametrize(
    "likelihood,impact,score,severity",
    [
        (5, 5, 25, "critical"),
        (4, 5, 20, "critical"),
        (3, 5, 15, "high"),
        (4, 3, 12, "high"),
        (2, 3, 6, "medium"),
        (1, 5, 5, "low"),
        (1, 1, 1, "low"),
    ],
)
def test_calculate_risk_bands(likelihood, impact, score, severity):
    assert rs.calculate_risk(likelihood, impact) == (score, severity)


def test_calculate_risk_missing_inputs():
    assert rs.calculate_risk(None, 3) == (None, None)
    assert rs.calculate_risk(3, None) == (None, None)
    assert rs.calculate_risk(None, None) == (None, None)


def test_router_wrapper_matches_service():
    for likelihood in range(1, 6):
        for impact in range(1, 6):
            assert calculate_risk_score_and_severity(likelihood, impact) == rs.calculate_risk(likelihood, impact)
    assert calculate_risk_score_and_severity(None, 2) == (None, None)


def test_severity_for_score_standalone():
    assert rs.severity_for_score(25) == "critical"
    assert rs.severity_for_score(12) == "high"
    assert rs.severity_for_score(6) == "medium"
    assert rs.severity_for_score(0) == "low"
    assert rs.severity_for_score(None) is None


def test_assess_keeps_inherent_and_residual_independent():
    result = rs.assess(5, 5, 2, 4)
    assert result["inherent_score"] == 25
    assert result["inherent_severity"] == "critical"
    assert result["residual_likelihood"] == 2
    assert result["residual_impact"] == 4
    assert result["residual_score"] == 8
    assert result["residual_severity"] == "medium"


def test_assess_does_not_infer_residual_from_mitigations():
    result = rs.assess(5, 5)
    assert result["inherent_score"] == 25
    assert result["residual_score"] is None
    assert result["residual_severity"] is None
