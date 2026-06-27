"""Server-side SVG renderer for diagram_data JSON → inline SVG string.

Used to embed diagrams in HTML and DOCX reports.
"""
from __future__ import annotations

import html as html_mod
import math
from typing import Any


COLORS = {
    "process": "#3b82f6",
    "datastore": "#10b981",
    "external": "#f59e0b",
    "boundary": "#6b7280",
}

NODE_SIZES = {
    "process": (96, 96),
    "datastore": (140, 40),
    "external": (120, 44),
    "boundary": (200, 150),
}

PADDING = 40


def _esc(s: str) -> str:
    return html_mod.escape(s) if s else ""


def _wrap_text(text: str, max_width: float, font_size: float = 10) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    char_w = font_size * 0.6
    for word in words:
        test = f"{current} {word}" if current else word
        if len(test) * char_w > max_width and current:
            lines.append(current)
            current = word
        else:
            current = test
    if current:
        lines.append(current)
    return lines or [text]


def _shape_boundary(cx: float, cy: float, w: float, h: float, node_type: str, tx: float, ty: float) -> tuple[float, float]:
    dx = tx - cx
    dy = ty - cy
    length = math.sqrt(dx * dx + dy * dy) or 1

    if node_type == "process":
        r = w / 2
        return cx + (dx / length) * r, cy + (dy / length) * r

    hw, hh = w / 2, h / 2
    abs_dx, abs_dy = abs(dx), abs(dy)
    if abs_dx * hh > abs_dy * hw:
        scale = hw / (abs_dx or 1)
    else:
        scale = hh / (abs_dy or 1)
    return cx + dx * scale, cy + dy * scale


