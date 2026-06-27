import { memo, useCallback, useRef } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';

function DiagramEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  animated,
  selected,
  markerEnd,
  style,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const parallelIndex = (data?.parallelIndex as number) ?? 0;
  const parallelCount = (data?.parallelCount as number) ?? 1;

  // Waypoint offset stored in edge data (set by dragging the midpoint)
  const waypointX = (data?.waypointX as number) ?? 0;
  const waypointY = (data?.waypointY as number) ?? 0;

  // Label offset stored in edge data (set by dragging the label)
  const labelOffsetX = (data?.labelOffsetX as number) ?? 0;
  const labelOffsetY = (data?.labelOffsetY as number) ?? 0;

  // Compute edge path
  let edgePath: string;
  let midX: number;
  let midY: number;

  const mx = (sourceX + targetX) / 2;
  const my = (sourceY + targetY) / 2;

  if (parallelCount > 1) {
    // Parallel edges: offset control point perpendicular to the line
    const mid = (parallelCount - 1) / 2;
    const offsetAmount = (parallelIndex - mid) * 50;
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;

    const cx = mx + perpX * offsetAmount + waypointX;
    const cy = my + perpY * offsetAmount + waypointY;

    edgePath = `M ${sourceX},${sourceY} Q ${cx},${cy} ${targetX},${targetY}`;
    midX = cx;
    midY = cy;
  } else if (waypointX !== 0 || waypointY !== 0) {
    // Single edge with user-dragged waypoint
    const cx = mx + waypointX;
    const cy = my + waypointY;
    edgePath = `M ${sourceX},${sourceY} Q ${cx},${cy} ${targetX},${targetY}`;
    midX = cx;
    midY = cy;
  } else {
    const result = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    edgePath = result[0];
    midX = result[1];
    midY = result[2];
  }

  // Final label position (midpoint + user offset)
  const finalLabelX = midX + labelOffsetX;
  const finalLabelY = midY + labelOffsetY;

  const threatCount = (data?.threatCount as number) ?? 0;
  const mitigationCount = (data?.mitigationCount as number) ?? 0;
  const hasCountBadges = threatCount > 0 || mitigationCount > 0;
  const edgeLabel = (label as string) || (data?.label as string) || '';

  // Midpoint drag handlers
  const onMidpointMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: waypointX, origY: waypointY };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setEdges(eds => eds.map(edge =>
        edge.id === id
          ? { ...edge, data: { ...edge.data, waypointX: dragRef.current!.origX + dx, waypointY: dragRef.current!.origY + dy } }
          : edge
      ));
    };

    const onMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [id, waypointX, waypointY, setEdges]);

  // Double-click midpoint to reset
  const onMidpointDblClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges(eds => eds.map(edge =>
      edge.id === id
        ? { ...edge, data: { ...edge.data, waypointX: 0, waypointY: 0 } }
        : edge
    ));
  }, [id, setEdges]);

  // Label drag handlers
  const labelDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onLabelMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    labelDragRef.current = { startX: e.clientX, startY: e.clientY, origX: labelOffsetX, origY: labelOffsetY };

    const onMouseMove = (ev: MouseEvent) => {
      if (!labelDragRef.current) return;
      const dx = ev.clientX - labelDragRef.current.startX;
      const dy = ev.clientY - labelDragRef.current.startY;
      setEdges(eds => eds.map(edge =>
        edge.id === id
          ? { ...edge, data: { ...edge.data, labelOffsetX: labelDragRef.current!.origX + dx, labelOffsetY: labelDragRef.current!.origY + dy } }
          : edge
      ));
    };

    const onMouseUp = () => {
      labelDragRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [id, labelOffsetX, labelOffsetY, setEdges]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 2.5 : 1.5,
        }}
        className={animated ? 'animated' : ''}
      />
      <EdgeLabelRenderer>
        {/* Draggable midpoint handle */}
        {selected && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              onMouseDown={onMidpointMouseDown}
              onDoubleClick={onMidpointDblClick}
              className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
              title="Drag to reshape • Double-click to reset"
            />
          </div>
        )}

        {/* Edge label + badges */}
        {(edgeLabel || hasCountBadges) && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${finalLabelX}px,${finalLabelY}px)`,
              pointerEvents: 'all',
              cursor: selected ? 'grab' : 'default',
            }}
            className="nodrag nopan flex flex-col items-center gap-0.5"
            onMouseDown={selected ? onLabelMouseDown : undefined}
          >
            {edgeLabel && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-background/90 border border-border/60 text-foreground shadow-sm whitespace-nowrap">
                {edgeLabel}
              </span>
            )}
            {hasCountBadges && (
              <div className="flex gap-1">
                {threatCount > 0 && (
                  <span className="inline-flex items-center text-[9px] font-bold leading-none px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/25">
                    T{threatCount}
                  </span>
                )}
                {mitigationCount > 0 && (
                  <span
                    className="inline-flex items-center text-[9px] font-bold leading-none px-1.5 py-0.5 rounded-full border"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--element-mitigation) 15%, transparent)',
                      color: 'var(--element-mitigation)',
                      borderColor: 'color-mix(in srgb, var(--element-mitigation) 25%, transparent)',
                    }}
                  >
                    M{mitigationCount}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(DiagramEdge);
