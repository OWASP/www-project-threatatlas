import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { CollabUser } from '@/hooks/useCollaboration';

const MAX_VISIBLE = 4;

interface CollabPresenceProps {
  users: CollabUser[];
}

export function CollabPresence({ users }: CollabPresenceProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1 shrink-0">
        {visible.map((user) => (
          <Tooltip key={user.user_id}>
            <TooltipTrigger asChild>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold select-none cursor-default ring-2 ring-background"
                style={{ backgroundColor: user.color }}
              >
                {user.user_name.charAt(0).toUpperCase()}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">{user.user_name}</TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-6 h-6 rounded-full flex items-center justify-center bg-muted text-muted-foreground text-[10px] font-bold select-none cursor-default ring-2 ring-background">
                +{overflow}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {users.slice(MAX_VISIBLE).map((u) => u.user_name).join(', ')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
