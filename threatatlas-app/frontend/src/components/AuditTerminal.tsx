/**
 * AuditTerminal — terminal-style audit log viewer.
 * Used in both ProductDetails (product-scoped) and Settings (global).
 */
import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { API_BASE_URL } from '@/lib/api';
import { toast } from 'sonner';
import { Search, X, RefreshCw, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AuditEvent {
  id: number;
  action: string;
  entity_type: string | null;
  entity_name: string | null;
  details: Record<string, unknown> | null;
  diagram_id: number | null;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
  product_name?: string;
}

// ── Action color + label map ──────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  threat_added:              'text-red-400',
  threat_removed:            'text-zinc-500',
  threat_status_changed:     'text-amber-400',
  threat_accepted:           'text-orange-400',
  acceptance_approved:       'text-emerald-400',
  acceptance_rejected:       'text-red-400',
  mitigation_added:          'text-green-400',
  mitigation_removed:        'text-zinc-500',
  mitigation_status_changed: 'text-cyan-400',
  diagram_created:           'text-blue-400',
  diagram_saved:             'text-zinc-400',
};

const ACTION_LABELS: Record<string, string> = {
  threat_added:              'THREAT_ADDED',
  threat_removed:            'THREAT_REMOVED',
  threat_status_changed:     'THREAT_UPDATED',
  threat_accepted:           'RISK_ACCEPTED',
  acceptance_approved:       'RISK_APPROVED',
  acceptance_rejected:       'RISK_REJECTED',
  mitigation_added:          'MITIGATION_ADDED',
  mitigation_removed:        'MITIGATION_REMOVED',
  mitigation_status_changed: 'MITIGATION_UPDATED',
  diagram_created:           'DIAGRAM_CREATED',
  diagram_saved:             'DIAGRAM_SAVED',
};

function getActionColor(action: string) { return ACTION_COLORS[action] ?? 'text-zinc-400'; }
function getActionLabel(action: string) { return ACTION_LABELS[action] ?? action.toUpperCase().replace(/_/g, '_'); }

function buildEventLine(ev: AuditEvent): string {
  const parts: string[] = [];
  if (ev.entity_name) parts.push(ev.entity_name);
  if (ev.details?.old_status && ev.details?.new_status) {
    parts.push(`${ev.details.old_status as string} → ${ev.details.new_status as string}`);
  }
  return parts.join(' · ');
}

// ── Main component ────────────────────────────────────────────────────────────

interface AuditTerminalProps {
  /** If provided, loads product-scoped audit. Otherwise loads global (admin). */
  productId?: number;
  /** Fixed height in px. Default 480. */
  height?: number;
  className?: string;
}

