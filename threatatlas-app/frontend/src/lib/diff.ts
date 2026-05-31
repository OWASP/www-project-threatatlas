// Pure helpers for building a visual version-diff graph from two diagram
// snapshots plus a backend comparison payload. Kept free of React/ReactFlow
// runtime so it can be unit-tested directly.

export type ChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface ElementChange {
  element_id: string;
  element_type: string;
  change_type: 'added' | 'removed' | 'modified';
  before?: any;
  after?: any;
}

export interface ComparisonLike {
  nodes_added: ElementChange[];
  nodes_removed: ElementChange[];
  nodes_modified: ElementChange[];
  edges_added: ElementChange[];
  edges_removed: ElementChange[];
  edges_modified: ElementChange[];
}

export interface DiagramData {
  nodes?: any[];
  edges?: any[];
}

export interface DiffNodeModel {
  id: string;
  position: { x: number; y: number };
  label: string;
  change: ChangeType;
}

export interface DiffEdgeModel {
  id: string;
  source: string;
  target: string;
  change: ChangeType;
}

export function nodeLabel(node: any): string {
  return node?.data?.label || node?.data?.name || node?.label || node?.id || 'node';
}

/**
 * Build the node/edge models for a visual diff.
 *
 * Nodes present in the "to" snapshot are classified added/modified/unchanged;
 * nodes only in the "from" snapshot that were removed are appended as ghost
 * entries with a `removed-` prefixed id. Edges follow the same rule.
 */
export function buildDiffGraph(
  fromData: DiagramData | null,
  toData: DiagramData | null,
  comparison: ComparisonLike,
): { nodes: DiffNodeModel[]; edges: DiffEdgeModel[] } {
  if (!fromData || !toData) return { nodes: [], edges: [] };

  const addedIds = new Set(comparison.nodes_added.map(c => c.element_id));
  const removedIds = new Set(comparison.nodes_removed.map(c => c.element_id));
  const modifiedIds = new Set(comparison.nodes_modified.map(c => c.element_id));
  const edgeAdded = new Set(comparison.edges_added.map(c => c.element_id));
  const edgeRemoved = new Set(comparison.edges_removed.map(c => c.element_id));
  const edgeModified = new Set(comparison.edges_modified.map(c => c.element_id));

  const classifyNode = (id: string): ChangeType =>
    addedIds.has(id) ? 'added' : modifiedIds.has(id) ? 'modified' : 'unchanged';

  const toNodes = toData.nodes ?? [];
  const fromNodes = fromData.nodes ?? [];

  const nodes: DiffNodeModel[] = toNodes.map((n: any) => ({
    id: n.id,
    position: n.position ?? { x: 0, y: 0 },
    label: nodeLabel(n),
    change: classifyNode(n.id),
  }));

  for (const n of fromNodes) {
    if (removedIds.has(n.id)) {
      nodes.push({
        id: `removed-${n.id}`,
        position: n.position ?? { x: 0, y: 0 },
        label: nodeLabel(n),
        change: 'removed',
      });
    }
  }

  const classifyEdge = (id: string): ChangeType =>
    edgeAdded.has(id) ? 'added' : edgeModified.has(id) ? 'modified' : 'unchanged';

  const toEdges = toData.edges ?? [];
  const fromEdges = fromData.edges ?? [];

  const edges: DiffEdgeModel[] = toEdges.map((e: any) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    change: classifyEdge(e.id),
  }));

  for (const e of fromEdges) {
    if (edgeRemoved.has(e.id)) {
      edges.push({
        id: `removed-${e.id}`,
        source: e.source,
        target: e.target,
        change: 'removed',
      });
    }
  }

  return { nodes, edges };
}
