# CI/CD integration — threat-model gates

ThreatAtlas exposes a machine-readable **security posture** endpoint so your
pipeline can fail (or warn) when a product's threat model crosses risk
thresholds — turning the threat model into an enforced gate instead of a
document people forget to update.

This guide is copy-paste ready. It uses only the
`GET /api/products/{id}/security-status` endpoint, which is covered by the
backend test suite.

---

## The endpoint

```
GET /api/products/{product_id}/security-status
```

Query parameters (all optional — omit them to just read the posture):

| Parameter | Type | Meaning |
|-----------|------|---------|
| `fail_on_critical` | bool | Mark `pass=false` if any critical threats exist |
| `fail_on_unmitigated_high` | bool | Mark `pass=false` if any high/critical threat has no active mitigation |
| `min_mitigation_ratio` | float `0.0–1.0` | Mark `pass=false` if the mitigated ratio is below this |

Response (HTTP 200 either way — **check the `pass` field, not the status code**):

```json
{
  "product_id": 1,
  "product_name": "Payments API",
  "summary": {
    "total_threats": 24,
    "by_severity": { "critical": 0, "high": 3, "medium": 8, "low": 13, "unscored": 0 },
    "mitigated_threats": 19,
    "mitigation_ratio": 0.79
  },
  "pass": false,
  "failures": ["3 high/critical threat(s) have no active mitigation"]
}
```

## Authentication

Create a ThreatAtlas **API token** (Settings → API Tokens) and store it as a CI
secret named `THREATATLAS_TOKEN`. Set `THREATATLAS_URL` to your instance base
URL and `PRODUCT_ID` to the product you want to gate.

---

## GitHub Actions

Save as `.github/workflows/threat-model-gate.yml` in **your application repo**:

```yaml
name: Threat Model Gate

on:
  pull_request:
  workflow_dispatch:

jobs:
  threat-model:
    runs-on: ubuntu-latest
    steps:
      - name: Check ThreatAtlas security posture
        env:
          THREATATLAS_URL: ${{ vars.THREATATLAS_URL }}
          THREATATLAS_TOKEN: ${{ secrets.THREATATLAS_TOKEN }}
          PRODUCT_ID: ${{ vars.THREATATLAS_PRODUCT_ID }}
        run: |
          set -euo pipefail

          response=$(curl -sf \
            -H "Authorization: Bearer $THREATATLAS_TOKEN" \
            "$THREATATLAS_URL/api/products/$PRODUCT_ID/security-status?fail_on_critical=true&fail_on_unmitigated_high=true&min_mitigation_ratio=0.7")

          echo "$response" | jq .

          # Append a human-readable summary to the job page.
          {
            echo "## 🛡️ Threat Model — $(echo "$response" | jq -r .product_name)"
            echo ""
            echo "| Metric | Value |"
            echo "|--------|-------|"
            echo "| Total threats | $(echo "$response" | jq -r .summary.total_threats) |"
            echo "| Critical | $(echo "$response" | jq -r .summary.by_severity.critical) |"
            echo "| High | $(echo "$response" | jq -r .summary.by_severity.high) |"
            echo "| Mitigation ratio | $(echo "$response" | jq -r '.summary.mitigation_ratio * 100 | floor')% |"
          } >> "$GITHUB_STEP_SUMMARY"

          if [ "$(echo "$response" | jq -r .pass)" != "true" ]; then
            echo "::error::Threat model gate failed:"
            echo "$response" | jq -r '.failures[]' | while read -r f; do echo "::error::- $f"; done
            exit 1
          fi
          echo "✅ Threat model gate passed."
```

Configure the repo with:
- **Variable** `THREATATLAS_URL` (e.g. `https://threatatlas.internal`)
- **Variable** `THREATATLAS_PRODUCT_ID` (e.g. `1`)
- **Secret** `THREATATLAS_TOKEN`

## GitLab CI

Add to `.gitlab-ci.yml`:

```yaml
threat-model-gate:
  stage: test
  image: alpine:3
  variables:
    # THREATATLAS_URL, THREATATLAS_TOKEN, PRODUCT_ID set as CI/CD variables
    THRESHOLDS: "fail_on_critical=true&fail_on_unmitigated_high=true&min_mitigation_ratio=0.7"
  before_script:
    - apk add --no-cache curl jq
  script:
    - |
      response=$(curl -sf -H "Authorization: Bearer $THREATATLAS_TOKEN" \
        "$THREATATLAS_URL/api/products/$PRODUCT_ID/security-status?$THRESHOLDS")
      echo "$response" | jq .
      if [ "$(echo "$response" | jq -r .pass)" != "true" ]; then
        echo "Threat model gate failed:"; echo "$response" | jq -r '.failures[]'
        exit 1
      fi
```

## Attaching the full report

To publish the human-readable report as a build artifact, pull the Markdown or
DOCX export alongside the gate:

```bash
# Markdown — append to the GitHub job summary or store as an artifact
curl -sf -H "Authorization: Bearer $THREATATLAS_TOKEN" \
  "$THREATATLAS_URL/api/products/$PRODUCT_ID/download/report.md" > threat-model.md

# Word document — for audit deliverables
curl -sf -H "Authorization: Bearer $THREATATLAS_TOKEN" \
  "$THREATATLAS_URL/api/products/$PRODUCT_ID/download/report.docx" > threat-model.docx
```

---

## Notes

- The endpoint always returns HTTP 200 when reachable; gating logic keys off the
  JSON `pass` field so a non-failing posture and a network error are never
  confused. The `curl -sf` flag makes genuine HTTP errors (401/404/5xx) fail the
  step.
- Start in **report-only** mode (no threshold params, never exit non-zero) to
  baseline your products, then turn on thresholds once teams have triaged.
