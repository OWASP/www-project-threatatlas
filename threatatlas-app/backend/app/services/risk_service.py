"""Risk scoring helpers for inherent and manually reassessed residual risk."""

from __future__ import annotations

# Severity bands, evaluated high-to-low.
SEVERITY_BANDS: tuple[tuple[int, str], ...] = (
    (20, "critical"),
    (12, "high"),
    (6, "medium"),
    (0, "low"),
)


def severity_for_score(score: int | None) -> str | None:
    """Map a numeric risk score onto a severity label."""
    if score is None:
        return None
    for minimum, label in SEVERITY_BANDS:
        if score >= minimum:
            return label
    return "low"


def calculate_risk(likelihood: int | None, impact: int | None) -> tuple[int | None, str | None]:
    """Calculate risk as likelihood × impact, or return unset for incomplete scores."""
    if likelihood is None or impact is None:
        return None, None
    score = likelihood * impact
    return score, severity_for_score(score)


def assess(
    likelihood: int | None,
    impact: int | None,
    residual_likelihood: int | None = None,
    residual_impact: int | None = None,
) -> dict:
    """Return independent inherent and residual assessments without inferred reductions."""
    inherent_score, inherent_severity = calculate_risk(likelihood, impact)
    residual_score, residual_severity = calculate_risk(residual_likelihood, residual_impact)
    return {
        "likelihood": likelihood,
        "impact": impact,
        "inherent_score": inherent_score,
        "inherent_severity": inherent_severity,
        "residual_likelihood": residual_likelihood,
        "residual_impact": residual_impact,
        "residual_score": residual_score,
        "residual_severity": residual_severity,
    }
