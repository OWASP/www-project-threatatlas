"""Unit tests for the risk scoring engine (app/services/risk_service.py)."""

import pytest

from app.services import risk_service as rs
from app.routers.diagram_threats import calculate_risk_score_and_severity


# ── Inherent risk + severity bands ───────────────────────────────────────────

@pytest.mark.parametrize(
    "likelihood,impact,score,severity",
    [
        (5, 5, 25, "critical"),
        (4, 5, 20, "critical"),   # boundary: 20 -> critical
        (3, 5, 15, "high"),
        (4, 3, 12, "high"),       # boundary: 12 -> high
        (2, 3, 6, "medium"),      # boundary: 6 -> medium
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
    """The router's public function must stay behaviourally identical."""
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


# ── Residual fraction ─────────────────────────────────────────────────────────

def test_residual_fraction_no_mitigations():
    assert rs.residual_fraction([]) == 1.0
    assert rs.residual_fraction(None) == 1.0


def test_residual_fraction_inactive_statuses_have_no_effect():
    assert rs.residual_fraction(["proposed", "rejected"]) == 1.0


def test_residual_fraction_single_active():
    assert rs.residual_fraction(["implemented"]) == 0.6   # 1 - 0.4
    assert rs.residual_fraction(["verified"]) == pytest.approx(0.4)  # 1 - 0.6


def test_residual_fraction_compounds():
    # implemented (0.6 remaining) * verified (0.4 remaining) = 0.24
    assert rs.residual_fraction(["implemented", "verified"]) == pytest.approx(0.24)


# ── Residual risk ─────────────────────────────────────────────────────────────

def test_residual_risk_reduces_score_and_severity():
    # inherent 25 (critical); one verified mitigation -> 25 * 0.4 = 10 -> medium
    score, sev = rs.residual_risk(5, 5, ["verified"])
    assert score == 10
    assert sev == "medium"


def test_residual_risk_no_mitigation_equals_inherent():
    assert rs.residual_risk(4, 5, []) == (20, "critical")


def test_residual_risk_floored_at_one():
    # inherent 2, heavy mitigation would round below 1 -> floored to 1
    score, _ = rs.residual_risk(1, 2, ["verified", "verified"])
    assert score == 1


def test_residual_risk_missing_inputs():
    assert rs.residual_risk(None, 3, ["verified"]) == (None, None)


# ── assess() aggregate ────────────────────────────────────────────────────────

def test_assess_full_shape():
    result = rs.assess(5, 5, ["implemented", "proposed"])
    assert result["inherent_score"] == 25
    assert result["inherent_severity"] == "critical"
    assert result["residual_score"] == 15  # 25 * 0.6
    assert result["residual_severity"] == "high"
    assert result["active_mitigations"] == 1  # only "implemented" is active


def test_assess_unscored_threat():
    result = rs.assess(None, None, [])
    assert result["inherent_score"] is None
    assert result["residual_score"] is None
    assert result["active_mitigations"] == 0
