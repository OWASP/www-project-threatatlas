"""Download endpoints for a product: diagrams JSON, threats/mitigations CSV,
standalone HTML report, and a ZIP bundle containing all of the above.

The HTML report is intentionally print-friendly so users can open it in a
browser and Save-as-PDF without needing server-side PDF tooling.
"""

from __future__ import annotations

import csv
import html
import io
import json
import zipfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    Diagram,
    DiagramMitigation,
    DiagramThreat,
    Product as ProductModel,
    User as UserModel,
)
from app.auth.dependencies import get_current_user
from app.auth.permissions import PermissionDenied, can_access_product

router = APIRouter(prefix="/products", tags=["products"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _load_product(product_id: int, user: UserModel, db: Session) -> ProductModel:
    product = (
        db.query(ProductModel)
        .options(
            joinedload(ProductModel.diagrams).joinedload(Diagram.diagram_threats).joinedload(DiagramThreat.threat),
            joinedload(ProductModel.diagrams).joinedload(Diagram.diagram_mitigations).joinedload(DiagramMitigation.mitigation),
            joinedload(ProductModel.collaborators),
        )
        .filter(ProductModel.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if not can_access_product(user, product):
        raise PermissionDenied("Not authorized to access this product")
    return product


def _safe_filename(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in name).strip("_") or "product"


def _diagrams_payload(product: ProductModel) -> dict:
    return {
        "product": {
            "id": product.id,
            "name": product.name,
            "description": product.description,
            "status": product.status,
            "business_area": product.business_area,
            "owner_name": product.owner_name,
            "owner_email": product.owner_email,
            "repository_url": product.repository_url,
            "application_url": product.application_url,
            "confluence_url": product.confluence_url,
        },
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "diagrams": [
            {
                "id": d.id,
                "name": d.name,
                "description": d.description,
                "current_version": d.current_version,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "data": d.diagram_data or {},
            }
            for d in product.diagrams
        ],
    }


def _threats_mitigations_rows(product: ProductModel) -> tuple[list[dict], list[dict]]:
    threats: list[dict] = []
    mitigations: list[dict] = []
    for d in product.diagrams:
        for dt in d.diagram_threats:
            threats.append({
                "diagram": d.name,
                "element_id": dt.element_id,
                "element_type": dt.element_type,
                "threat_name": dt.threat.name if dt.threat else "",
                "category": dt.threat.category if dt.threat else "",
                "description": dt.threat.description if dt.threat else "",
                "status": dt.status,
                "severity": dt.severity,
                "likelihood": dt.likelihood,
                "impact": dt.impact,
                "risk_score": dt.risk_score,
                "comments": dt.comments or "",
            })
        for dm in d.diagram_mitigations:
            mitigations.append({
                "diagram": d.name,
                "element_id": dm.element_id,
                "element_type": dm.element_type,
                "mitigation_name": dm.mitigation.name if dm.mitigation else "",
                "category": dm.mitigation.category if dm.mitigation else "",
                "description": dm.mitigation.description if dm.mitigation else "",
                "status": dm.status,
                "linked_threat_id": dm.threat_id,
                "comments": dm.comments or "",
            })
    return threats, mitigations


def _threats_csv(threats: list[dict], mitigations: list[dict]) -> str:
    buf = io.StringIO()
    buf.write("# Threats\n")
    if threats:
        w = csv.DictWriter(buf, fieldnames=list(threats[0].keys()))
        w.writeheader()
        w.writerows(threats)
    else:
        buf.write("(no threats)\n")
    buf.write("\n# Mitigations\n")
    if mitigations:
        w = csv.DictWriter(buf, fieldnames=list(mitigations[0].keys()))
        w.writeheader()
        w.writerows(mitigations)
    else:
        buf.write("(no mitigations)\n")
    return buf.getvalue()


def _html_report(product: ProductModel, threats: list[dict], mitigations: list[dict]) -> str:
    def esc(v):
        return html.escape(str(v)) if v not in (None, "") else "—"

    metadata_rows = [
        ("Status", product.status),
        ("Business area", product.business_area),
        ("Owner", f"{product.owner_name or ''} {('<' + product.owner_email + '>') if product.owner_email else ''}".strip()),
        ("Repository", product.repository_url),
        ("Application URL", product.application_url),
        ("Confluence", product.confluence_url),
    ]
    meta_html = "".join(
        f"<tr><th>{esc(k)}</th><td>{esc(v)}</td></tr>" for k, v in metadata_rows if v
    )

    def threat_row(t):
        return (
            f"<tr>"
            f"<td>{esc(t['diagram'])}</td>"
            f"<td>{esc(t['element_id'])}</td>"
            f"<td>{esc(t['threat_name'])}</td>"
            f"<td>{esc(t['category'])}</td>"
            f"<td>{esc(t['status'])}</td>"
            f"<td>{esc(t['severity'])}</td>"
            f"<td>{esc(t['risk_score'])}</td>"
            f"<td>{esc(t['description'])}</td>"
            f"</tr>"
        )

    def mit_row(m):
        return (
            f"<tr>"
            f"<td>{esc(m['diagram'])}</td>"
            f"<td>{esc(m['element_id'])}</td>"
            f"<td>{esc(m['mitigation_name'])}</td>"
            f"<td>{esc(m['category'])}</td>"
            f"<td>{esc(m['status'])}</td>"
            f"<td>{esc(m['description'])}</td>"
            f"</tr>"
        )

    threats_html = "".join(threat_row(t) for t in threats) or '<tr><td colspan="8">No threats recorded.</td></tr>'
    mitigations_html = "".join(mit_row(m) for m in mitigations) or '<tr><td colspan="6">No mitigations recorded.</td></tr>'

    diagrams_html = "".join(
        f"<li><strong>{esc(d.name)}</strong> — {esc(d.description) if d.description else 'no description'} "
        f"<em>(v{d.current_version})</em></li>"
        for d in product.diagrams
    ) or "<li>No diagrams.</li>"

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Threat Model Report — {esc(product.name)}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          margin: 40px auto; max-width: 1100px; color: #222; }}
  h1 {{ border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }}
  h2 {{ margin-top: 40px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }}
  table {{ border-collapse: collapse; width: 100%; margin-top: 12px; font-size: 13px; }}
  th, td {{ border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; vertical-align: top; }}
  th {{ background: #f3f4f6; font-weight: 600; }}
  .meta th {{ width: 160px; background: #f9fafb; }}
  .footer {{ margin-top: 60px; color: #6b7280; font-size: 11px; text-align: center; }}
  @media print {{ body {{ margin: 20px; }} h1 {{ page-break-after: avoid; }} table {{ page-break-inside: avoid; }} }}
</style>
</head>
<body>
<h1>Threat Model Report — {esc(product.name)}</h1>
<p><em>{esc(product.description or "")}</em></p>

<h2>Project Metadata</h2>
<table class="meta">{meta_html or '<tr><td>No project metadata provided.</td></tr>'}</table>

<h2>Diagrams</h2>
<ul>{diagrams_html}</ul>

<h2>Threats ({len(threats)})</h2>
<table>
  <thead><tr>
    <th>Diagram</th><th>Element</th><th>Threat</th><th>Category</th>
    <th>Status</th><th>Severity</th><th>Risk</th><th>Description</th>
  </tr></thead>
  <tbody>{threats_html}</tbody>
</table>

<h2>Mitigations ({len(mitigations)})</h2>
<table>
  <thead><tr>
    <th>Diagram</th><th>Element</th><th>Mitigation</th><th>Category</th>
    <th>Status</th><th>Description</th>
  </tr></thead>
  <tbody>{mitigations_html}</tbody>
</table>

<p class="footer">Generated by ThreatAtlas on {generated}. Use your browser's Print → Save as PDF to export.</p>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/{product_id}/download/diagrams")
def download_diagrams(product_id: int, current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    product = _load_product(product_id, current_user, db)
    body = json.dumps(_diagrams_payload(product), indent=2, default=str)
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{_safe_filename(product.name)}-diagrams.json"'},
    )


@router.get("/{product_id}/download/threats-mitigations")
def download_threats_mitigations(product_id: int, current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    product = _load_product(product_id, current_user, db)
    threats, mitigations = _threats_mitigations_rows(product)
    return Response(
        content=_threats_csv(threats, mitigations),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{_safe_filename(product.name)}-threats-mitigations.csv"'},
    )


@router.get("/{product_id}/download/report")
def download_report(product_id: int, current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    product = _load_product(product_id, current_user, db)
    threats, mitigations = _threats_mitigations_rows(product)
    return Response(
        content=_html_report(product, threats, mitigations),
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{_safe_filename(product.name)}-report.html"'},
    )


@router.get("/{product_id}/download/bundle")
def download_bundle(product_id: int, current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    product = _load_product(product_id, current_user, db)
    threats, mitigations = _threats_mitigations_rows(product)
    slug = _safe_filename(product.name)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{slug}/diagrams.json", json.dumps(_diagrams_payload(product), indent=2, default=str))
        zf.writestr(f"{slug}/threats-mitigations.csv", _threats_csv(threats, mitigations))
        zf.writestr(f"{slug}/report.html", _html_report(product, threats, mitigations))
        zf.writestr(
            f"{slug}/README.txt",
            f"ThreatAtlas export for product: {product.name}\n"
            f"Generated: {datetime.now(timezone.utc).isoformat()}\n\n"
            f"- diagrams.json: full diagram data (ReactFlow nodes/edges) for re-import\n"
            f"- threats-mitigations.csv: all threats and mitigations across every diagram\n"
            f"- report.html: standalone HTML report — open in a browser and use "
            f"Print → Save as PDF to export\n",
        )
    buf.seek(0)
    return Response(
        content=buf.read(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{slug}-threatatlas.zip"'},
    )
