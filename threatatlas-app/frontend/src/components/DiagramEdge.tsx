import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
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
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const threatCount = (data?.threatCount as number) ?? 0;
  const mitigationCount = (data?.mitigationCount as number) ?? 0;
  const hasCountBadges = threatCount > 0 || mitigationCount > 0;
  const edgeLabel = (label as string) || (data?.label as string) || '';

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
      {(edgeLabel || hasCountBadges) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan flex flex-col items-center gap-0.5"
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
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(DiagramEdge);
