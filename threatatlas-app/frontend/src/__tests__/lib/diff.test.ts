import { describe, it, expect } from 'vitest';
import { buildDiffGraph, nodeLabel, type ComparisonLike } from '@/lib/diff';

const EMPTY: ComparisonLike = {
  nodes_added: [],
  nodes_removed: [],
  nodes_modified: [],
  edges_added: [],
  edges_removed: [],
  edges_modified: [],
};

const change = (id: string, type: 'added' | 'removed' | 'modified', element_type = 'node') => ({
  element_id: id,
  element_type,
  change_type: type,
});

describe('nodeLabel', () => {
  it('prefers data.label, then data.name, then label, then id', () => {
    expect(nodeLabel({ id: 'a', data: { label: 'L' } })).toBe('L');
    expect(nodeLabel({ id: 'a', data: { name: 'N' } })).toBe('N');
    expect(nodeLabel({ id: 'a', label: 'Top' })).toBe('Top');
    expect(nodeLabel({ id: 'just-id' })).toBe('just-id');
    expect(nodeLabel({})).toBe('node');
  });
});

describe('buildDiffGraph', () => {
  it('returns empty graph when either snapshot is missing', () => {
    expect(buildDiffGraph(null, { nodes: [] }, EMPTY)).toEqual({ nodes: [], edges: [] });
    expect(buildDiffGraph({ nodes: [] }, null, EMPTY)).toEqual({ nodes: [], edges: [] });
  });

  it('classifies added, modified and unchanged nodes from the "to" snapshot', () => {
    const from = { nodes: [{ id: 'n2' }, { id: 'n3' }], edges: [] };
    const to = { nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }], edges: [] };
    const comparison = { ...EMPTY, nodes_added: [change('n1', 'added')], nodes_modified: [change('n2', 'modified')] };

    const { nodes } = buildDiffGraph(from, to, comparison);
    const byId = Object.fromEntries(nodes.map(n => [n.id, n.change]));
    expect(byId).toEqual({ n1: 'added', n2: 'modified', n3: 'unchanged' });
  });

  it('appends removed nodes as ghosts with a removed- prefix and keeps their position', () => {
    const from = { nodes: [{ id: 'gone', position: { x: 5, y: 9 } }], edges: [] };
    const to = { nodes: [], edges: [] };
    const comparison = { ...EMPTY, nodes_removed: [change('gone', 'removed')] };

    const { nodes } = buildDiffGraph(from, to, comparison);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('removed-gone');
    expect(nodes[0].change).toBe('removed');
    expect(nodes[0].position).toEqual({ x: 5, y: 9 });
  });

  it('defaults missing node positions to origin', () => {
    const to = { nodes: [{ id: 'n1' }], edges: [] };
    const { nodes } = buildDiffGraph({ nodes: [], edges: [] }, to, EMPTY);
    expect(nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it('classifies edges and ghosts removed edges', () => {
    const from = { nodes: [], edges: [{ id: 'e-old', source: 'a', target: 'b' }] };
    const to = {
      nodes: [],
      edges: [
        { id: 'e-new', source: 'a', target: 'c' },
        { id: 'e-keep', source: 'b', target: 'c' },
      ],
    };
    const comparison = {
      ...EMPTY,
      edges_added: [change('e-new', 'added', 'edge')],
      edges_removed: [change('e-old', 'removed', 'edge')],
    };

    const { edges } = buildDiffGraph(from, to, comparison);
    const byId = Object.fromEntries(edges.map(e => [e.id, e.change]));
    expect(byId['e-new']).toBe('added');
    expect(byId['e-keep']).toBe('unchanged');
    expect(byId['removed-e-old']).toBe('removed');
  });

  it('produces an all-unchanged graph when there are no changes', () => {
    const data = { nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [{ id: 'e1', source: 'n1', target: 'n2' }] };
    const { nodes, edges } = buildDiffGraph(data, data, EMPTY);
    expect(nodes.every(n => n.change === 'unchanged')).toBe(true);
    expect(edges.every(e => e.change === 'unchanged')).toBe(true);
  });
});
