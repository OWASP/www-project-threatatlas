import { memo } from 'react';
import { Handle, Position, type NodeProps, NodeResizer } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  Database,
  Cpu,
  Users,
  Box as BoxIcon,
  Cloud,
  Router,
  MessagesSquare,
  User,
  Smartphone,
  Radio,
} from 'lucide-react';

function NodeCountBadges({ t, m }: { t: number; m: number }) {
  if (t === 0 && m === 0) return null;
  return (
    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none whitespace-nowrap">
      {t > 0 && (
        <span className="inline-flex items-center text-[9px] font-bold leading-none px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/25">
          T{t}
        </span>
      )}
      {m > 0 && (
        <span className="inline-flex items-center text-[9px] font-bold leading-none px-1.5 py-0.5 rounded-full border" style={{
          backgroundColor: 'color-mix(in srgb, var(--element-mitigation) 15%, transparent)',
          color: 'var(--element-mitigation)',
          borderColor: 'color-mix(in srgb, var(--element-mitigation) 25%, transparent)'
        }}>
          M{m}
        </span>
      )}
    </div>
  );
}

interface NodeStyle {
  icon: React.ComponentType<any>;
  bg: React.CSSProperties;
  border: string;
  borderColor: string;
  lineColor: string;
  iconColor: React.CSSProperties;
  textColor: React.CSSProperties;
  shape: 'circle' | 'parallel' | 'rectangle' | 'dashed';
}

