import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  findContainingBoundary,
  getAbsoluteNodePosition,
  normalizeBoundaryChildren,
  reparentBoundaryChild,
} from '@/lib/canvasBoundaries';

const boundary: Node = {
  id: 'zone', type: 'custom', position: { x: 100, y: 200 },
  width: 300, height: 200, data: { type: 'boundary' },
};
const child: Node = {
  id: 'service', type: 'custom', parentId: boundary.id, extent: 'parent',
  position: { x: 20, y: 30 }, data: { label: 'Service', type: 'process' },
};

describe('trust-boundary grouping', () => {
  it('unclamps saved and remotely received children without moving or unparenting them', () => {
    const [normalized] = normalizeBoundaryChildren([child]);
    expect(normalized.extent).toBeUndefined();
    expect(normalized.parentId).toBe(boundary.id);
    expect(normalized.position).toEqual(child.position);
    expect(child.extent).toBe('parent');
    expect(normalizeBoundaryChildren([normalized])[0]).toBe(normalized);
  });

  it('leaves boundaries, unparented nodes, and explicit coordinate extents alone', () => {
    const bounded: Node = { ...child, extent: [[0, 0], [1000, 1000]] };
    const free: Node = { ...child, parentId: undefined };
    const nested: Node = { ...boundary, parentId: 'outer', extent: 'parent' };
    const nodes = [boundary, bounded, free, nested];
    normalizeBoundaryChildren(nodes).forEach((node, index) => expect(node).toBe(nodes[index]));
  });

  it('detaches an out-of-boundary child without jumping on the canvas', () => {
    const dragged: Node = { ...child, position: { x: 400, y: 300 } };
    const nodes = [boundary, dragged];
    expect(findContainingBoundary(dragged, nodes)).toBeUndefined();
    const detached = reparentBoundaryChild(dragged, nodes);
    expect(detached.position).toEqual({ x: 500, y: 500 });
    expect(detached.parentId).toBeUndefined();
    expect(detached.extent).toBeUndefined();
    expect(detached.data).toBe(child.data);
    expect(dragged.parentId).toBe(boundary.id);
  });

  it('keeps a child in its original boundary when dropped inside', () => {
    const nodes = [boundary, child];
    expect(findContainingBoundary(child, nodes)).toBe(boundary);
    expect(reparentBoundaryChild(child, nodes, boundary)).toMatchObject({
      parentId: boundary.id, position: child.position,
    });
  });

  it('moves between boundaries using parent-relative positions', () => {
    const target: Node = { ...boundary, id: 'target', position: { x: 500, y: 200 } };
    const dragged: Node = { ...child, position: { x: 450, y: 30 } };
    const nodes = [boundary, target, dragged];
    expect(findContainingBoundary(dragged, nodes)).toBe(target);
    const attached = reparentBoundaryChild(dragged, nodes, target);
    expect(attached.position).toEqual({ x: 50, y: 30 });
    expect(attached.parentId).toBe(target.id);
    expect(attached.extent).toBeUndefined();
    expect(getAbsoluteNodePosition(attached, [boundary, target, attached])).toEqual({ x: 550, y: 230 });
  });

  it('supports negative canvas coordinates and round-trips through saved JSON', () => {
    const target: Node = { ...boundary, position: { x: -200, y: -100 } };
    const free: Node = { ...child, parentId: undefined, position: { x: -150, y: -50 } };
    const attached = reparentBoundaryChild(free, [target, free], target);
    const [loaded] = normalizeBoundaryChildren(JSON.parse(JSON.stringify([attached])));
    expect(loaded.position).toEqual({ x: 50, y: 50 });
    expect(getAbsoluteNodePosition(loaded, [target, loaded])).toEqual(free.position);
  });

  it('uses the complete ancestor chain and selects the inner boundary', () => {
    const outer: Node = { ...boundary, id: 'outer', width: 800, height: 800 };
    const inner: Node = { ...boundary, parentId: outer.id, position: { x: 50, y: 60 } };
    const nodes = [outer, inner, child];
    expect(getAbsoluteNodePosition(child, nodes)).toEqual({ x: 170, y: 290 });
    expect(findContainingBoundary(child, nodes)).toBe(inner);
    expect(reparentBoundaryChild(child, nodes).position).toEqual({ x: 170, y: 290 });
    const detached = reparentBoundaryChild(child, nodes, outer);
    expect(detached.position).toEqual({ x: 70, y: 90 });
  });

  it('can leave the inner boundary while staying inside the outer boundary', () => {
    const outer: Node = { ...boundary, id: 'outer', width: 800, height: 800 };
    const inner: Node = { ...boundary, parentId: outer.id, position: { x: 50, y: 60 } };
    const dragged: Node = { ...child, position: { x: 400, y: 300 } };
    const nodes = [outer, inner, dragged];
    expect(findContainingBoundary(dragged, nodes)).toBe(outer);
    expect(reparentBoundaryChild(dragged, nodes, outer).position).toEqual({ x: 450, y: 360 });
  });

  it('handles missing parents and terminates on malformed cyclic ancestry', () => {
    expect(getAbsoluteNodePosition(child, [child])).toEqual(child.position);
    const cyclic: Node = { ...boundary, parentId: child.id };
    expect(getAbsoluteNodePosition(child, [child, cyclic])).toEqual({ x: 120, y: 230 });
  });
});
