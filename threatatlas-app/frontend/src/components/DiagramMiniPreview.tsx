import { ReactFlow, ReactFlowProvider, Background, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import DiagramNode from './DiagramNode';
import DiagramEdge from './DiagramEdge';

// Same node/edge renderers as the main canvas, so previews show real DFD
// elements (process circles, datastore, external, trust boundaries) and
// connections — not a stand-in representation.
const nodeTypes = { custom: DiagramNode };
const edgeTypes = { custom: DiagramEdge };

interface DiagramMiniPreviewProps {
  nodes: Node[] | any[];
  edges: Edge[] | any[];
  className?: string;
}

/**
 * Static, non-interactive ReactFlow preview wrapped in its own provider so it
 * never shares state with a parent canvas. Used for diagram-template previews.
 */
export default function DiagramMiniPreview({ nodes, edges, className }: DiagramMiniPreviewProps) {
  const viewNodes = (nodes ?? []).map(n => ({ ...n, draggable: false, selectable: false }));
  return (
    <div className={className}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={viewNodes as Node[]}
          edges={(edges ?? []) as Edge[]}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
