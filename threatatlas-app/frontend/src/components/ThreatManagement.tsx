import { useState, useEffect } from 'react';
import { diagramThreatsApi, threatsApi, frameworksApi, diagramMitigationsApi, mitigationsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Plus, Trash2, Search, X, Shield, ChevronDown, Layers, Target, Sparkles } from 'lucide-react';
import { RiskSelector } from '@/components/RiskSelector';
import { getSeverityVariant, getSeverityStripeClass, getStatusClasses } from '@/lib/risk';
import { CommentSection } from '@/components/CommentSection';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Threat {
  id: number;
  framework_id: number;
  name: string;
  description: string;
  category: string;
  is_custom: boolean;
}

interface Framework {
  id: number;
  name: string;
}

interface DiagramThreat {
  id: number;
  threat_id: number;
  status: string;
  comments: string;
  likelihood: number | null;
  impact: number | null;
  risk_score: number | null;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  element_id: string;
  threat: Threat;
  model?: any;
}

interface DiagramThreatUpdate {
  status?: string;
  comments?: string;
  likelihood?: number | null;
  impact?: number | null;
}

interface DiagramMitigationUpdate {
  status?: string;
  comments?: string | null;
  threat_id?: number | null;
}

interface ThreatManagementProps {
  diagramId: number | null;
  activeModelId: number | null;
  modelFrameworkId: number | null;
  elementId: string;
  elementType: string;
}

// ── Severity dot ──────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--risk-critical)',
  high:     'var(--risk-high)',
  medium:   'var(--risk-medium)',
  low:      'var(--risk-low)',
};

