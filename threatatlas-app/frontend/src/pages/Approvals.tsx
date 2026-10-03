import { useEffect, useState } from 'react';
import { approvalsApi, type ApprovalItem } from '@/lib/api';
import { toast } from 'sonner';
import { format, isPast } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ShieldCheck, ShieldX, Clock, CheckCircle2, XCircle,
  AlertTriangle, FileText, Calendar, ChevronRight, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Column skeleton ───────────────────────────────────────────────────────────

function ColumnSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <Card key={i} className="rounded-xl border-border/60 shadow-xs">
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-3 w-56" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Review state ──────────────────────────────────────────────────────────────

interface ReviewState { mode: 'idle' | 'approving' | 'rejecting'; note: string; submitting: boolean; }

// ── Single approval card ──────────────────────────────────────────────────────

function ApprovalCard({ item, onReviewed }: { item: ApprovalItem; onReviewed: () => void }) {
  const [review, setReview] = useState<ReviewState>({ mode: 'idle', note: '', submitting: false });
  const isPending = !item.acceptance_review_status;
  const [expanded, setExpanded] = useState(false);
  const open = isPending || expanded;
  const reviewDate = item.acceptance_review_date ? new Date(item.acceptance_review_date) : null;
  const isOverdue = reviewDate ? isPast(reviewDate) : false;

  async function submit(status: 'approved' | 'rejected') {
    if (status === 'rejected' && !review.note.trim()) return;
    setReview((r) => ({ ...r, submitting: true }));
    try {
      await approvalsApi.review(item.diagram_threat_id, {
        acceptance_review_status: status,
        acceptance_review_note: review.note.trim() || undefined,
      });
      toast.success(status === 'approved' ? 'Risk acceptance approved.' : 'Risk acceptance rejected.');
      onReviewed();
    } catch {
      toast.error('Failed to submit review. Please try again.');
      setReview((r) => ({ ...r, submitting: false }));
    }
  }

  return (
    <Collapsible open={open} onOpenChange={(v) => !isPending && setExpanded(v)} asChild>
    <Card className="rounded-xl border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className={open ? 'pb-3' : 'pb-4'}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--risk-high)' }} />
              <span className="font-semibold text-sm truncate">{item.threat_name}</span>
            </div>
            {item.category && (
              <div className="pl-6">
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">{item.category}</Badge>
              </div>
            )}
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground flex-wrap pl-6">
              {item.product_name && (
                <>
                  <a href={`/products/${item.product_id}`} className="hover:text-foreground transition-colors hover:underline">
                    {item.product_name}
                  </a>
                  <ChevronRight className="h-3 w-3 opacity-50" />
                </>
              )}
              {item.diagram_name && (
                <span className="font-medium text-foreground/70">{item.diagram_name}</span>
              )}
            </div>
          </div>
          {!isPending && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={open ? 'Collapse details' : 'Expand details'}>
                <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
      </CardHeader>

      <CollapsibleContent>
      <CardContent className="space-y-3 pt-0">
        {/* Justification */}
        {item.acceptance_justification && (
          <div className="rounded-lg bg-muted/40 border border-border/50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              <FileText className="h-3 w-3" />Justification
            </div>
            <p className="text-sm text-foreground/80 italic leading-relaxed">"{item.acceptance_justification}"</p>
          </div>
        )}

        {/* Meta */}
        <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          {(item.accepted_by_name || item.accepted_at) && (
            <span>
              {item.accepted_by_name && <>Accepted by <strong className="text-foreground/80">{item.accepted_by_name}</strong></>}
              {item.accepted_at && <> on <strong className="text-foreground/80">{format(new Date(item.accepted_at), 'MMM d, yyyy')}</strong></>}
            </span>
          )}
          {reviewDate && (
            <span className={cn('flex items-center gap-1', isOverdue && isPending ? 'text-destructive font-semibold' : '')}>
              <Calendar className="h-3 w-3" />
              Review by <strong>{format(reviewDate, 'MMM d, yyyy')}</strong>
              {isOverdue && isPending && (
                <span className="flex items-center gap-0.5 ml-1">
                  <AlertTriangle className="h-3 w-3" />Overdue
                </span>
              )}
            </span>
          )}
        </div>

        {/* Reviewed outcome note */}
        {!isPending && item.acceptance_review_note && (
          <div className="rounded-lg bg-muted/30 border border-border/40 px-3 py-2.5 space-y-1.5">
            {item.acceptance_reviewed_at && (
              <span className="text-[11px] text-muted-foreground block">
                Reviewed {format(new Date(item.acceptance_reviewed_at), 'MMM d, yyyy')}
              </span>
            )}
            <p className="text-sm text-muted-foreground">{item.acceptance_review_note}</p>
          </div>
        )}

        {/* Pending actions */}
        {isPending && review.mode === 'idle' && (
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm"
              onClick={() => setReview({ mode: 'approving', note: '', submitting: false })}>
              <ShieldCheck />Approve
            </Button>
            <Button size="sm" variant="destructive"
              onClick={() => setReview({ mode: 'rejecting', note: '', submitting: false })}>
              <ShieldX />Reject
            </Button>
          </div>
        )}

        {/* Approve confirmation */}
        {isPending && review.mode === 'approving' && (
          <div className="space-y-2 rounded-lg border border-success/25 bg-success/5 p-3">
            <p className="text-xs font-semibold text-success">Confirm approval</p>
            <Textarea placeholder="Optional note…" className="text-sm resize-none min-h-[60px]" rows={2}
              value={review.note} onChange={(e) => setReview((r) => ({ ...r, note: e.target.value }))} />
            <div className="flex gap-2">
              <Button size="sm"
                disabled={review.submitting} onClick={() => submit('approved')}>
                {review.submitting ? 'Approving…' : 'Confirm'}
              </Button>
              <Button size="sm" variant="ghost"
                disabled={review.submitting} onClick={() => setReview({ mode: 'idle', note: '', submitting: false })}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Reject form */}
        {isPending && review.mode === 'rejecting' && (
          <div className="space-y-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3">
            <p className="text-xs font-semibold text-destructive">Rejection note <span className="font-normal opacity-70">(required)</span></p>
            <Textarea placeholder="Explain why this acceptance is being rejected…" className="text-sm resize-none min-h-[72px]"
              rows={3} value={review.note} onChange={(e) => setReview((r) => ({ ...r, note: e.target.value }))} />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive"
                disabled={review.submitting || !review.note.trim()} onClick={() => submit('rejected')}>
                {review.submitting ? 'Rejecting…' : 'Confirm Rejection'}
              </Button>
              <Button size="sm" variant="ghost"
                disabled={review.submitting} onClick={() => setReview({ mode: 'idle', note: '', submitting: false })}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      </CollapsibleContent>
    </Card>
    </Collapsible>
  );
}

// ── Column empty state ────────────────────────────────────────────────────────

function ColumnEmpty({ column }: { column: 'pending' | 'approved' | 'rejected' }) {
  const config = {
    pending: { icon: <Clock className="h-7 w-7 text-muted-foreground/40" />, text: 'No pending items', sub: 'All caught up!' },
    approved: { icon: <CheckCircle2 className="h-7 w-7 text-muted-foreground/40" />, text: 'None approved yet', sub: 'Approved items appear here.' },
    rejected: { icon: <XCircle className="h-7 w-7 text-muted-foreground/40" />, text: 'None rejected yet', sub: 'Rejected items appear here.' },
  }[column];

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 min-h-[120px]">
      {config.icon}
      <p className="text-sm font-medium text-muted-foreground">{config.text}</p>
      <p className="text-xs text-muted-foreground/60">{config.sub}</p>
    </div>
  );
}

// ── Column header ─────────────────────────────────────────────────────────────

interface ColumnConfig {
  key: 'pending' | 'approved' | 'rejected';
  label: string;
  headerBg: string;
  dotColor: string;
  countBg: string;
  countText: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    key: 'pending',
    label: 'Pending Review',
    headerBg: 'bg-card',
    dotColor: 'bg-warning',
    countBg: 'bg-secondary',
    countText: 'text-secondary-foreground',
  },
  {
    key: 'approved',
    label: 'Approved',
    headerBg: 'bg-card',
    dotColor: 'bg-success',
    countBg: 'bg-secondary',
    countText: 'text-secondary-foreground',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    headerBg: 'bg-card',
    dotColor: 'bg-destructive/70',
    countBg: 'bg-secondary',
    countText: 'text-secondary-foreground',
  },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Approvals() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await approvalsApi.listMine();
      setItems(res.data);
    } catch {
      toast.error('Failed to load approvals.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const pending = items.filter((i) => !i.acceptance_review_status);
  const approved = items.filter((i) => i.acceptance_review_status === 'approved');
  const rejected = items.filter((i) => i.acceptance_review_status === 'rejected');
  const overdueCount = pending.filter(i => i.acceptance_review_date && isPast(new Date(i.acceptance_review_date))).length;

  const columnItems: Record<string, ApprovalItem[]> = { pending, approved, rejected };

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:p-8">

      {/* ── KPI strip ── */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Pending Review', value: pending.length, sub: pending.length > 0 ? 'Awaiting your decision' : 'All caught up', icon: Clock, iconColor: 'var(--warning)' },
            { label: 'Overdue', value: overdueCount, sub: overdueCount > 0 ? 'Past review date' : 'None overdue', icon: AlertTriangle, iconColor: 'var(--risk-critical)' },
            { label: 'Reviewed', value: approved.length + rejected.length, sub: `${approved.length} approved · ${rejected.length} rejected`, icon: CheckCircle2, iconColor: 'var(--success)' },
          ].map(({ label, value, sub, icon: Icon, iconColor }) => (
            <Card key={label} className="rounded-xl shadow-sm bg-card">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
                  <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
                </div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Kanban — 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {COLUMNS.map((col) => (
          <div key={col.key} className="flex flex-col gap-3">

            {/* Column header card */}
            <div className={cn(
              'flex items-center justify-between px-4 py-3 rounded-xl border border-border/60 shadow-sm',
              col.headerBg,
            )}>
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full shrink-0', col.dotColor)} />
                <h2 className="text-sm font-semibold">{col.label}</h2>
              </div>
              {!loading && (
                <span className={cn(
                  'inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold',
                  col.countBg, col.countText,
                )}>
                  {columnItems[col.key].length}
                </span>
              )}
            </div>

            {/* Cards */}
            {loading
              ? <ColumnSkeleton />
              : columnItems[col.key].length === 0
                ? <ColumnEmpty column={col.key} />
                : (
                  <div className="space-y-3">
                    {columnItems[col.key].map(item => (
                      <ApprovalCard key={item.id} item={item} onReviewed={load} />
                    ))}
                  </div>
                )
            }
          </div>
        ))}
      </div>
    </div>
  );
}
