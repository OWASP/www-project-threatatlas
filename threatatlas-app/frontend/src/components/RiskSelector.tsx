import { FieldTitle } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getSeverity, getSeverityVariant } from '@/lib/risk';

interface RiskSelectorProps {
  likelihood: number | null;
  impact: number | null;
  onLikelihoodChange: (value: number) => void;
  onImpactChange: (value: number) => void;
}

const likelihoodOptions = [
  { value: 1, label: 'Rare' },
  { value: 2, label: 'Unlikely' },
  { value: 3, label: 'Possible' },
  { value: 4, label: 'Likely' },
  { value: 5, label: 'Almost Certain' },
];

const impactOptions = [
  { value: 1, label: 'Negligible' },
  { value: 2, label: 'Minor' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'Major' },
  { value: 5, label: 'Severe' },
];

export function RiskSelector({ likelihood, impact, onLikelihoodChange, onImpactChange }: RiskSelectorProps) {
  const riskScore = likelihood && impact ? likelihood * impact : null;
  const severity = riskScore ? getSeverity(riskScore) : null;

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <FieldTitle className="flex-1">Likelihood</FieldTitle>
        <FieldTitle className="flex-1">Impact</FieldTitle>
        {riskScore && severity && <div className="flex-1" />}
      </div>
      <div className="flex gap-3">
        <Select value={likelihood?.toString() || ''} onValueChange={(v) => onLikelihoodChange(Number(v))}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select likelihood" />
          </SelectTrigger>
          <SelectContent>
            {likelihoodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.value} - {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={impact?.toString() || ''} onValueChange={(v) => onImpactChange(Number(v))}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select impact" />
          </SelectTrigger>
          <SelectContent>
            {impactOptions.map((option) => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.value} - {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {riskScore && severity && (
          <div className="flex items-center justify-center gap-3 p-1 bg-muted rounded-md flex-1">
            <span className="text-sm font-medium whitespace-nowrap">Risk Score: {riskScore}</span>
            <Badge variant={getSeverityVariant(severity)} className="capitalize">
              {severity}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
