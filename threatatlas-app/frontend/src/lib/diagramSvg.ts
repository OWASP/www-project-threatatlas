/**
 * diagramSvg.ts — Renders ReactFlow node/edge data as a standalone SVG string.
 * Used for HTML/PDF reports with embedded diagrams.
 */

interface SvgNode {
  id: string;
  position: { x: number; y: number };
  data: { label: string; type: string };
  width?: number;
  height?: number;
  parentId?: string;
}

interface SvgEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: { label?: string; labelOffsetX?: number; labelOffsetY?: number };
}

const COLORS: Record<string, string> = {
  process: '#3b82f6',
  datastore: '#10b981',
  external: '#f59e0b',
  boundary: '#6b7280',
};

const PADDING = 40;
const NODE_SIZES: Record<string, { w: number; h: number }> = {
  process: { w: 96, h: 96 },
  datastore: { w: 140, h: 40 },
  external: { w: 120, h: 44 },
  boundary: { w: 200, h: 150 },
};

/**
 * Wrap text into multiple lines to prevent overflow.
 */
function wrapText(text: string, maxWidth: number, fontSize = 11): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  const charWidth = fontSize * 0.6;

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length * charWidth > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Resolve absolute positions by walking parentId chain.
 */
function resolvePositions(nodes: SvgNode[]): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const cache = new Map<string, { x: number; y: number }>();

  const resolve = (id: string): { x: number; y: number } => {
    if (cache.has(id)) return cache.get(id)!;
    const node = byId.get(id);
    if (!node) return { x: 0, y: 0 };
    if (!node.parentId) {
      cache.set(id, { x: node.position.x, y: node.position.y });
    } else {
      const p = resolve(node.parentId);
      cache.set(id, { x: p.x + node.position.x, y: p.y + node.position.y });
    }
    return cache.get(id)!;
  };

  nodes.forEach(n => resolve(n.id));
  return cache;
}

/**
 * Compute edge endpoint on the shape boundary (not center).
 */
function shapeBoundaryPoint(
  cx: number, cy: number, w: number, h: number, type: string,
  targetX: number, targetY: number
): { x: number; y: number } {
  const dx = targetX - cx;
  const dy = targetY - cy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  if (type === 'process') {
    // Circle boundary
    const r = w / 2;
    return { x: cx + (dx / len) * r, y: cy + (dy / len) * r };
  }

  // Rectangle boundary
  const hw = w / 2;
  const hh = h / 2;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let scale: number;
  if (absDx * hh > absDy * hw) {
    scale = hw / (absDx || 1);
  } else {
    scale = hh / (absDy || 1);
  }

  return { x: cx + dx * scale, y: cy + dy * scale };
}

/**
 * Render a diagram as an SVG string.
 */
