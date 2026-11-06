import type { Node, XYPosition } from '@xyflow/react';

/** Keep parent-relative grouping without clamping a child to its boundary. */
export function normalizeBoundaryChildren(nodes: Node[]): Node[] {
  return nodes.map(node => {
    if (!node.parentId || node.data.type === 'boundary' || node.extent !== 'parent') {
      return node;
    }
    const unconstrained = { ...node };
    delete unconstrained.extent;
    return unconstrained;
  });
}

export function getAbsoluteNodePosition(node: Node, nodes: Node[]): XYPosition {
  const position = { ...node.position };
  const visited = new Set([node.id]);
  let parentId = node.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = nodes.find(candidate => candidate.id === parentId);
    if (!parent) break;
    position.x += parent.position.x;
    position.y += parent.position.y;
    parentId = parent.parentId;
  }
  return position;
}

const ATTACH_SIZE: Record<string, { w: number; h: number }> = {
  process: { w: 96, h: 96 },
  datastore: { w: 140, h: 40 },
  external: { w: 120, h: 44 },
};

export function findContainingBoundary(node: Node, nodes: Node[]): Node | undefined {
  const position = getAbsoluteNodePosition(node, nodes);
  const size = ATTACH_SIZE[String(node.data.type)] ?? {
    w: node.width ?? 80, h: node.height ?? 40,
  };
  const cx = position.x + size.w / 2;
  const cy = position.y + size.h / 2;
  const containingBoundaries = nodes.filter(candidate => {
    if (candidate.data.type !== 'boundary' || candidate.id === node.id) return false;
    const origin = getAbsoluteNodePosition(candidate, nodes);
    return cx >= origin.x && cx <= origin.x + (candidate.width ?? 300)
      && cy >= origin.y && cy <= origin.y + (candidate.height ?? 200);
  });
  // Prefer the inner boundary when a node is inside nested boundaries.
  return containingBoundaries.sort((a, b) =>
    (a.width ?? 300) * (a.height ?? 200) - (b.width ?? 300) * (b.height ?? 200)
  )[0];
}

/** Reparent on drop, preserving the node's absolute canvas position. */
export function reparentBoundaryChild(node: Node, nodes: Node[], boundary?: Node): Node {
  const absolutePosition = getAbsoluteNodePosition(node, nodes);
  const result = { ...node };
  delete result.parentId;
  if (result.extent === 'parent') delete result.extent;
  if (boundary) {
    const parentPosition = getAbsoluteNodePosition(boundary, nodes);
    return {
      ...result,
      parentId: boundary.id,
      position: {
        x: absolutePosition.x - parentPosition.x,
        y: absolutePosition.y - parentPosition.y,
      },
    };
  }
  return { ...result, position: absolutePosition };
}