def render_diagram_svg(diagram_data: dict[str, Any] | None) -> str | None:
    """Render diagram_data to an SVG string. Returns None if no data."""
    if not diagram_data:
        return None

    nodes_raw = diagram_data.get("nodes", [])
    edges_raw = diagram_data.get("edges", [])
    if not nodes_raw:
        return None

    # Parse nodes
    nodes: dict[str, dict] = {}
    for n in nodes_raw:
        nid = n.get("id", "")
        data = n.get("data", {})
        pos = n.get("position", {})
        node_type = data.get("type", "external")
        default_w, default_h = NODE_SIZES.get(node_type, (120, 44))
        nodes[nid] = {
            "id": nid,
            "label": data.get("label", ""),
            "type": node_type,
            "x": pos.get("x", 0),
            "y": pos.get("y", 0),
            "w": n.get("width") or default_w,
            "h": n.get("height") or default_h,
            "parentId": n.get("parentId"),
        }

    # Resolve absolute positions
    abs_pos: dict[str, tuple[float, float]] = {}

    def resolve(nid: str) -> tuple[float, float]:
        if nid in abs_pos:
            return abs_pos[nid]
        node = nodes.get(nid)
        if not node:
            return (0, 0)
        pid = node.get("parentId")
        if not pid or pid not in nodes:
            abs_pos[nid] = (node["x"], node["y"])
        else:
            px, py = resolve(pid)
            abs_pos[nid] = (px + node["x"], py + node["y"])
        return abs_pos[nid]

    for nid in nodes:
        resolve(nid)

    # Bounding box
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")
    for nid, node in nodes.items():
        x, y = abs_pos[nid]
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        max_x = max(max_x, x + node["w"])
        max_y = max(max_y, y + node["h"])

    svg_w = max_x - min_x + PADDING * 2
    svg_h = max_y - min_y + PADDING * 2
    ox = -min_x + PADDING
    oy = -min_y + PADDING

    parts: list[str] = []
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_w}" height="{svg_h}" viewBox="0 0 {svg_w} {svg_h}" style="background:#ffffff;border-radius:8px;">')
    parts.append('<defs><marker id="ah" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#444"/></marker></defs>')

    # Boundaries
    for nid, node in nodes.items():
        if node["type"] != "boundary":
            continue
        x, y = abs_pos[nid]
        parts.append(f'<rect x="{x+ox}" y="{y+oy}" width="{node["w"]}" height="{node["h"]}" fill="none" stroke="{COLORS["boundary"]}" stroke-width="1.5" stroke-dasharray="6 4" rx="4"/>')
        parts.append(f'<text x="{x+ox+8}" y="{y+oy+16}" font-size="10" fill="{COLORS["boundary"]}" font-family="sans-serif">{_esc(node["label"] or "Trust Boundary")}</text>')

    # Edges
    # Edges — TD style: straight parallel lines with labels spaced along the path
    edge_groups: dict[str, list] = {}
    for e in edges_raw:
        key = "|".join(sorted([e.get("source", ""), e.get("target", "")]))
        edge_groups.setdefault(key, []).append(e)

    for group in edge_groups.values():
        for i, e in enumerate(group):
            src_id = e.get("source", "")
            tgt_id = e.get("target", "")
            src = nodes.get(src_id)
            tgt = nodes.get(tgt_id)
            if not src or not tgt:
                continue

            sx, sy = abs_pos[src_id]
            tx, ty = abs_pos[tgt_id]
            scx = sx + ox + src["w"] / 2
            scy = sy + oy + src["h"] / 2
            tcx = tx + ox + tgt["w"] / 2
            tcy = ty + oy + tgt["h"] / 2

            start = _shape_boundary(scx, scy, src["w"], src["h"], src["type"], tcx, tcy)
            end = _shape_boundary(tcx, tcy, tgt["w"], tgt["h"], tgt["type"], scx, scy)

            # For parallel edges: offset the entire line perpendicular to the path
            dx = end[0] - start[0]
            dy = end[1] - start[1]
            length = math.sqrt(dx * dx + dy * dy) or 1
            perp_x = -dy / length
            perp_y = dx / length

            # Offset each parallel edge by 16px perpendicular (enough for labels)
            mid_count = (len(group) - 1) / 2
            line_offset = (i - mid_count) * 16

            x1 = start[0] + perp_x * line_offset
            y1 = start[1] + perp_y * line_offset
            x2 = end[0] + perp_x * line_offset
            y2 = end[1] + perp_y * line_offset

            # Draw the edge line
            parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#888" stroke-width="1" stroke-dasharray="4 3" marker-end="url(#ah)"/>')

            # Label: place above the edge line, near the source-side quarter
            label = e.get("label") or (e.get("data") or {}).get("label", "")
            if label:
                # Position at 30% along the line from source
                t = 0.3
                lx = x1 + (x2 - x1) * t
                ly = y1 + (y2 - y1) * t - 10  # 10px above the line
                trunc = label[:28] + "..." if len(label) > 28 else label
                parts.append(f'<text x="{lx}" y="{ly}" font-size="9" fill="#333" font-family="sans-serif">{_esc(trunc)}</text>')

    # Nodes (non-boundary)
    for nid, node in nodes.items():
        if node["type"] == "boundary":
            continue
        x, y = abs_pos[nid]
        px, py = x + ox, y + oy
        w, h = node["w"], node["h"]
        color = COLORS.get(node["type"], COLORS["external"])

        if node["type"] == "process":
            cx, cy = px + w / 2, py + h / 2
            r = w / 2
            parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{color}" stroke-width="2"/>')
            lines = _wrap_text(node["label"], r * 1.4, 10)
            start_y = cy - (len(lines) - 1) * 6
            for j, line in enumerate(lines[:3]):
                parts.append(f'<text x="{cx}" y="{start_y + j * 12}" font-size="10" fill="#222" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">{_esc(line)}</text>')
        elif node["type"] == "datastore":
            parts.append(f'<line x1="{px}" y1="{py}" x2="{px+w}" y2="{py}" stroke="{color}" stroke-width="2"/>')
            parts.append(f'<line x1="{px}" y1="{py+h}" x2="{px+w}" y2="{py+h}" stroke="{color}" stroke-width="2"/>')
            lines = _wrap_text(node["label"], w - 10, 10)
            cy = py + h / 2
            start_y = cy - (len(lines) - 1) * 6
            for j, line in enumerate(lines[:2]):
                parts.append(f'<text x="{px + w/2}" y="{start_y + j * 12}" font-size="10" fill="#222" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">{_esc(line)}</text>')
        else:
            parts.append(f'<rect x="{px}" y="{py}" width="{w}" height="{h}" fill="none" stroke="{color}" stroke-width="2" rx="3"/>')
            lines = _wrap_text(node["label"], w - 10, 10)
            cy = py + h / 2
            start_y = cy - (len(lines) - 1) * 6
            for j, line in enumerate(lines[:2]):
                parts.append(f'<text x="{px + w/2}" y="{start_y + j * 12}" font-size="10" fill="#222" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">{_esc(line)}</text>')

    parts.append("</svg>")
    return "\n".join(parts)
