import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';

interface RiskSelectorProps {
  likelihood: number | null;
  impact: number | null;
  onLikelihoodChange: (value: number) => void;
  onImpactChange: (value: number) => void;
}

const likelihoodLabels: Record<number, string> = {
  1: 'Rare',
  2: 'Unlikely',
  3: 'Possible',
  4: 'Likely',
  5: 'Certain',
};

const impactLabels: Record<number, string> = {
  1: 'Negligible',
  2: 'Minor',
  3: 'Moderate',
  4: 'Major',
  5: 'Severe',
};

interface SliderRowProps {
  label: string;
  value: number | null;
  stepLabels: Record<number, string>;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}

function SliderRow({ label, value, stepLabels, onChange, onCommit }: SliderRowProps) {
  // Local state so dragging doesn't bubble up API calls on every tick
  const [local, setLocal] = useState<number>(value ?? 1);

  // Sync when parent changes (e.g. different item selected)
  useEffect(() => {
    setLocal(value ?? 1);
  }, [value]);

  const isSet = value !== null;

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">{label}</span>
        {isSet ? (
          <span className="text-xs font-semibold tabular-nums">
            {local} — {stepLabels[local]}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">Not set</span>
        )}
      </div>

      {/* Slider */}
      <Slider
        min={1}
        max={5}
        step={1}
        value={[local]}
        onValueChange={([v]) => {
          setLocal(v);
          onChange(v);
        }}
        onValueCommit={([v]) => onCommit(v)}
        className={!isSet ? 'opacity-50' : ''}
      />

      {/* Tick labels for all 5 positions */}
      <div className="grid grid-cols-5 text-[10px] text-muted-foreground select-none px-[5px]">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={
              n === 1 ? 'text-left' :
              n === 5 ? 'text-right' :
              'text-center'
            }
          >
            {stepLabels[n]}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RiskSelector({ likelihood, impact, onLikelihoodChange, onImpactChange }: RiskSelectorProps) {
  const [localLikelihood, setLocalLikelihood] = useState<number>(likelihood ?? 1);
  const [localImpact, setLocalImpact] = useState<number>(impact ?? 1);

  // Keep locals in sync when the parent item changes (e.g. another threat selected)
  useEffect(() => {
    setLocalLikelihood(likelihood ?? 1);
    setLocalImpact(impact ?? 1);
  }, [likelihood, impact]);

  return (
    <div className="space-y-5">
      <SliderRow
        label="Likelihood"
        value={likelihood}
        stepLabels={likelihoodLabels}
        onChange={setLocalLikelihood}
        onCommit={onLikelihoodChange}
      />
      <SliderRow
        label="Impact"
        value={impact}
        stepLabels={impactLabels}
        onChange={setLocalImpact}
        onCommit={onImpactChange}
      />
    </div>
  );
}
