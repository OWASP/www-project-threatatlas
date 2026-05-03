import { AlertTriangle, Shield, CheckCircle2, X, Plus, Tag, Trash2, Layers, Lightbulb, BarChart2 } from 'lucide-react';

const ELEMENT_TYPE_LABELS: Record<string, string> = {
  process: 'Process',
  datastore: 'Data Store',
  data_store: 'Data Store',
  external: 'External Entity',
  external_entity: 'External Entity',
  boundary: 'Trust Boundary',
  trust_boundary: 'Trust Boundary',
  edge: 'Data Flow',
  data_flow: 'Data Flow',
  dataflow: 'Data Flow',
  unknown: 'Element',
};
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Proposal } from '@/hooks/useAIChat';

interface AIProposalCardProps {
  proposal: Proposal;
  messageId: number;
  onApprove: (messageId: number, proposalId: string) => void;
  onDismiss: (messageId: number, proposalId: string) => void;
}

export default function AIProposalCard({ proposal, messageId, onApprove, onDismiss }: AIProposalCardProps) {
  const isRemoval = proposal.type === 'remove_threat' || proposal.type === 'remove_mitigation';
  const isThreat = proposal.type === 'threat';
  const isCreateModel = proposal.type === 'create_model';
  const isKbSuggestion = proposal.type === 'suggest_kb_threat' || proposal.type === 'suggest_kb_mitigation';
  const isKbThreatSuggestion = proposal.type === 'suggest_kb_threat';
  const isRiskUpdate = proposal.type === 'update_risk';
  const isApproved = proposal.status === 'approved';
  const isDismissed = proposal.status === 'dismissed';
  const isPending = proposal.status === 'pending';

  const getColors = () => {
    if (isRiskUpdate) return {
      border: 'border-[color-mix(in_srgb,var(--slushie-800)_25%,transparent)]',
      bg: { backgroundColor: 'color-mix(in srgb, var(--slushie-500) 4%, transparent)' },
      hdrStyle: { borderColor: 'color-mix(in srgb, var(--slushie-800) 15%, transparent)', backgroundColor: 'color-mix(in srgb, var(--slushie-500) 6%, transparent)' },
      iconColor: { color: 'var(--slushie-800)' },
      labelColor: { color: 'var(--slushie-800)' },
    };
    if (isCreateModel) return {
      border: 'border-[color-mix(in_srgb,var(--primary)_25%,transparent)]',
      bg: { backgroundColor: 'color-mix(in srgb, var(--primary) 4%, transparent)' },
      hdrStyle: { borderColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', backgroundColor: 'color-mix(in srgb, var(--primary) 6%, transparent)' },
      iconColor: { color: 'var(--primary)' },
      labelColor: { color: 'var(--primary)' },
    };
    if (isKbSuggestion) return {
      border: 'border-[color-mix(in_srgb,var(--lemon-500)_35%,transparent)]',
      bg: { backgroundColor: 'color-mix(in srgb, var(--lemon-500) 4%, transparent)' },
      hdrStyle: { borderColor: 'color-mix(in srgb, var(--lemon-500) 20%, transparent)', backgroundColor: 'color-mix(in srgb, var(--lemon-500) 6%, transparent)' },
      iconColor: { color: 'var(--risk-medium)' },
      labelColor: { color: 'var(--risk-medium)' },
    };
    if (isRemoval) return {
      border: 'border-[color-mix(in_srgb,var(--element-removal)_25%,transparent)]',
      bg: { backgroundColor: 'color-mix(in srgb, var(--element-removal) 4%, transparent)' },
      hdrStyle: { borderColor: 'color-mix(in srgb, var(--element-removal) 15%, transparent)', backgroundColor: 'color-mix(in srgb, var(--element-removal) 6%, transparent)' },
      iconColor: { color: 'var(--element-removal)' },
      labelColor: { color: 'var(--element-removal)' },
    };
    if (isThreat) return {
      border: 'border-destructive/20',
      bg: { backgroundColor: 'color-mix(in srgb, var(--element-threat) 4%, transparent)' },
      hdrStyle: { borderColor: 'color-mix(in srgb, var(--element-threat) 15%, transparent)', backgroundColor: 'color-mix(in srgb, var(--element-threat) 6%, transparent)' },
      iconColor: { color: 'var(--element-threat)' },
      labelColor: { color: 'var(--element-threat)' },
    };
    return {
      border: 'border-[color-mix(in_srgb,var(--element-mitigation)_25%,transparent)]',
      bg: { backgroundColor: 'color-mix(in srgb, var(--element-mitigation) 4%, transparent)' },
      hdrStyle: { borderColor: 'color-mix(in srgb, var(--element-mitigation) 15%, transparent)', backgroundColor: 'color-mix(in srgb, var(--element-mitigation) 6%, transparent)' },
      iconColor: { color: 'var(--element-mitigation)' },
      labelColor: { color: 'var(--element-mitigation)' },
    };
  };

  const colors = getColors();
  const borderColor = colors.border;
  const bgColor = colors.bg;
  const iconColor = colors.iconColor;
  const labelColor = colors.labelColor;
  const hdrStyle = colors.hdrStyle;
  const typeLabel = isRiskUpdate
    ? 'Risk Assessment'
    : isCreateModel
      ? 'Create Threat Model'
      : isKbSuggestion
        ? (isKbThreatSuggestion ? 'AI Suggestion — New Threat' : 'AI Suggestion — New Mitigation')
        : isRemoval
          ? (proposal.type === 'remove_threat' ? 'Remove Threat' : 'Remove Mitigation')
          : isThreat ? 'Threat Proposal' : 'Mitigation Proposal';

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      borderColor,
      isDismissed && 'opacity-40 grayscale',
      isPending && 'hover:shadow-sm',
    )}
    style={bgColor}>
      {/* Type bar */}
      <div className="flex items-center gap-2 px-3.5 py-2 rounded-t-xl border-b" style={{ ...hdrStyle, borderBottomWidth: '1px', borderBottomStyle: 'solid' }}>
        {isRiskUpdate
          ? <BarChart2 className="h-3.5 w-3.5 shrink-0" style={iconColor} />
          : isCreateModel
            ? <Layers className="h-3.5 w-3.5 shrink-0" style={iconColor} />
            : isKbSuggestion
              ? <Lightbulb className="h-3.5 w-3.5 shrink-0" style={iconColor} />
              : isRemoval
                ? <Trash2 className="h-3.5 w-3.5 shrink-0" style={iconColor} />
                : isThreat
                  ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={iconColor} />
                  : <Shield className="h-3.5 w-3.5 shrink-0" style={iconColor} />
        }
        <span className="text-xs font-semibold" style={labelColor}>{typeLabel}</span>
        {isKbSuggestion && (
          <Badge className="ml-auto text-[10px] h-4 px-1.5 font-semibold" style={{ backgroundColor: 'color-mix(in srgb, var(--lemon-500) 20%, transparent)', color: 'var(--risk-medium)', border: '1px solid color-mix(in srgb, var(--lemon-500) 35%, transparent)' }}>
            Adds to KB
          </Badge>
        )}
        {!isKbSuggestion && proposal.framework_name && (
          <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5 font-normal gap-1">
            <Tag className="h-2.5 w-2.5" />
            {proposal.framework_name}
          </Badge>
        )}
        {!isKbSuggestion && !proposal.framework_name && proposal.category && (
          <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5 font-normal gap-1">
            <Tag className="h-2.5 w-2.5" />
            {proposal.category}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="px-3.5 py-3 space-y-2">
        {/* Risk update: dedicated layout showing threat + element + score visually */}
        {isRiskUpdate ? (
          <div className="space-y-2.5">
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Threat</p>
              <p className="text-sm font-semibold leading-snug">{proposal.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Element</p>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">
                  {proposal.element_label || proposal.element_id}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {ELEMENT_TYPE_LABELS[proposal.element_type] ?? proposal.element_type}
                </span>
              </div>
            </div>
            {proposal.likelihood && proposal.impact && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Risk Score</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Likelihood <strong className="text-foreground">{proposal.likelihood}</strong>/5</span>
                  <span className="text-muted-foreground/40">×</span>
                  <span className="text-xs text-muted-foreground">Impact <strong className="text-foreground">{proposal.impact}</strong>/5</span>
                  <span className="text-muted-foreground/40">=</span>
                  <Badge variant="outline" className={`text-xs px-2 py-0.5 font-bold capitalize severity-${proposal.severity}`}>
                    {proposal.risk_score} · {proposal.severity}
                  </Badge>
                </div>
              </div>
            )}
            {proposal.reasoning && (
              <p className="text-[11px] text-muted-foreground/80 italic leading-relaxed border-l-2 border-muted pl-2">
                {proposal.reasoning}
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm font-medium leading-snug">{proposal.name}</p>
            {proposal.description && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {proposal.description}
              </p>
            )}
            {proposal.reasoning && (
              <div className="flex gap-1.5 pt-0.5">
                <div className="mt-0.5 h-3 w-0.5 rounded-full bg-primary/40 shrink-0" />
                <p className="text-[11px] text-muted-foreground/80 italic leading-relaxed">
                  {proposal.reasoning}
                </p>
              </div>
            )}
            {!isCreateModel && (
              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                  {proposal.element_label || proposal.element_id}
                </Badge>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                  {ELEMENT_TYPE_LABELS[proposal.element_type] ?? proposal.element_type}
                </Badge>
                {(isThreat || isKbThreatSuggestion) && proposal.severity && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] h-4 px-1.5 font-semibold capitalize severity-${proposal.severity}`}
                  >
                    {proposal.severity}
                    {proposal.likelihood && proposal.impact ? ` · ${proposal.likelihood}×${proposal.impact}` : ''}
                  </Badge>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      {isPending && (
        <div className="flex items-center gap-2 px-3.5 pb-3">
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5 rounded-lg flex-1 text-white"
            style={isRemoval ? { backgroundColor: 'var(--element-removal)' } : {}}
            onClick={() => onApprove(messageId, proposal.id)}
          >
            {isRiskUpdate ? <BarChart2 className="h-3 w-3" /> : isCreateModel ? <Layers className="h-3 w-3" /> : isKbSuggestion ? <Lightbulb className="h-3 w-3" /> : isRemoval ? <Trash2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {isRiskUpdate ? 'Apply Risk Score' : isCreateModel ? 'Create Model' : isKbSuggestion ? 'Add to KB & Apply' : isRemoval ? 'Remove from Diagram' : 'Add to Diagram'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 rounded-lg text-muted-foreground hover:text-destructive"
            onClick={() => onDismiss(messageId, proposal.id)}
          >
            <X className="h-3 w-3" />
            Dismiss
          </Button>
        </div>
      )}

      {isApproved && (
        <div className="flex items-center gap-1.5 px-3.5 pb-3 text-xs font-medium" style={labelColor}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isRiskUpdate ? 'Risk score applied' : isCreateModel ? 'Threat model created' : isKbSuggestion ? 'Added to KB & diagram' : isRemoval ? 'Removed from diagram' : 'Added to diagram'}
        </div>
      )}

      {isDismissed && (
        <div className="flex items-center gap-1.5 px-3.5 pb-3 text-xs text-muted-foreground/60">
          <X className="h-3.5 w-3.5" />
          Dismissed
        </div>
      )}
    </div>
  );
}
