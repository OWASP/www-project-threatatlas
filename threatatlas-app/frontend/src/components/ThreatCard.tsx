import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Shield, ExternalLink, MessageSquare, ChevronRight, Target } from 'lucide-react';
import { getSeverityClasses, getSeverityStripeClass, getStatusClasses } from '@/lib/risk';
import { cn } from '@/lib/utils';

interface ThreatData {
  id: number;
  status: string;
  comments: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  risk_score: number | null;
  threat: {
    name: string;
    description: string;
    category: string;
  };
}

interface MitigationData {
  id: number;
  status: string;
  comments: string;
  mitigation: {
    name: string;
    description: string;
    category?: string;
  };
}

interface ContextItem {
  icon: React.ReactNode;
  label: string;
}

interface ThreatCardProps {
  threat: ThreatData;
  linkedMitigations: MitigationData[];
  contextItems?: ContextItem[];
  index?: number;
  onOpen: () => void;
  onNavigateToDiagram?: () => void;
}

function getMitigationProgress(mitigations: MitigationData[]): number {
  if (mitigations.length === 0) return 0;
  const done = mitigations.filter(m => m.status === 'implemented' || m.status === 'verified').length;
  return Math.round((done / mitigations.length) * 100);
}

export default function ThreatCard({
  threat,
  linkedMitigations,
  contextItems,
  index = 0,
  onOpen,
  onNavigateToDiagram,
}: ThreatCardProps) {
  const mitigationProgress = getMitigationProgress(linkedMitigations);
  const hasComments = threat.comments && threat.comments !== '[]';

  const iconColor = () => {
    if (threat.status === 'mitigated') return 'text-green-600';
    if (threat.status === 'accepted') return 'text-slate-500';
    if (linkedMitigations.length === 0) return 'text-red-600';
    return 'text-amber-600';
  };

  const iconBg = () => {
    if (threat.status === 'mitigated') return 'bg-green-500/10';
    if (threat.status === 'accepted') return 'bg-slate-500/10';
    if (linkedMitigations.length === 0) return 'bg-red-500/10';
    return 'bg-amber-500/10';
  };

  return (
    <Card
      className="animate-fadeInUp hover:shadow-lg hover:border-primary/20 transition-all duration-300 rounded-xl relative overflow-hidden"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Severity stripe */}
      <div aria-hidden="true" className={cn('absolute left-0 top-0 bottom-0 w-1', getSeverityStripeClass(threat.severity))} />

      <CardContent className="p-0">
        {/* ── Threat section ── */}
        <div className="px-5 pl-6 py-1 cursor-pointer group/threat" onClick={onOpen}>
          {/* Top bar: icon + name + badges + action */}
          <div className="flex items-center gap-3 mb-2">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', iconBg())}>
              <AlertTriangle className={cn('h-4 w-4', iconColor())} />
            </div>
            <h3 className="font-bold text-sm leading-snug group-hover/threat:text-primary transition-colors flex-1 min-w-0 truncate">
              {threat.threat.name}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {threat.severity && (
                <Badge variant="outline" className={cn('capitalize text-[11px]', getSeverityClasses(threat.severity))}>
                  {threat.severity}
                </Badge>
              )}
              <Badge variant="outline" className={cn('capitalize text-[11px]', getStatusClasses(threat.status))}>
                {threat.status}
              </Badge>
              {threat.risk_score !== null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-[11px] font-mono tabular-nums gap-1 cursor-default">
                      <Target className="h-3 w-3 shrink-0" />
                      {threat.risk_score}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Risk score</TooltipContent>
                </Tooltip>
              )}
              {hasComments && (
                <MessageSquare className="h-3 w-3 text-blue-500/70" />
              )}
              {onNavigateToDiagram && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover/threat:opacity-100 hover:bg-primary/10 rounded-lg transition-all"
                      aria-label="View in diagram"
                      onClick={(e) => { e.stopPropagation(); onNavigateToDiagram(); }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View in diagram</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Description - full width */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2">
            {threat.threat.description}
          </p>

          {/* Bottom meta row: category + context */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <Badge variant="outline" className="text-[10px]">{threat.threat.category}</Badge>
            {contextItems && contextItems.length > 0 && (
              <>
                <span className="text-border/60">&middot;</span>
                {contextItems.map((item, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-border/60">&middot;</span>}
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Mitigations section ── */}
        {linkedMitigations.length > 0 && (
          <>
            <Separator className="opacity-50" />
            <div className="bg-muted/15 px-5 pl-6 py-3 cursor-pointer" onClick={onOpen}>
              {/* Mitigation header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs font-semibold">{linkedMitigations.length} Mitigation{linkedMitigations.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <Progress value={mitigationProgress} className="h-1 max-w-24" />
                  <span className="text-[10px] text-muted-foreground tabular-nums">{mitigationProgress}%</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              </div>

              {/* Mitigation chips - showing name, category, and status */}
              <div className="flex flex-wrap gap-2">
                {linkedMitigations.map((mit) => (
                  <div
                    key={mit.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-background/60 hover:bg-background hover:shadow-sm transition-all text-xs"
                  >
                    <Shield className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      mit.status === 'verified' ? 'text-green-600' :
                      mit.status === 'implemented' ? 'text-emerald-500' :
                      'text-muted-foreground/60'
                    )} />
                    <div className="flex flex-col min-w-0 max-w-[180px]">
                      <span className="font-medium truncate leading-tight">{mit.mitigation.name}</span>
                      {mit.mitigation.category && (
                        <span className="text-[10px] text-muted-foreground truncate leading-tight">{mit.mitigation.category}</span>
                      )}
                    </div>
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 capitalize shrink-0 ml-auto', getStatusClasses(mit.status))}>
                      {mit.status}
                    </Badge>
                    {mit.comments && mit.comments !== '[]' && (
                      <MessageSquare className="h-3 w-3 text-blue-500/70 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
