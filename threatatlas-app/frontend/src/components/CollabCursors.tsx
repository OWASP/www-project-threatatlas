import { useReactFlow } from '@xyflow/react';
import type { CollabCursor } from '@/hooks/useCollaboration';

interface CollabCursorsProps {
  cursors: CollabCursor[];
}

export function CollabCursors({ cursors }: CollabCursorsProps) {
  const { flowToScreenPosition } = useReactFlow();

  if (cursors.length === 0) return null;

  return (
    <>
      {cursors.map((cursor) => {
        const { x, y } = flowToScreenPosition({ x: cursor.x, y: cursor.y });
        return (
          <div
            key={cursor.user_id}
            className="pointer-events-none absolute z-50"
            style={{ left: x, top: y, transform: 'translate(0, 0)' }}
          >
            {/* Cursor SVG arrow */}
            <svg
              width="18"
              height="22"
              viewBox="0 0 18 22"
              fill="none"
              style={{ filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.35))` }}
            >
              <path
                d="M1 1L1 17L5.5 13L8.5 21L10.5 20.5L7.5 12.5L14 12.5L1 1Z"
                fill={cursor.color}
                stroke="white"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
            {/* Username label */}
            <div
              className="absolute left-4 top-3 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.user_name}
            </div>
          </div>
        );
      })}
    </>
  );
}
