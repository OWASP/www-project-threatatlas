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

const nodeStyles = {
  process: {
    icon: Cpu,
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    border: 'border-blue-500',
    iconColor: 'text-blue-600 dark:text-blue-400',
    textColor: 'text-blue-900 dark:text-blue-100',
    shape: 'circle',
  },
  datastore: {
    icon: Database,
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    border: 'border-amber-500',
    iconColor: 'text-amber-600 dark:text-amber-400',
    textColor: 'text-amber-900 dark:text-amber-100',
    shape: 'parallel',
  },
  external: {
    icon: Users,
    bg: 'bg-pink-50 dark:bg-pink-950/50',
    border: 'border-pink-500',
    iconColor: 'text-pink-600 dark:text-pink-400',
    textColor: 'text-pink-900 dark:text-pink-100',
    shape: 'rectangle',
  },
  boundary: {
    icon: BoxIcon,
    bg: 'bg-slate-50 dark:bg-slate-900/50',
    border: 'border-slate-400',
    iconColor: 'text-slate-600 dark:text-slate-400',
    textColor: 'text-slate-900 dark:text-slate-100',
    shape: 'dashed',
  },
  cloud: {
    icon: Cloud,
    bg: 'bg-sky-50 dark:bg-sky-950/50',
    border: 'border-sky-500',
    iconColor: 'text-sky-600 dark:text-sky-400',
    textColor: 'text-sky-900 dark:text-sky-100',
    shape: 'rectangle',
  },
  apigateway: {
    icon: Router,
    bg: 'bg-indigo-50 dark:bg-indigo-950/50',
    border: 'border-indigo-500',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    textColor: 'text-indigo-900 dark:text-indigo-100',
    shape: 'rectangle',
  },
  queue: {
    icon: MessagesSquare,
    bg: 'bg-purple-50 dark:bg-purple-950/50',
    border: 'border-purple-500',
    iconColor: 'text-purple-600 dark:text-purple-400',
    textColor: 'text-purple-900 dark:text-purple-100',
    shape: 'parallel',
  },
  actor: {
    icon: User,
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    border: 'border-rose-500',
    iconColor: 'text-rose-600 dark:text-rose-400',
    textColor: 'text-rose-900 dark:text-rose-100',
    shape: 'circle',
  },
  mobile: {
    icon: Smartphone,
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    border: 'border-emerald-500',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    textColor: 'text-emerald-900 dark:text-emerald-100',
    shape: 'rectangle',
  },
  iot: {
    icon: Radio,
    bg: 'bg-orange-50 dark:bg-orange-950/50',
    border: 'border-orange-500',
    iconColor: 'text-orange-600 dark:text-orange-400',
    textColor: 'text-orange-900 dark:text-orange-100',
    shape: 'rectangle',
  },
};

function DiagramNode({ data, selected }: NodeProps) {
  const nodeType = (data.type as keyof typeof nodeStyles) || 'process';
  const style = nodeStyles[nodeType];
  const Icon = style.icon;

  // Process - Circle (DFD standard)
  if (style.shape === 'circle') {
    return (
      <div className="relative">
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          className="!bg-blue-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Top}
          id="source-top"
          className="!bg-blue-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="target"
          position={Position.Right}
          id="target-right"
          className="!bg-blue-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className="!bg-blue-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="target-bottom"
          className="!bg-blue-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className="!bg-blue-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="!bg-blue-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="source-left"
          className="!bg-blue-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-full border-2 shadow-lg transition-all duration-200',
            'w-24 h-24 p-3',
            style.bg,
            style.border,
            selected && 'ring-2 ring-blue-400 ring-offset-2 shadow-xl scale-110'
          )}
        >
          <Icon className={cn('h-5 w-5 mb-1', style.iconColor)} />
          <div className={cn('font-medium text-xs text-center leading-tight', style.textColor)}>
            {data.label as string}
          </div>
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
          className="!bg-amber-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Top}
          id="source-top"
          className="!bg-amber-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="target"
          position={Position.Right}
          id="target-right"
          className="!bg-amber-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className="!bg-amber-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="target-bottom"
          className="!bg-amber-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className="!bg-amber-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="!bg-amber-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="source-left"
          className="!bg-amber-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <div className={cn('relative transition-all duration-200', selected && 'scale-105')}>
          {/* Top line */}
          <div className={cn('absolute top-0 left-0 right-0 h-0.5', style.border.replace('border-', 'bg-'))} />
          {/* Content */}
          <div
            className={cn(
              'px-4 py-3 min-w-[140px]',
              style.bg,
              selected && 'ring-2 ring-amber-400 ring-offset-2'
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className={cn('h-4 w-4', style.iconColor)} />
              <div className={cn('font-medium text-sm', style.textColor)}>
                {data.label as string}
              </div>
            </div>
          </div>
          {/* Bottom line */}
          <div className={cn('absolute bottom-0 left-0 right-0 h-0.5', style.border.replace('border-', 'bg-'))} />
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
          className="!bg-pink-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Top}
          id="source-top"
          className="!bg-pink-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="target"
          position={Position.Right}
          id="target-right"
          className="!bg-pink-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className="!bg-pink-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="target-bottom"
          className="!bg-pink-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className="!bg-pink-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="!bg-pink-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="source-left"
          className="!bg-pink-500 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <div
          className={cn(
            'px-4 py-3 border-2 shadow-lg transition-all duration-200 min-w-[120px]',
            style.bg,
            style.border,
            selected && 'ring-2 ring-pink-400 ring-offset-2 shadow-xl scale-105'
          )}
        >
          <div className="flex items-center gap-2">
            <Icon className={cn('h-4 w-4', style.iconColor)} />
            <div className={cn('font-medium text-sm', style.textColor)}>
              {data.label as string}
            </div>
          </div>
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
          className="!bg-slate-400 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Top}
          id="source-top"
          className="!bg-slate-400 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="target"
          position={Position.Right}
          id="target-right"
          className="!bg-slate-400 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className="!bg-slate-400 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="target-bottom"
          className="!bg-slate-400 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className="!bg-slate-400 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="!bg-slate-400 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="source-left"
          className="!bg-slate-400 !w-2 !h-2 !border-2 !border-white dark:!border-slate-950"
        />
        <div
          className={cn(
            'w-full h-full border-2 border-dashed rounded-lg transition-all duration-200 p-4',
            style.bg,
            style.border,
            selected && 'ring-2 ring-slate-400 ring-offset-2'
          )}
          style={{ minWidth: '200px', minHeight: '150px' }}
        >
          <div className="flex items-start gap-2 absolute top-2 left-2">
            <Icon className={cn('h-4 w-4', style.iconColor)} />
            <div className={cn('font-medium text-xs', style.textColor)}>
              {data.label as string}
            </div>
          </div>
          <div className="text-xs text-muted-foreground/50 italic absolute bottom-2 right-2">
            Trust Boundary
          </div>
        </div>
        <NodeResizer
          minWidth={200}
          minHeight={150}
          isVisible={selected}
          lineClassName="!border-slate-400"
          handleClassName="!h-3 !w-3 !bg-slate-400"
        />
      </div>
    );
  }

  return null;
}

export default memo(DiagramNode);
