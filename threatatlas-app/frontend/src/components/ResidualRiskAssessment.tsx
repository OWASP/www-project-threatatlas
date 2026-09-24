import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RiskSelector } from '@/components/RiskSelector';
import { getSeverity, getSeverityClasses, getSeverityVariant } from '@/lib/risk';
import { cn } from '@/lib/utils';

interface ResidualRiskValues {
  residual_likelihood: number | null;
  residual_impact: number | null;
  residual_comments: string | null;
}

interface ResidualRiskAssessmentProps extends ResidualRiskValues {
  itemId: number;
  inherentComplete: boolean;
  disabled?: boolean;
  onSave: (values: ResidualRiskValues) => void | Promise<void>;
}

export function ResidualRiskAssessment({
  itemId,
  inherentComplete,
  residual_likelihood,
  residual_impact,
  residual_comments,
  disabled = false,
  onSave,
}: ResidualRiskAssessmentProps) {
  const [likelihood, setLikelihood] = useState<number | null>(residual_likelihood);
  const [impact, setImpact] = useState<number | null>(residual_impact);
  const [comments, setComments] = useState(residual_comments ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLikelihood(residual_likelihood);
    setImpact(residual_impact);
    setComments(residual_comments ?? '');
  }, [itemId, residual_likelihood, residual_impact, residual_comments]);

  const score = likelihood != null && impact != null ? likelihood * impact : null;
  const severity = score != null ? getSeverity(score) : null;
  const changed = likelihood !== residual_likelihood
    || impact !== residual_impact
    || comments !== (residual_comments ?? '');
  const canSave = inherentComplete
    && likelihood != null
    && impact != null
    && comments.trim().length > 0
    && changed
    && !disabled
    && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        residual_likelihood: likelihood,
        residual_impact: impact,
        residual_comments: comments.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (disabled || saving) return;
    setSaving(true);
    try {
      await onSave({ residual_likelihood: null, residual_impact: null, residual_comments: null });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Residual risk</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Reassess after controls are implemented. Changing the inherent baseline clears this assessment; mitigation status never changes scores automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {severity && <Badge variant={getSeverityVariant(severity)} className={cn('capitalize', getSeverityClasses(severity))}>{severity}</Badge>}
          <span className="text-sm font-bold tabular-nums">{score ?? 'Not assessed'}</span>
        </div>
      </div>

      {!inherentComplete && (
        <p className="text-xs text-muted-foreground">Set inherent likelihood and impact first.</p>
      )}

      <RiskSelector
        likelihood={likelihood}
        impact={impact}
        onLikelihoodChange={setLikelihood}
        onImpactChange={setImpact}
        disabled={disabled || !inherentComplete || saving}
      />

      <div className="space-y-2">
        <label htmlFor={`residual-rationale-${itemId}`} className="text-xs font-semibold text-muted-foreground">
          Rationale (required)
        </label>
        <Textarea
          id={`residual-rationale-${itemId}`}
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          placeholder="Why has the likelihood or impact changed after these controls?"
          maxLength={2000}
          rows={3}
          disabled={disabled || !inherentComplete || saving}
        />
      </div>

      <div className="flex justify-end gap-2">
        {(residual_likelihood != null || residual_impact != null || residual_comments) && (
          <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={disabled || saving}>
            Clear assessment
          </Button>
        )}
        <Button type="button" size="sm" onClick={() => void save()} disabled={!canSave}>
          {saving ? 'Saving…' : 'Save residual assessment'}
        </Button>
      </div>
    </section>
  );
}