const getNodeStyles = (type: string): NodeStyle => {
  // Helper for the extended node types - uses plain hex colors since the
  // CSS-variable theme doesn't yet define entries for cloud/queue/etc.
  const fixed = (
    icon: React.ComponentType<any>,
    color: string,
    shape: NodeStyle['shape'],
  ): NodeStyle => ({
    icon,
    bg: { backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)` },
    border: '',
    borderColor: color,
    lineColor: color,
    iconColor: { color },
    textColor: { color: 'var(--foreground)' },
    shape,
  });

  const baseStyle: Record<string, NodeStyle> = {
    process: {
      icon: Cpu,
      bg: { backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)' },
      border: 'border-primary/70',
      borderColor: 'var(--primary)',
      lineColor: 'var(--primary)',
      iconColor: { color: 'var(--primary)' },
      textColor: { color: 'var(--foreground)' },
      shape: 'circle',
    },
    datastore: {
      icon: Database,
      bg: { backgroundColor: 'color-mix(in srgb, var(--element-datastore) 8%, transparent)' },
      border: 'border-[color:var(--element-datastore)]',
      borderColor: 'var(--element-datastore)',
      lineColor: 'var(--element-datastore)',
      iconColor: { color: 'var(--element-datastore)' },
      textColor: { color: 'var(--lemon-800)' },
      shape: 'parallel',
    },
    external: {
      icon: Users,
      bg: { backgroundColor: 'color-mix(in srgb, var(--element-external) 8%, transparent)' },
      border: 'border-[color:var(--element-external)]',
      borderColor: 'var(--element-external)',
      lineColor: 'var(--element-external)',
      iconColor: { color: 'var(--element-external)' },
      textColor: { color: 'var(--ube-900)' },
      shape: 'rectangle',
    },
    boundary: {
      icon: BoxIcon,
      bg: { backgroundColor: 'color-mix(in srgb, var(--element-boundary) 8%, transparent)' },
      border: 'border-[color:var(--element-boundary)]',
      borderColor: 'var(--element-boundary)',
      lineColor: 'var(--element-boundary)',
      iconColor: { color: 'var(--element-boundary)' },
      textColor: { color: 'var(--clay-text-tertiary)' },
      shape: 'dashed',
    },
    // Extended node types
    cloud:      fixed(Cloud,           '#0ea5e9', 'rectangle'),
    apigateway: fixed(Router,          '#6366f1', 'rectangle'),
    queue:      fixed(MessagesSquare,  '#a855f7', 'parallel'),
    actor:      fixed(User,            '#f43f5e', 'circle'),
    mobile:     fixed(Smartphone,      '#10b981', 'rectangle'),
    iot:        fixed(Radio,           '#f97316', 'rectangle'),
  };
  return baseStyle[type] || baseStyle.process;
};

function DiagramNode({ data, selected }: NodeProps) {
  const nodeType = (data.type as string) || 'process';
  const style = getNodeStyles(nodeType);
  const Icon = style.icon;
  const threatCount = (data.threatCount as number) || 0;
  const mitigationCount = (data.mitigationCount as number) || 0;

  // Process - Circle (DFD standard)
  if (style.shape === 'circle') {
    return (
      <div className="relative">
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          className="!bg-primary !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Top}
          id="source-top"
          className="!bg-primary !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="target"
          position={Position.Right}
          id="target-right"
          className="!bg-primary !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className="!bg-primary !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="target-bottom"
          className="!bg-primary !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className="!bg-primary !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="!bg-primary !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="source-left"
          className="!bg-primary !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <div className="relative">
          <div
            className={cn(
              'flex flex-col items-center justify-center rounded-full border-2 shadow-lg transition-all duration-200',
              'w-24 h-24 p-3',
              style.border,
              selected && 'ring-2 ring-primary/60 ring-offset-2 shadow-xl scale-110'
            )}
            style={style.bg as React.CSSProperties}
          >
            <Icon className="h-5 w-5 mb-1" style={style.iconColor as React.CSSProperties} />
            <div className="font-medium text-xs text-center leading-tight" style={style.textColor as React.CSSProperties}>
              {data.label as string}
            </div>
          </div>
          <NodeCountBadges t={threatCount} m={mitigationCount} />
        </div>
      </div>
    );
  }

  // Data Store - Parallel lines (DFD standard)
  if (style.shape === 'parallel') {
    return (
      <div className="relative">
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          className="!bg-[var(--element-datastore)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Top}
          id="source-top"
          className="!bg-[var(--element-datastore)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="target"
          position={Position.Right}
          id="target-right"
          className="!bg-[var(--element-datastore)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className="!bg-[var(--element-datastore)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="target-bottom"
          className="!bg-[var(--element-datastore)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className="!bg-[var(--element-datastore)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="!bg-[var(--element-datastore)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="source-left"
          className="!bg-[var(--element-datastore)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <div className={cn('relative transition-all duration-200', selected && 'scale-105')}>
          {/* Top line */}
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: style.lineColor }} />
          {/* Content */}
          <div
            className="px-4 py-3 min-w-[140px]"
            style={{
              ...style.bg,
              ...(selected && {
                outline: '2px solid var(--element-datastore)',
                outlineOffset: '2px'
              })
            }}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" style={style.iconColor} />
              <div className="font-medium text-sm" style={style.textColor}>
                {data.label as string}
              </div>
            </div>
          </div>
          {/* Bottom line */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: style.lineColor }} />
          <NodeCountBadges t={threatCount} m={mitigationCount} />
        </div>
      </div>
    );
  }

  // External Entity - Rectangle (DFD standard)
  if (style.shape === 'rectangle') {
    return (
      <div className="relative">
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          className="!bg-[var(--element-external)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Top}
          id="source-top"
          className="!bg-[var(--element-external)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="target"
          position={Position.Right}
          id="target-right"
          className="!bg-[var(--element-external)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className="!bg-[var(--element-external)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="target-bottom"
          className="!bg-[var(--element-external)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className="!bg-[var(--element-external)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="!bg-[var(--element-external)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="source-left"
          className="!bg-[var(--element-external)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <div className="relative">
          <div
            className={cn(
              'px-4 py-3 border-2 shadow-lg transition-all duration-200 min-w-[120px]',
              selected && 'ring-2 ring-[color:var(--element-external)] ring-offset-2 shadow-xl scale-105'
            )}
            style={{
              ...style.bg,
              borderColor: style.borderColor,
            }}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" style={style.iconColor} />
              <div className="font-medium text-sm" style={style.textColor}>
                {data.label as string}
              </div>
            </div>
          </div>
          <NodeCountBadges t={threatCount} m={mitigationCount} />
        </div>
      </div>
    );
  }

  // Trust Boundary - Dashed rectangle (resizable)
  if (style.shape === 'dashed') {
    return (
      <div className="relative w-full h-full">
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          className="!bg-[var(--element-boundary)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Top}
          id="source-top"
          className="!bg-[var(--element-boundary)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="target"
          position={Position.Right}
          id="target-right"
          className="!bg-[var(--element-boundary)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className="!bg-[var(--element-boundary)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="target-bottom"
          className="!bg-[var(--element-boundary)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className="!bg-[var(--element-boundary)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="!bg-[var(--element-boundary)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="source-left"
          className="!bg-[var(--element-boundary)] !w-2 !h-2 !border-2 !border-white dark:!border-background"
        />
        <div
          className={cn(
            'w-full h-full border-2 border-dashed rounded-lg transition-all duration-200 p-4',
            selected && 'ring-2 ring-stone-400 ring-offset-2'
          )}
          style={{
            ...style.bg,
            minWidth: '200px',
            minHeight: '150px',
            borderColor: style.borderColor,
          }}
        >
          <div className="flex items-start gap-2 absolute top-2 left-2">
            <Icon className="h-4 w-4" style={style.iconColor} />
            <div className="font-medium text-xs" style={style.textColor}>
              {data.label as string}
            </div>
          </div>
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            {(threatCount > 0 || mitigationCount > 0) && (
              <div className="flex gap-1">
                {threatCount > 0 && (
                  <span className="inline-flex items-center text-[9px] font-bold leading-none px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/25">
                    T{threatCount}
                  </span>
                )}
                {mitigationCount > 0 && (
                  <span className="inline-flex items-center text-[9px] font-bold leading-none px-1.5 py-0.5 rounded-full border" style={{
                    backgroundColor: 'color-mix(in srgb, var(--element-mitigation) 15%, transparent)',
                    color: 'var(--element-mitigation)',
                    borderColor: 'color-mix(in srgb, var(--element-mitigation) 25%, transparent)'
                  }}>
                    M{mitigationCount}
                  </span>
                )}
              </div>
            )}
            <span className="text-xs text-muted-foreground/50 italic">Trust Boundary</span>
          </div>
        </div>
        <NodeResizer
          minWidth={200}
          minHeight={150}
          isVisible={selected}
          lineClassName="!border-[var(--element-boundary)]"
          handleClassName="!h-3 !w-3 !bg-[var(--element-boundary)]"
        />
      </div>
    );
  }

  return null;
}

export default memo(DiagramNode);
