import { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import DiagramNode from '@/components/DiagramNode';
import DiagramEdge from '@/components/DiagramEdge';
import { diagramVersionsApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { buildDiffGraph, type ChangeType, type ComparisonLike } from '@/lib/diff';

const CHANGE_COLORS: Record<ChangeType, string> = {
  added: 'var(--element-mitigation)',
  removed: 'var(--element-threat)',
  modified: 'var(--risk-medium)',
  unchanged: 'var(--border)',
};

const CHANGE_LABEL: Record<ChangeType, string> = {
  added: 'Added',
  removed: 'Removed',
  modified: 'Modified',
  unchanged: 'Unchanged',
};

// Render with the SAME node/edge components as the main canvas so elements and
// connections look identical; diff status is layered on as an outline ring.
const nodeTypes = { custom: DiagramNode };
const edgeTypes = { custom: DiagramEdge };

function diffNodeStyle(change: ChangeType): React.CSSProperties {
  if (change === 'unchanged') return {};
  const color = CHANGE_COLORS[change];
  return {
    outline: `2px ${change === 'removed' ? 'dashed' : 'solid'} ${color}`,
    outlineOffset: 3,
    borderRadius: 10,
    opacity: change === 'removed' ? 0.5 : 1,
  };
}

function diffEdgeStyle(change: ChangeType): React.CSSProperties | undefined {
  if (change === 'unchanged') return undefined;
  return {
    stroke: CHANGE_COLORS[change],
    strokeWidth: 2.5,
    strokeDasharray: change === 'removed' ? '6 4' : undefined,
    opacity: change === 'removed' ? 0.5 : 1,
  };
}

const stripPrefix = (id: string) => id.replace(/^removed-/, '');

interface DiagramDiffCanvasProps {
  diagramId: number;
  fromVersion: number;
  toVersion: number;
  comparison: ComparisonLike;
}

export default function DiagramDiffCanvas({ diagramId, fromVersion, toVersion, comparison }: DiagramDiffCanvasProps) {
  const [fromData, setFromData] = useState<any | null>(null);
  const [toData, setToData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      diagramVersionsApi.get(diagramId, fromVersion),
      diagramVersionsApi.get(diagramId, toVersion),
    ])
      .then(([fromRes, toRes]) => {
        if (cancelled) return;
        setFromData(fromRes.data?.diagram_data ?? { nodes: [], edges: [] });
        setToData(toRes.data?.diagram_data ?? { nodes: [], edges: [] });
      })
      .catch(() => !cancelled && toast.error('Failed to load version canvases'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [diagramId, fromVersion, toVersion]);

  const { nodes, edges } = useMemo(() => {
    if (!fromData || !toData) return { nodes: [] as Node[], edges: [] as Edge[] };

    const graph = buildDiffGraph(fromData, toData, comparison);

    // Look up the original node/edge objects so we render real DFD shapes,
    // labels, and styling — identical to the main canvas.
    const toNodeById = new Map<string, any>((toData.nodes ?? []).map((n: any) => [n.id, n]));
    const fromNodeById = new Map<string, any>((fromData.nodes ?? []).map((n: any) => [n.id, n]));
    const toEdgeById = new Map<string, any>((toData.edges ?? []).map((e: any) => [e.id, e]));
    const fromEdgeById = new Map<string, any>((fromData.edges ?? []).map((e: any) => [e.id, e]));

    const builtNodes: Node[] = graph.nodes.map(gn => {
      const removed = gn.change === 'removed';
      const orig = (removed ? fromNodeById : toNodeById).get(stripPrefix(gn.id)) ?? {};
      return {
        ...orig,
        id: gn.id,
        type: 'custom',
        position: gn.position,
        data: { ...(orig.data ?? {}), label: orig.data?.label ?? gn.label },
        draggable: false,
        selectable: false,
        style: { ...(orig.style ?? {}), ...diffNodeStyle(gn.change) },
      } as Node;
    });

    const builtEdges: Edge[] = graph.edges.map(ge => {
      const removed = ge.change === 'removed';
      const orig = (removed ? fromEdgeById : toEdgeById).get(stripPrefix(ge.id)) ?? {};
      const overlay = diffEdgeStyle(ge.change);
      return {
        ...orig,
        id: ge.id,
        source: ge.source,
        target: ge.target,
        type: 'custom',
        animated: ge.change === 'added',
        style: { ...(orig.style ?? {}), ...(overlay ?? {}) },
      } as Edge;
    });

    return { nodes: builtNodes, edges: builtEdges };
  }, [fromData, toData, comparison]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[420px] text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Rendering visual diff…</span>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[420px] text-muted-foreground text-sm">
        No diagram canvas data to compare for these versions.
      </div>
    );
  }

  return (
    <div className="relative h-[420px] w-full rounded-lg border overflow-hidden">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>

      {/* Legend */}
      <div className="absolute top-2 right-2 z-10 rounded-md border bg-card/90 backdrop-blur px-2.5 py-2 text-[10px] space-y-1 shadow-sm">
        {(['added', 'removed', 'modified', 'unchanged'] as ChangeType[]).map(c => (
          <div key={c} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{
                backgroundColor: c === 'unchanged' ? 'transparent' : CHANGE_COLORS[c],
                border: `1.5px ${c === 'removed' ? 'dashed' : 'solid'} ${CHANGE_COLORS[c]}`,
              }}
            />
            <span className="text-muted-foreground">{CHANGE_LABEL[c]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
