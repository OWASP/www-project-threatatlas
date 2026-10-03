import { ArrowRight, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getSeverity, getSeverityClasses, getSeverityColor, getSeverityVariant } from '@/lib/risk';
import { cn } from '@/lib/utils';

interface RiskSummaryProps {
  inherentScore: number | null;
  residualScore: number | null;
}

function ScoreCard({ label, hint, score }: { label: string; hint: string; score: number | null }) {
  const severity = score != null ? getSeverity(score) : null;
  const color = getSeverityColor(severity);
  return (
    <div
      className="relative flex-1 min-w-0 overflow-hidden rounded-xl border px-4 py-3.5"
      style={severity ? { backgroundColor: `color-mix(in srgb, ${color} 7%, transparent)`, borderColor: `color-mix(in srgb, ${color} 30%, transparent)` } : undefined}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        {score != null ? (
          <span className="text-3xl font-bold leading-none tabular-nums" style={{ color }}>{score}</span>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">Not assessed</span>
        )}
        {severity && (
          <Badge variant={getSeverityVariant(severity)} className={cn('capitalize', getSeverityClasses(severity))}>
            {severity}
          </Badge>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function RiskSummary({ inherentScore, residualScore }: RiskSummaryProps) {
  const delta = inherentScore != null && residualScore != null ? residualScore - inherentScore : null;
  const pct = delta != null && inherentScore ? Math.round((Math.abs(delta) / inherentScore) * 100) : null;
  const DeltaIcon = delta == null ? ArrowRight : delta < 0 ? ArrowDown : delta > 0 ? ArrowUp : Minus;

  return (
    <section aria-label="Risk summary" className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <ScoreCard label="Inherent risk" hint="Before mitigations" score={inherentScore} />
        <div className="flex shrink-0 flex-row items-center justify-center gap-1.5 sm:flex-col sm:gap-1 text-muted-foreground">
          <DeltaIcon
            className={cn('h-5 w-5', delta != null && delta < 0 && 'text-success', delta != null && delta > 0 && 'text-destructive')}
            aria-hidden
          />
          {delta != null && (
            <span className={cn('text-[11px] font-semibold tabular-nums', delta < 0 && 'text-success', delta > 0 && 'text-destructive')}>
              {delta === 0 ? 'No change' : `${delta < 0 ? '−' : '+'}${Math.abs(delta)}${pct != null ? ` (${pct}%)` : ''}`}
            </span>
          )}
        </div>
        <ScoreCard label="Residual risk" hint="After controls" score={residualScore} />
      </div>
    </section>
  );
}