function SeverityDot({ severity }: { severity: string | null }) {
  const color = severity ? (SEVERITY_COLOR[severity] ?? 'var(--muted-foreground)') : 'var(--muted-foreground)';
  return (
    <span
      className="inline-block h-2 w-2 rounded-full shrink-0"
      style={{ backgroundColor: color }}
      title={severity ?? 'unknown'}
    />
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const THREAT_STATUS_STYLE: Record<string, React.CSSProperties> = {
  identified: { color: 'var(--risk-high)',       backgroundColor: 'color-mix(in srgb, var(--risk-high) 10%, transparent)',       border: '1px solid color-mix(in srgb, var(--risk-high) 25%, transparent)' },
  mitigated:  { color: 'var(--risk-low)',        backgroundColor: 'color-mix(in srgb, var(--risk-low) 10%, transparent)',        border: '1px solid color-mix(in srgb, var(--risk-low) 25%, transparent)' },
  accepted:   { color: 'var(--muted-foreground)', backgroundColor: 'color-mix(in srgb, var(--muted-foreground) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--muted-foreground) 20%, transparent)' },
};

const MIT_STATUS_STYLE: Record<string, React.CSSProperties> = {
  proposed:    { color: 'var(--risk-medium)',     backgroundColor: 'color-mix(in srgb, var(--risk-medium) 10%, transparent)',     border: '1px solid color-mix(in srgb, var(--risk-medium) 25%, transparent)' },
  implemented: { color: 'var(--element-mitigation)', backgroundColor: 'color-mix(in srgb, var(--element-mitigation) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--element-mitigation) 25%, transparent)' },
  verified:    { color: 'var(--risk-low)',        backgroundColor: 'color-mix(in srgb, var(--risk-low) 10%, transparent)',        border: '1px solid color-mix(in srgb, var(--risk-low) 25%, transparent)' },
};

function StatusPill({ status, type = 'threat' }: { status: string; type?: 'threat' | 'mitigation' }) {
  const style = type === 'threat' ? (THREAT_STATUS_STYLE[status] ?? {}) : (MIT_STATUS_STYLE[status] ?? {});
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize" style={style}>
      {status}
    </span>
  );
}

export default function ThreatManagement({ diagramId, activeModelId, modelFrameworkId, elementId, elementType }: ThreatManagementProps) {
  const { user, canWrite } = useAuth();
  const authorName = user?.full_name || user?.email || 'Unknown User';
  const [attachedThreats, setAttachedThreats] = useState<DiagramThreat[]>([]);
  const [availableThreats, setAvailableThreats] = useState<Threat[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [elementMitigations, setElementMitigations] = useState<any[]>([]);

  const [addMitigationDialogOpen, setAddMitigationDialogOpen] = useState(false);
  const [currentThreat, setCurrentThreat] = useState<DiagramThreat | null>(null);
  const [availableMitigations, setAvailableMitigations] = useState<any[]>([]);
  const [mitigationSearchQuery, setMitigationSearchQuery] = useState('');

  const [threatToDelete, setThreatToDelete] = useState<DiagramThreat | null>(null);
  const [mitigationToDelete, setMitigationToDelete] = useState<any>(null);

  const [createThreatDialogOpen, setCreateThreatDialogOpen] = useState(false);
  const [createMitigationDialogOpen, setCreateMitigationDialogOpen] = useState(false);
  const [threatForm, setThreatForm] = useState({ name: '', description: '', category: '', framework_id: 0 });
  const [mitigationForm, setMitigationForm] = useState({ name: '', description: '', category: '', framework_id: 0 });

  const [expandedThreats, setExpandedThreats] = useState<Record<number, boolean>>({});

  const toggleThreat = (threatId: number) => {
    setExpandedThreats(prev => ({ ...prev, [threatId]: !prev[threatId] }));
  };

  useEffect(() => { loadData(); }, [diagramId, elementId, activeModelId]);

  const loadData = async () => {
    if (!diagramId || !elementId) return;
    try {
      setLoading(true);
      const threatParams: any = { diagram_id: diagramId };
      if (activeModelId) threatParams.model_id = activeModelId;
      const mitigationParams: any = { diagram_id: diagramId };
      if (activeModelId) mitigationParams.model_id = activeModelId;

      const [threatsRes, availableRes, frameworksRes, mitigationsRes, availableMitigationsRes] = await Promise.all([
        diagramThreatsApi.list(threatParams),
        modelFrameworkId ? threatsApi.list({ framework_id: modelFrameworkId }) : Promise.resolve({ data: [] }),
        frameworksApi.list(),
        diagramMitigationsApi.list(mitigationParams),
        modelFrameworkId ? mitigationsApi.list({ framework_id: modelFrameworkId }) : Promise.resolve({ data: [] }),
      ]);

      setAttachedThreats(threatsRes.data.filter((dt: DiagramThreat) => dt.element_id === elementId));
      setAvailableThreats(availableRes.data);
      setFrameworks(frameworksRes.data);
      setElementMitigations(mitigationsRes.data.filter((dm: any) => dm.element_id === elementId));
      setAvailableMitigations(availableMitigationsRes.data);
    } catch (error) {
      console.error('Error loading threats:', error);
      toast.error('Failed to load threats');
    } finally {
      setLoading(false);
    }
  };

  const handleAttachThreat = async (threat: Threat) => {
    if (!activeModelId || !diagramId) return;
    try {
      await diagramThreatsApi.create({ diagram_id: diagramId, model_id: activeModelId, threat_id: threat.id, element_id: elementId, element_type: elementType, status: 'identified', comments: '' });
      setAddDialogOpen(false);
      setSearchQuery('');
      loadData();
      toast.success('Threat attached');
    } catch {
      toast.error('Failed to attach threat');
    }
  };

  const handleUpdateThreat = async (diagramThreatId: number, updates: DiagramThreatUpdate) => {
    try {
      await diagramThreatsApi.update(diagramThreatId, updates);
      loadData();
    } catch {
      toast.error('Failed to update threat');
    }
  };

  const handleRemoveThreat = async (diagramThreatId: number) => {
    try {
      await diagramThreatsApi.delete(diagramThreatId);
      loadData();
      toast.success('Threat removed');
    } catch {
      toast.error('Failed to remove threat');
    }
  };

  const handleAttachMitigation = async (mitigation: any) => {
    if (!activeModelId || !diagramId) return;
    try {
      await diagramMitigationsApi.create({ diagram_id: diagramId, model_id: activeModelId, mitigation_id: mitigation.id, element_id: elementId, element_type: elementType, threat_id: currentThreat?.id, status: 'proposed', comments: '' });
      setAddMitigationDialogOpen(false);
      setMitigationSearchQuery('');
      setCurrentThreat(null);
      loadData();
      toast.success('Mitigation attached');
    } catch {
      toast.error('Failed to attach mitigation');
    }
  };

  const handleRemoveMitigation = async (mitigationId: number) => {
    try {
      await diagramMitigationsApi.delete(mitigationId);
      loadData();
      toast.success('Mitigation removed');
    } catch {
      toast.error('Failed to remove mitigation');
    }
  };

  const handleUpdateMitigation = async (mitigationId: number, updates: DiagramMitigationUpdate) => {
    try {
      await diagramMitigationsApi.update(mitigationId, updates);
      loadData();
    } catch {
      toast.error('Failed to update mitigation');
    }
  };

  const handleCreateCustomThreat = async () => {
    if (!threatForm.name || !threatForm.category || !modelFrameworkId) return;
    try {
      const response = await threatsApi.create({ ...threatForm, framework_id: modelFrameworkId });
      setCreateThreatDialogOpen(false);
      setThreatForm({ name: '', description: '', category: '', framework_id: 0 });
      loadData();
      toast.success('Custom threat created');
      await handleAttachThreat(response.data);
    } catch {
      toast.error('Failed to create custom threat');
    }
  };

  const handleCreateCustomMitigation = async () => {
    if (!mitigationForm.name || !mitigationForm.category || !modelFrameworkId) return;
    try {
      const response = await mitigationsApi.create({ ...mitigationForm, framework_id: modelFrameworkId });
      setCreateMitigationDialogOpen(false);
      setMitigationForm({ name: '', description: '', category: '', framework_id: 0 });
      toast.success('Custom mitigation created');
      await handleAttachMitigation(response.data);
    } catch {
      toast.error('Failed to create custom mitigation');
    }
  };

  const filteredAvailableThreats = availableThreats.filter((threat) =>
    threat.framework_id === modelFrameworkId &&
    !attachedThreats.some(dt => dt.threat_id === threat.id) &&
    (threat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     threat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
     threat.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const threatCategories = Array.from(new Set(availableThreats.map(t => t.category).filter(Boolean)));
  const mitigationCategories = Array.from(new Set(availableMitigations.map(m => m.category).filter(Boolean)));

  // ── Status counts for the stats bar ──
  const statusCounts = {
    identified: attachedThreats.filter(t => t.status === 'identified').length,
    mitigated:  attachedThreats.filter(t => t.status === 'mitigated').length,
    accepted:   attachedThreats.filter(t => t.status === 'accepted').length,
  };

  return (
    <div className="space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--element-threat)' }} />
          <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Threats</span>
          {attachedThreats.length > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold bg-muted text-muted-foreground tabular-nums">
              {attachedThreats.length}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs rounded-lg"
          onClick={() => setAddDialogOpen(true)}
          disabled={!activeModelId}
          title={!activeModelId ? 'Select a model to add threats' : ''}
        >
          <Plus className="h-3 w-3" />
          Add Threat
        </Button>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      {attachedThreats.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: 'identified', color: 'var(--risk-high)', label: 'Identified' },
            { key: 'mitigated',  color: 'var(--risk-low)',  label: 'Mitigated' },
            { key: 'accepted',   color: 'var(--ds-stone-gray)', label: 'Accepted' },
          ] as const).map(({ key, color, label }) => (
            <div
              key={key}
              className="rounded-xl border px-3 py-2.5 text-center"
              style={{ borderColor: `color-mix(in srgb, ${color} 20%, transparent)`, backgroundColor: `color-mix(in srgb, ${color} 5%, transparent)` }}
            >
              <p className="text-lg font-bold tabular-nums leading-none" style={{ color }}>
                {statusCounts[key]}
              </p>
              <p className="text-[10px] font-medium mt-1 text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Threat list ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : attachedThreats.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--element-threat) 8%, transparent)' }}>
            <AlertTriangle className="h-5 w-5" style={{ color: 'var(--element-threat)' }} />
          </div>
          <div>
            <p className="text-sm font-semibold mb-0.5">No threats identified</p>
            {activeModelId ? (
              <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)} className="mt-2 gap-1.5 h-7 text-xs">
                <Plus className="h-3 w-3" /> Add Threat
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground max-w-[220px]">Select a model to start adding threats to this element.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {attachedThreats.map((dt) => {
            const isExpanded = expandedThreats[dt.id] === true;
            const linkedMits = elementMitigations.filter((dm: any) => dm.threat_id === dt.id);
            const severityColor = dt.severity ? (SEVERITY_COLOR[dt.severity] ?? 'var(--border)') : 'var(--border)';

            return (
              <div
                key={dt.id}
                className="rounded-xl border overflow-hidden transition-shadow hover:shadow-sm"
                style={{ borderColor: isExpanded ? `color-mix(in srgb, ${severityColor} 30%, var(--border))` : undefined }}
              >
                {/* ── Collapsed header — always visible ── */}
                <div
                  className="flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none"
                  onClick={() => toggleThreat(dt.id)}
                  style={isExpanded ? { backgroundColor: `color-mix(in srgb, ${severityColor} 4%, transparent)` } : {}}
                >
                  {/* Severity indicator */}
                  <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: severityColor, minHeight: '1.5rem' }} />

                  {/* Name + badges */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug truncate">{dt.threat.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">{dt.threat.category}</Badge>
                      {dt.model && !activeModelId && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-1">
                          <Layers className="h-2.5 w-2.5" />{dt.model.name}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Right-side meta */}
                  <div className="flex items-center gap-2 shrink-0">
                    {dt.risk_score !== null && (
                      <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-muted-foreground">
                        <Target className="h-3 w-3" />{dt.risk_score}
                      </span>
                    )}
                    {linkedMits.length > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--element-mitigation)' }}>
                        <Shield className="h-3 w-3" />{linkedMits.length}
                      </span>
                    )}
                    <StatusPill status={dt.status} type="threat" />
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setThreatToDelete(dt); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200', isExpanded && 'rotate-180')} />
                    </div>
                  </div>
                </div>

                {/* ── Expanded body ── */}
                {isExpanded && (
                  <div className="border-t px-4 py-4 space-y-4">
                    {/* Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed">{dt.threat.description}</p>

                    {/* Status + Risk row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1.5">STATUS</p>
                        <Select value={dt.status} onValueChange={(v) => handleUpdateThreat(dt.id, { status: v })}>
                          <SelectTrigger className="h-8 text-xs rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="identified">Identified</SelectItem>
                            <SelectItem value="mitigated">Mitigated</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(dt.risk_score !== null || dt.severity) && (
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1.5">SEVERITY / RISK</p>
                          <div className="flex items-center gap-2 h-8">
                            {dt.severity && (
                              <Badge variant={getSeverityVariant(dt.severity)} className="capitalize text-[10px]">{dt.severity}</Badge>
                            )}
                            {dt.risk_score !== null && (
                              <span className="text-sm font-bold tabular-nums" style={{ color: severityColor }}>
                                {dt.risk_score}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Risk assessment */}
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-2">RISK ASSESSMENT</p>
                      <RiskSelector
                        likelihood={dt.likelihood}
                        impact={dt.impact}
                        onLikelihoodChange={(v) => handleUpdateThreat(dt.id, { likelihood: v })}
                        onImpactChange={(v) => handleUpdateThreat(dt.id, { impact: v })}
                      />
                    </div>

                    {/* Comments */}
                    <CommentSection
                      comments={dt.comments}
                      canWrite={canWrite}
                      authorName={authorName}
                      onSave={(c) => handleUpdateThreat(dt.id, { comments: c })}
                    />

                    {/* ── Mitigations sub-section ── */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3 w-3" style={{ color: 'var(--element-mitigation)' }} />
                          <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Mitigations</p>
                          {linkedMits.length > 0 && (
                            <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9px] font-bold tabular-nums" style={{ backgroundColor: 'color-mix(in srgb, var(--element-mitigation) 12%, transparent)', color: 'var(--element-mitigation)' }}>
                              {linkedMits.length}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] gap-1 px-2 rounded-lg"
                          disabled={!activeModelId}
                          onClick={() => { setCurrentThreat(dt); setAddMitigationDialogOpen(true); }}
                        >
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                      </div>

                      {linkedMits.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 italic">No mitigations linked yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {linkedMits.map((dm: any) => (
                            <div
                              key={dm.id}
                              className="rounded-lg px-3 py-2.5 flex items-start gap-2.5"
                              style={{ backgroundColor: 'color-mix(in srgb, var(--element-mitigation) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--element-mitigation) 15%, transparent)' }}
                            >
                              <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'var(--element-mitigation)' }} />
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <p className="text-xs font-semibold leading-snug">{dm.mitigation.name}</p>
                                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{dm.mitigation.description}</p>
                                <div className="flex items-center gap-2">
                                  <Select value={dm.status} onValueChange={(v) => handleUpdateMitigation(dm.id, { status: v })}>
                                    <SelectTrigger className="h-6 text-[11px] w-auto px-2 rounded-md border-none bg-transparent gap-1 focus:ring-0">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="proposed">Proposed</SelectItem>
                                      <SelectItem value="implemented">Implemented</SelectItem>
                                      <SelectItem value="verified">Verified</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <CommentSection
                                  comments={dm.comments}
                                  canWrite={canWrite}
                                  authorName={authorName}
                                  onSave={(c) => handleUpdateMitigation(dm.id, { comments: c })}
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive shrink-0"
                                onClick={() => setMitigationToDelete(dm)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Threat Dialog ───────────────────────────────────────────── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="!max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: 'var(--element-threat)' }} />
              Add Threat
            </DialogTitle>
            <DialogDescription>
              Showing threats from <strong>{frameworks.find(f => f.id === modelFrameworkId)?.name ?? 'the active framework'}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search threats…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
                {searchQuery && (
                  <Button size="sm" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setSearchQuery('')}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs shrink-0" onClick={() => { setAddDialogOpen(false); setCreateThreatDialogOpen(true); }}>
                <Sparkles className="h-3.5 w-3.5" /> Custom
              </Button>
            </div>

            <ScrollArea className="h-[380px] rounded-xl border">
              <div className="p-3 space-y-1.5">
                {filteredAvailableThreats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No threats found</p>
                  </div>
                ) : (
                  filteredAvailableThreats.map((threat) => (
                    <button
                      key={threat.id}
                      className="w-full text-left rounded-lg px-3.5 py-3 border border-transparent hover:border-border hover:bg-muted/40 transition-all group"
                      onClick={() => handleAttachThreat(threat)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm font-semibold group-hover:text-primary transition-colors">{threat.name}</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">{threat.category}</Badge>
                            {threat.is_custom && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Custom</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{threat.description}</p>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary shrink-0 mt-1 transition-colors" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Mitigation Dialog ───────────────────────────────────────── */}
      <Dialog open={addMitigationDialogOpen} onOpenChange={(open) => { setAddMitigationDialogOpen(open); if (!open) setCurrentThreat(null); }}>
        <DialogContent className="!max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" style={{ color: 'var(--element-mitigation)' }} />
              Add Mitigation
              {currentThreat && <span className="text-muted-foreground font-normal text-sm">for {currentThreat.threat.name}</span>}
            </DialogTitle>
            <DialogDescription>
              Showing mitigations from <strong>{frameworks.find(f => f.id === modelFrameworkId)?.name ?? 'the active framework'}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search mitigations…"
                  value={mitigationSearchQuery}
                  onChange={(e) => setMitigationSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
                {mitigationSearchQuery && (
                  <Button size="sm" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setMitigationSearchQuery('')}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs shrink-0" onClick={() => { setAddMitigationDialogOpen(false); setCreateMitigationDialogOpen(true); }}>
                <Sparkles className="h-3.5 w-3.5" /> Custom
              </Button>
            </div>

            <ScrollArea className="h-[380px] rounded-xl border">
              <div className="p-3 space-y-1.5">
                {(() => {
                  const filtered = availableMitigations.filter((m) => {
                    const matchesFramework = m.framework_id === modelFrameworkId;
                    const matchesSearch = m.name.toLowerCase().includes(mitigationSearchQuery.toLowerCase()) || m.description.toLowerCase().includes(mitigationSearchQuery.toLowerCase());
                    const matchesCategory = !currentThreat || m.category === currentThreat.threat.category;
                    const isAttached = elementMitigations.some(dm => dm.mitigation_id === m.id && dm.threat_id === currentThreat?.id);
                    return matchesFramework && matchesSearch && matchesCategory && !isAttached;
                  });

                  return filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Shield className="h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {currentThreat ? `No mitigations for ${currentThreat.threat.category}` : 'No mitigations found'}
                      </p>
                    </div>
                  ) : (
                    filtered.map((mitigation) => (
                      <button
                        key={mitigation.id}
                        className="w-full text-left rounded-lg px-3.5 py-3 border border-transparent hover:border-border hover:bg-muted/40 transition-all group"
                        onClick={() => handleAttachMitigation(mitigation)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-sm font-semibold group-hover:text-primary transition-colors">{mitigation.name}</span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">{mitigation.category}</Badge>
                              {mitigation.is_custom && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Custom</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{mitigation.description}</p>
                          </div>
                          <Plus className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary shrink-0 mt-1 transition-colors" />
                        </div>
                      </button>
                    ))
                  );
                })()}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddMitigationDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm delete threat ── */}
      <AlertDialog open={!!threatToDelete} onOpenChange={() => setThreatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Threat</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>"{threatToDelete?.threat.name}"</strong> from this element? All linked mitigations will also be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (threatToDelete) { handleRemoveThreat(threatToDelete.id); setThreatToDelete(null); } }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm delete mitigation ── */}
      <AlertDialog open={!!mitigationToDelete} onOpenChange={() => setMitigationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Mitigation</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>"{mitigationToDelete?.mitigation.name}"</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (mitigationToDelete) { handleRemoveMitigation(mitigationToDelete.id); setMitigationToDelete(null); } }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Create custom threat ── */}
      <Dialog open={createThreatDialogOpen} onOpenChange={setCreateThreatDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Custom Threat</DialogTitle>
            <DialogDescription>
              Adds a custom threat to <strong>{frameworks.find(f => f.id === modelFrameworkId)?.name ?? 'the active framework'}</strong> and attaches it here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ct-name" className="text-xs font-semibold">Name</Label>
              <Input id="ct-name" value={threatForm.name} onChange={(e) => setThreatForm({ ...threatForm, name: e.target.value })} placeholder="Threat name" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-cat" className="text-xs font-semibold">Category</Label>
              {threatCategories.length > 0 ? (
                <Select value={threatCategories.includes(threatForm.category) ? threatForm.category : '__custom__'} onValueChange={(v) => v !== '__custom__' && setThreatForm({ ...threatForm, category: v })}>
                  <SelectTrigger id="ct-cat" className="h-9"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {threatCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value="__custom__">Other (custom)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input id="ct-cat" value={threatForm.category} onChange={(e) => setThreatForm({ ...threatForm, category: e.target.value })} placeholder="e.g., Spoofing, Tampering" className="h-9" />
              )}
              {threatCategories.length > 0 && !threatCategories.includes(threatForm.category) && (
                <Input value={threatForm.category} onChange={(e) => setThreatForm({ ...threatForm, category: e.target.value })} placeholder="Custom category name" className="h-9 mt-1.5" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-desc" className="text-xs font-semibold">Description</Label>
              <Textarea id="ct-desc" value={threatForm.description} onChange={(e) => setThreatForm({ ...threatForm, description: e.target.value })} placeholder="Describe this threat" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateThreatDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateCustomThreat} disabled={!threatForm.name || !threatForm.category}>Create & Attach</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create custom mitigation ── */}
      <Dialog open={createMitigationDialogOpen} onOpenChange={(open) => { setCreateMitigationDialogOpen(open); if (!open) setCurrentThreat(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Custom Mitigation</DialogTitle>
            <DialogDescription>
              Adds a custom mitigation to <strong>{frameworks.find(f => f.id === modelFrameworkId)?.name ?? 'the active framework'}</strong> and attaches it here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cm-name" className="text-xs font-semibold">Name</Label>
              <Input id="cm-name" value={mitigationForm.name} onChange={(e) => setMitigationForm({ ...mitigationForm, name: e.target.value })} placeholder="Mitigation name" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm-cat" className="text-xs font-semibold">Category</Label>
              {mitigationCategories.length > 0 ? (
                <Select value={mitigationCategories.includes(mitigationForm.category) ? mitigationForm.category : '__custom__'} onValueChange={(v) => v !== '__custom__' && setMitigationForm({ ...mitigationForm, category: v })}>
                  <SelectTrigger id="cm-cat" className="h-9"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {mitigationCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value="__custom__">Other (custom)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input id="cm-cat" value={mitigationForm.category} onChange={(e) => setMitigationForm({ ...mitigationForm, category: e.target.value })} placeholder="e.g., Authentication, Encryption" className="h-9" />
              )}
              {mitigationCategories.length > 0 && !mitigationCategories.includes(mitigationForm.category) && (
                <Input value={mitigationForm.category} onChange={(e) => setMitigationForm({ ...mitigationForm, category: e.target.value })} placeholder="Custom category name" className="h-9 mt-1.5" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm-desc" className="text-xs font-semibold">Description</Label>
              <Textarea id="cm-desc" value={mitigationForm.description} onChange={(e) => setMitigationForm({ ...mitigationForm, description: e.target.value })} placeholder="Describe this mitigation" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateMitigationDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateCustomMitigation} disabled={!mitigationForm.name || !mitigationForm.category}>Create & Attach</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
