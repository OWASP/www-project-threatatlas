"""Risk scoring engine.

Centralises how ThreatAtlas turns likelihood/impact into a risk score and
severity band, and adds *residual* risk: the risk that remains once active
mitigations are taken into account. The inherent-risk behaviour here is
identical to the original inline calculation in the diagram_threats router
(likelihood x impact with fixed severity bands) so existing data and tests
are unaffected; the residual model is additive.
"""

from __future__ import annotations

# Severity bands, evaluated high-to-low. Each entry is (minimum_score, label).
# These thresholds match the historical inline implementation exactly.
SEVERITY_BANDS: tuple[tuple[int, str], ...] = (
    (20, "critical"),
    (12, "high"),
    (6, "medium"),
    (0, "low"),
)

# How much an *active* mitigation reduces remaining risk, by mitigation status.
# Multiple active mitigations compound multiplicatively on the residual fraction.
MITIGATION_EFFECTIVENESS: dict[str, float] = {
    "verified": 0.6,
    "implemented": 0.4,
}
_ACTIVE_MITIGATION_STATUSES = frozenset(MITIGATION_EFFECTIVENESS)


def severity_for_score(score: int | None) -> str | None:
    """Map a numeric risk score onto a severity label."""
    if score is None:
        return None
    for minimum, label in SEVERITY_BANDS:
        if score >= minimum:
            return label
    return "low"


def calculate_risk(likelihood: int | None, impact: int | None) -> tuple[int | None, str | None]:
    """Inherent risk: (score, severity) from likelihood x impact.

    Returns (None, None) when either input is missing — matching the prior
    behaviour exactly.
    """
    if likelihood is None or impact is None:
        return None, None
    score = likelihood * impact
    return score, severity_for_score(score)


def residual_fraction(mitigation_statuses: list[str] | None) -> float:
    """Fraction of inherent risk remaining after the given mitigations.

    Only mitigations in an *active* status (implemented/verified) count.
    Effects compound: two implemented mitigations leave 0.6 * 0.6 = 0.36.
    """
    fraction = 1.0
    for status in mitigation_statuses or []:
        effectiveness = MITIGATION_EFFECTIVENESS.get(status, 0.0)
        fraction *= (1.0 - effectiveness)
    return round(fraction, 4)


def residual_risk(
    likelihood: int | None,
    impact: int | None,
    mitigation_statuses: list[str] | None,
) -> tuple[int | None, str | None]:
    """Residual (score, severity) after applying active mitigations.

    Residual score is floored at 1 whenever inherent risk exists and any risk
    remains, so a partially-mitigated threat never silently rounds to zero.
    """
    inherent, _ = calculate_risk(likelihood, impact)
    if inherent is None:
        return None, None
    fraction = residual_fraction(mitigation_statuses)
    raw = inherent * fraction
    if inherent > 0 and fraction > 0:
        score = max(round(raw), 1)
    else:
        score = round(raw)
    return score, severity_for_score(score)


def assess(
    likelihood: int | None,
    impact: int | None,
    mitigation_statuses: list[str] | None = None,
) -> dict:
    """Full assessment combining inherent and residual risk for a threat."""
    inherent_score, inherent_sev = calculate_risk(likelihood, impact)
    residual_score, residual_sev = residual_risk(likelihood, impact, mitigation_statuses)
    active = [s for s in (mitigation_statuses or []) if s in _ACTIVE_MITIGATION_STATUSES]
    return {
        "likelihood": likelihood,
        "impact": impact,
        "inherent_score": inherent_score,
        "inherent_severity": inherent_sev,
        "residual_score": residual_score,
        "residual_severity": residual_sev,
        "active_mitigations": len(active),
    }