export function renderDiagramSvg(nodes: SvgNode[], edges: SvgEdge[]): string {
  const positions = resolvePositions(nodes);

  // Expand boundaries to contain children
  const boundaries = nodes.filter(n => n.data.type === 'boundary');
  for (const b of boundaries) {
    const children = nodes.filter(n => n.parentId === b.id);
    if (children.length > 0) {
      let maxX = 0, maxY = 0;
      for (const child of children) {
        const cSize = NODE_SIZES[child.data.type] ?? NODE_SIZES.external;
        maxX = Math.max(maxX, child.position.x + cSize.w + PADDING);
        maxY = Math.max(maxY, child.position.y + cSize.h + PADDING);
      }
      b.width = Math.max(b.width ?? 200, maxX);
      b.height = Math.max(b.height ?? 150, maxY);
    }
  }

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const pos = positions.get(node.id)!;
    const size = NODE_SIZES[node.data.type] ?? NODE_SIZES.external;
    const w = node.width ?? size.w;
    const h = node.height ?? size.h;
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + w);
    maxY = Math.max(maxY, pos.y + h);
  }

  // Account for edge labels
  for (const edge of edges) {
    const src = positions.get(edge.source);
    const tgt = positions.get(edge.target);
    if (src && tgt) {
      const lx = (src.x + tgt.x) / 2 + (edge.data?.labelOffsetX ?? 0);
      const ly = (src.y + tgt.y) / 2 + (edge.data?.labelOffsetY ?? 0);
      minX = Math.min(minX, lx - 60);
      maxX = Math.max(maxX, lx + 60);
      minY = Math.min(minY, ly - 15);
      maxY = Math.max(maxY, ly + 15);
    }
  }

  const svgWidth = maxX - minX + PADDING * 2;
  const svgHeight = maxY - minY + PADDING * 2;
  const offsetX = -minX + PADDING;
  const offsetY = -minY + PADDING;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`);
  parts.push(`<defs>`);
  parts.push(`<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#666"/></marker>`);
  parts.push(`</defs>`);
  parts.push(`<rect width="100%" height="100%" fill="#1a1a2e"/>`);

  // Render boundaries first (behind)
  for (const node of nodes) {
    if (node.data.type !== 'boundary') continue;
    const pos = positions.get(node.id)!;
    const x = pos.x + offsetX;
    const y = pos.y + offsetY;
    const w = node.width ?? 200;
    const h = node.height ?? 150;
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${COLORS.boundary}" stroke-width="1.5" stroke-dasharray="6 4" rx="4"/>`);
    parts.push(`<text x="${x + 8}" y="${y + 16}" font-size="10" fill="${COLORS.boundary}" font-family="sans-serif">${escapeXml(node.data.label || 'Trust Boundary')}</text>`);
  }

  // Render edges — group by node pair for parallel offset
  const edgePairGroups = new Map<string, typeof edges>();
  for (const edge of edges) {
    const key = [edge.source, edge.target].sort().join('|');
    const group = edgePairGroups.get(key) ?? [];
    group.push(edge);
    edgePairGroups.set(key, group);
  }

  for (const [, group] of edgePairGroups) {
    for (let ei = 0; ei < group.length; ei++) {
      const edge = group[ei];
      const srcNode = nodes.find(n => n.id === edge.source);
      const tgtNode = nodes.find(n => n.id === edge.target);
      if (!srcNode || !tgtNode) continue;

      const srcPos = positions.get(edge.source)!;
      const tgtPos = positions.get(edge.target)!;
      const srcSize = NODE_SIZES[srcNode.data.type] ?? NODE_SIZES.external;
      const tgtSize = NODE_SIZES[tgtNode.data.type] ?? NODE_SIZES.external;

      const srcCx = srcPos.x + offsetX + (srcNode.width ?? srcSize.w) / 2;
      const srcCy = srcPos.y + offsetY + (srcNode.height ?? srcSize.h) / 2;
      const tgtCx = tgtPos.x + offsetX + (tgtNode.width ?? tgtSize.w) / 2;
      const tgtCy = tgtPos.y + offsetY + (tgtNode.height ?? tgtSize.h) / 2;

      const start = shapeBoundaryPoint(srcCx, srcCy, srcNode.width ?? srcSize.w, srcNode.height ?? srcSize.h, srcNode.data.type, tgtCx, tgtCy);
      const end = shapeBoundaryPoint(tgtCx, tgtCy, tgtNode.width ?? tgtSize.w, tgtNode.height ?? tgtSize.h, tgtNode.data.type, srcCx, srcCy);

      // Parallel edge offset
      const mid = (group.length - 1) / 2;
      const perpOffset = (ei - mid) * 50; // 50px between parallel edges
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / len;
      const perpY = dx / len;

      // Control point for quadratic bezier
      const cpx = (start.x + end.x) / 2 + perpX * perpOffset;
      const cpy = (start.y + end.y) / 2 + perpY * perpOffset;

      if (group.length > 1) {
        // Curved path for parallel edges
        parts.push(`<path d="M ${start.x},${start.y} Q ${cpx},${cpy} ${end.x},${end.y}" fill="none" stroke="#555" stroke-width="1" stroke-dasharray="4 3" marker-end="url(#arrowhead)"/>`);
      } else {
        // Straight line for single edges
        parts.push(`<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#555" stroke-width="1" stroke-dasharray="4 3" marker-end="url(#arrowhead)"/>`);
      }

      // Edge label — positioned at the control point (on the curve)
      const edgeLabel = edge.label ?? edge.data?.label;
      if (edgeLabel) {
        const lx = group.length > 1 ? cpx : (start.x + end.x) / 2;
        const ly = (group.length > 1 ? cpy : (start.y + end.y) / 2) - 6;
        const truncLabel = edgeLabel.length > 22 ? edgeLabel.slice(0, 19) + '...' : edgeLabel;
        // Background rect for readability
        const textWidth = truncLabel.length * 5.5;
        parts.push(`<rect x="${lx - textWidth / 2 - 2}" y="${ly - 8}" width="${textWidth + 4}" height="12" rx="2" fill="#1a1a2e" fill-opacity="0.85"/>`);
        parts.push(`<text x="${lx}" y="${ly}" font-size="8" fill="#bbb" font-family="sans-serif" text-anchor="middle">${escapeXml(truncLabel)}</text>`);
      }
    }
  }

  // Render nodes (non-boundary)
  for (const node of nodes) {
    if (node.data.type === 'boundary') continue;
    const pos = positions.get(node.id)!;
    const size = NODE_SIZES[node.data.type] ?? NODE_SIZES.external;
    const w = node.width ?? size.w;
    const h = node.height ?? size.h;
    const x = pos.x + offsetX;
    const y = pos.y + offsetY;
    const color = COLORS[node.data.type] ?? COLORS.external;

    if (node.data.type === 'process') {
      // Circle
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = w / 2;
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="2"/>`);
      const lines = wrapText(node.data.label, r * 1.4, 10);
      const startY = cy - ((lines.length - 1) * 12) / 2;
      for (let i = 0; i < Math.min(lines.length, 3); i++) {
        parts.push(`<text x="${cx}" y="${startY + i * 12}" font-size="10" fill="#eee" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${escapeXml(lines[i])}</text>`);
      }
    } else if (node.data.type === 'datastore') {
      // Parallel lines (top and bottom)
      parts.push(`<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${color}" stroke-width="2"/>`);
      parts.push(`<line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="${color}" stroke-width="2"/>`);
      const lines = wrapText(node.data.label, w - 10, 11);
      const cy = y + h / 2;
      const startY = cy - ((lines.length - 1) * 13) / 2;
      for (let i = 0; i < lines.length; i++) {
        parts.push(`<text x="${x + w / 2}" y="${startY + i * 13}" font-size="11" fill="#eee" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${escapeXml(lines[i])}</text>`);
      }
    } else {
      // Rectangle (external entity)
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="2" rx="3"/>`);
      const lines = wrapText(node.data.label, w - 10, 11);
      const cy = y + h / 2;
      const startY = cy - ((lines.length - 1) * 13) / 2;
      for (let i = 0; i < lines.length; i++) {
        parts.push(`<text x="${x + w / 2}" y="${startY + i * 13}" font-size="11" fill="#eee" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${escapeXml(lines[i])}</text>`);
      }
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