export default function AuditTerminal({ productId, height = 480, className }: AuditTerminalProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const LIMIT = 100;

  const fetchEvents = async (off: number) => {
    try {
      const token = localStorage.getItem('token');
      const url = productId
        ? `${API_BASE_URL}/api/audit/products/${productId}?limit=${LIMIT}&offset=${off}`
        : `${API_BASE_URL}/api/audit/global?limit=${LIMIT}&offset=${off}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`${r.status}`);
      const raw = await r.json();
      const data = Array.isArray(raw) ? raw : [];
      if (off === 0) setEvents(data);
      else setEvents(prev => [...prev, ...data]);
      setHasMore(data.length === LIMIT);
      setOffset(off + data.length);
    } catch {
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { fetchEvents(0); }, [productId]);

  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events, autoScroll]);

  const filtered = search.trim()
    ? events.filter(ev =>
        ev.action.includes(search.toLowerCase()) ||
        ev.entity_name?.toLowerCase().includes(search.toLowerCase()) ||
        ev.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        ev.user_email?.toLowerCase().includes(search.toLowerCase()) ||
        ev.product_name?.toLowerCase().includes(search.toLowerCase())
      )
    : events;

  return (
    <div className={cn('flex flex-col rounded-xl overflow-hidden border border-border/60 dark:border-zinc-800', className)}>
      {/* Terminal toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 dark:bg-zinc-900 border-b border-border/50 dark:border-zinc-800 shrink-0">
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="h-3 w-3 rounded-full bg-red-500/70" />
          <div className="h-3 w-3 rounded-full bg-amber-500/70" />
          <div className="h-3 w-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-[11px] text-muted-foreground font-mono flex-1 text-center select-none">
          {productId ? `audit • product:${productId}` : 'audit • global'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="filter…"
              className="h-6 pl-6 pr-5 text-[10px] font-mono w-32"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6"
            onClick={() => { setLoading(true); setOffset(0); fetchEvents(0); }}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <button
            onClick={() => setAutoScroll(v => !v)}
            className={cn('h-6 w-6 flex items-center justify-center rounded text-[10px] font-mono transition-colors', autoScroll ? 'text-green-600 dark:text-green-400 bg-green-500/10' : 'text-muted-foreground hover:text-foreground')}
            title="Auto-scroll"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Log body */}
      <div
        className="flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-950 font-mono text-[11px] leading-relaxed"
        style={{ height }}
      >
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-3 text-muted-foreground">
            <span className="animate-pulse">●</span>
            <span>Loading audit log…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-muted-foreground text-center">
            {search ? `No events matching "${search}"` : 'No audit events yet.'}
          </div>
        ) : (
          <>
            {/* Header line */}
            <div className="px-4 py-1.5 text-muted-foreground border-b border-border/50 dark:border-zinc-700/50 flex items-center gap-4 sticky top-0 bg-gray-50 dark:bg-zinc-950 z-10 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-36">Timestamp</span>
              <span className="w-36">Action</span>
              <span className="w-28">Actor</span>
              <span>Detail</span>
              {!productId && <span className="ml-auto">Product</span>}
            </div>

            {filtered.map((ev, i) => {
              const color = getActionColor(ev.action);
              const label = getActionLabel(ev.action);
              const detail = buildEventLine(ev);
              const actor = ev.user_name || ev.user_email || 'system';
              const ts = format(new Date(ev.created_at), 'yyyy-MM-dd HH:mm:ss');
              return (
                <div
                  key={ev.id}
                  className={cn(
                    'flex items-start gap-4 px-4 py-0.5 hover:bg-black/5 dark:hover:bg-zinc-900/60 transition-colors group',
                    i % 2 === 0 ? '' : 'bg-black/[0.02] dark:bg-zinc-900/20'
                  )}
                >
                  <span className="text-muted-foreground shrink-0 w-36">{ts}</span>
                  <span className={cn('shrink-0 w-36 font-semibold', color)}>{label}</span>
                  <span className="text-cyan-600 dark:text-cyan-500/80 shrink-0 w-28 truncate" title={actor}>{actor}</span>
                  <span className="text-foreground/80 dark:text-zinc-300 truncate flex-1" title={detail}>
                    {ev.entity_name && <span className="text-foreground dark:text-white font-medium">{ev.entity_name}</span>}
                    {detail && ev.entity_name && <span className="text-muted-foreground"> · </span>}
                    {detail.replace(ev.entity_name ?? '', '').replace(' · ', '')}
                  </span>
                  {!productId && ev.product_name && (
                    <span className="text-muted-foreground shrink-0 text-[10px] ml-2">{ev.product_name}</span>
                  )}
                </div>
              );
            })}

            {hasMore && (
              <button
                className="w-full py-2 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-zinc-900 transition-colors text-[11px]"
                disabled={loadingMore}
                onClick={() => { setLoadingMore(true); fetchEvents(offset); }}
              >
                {loadingMore ? '…loading more…' : '▼ load more'}
              </button>
            )}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-muted/60 dark:bg-zinc-900 border-t border-border/50 dark:border-zinc-800 text-[10px] text-muted-foreground font-mono shrink-0">
        <span>{filtered.length} event{filtered.length !== 1 ? 's' : ''}{search ? ' (filtered)' : ''}</span>
        <span>ThreatAtlas Audit</span>
      </div>
    </div>
  );
}
