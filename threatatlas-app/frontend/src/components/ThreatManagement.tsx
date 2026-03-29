import { useState, useEffect } from 'react';
import { diagramThreatsApi, threatsApi, frameworksApi, diagramMitigationsApi, mitigationsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { AlertTriangle, Plus, Trash2, Search, X, Shield, ChevronDown, Layers } from 'lucide-react';
import { RiskSelector } from '@/components/RiskSelector';
import { getSeverityVariant, getSeverityStripeClass, getStatusClasses } from '@/lib/risk';
import { CommentSection } from '@/components/CommentSection';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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

  // Mitigation dialog states
  const [addMitigationDialogOpen, setAddMitigationDialogOpen] = useState(false);
  const [currentThreat, setCurrentThreat] = useState<DiagramThreat | null>(null);
  const [availableMitigations, setAvailableMitigations] = useState<any[]>([]);
  const [mitigationSearchQuery, setMitigationSearchQuery] = useState('');

  // Delete confirmation states
  const [threatToDelete, setThreatToDelete] = useState<DiagramThreat | null>(null);
  const [mitigationToDelete, setMitigationToDelete] = useState<any>(null);

  // Custom threat/mitigation creation states
  const [createThreatDialogOpen, setCreateThreatDialogOpen] = useState(false);
  const [createMitigationDialogOpen, setCreateMitigationDialogOpen] = useState(false);
  const [threatForm, setThreatForm] = useState({ name: '', description: '', category: '', framework_id: 0 });
  const [mitigationForm, setMitigationForm] = useState({ name: '', description: '', category: '', framework_id: 0 });

  // Collapsible state for each threat
  const [expandedThreats, setExpandedThreats] = useState<Record<number, boolean>>({});

  const toggleThreat = (threatId: number) => {
    setExpandedThreats(prev => ({
      ...prev,
      [threatId]: !prev[threatId]
    }));
  };

  useEffect(() => {
    loadData();
  }, [diagramId, elementId, activeModelId]);

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

      // Filter threats for this element
      const elementThreats = threatsRes.data.filter(
        (dt: DiagramThreat) => dt.element_id === elementId
      );

      // Filter mitigations for this element
      const elementMits = mitigationsRes.data.filter(
        (dm: any) => dm.element_id === elementId
      );

      setAttachedThreats(elementThreats);
      setAvailableThreats(availableRes.data);
      setFrameworks(frameworksRes.data);
      setElementMitigations(elementMits);
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
      await diagramThreatsApi.create({
        diagram_id: diagramId,
        model_id: activeModelId,
        threat_id: threat.id,
        element_id: elementId,
        element_type: elementType,
        status: 'identified',
        comments: '',
      });
      setAddDialogOpen(false);
      setSearchQuery('');
      loadData();
      toast.success('Threat attached successfully');
    } catch (error) {
      console.error('Error attaching threat:', error);
      toast.error('Failed to attach threat');
    }
  };

  const handleUpdateThreat = async (diagramThreatId: number, updates: DiagramThreatUpdate) => {
    try {
      await diagramThreatsApi.update(diagramThreatId, updates);
      loadData();
      toast.success('Threat updated');
    } catch (error) {
      console.error('Error updating threat:', error);
      toast.error('Failed to update threat');
    }
  };

  const handleRemoveThreat = async (diagramThreatId: number) => {
    try {
      await diagramThreatsApi.delete(diagramThreatId);
      loadData();
      toast.success('Threat removed');
    } catch (error) {
      console.error('Error removing threat:', error);
      toast.error('Failed to remove threat');
    }
  };

  const handleAttachMitigation = async (mitigation: any) => {
    if (!activeModelId || !diagramId) return;
    try {
      await diagramMitigationsApi.create({
        diagram_id: diagramId,
        model_id: activeModelId,
        mitigation_id: mitigation.id,
        element_id: elementId,
        element_type: elementType,
        threat_id: currentThreat?.id,
        status: 'proposed',
        comments: '',
      });
      setAddMitigationDialogOpen(false);
      setMitigationSearchQuery('');
      setCurrentThreat(null);
      loadData();
      toast.success('Mitigation attached successfully');
    } catch (error) {
      console.error('Error attaching mitigation:', error);
      toast.error('Failed to attach mitigation');
    }
  };

  const handleRemoveMitigation = async (mitigationId: number) => {
    try {
      await diagramMitigationsApi.delete(mitigationId);
      loadData();
      toast.success('Mitigation removed');
    } catch (error) {
      console.error('Error removing mitigation:', error);
      toast.error('Failed to remove mitigation');
    }
  };

  const handleUpdateMitigation = async (mitigationId: number, updates: DiagramMitigationUpdate) => {
    try {
      await diagramMitigationsApi.update(mitigationId, updates);
      loadData();
      toast.success('Mitigation updated');
    } catch (error) {
      console.error('Error updating mitigation:', error);
      toast.error('Failed to update mitigation');
    }
  };

  const handleCreateCustomThreat = async () => {
    if (!threatForm.name || !threatForm.category || !modelFrameworkId) return;
    try {
      const response = await threatsApi.create({
        ...threatForm,
        framework_id: modelFrameworkId, // Use the model's framework
      });
      setCreateThreatDialogOpen(false);
      setThreatForm({ name: '', description: '', category: '', framework_id: 0 });
      loadData();
      toast.success('Custom threat created');
      // Optionally attach the newly created threat
      await handleAttachThreat(response.data);
    } catch (error) {
      console.error('Error creating custom threat:', error);
      toast.error('Failed to create custom threat');
    }
  };

  const handleCreateCustomMitigation = async () => {
    if (!mitigationForm.name || !mitigationForm.category || !modelFrameworkId) return;
    try {
      const response = await mitigationsApi.create({
        ...mitigationForm,
        framework_id: modelFrameworkId, // Use the model's framework
      });
      setCreateMitigationDialogOpen(false);
      setMitigationForm({ name: '', description: '', category: '', framework_id: 0 });
      toast.success('Custom mitigation created');
      // Attach the newly created mitigation (this will also clear currentThreat and reload data)
      await handleAttachMitigation(response.data);
    } catch (error) {
      console.error('Error creating custom mitigation:', error);
      toast.error('Failed to create custom mitigation');
    }
  };

  const filteredAvailableThreats = availableThreats.filter((threat) => {
    // Only show threats from the active model's framework
    const matchesFramework = threat.framework_id === modelFrameworkId;
    const matchesSearch = threat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      threat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      threat.category.toLowerCase().includes(searchQuery.toLowerCase());

    // Don't show already attached threats
    const isAttached = attachedThreats.some(dt => dt.threat_id === threat.id);

    return matchesFramework && matchesSearch && !isAttached;
  });

  // Get unique categories for custom creation
  const threatCategories = Array.from(new Set(availableThreats.map(t => t.category).filter(Boolean)));
  const mitigationCategories = Array.from(new Set(availableMitigations.map(m => m.category).filter(Boolean)));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'identified':
        return 'destructive';
      case 'mitigated':
        return 'default';
      case 'accepted':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-muted-foreground tracking-wider">THREATS</p>
          {attachedThreats.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{attachedThreats.length}</Badge>
          )}
        </div>
        <Button
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setAddDialogOpen(true)}
          disabled={!activeModelId}
          title={!activeModelId ? 'Select a model to add threats' : ''}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Threat
        </Button>
      </div>

      {/* Stats bar */}
      {attachedThreats.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {(['identified', 'mitigated', 'accepted'] as const).map((s) => {
            const count = attachedThreats.filter((t) => t.status === s).length;
            return (
              <div key={s} className={`rounded-lg border px-3 py-2 text-center ${getStatusClasses(s)}`}>
                <p className="text-base font-bold tabular-nums">{count}</p>
                <p className="text-[10px] capitalize">{s}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : attachedThreats.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 mb-3">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <p className="text-sm font-semibold mb-1">No threats attached</p>
          {activeModelId ? (
            <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)} className="mt-2 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Threat
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground max-w-[240px] mt-1 leading-relaxed">
              Select a model above to start attaching threats to this element.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {attachedThreats.map((dt) => {
            const isExpanded = expandedThreats[dt.id] !== false;
            const linkedMits = elementMitigations.filter((dm: any) => dm.threat_id === dt.id);
            return (
              <Collapsible key={dt.id} open={isExpanded} onOpenChange={() => toggleThreat(dt.id)}>
                <Card className="overflow-hidden transition-shadow hover:shadow-sm">
                  {/* Severity stripe */}
                  <div className={`h-0.5 w-full ${getSeverityStripeClass(dt.severity)}`} />
                  <CardContent className="p-4">
                    {/* Card header */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 shrink-0 mt-0.5">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-snug">{dt.threat.name}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <Badge variant="outline" className="text-[10px]">{dt.threat.category}</Badge>
                              {dt.severity && (
                                <Badge variant={getSeverityVariant(dt.severity)} className="text-[10px] capitalize">
                                  {dt.severity}
                                </Badge>
                              )}
                              {dt.risk_score !== null && (
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  Risk {dt.risk_score}
                                </Badge>
                              )}
                              {dt.model && !activeModelId && (
                                <Badge variant="secondary" className="text-[10px] gap-1">
                                  <Layers className="h-2.5 w-2.5" />{dt.model.name}
                                </Badge>
                              )}
                              {linkedMits.length > 0 && (
                                <Badge variant="outline" className="text-[10px] gap-1 text-green-700 border-green-300">
                                  <Shield className="h-2.5 w-2.5" />{linkedMits.length}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Remove threat"
                              onClick={(e) => { e.stopPropagation(); setThreatToDelete(dt); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        {/* Description preview when collapsed */}
                        {!isExpanded && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1 leading-relaxed">
                            {dt.threat.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Expanded content */}
                    <CollapsibleContent>
                      <div className="mt-4 space-y-4 pt-4 border-t">
                        {/* Full description */}
                        <p className="text-xs text-muted-foreground leading-relaxed">{dt.threat.description}</p>

                        {/* Status */}
                        <div>
                          <p className="text-xs font-bold text-muted-foreground tracking-wider mb-1.5">STATUS</p>
                          <Select
                            value={dt.status}
                            onValueChange={(value) => handleUpdateThreat(dt.id, { status: value })}
                          >
                            <SelectTrigger className={`h-8 text-xs rounded-lg w-full ${getStatusClasses(dt.status)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="identified">Identified</SelectItem>
                              <SelectItem value="mitigated">Mitigated</SelectItem>
                              <SelectItem value="accepted">Accepted</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Risk Assessment */}
                        <div>
                          <p className="text-xs font-bold text-muted-foreground tracking-wider mb-2">RISK ASSESSMENT</p>
                          <RiskSelector
                            likelihood={dt.likelihood}
                            impact={dt.impact}
                            onLikelihoodChange={(value) => handleUpdateThreat(dt.id, { likelihood: value })}
                            onImpactChange={(value) => handleUpdateThreat(dt.id, { impact: value })}
                          />
                        </div>

                        {/* Comments */}
                        <CommentSection
                          comments={dt.comments}
                          canWrite={canWrite}
                          authorName={authorName}
                          onSave={(newComments) => handleUpdateThreat(dt.id, { comments: newComments })}
                        />

                        <Separator />

                        {/* Mitigations */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                              <Shield className="h-3 w-3 text-green-600" />
                              MITIGATIONS
                              {linkedMits.length > 0 && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{linkedMits.length}</Badge>
                              )}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              disabled={!activeModelId}
                              title={!activeModelId ? 'Select a model to add mitigations' : ''}
                              onClick={() => { setCurrentThreat(dt); setAddMitigationDialogOpen(true); }}
                            >
                              <Plus className="h-3 w-3" />
                              Add
                            </Button>
                          </div>

                          {linkedMits.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-1">No mitigations linked yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {linkedMits.map((dm: any) => (
                                <div key={dm.id} className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 space-y-2">
                                  <div className="flex items-start gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500/10 shrink-0 mt-0.5">
                                      <Shield className="h-3 w-3 text-green-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold">{dm.mitigation.name}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                                        {dm.mitigation.description}
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive shrink-0"
                                      aria-label="Remove mitigation"
                                      onClick={() => setMitigationToDelete(dm)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-2 pl-8">
                                    <Select
                                      value={dm.status}
                                      onValueChange={(value) => handleUpdateMitigation(dm.id, { status: value })}
                                    >
                                      <SelectTrigger className={`h-6 text-[11px] rounded-md w-auto px-2 gap-1 ${getStatusClasses(dm.status)}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="proposed">Proposed</SelectItem>
                                        <SelectItem value="implemented">Implemented</SelectItem>
                                        <SelectItem value="verified">Verified</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="pl-8">
                                    <CommentSection
                                      comments={dm.comments}
                                      canWrite={canWrite}
                                      authorName={authorName}
                                      onSave={(newComments) => handleUpdateMitigation(dm.id, { comments: newComments })}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Add Threat Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="!max-w-5xl">
          <DialogHeader>
            <DialogTitle>Add Threat</DialogTitle>
            <DialogDescription>
              Select a threat from the knowledge base to attach to this element. Showing only threats from <strong>{frameworks.find(f => f.id === modelFrameworkId)?.name || 'the current framework'}</strong>. You can assign risk assessment after adding.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end -mt-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAddDialogOpen(false);
                setCreateThreatDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Custom
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search threats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="h-[450px] rounded-md border">
              <div className="p-4">
                {filteredAvailableThreats.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No threats found matching your criteria
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {filteredAvailableThreats.map((threat) => (
                      <Card
                        key={threat.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleAttachThreat(threat)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="font-medium text-sm">{threat.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {threat.category}
                                </Badge>
                                {threat.is_custom && (
                                  <Badge variant="secondary" className="text-xs">
                                    Custom
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {threat.description}
                              </p>
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Mitigation Dialog */}
      <Dialog open={addMitigationDialogOpen} onOpenChange={(open) => {
        setAddMitigationDialogOpen(open);
        if (!open) setCurrentThreat(null);
      }}>
        <DialogContent className="!max-w-5xl">
          <DialogHeader>
            <DialogTitle>Add Mitigation</DialogTitle>
            <DialogDescription>
              Select a mitigation from the knowledge base to attach to this element. Showing only mitigations from <strong>{frameworks.find(f => f.id === modelFrameworkId)?.name || 'the current framework'}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end -mt-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAddMitigationDialogOpen(false);
                setCreateMitigationDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Custom
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search mitigations..."
                  value={mitigationSearchQuery}
                  onChange={(e) => setMitigationSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {mitigationSearchQuery && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    aria-label="Clear search"
                    onClick={() => setMitigationSearchQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="h-[450px] rounded-md border">
              <div className="p-4">
                {availableMitigations
                  .filter((mitigation) => {
                    // Only show mitigations from the active model's framework
                    const matchesFramework = mitigation.framework_id === modelFrameworkId;
                    const matchesSearch = mitigation.name.toLowerCase().includes(mitigationSearchQuery.toLowerCase()) ||
                      mitigation.description.toLowerCase().includes(mitigationSearchQuery.toLowerCase());
                    const matchesCategory = !currentThreat || mitigation.category === currentThreat.threat.category;
                    const isAttached = elementMitigations.some(dm => dm.mitigation_id === mitigation.id && dm.threat_id === currentThreat?.id);
                    return matchesFramework && matchesSearch && matchesCategory && !isAttached;
                  })
                  .length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {currentThreat ? (
                      <>No mitigations found for <strong>{currentThreat.threat.category}</strong> category</>
                    ) : (
                      'No mitigations found matching your criteria'
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {availableMitigations
                      .filter((mitigation) => {
                        // Only show mitigations from the active model's framework
                        const matchesFramework = mitigation.framework_id === modelFrameworkId;
                        const matchesSearch = mitigation.name.toLowerCase().includes(mitigationSearchQuery.toLowerCase()) ||
                          mitigation.description.toLowerCase().includes(mitigationSearchQuery.toLowerCase());
                        const matchesCategory = !currentThreat || mitigation.category === currentThreat.threat.category;
                        const isAttached = elementMitigations.some(dm => dm.mitigation_id === mitigation.id && dm.threat_id === currentThreat?.id);
                        return matchesFramework && matchesSearch && matchesCategory && !isAttached;
                      })
                      .map((mitigation) => (
                        <Card
                          key={mitigation.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleAttachMitigation(mitigation)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h4 className="font-medium text-sm">{mitigation.name}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {mitigation.category}
                                  </Badge>
                                  {mitigation.is_custom && (
                                    <Badge variant="secondary" className="text-xs">
                                      Custom
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {mitigation.description}
                                </p>
                              </div>
                              <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    }
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMitigationDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Threat Confirmation Dialog */}
      <AlertDialog open={!!threatToDelete} onOpenChange={() => setThreatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Threat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{threatToDelete?.threat.name}"? This action cannot be undone and will also remove all associated mitigations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (threatToDelete) {
                  handleRemoveThreat(threatToDelete.id);
                  setThreatToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Mitigation Confirmation Dialog */}
      <AlertDialog open={!!mitigationToDelete} onOpenChange={() => setMitigationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mitigation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{mitigationToDelete?.mitigation.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (mitigationToDelete) {
                  handleRemoveMitigation(mitigationToDelete.id);
                  setMitigationToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Custom Threat Dialog */}
      <Dialog open={createThreatDialogOpen} onOpenChange={setCreateThreatDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Custom Threat</DialogTitle>
            <DialogDescription>
              Create a custom threat for this framework and attach it to this element.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="grid gap-2">
              <Label htmlFor="threat-framework">Framework</Label>
              <Input
                id="threat-framework"
                value={frameworks.find(f => f.id === modelFrameworkId)?.name || 'Unknown'}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Custom threats will be added to the current model's framework
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-threat-name">Name</Label>
              <Input
                id="custom-threat-name"
                value={threatForm.name}
                onChange={(e) => setThreatForm({ ...threatForm, name: e.target.value })}
                placeholder="Enter threat name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-threat-category">Category</Label>
              {threatCategories.length > 0 ? (
                <>
                  <Select
                    value={threatCategories.includes(threatForm.category) ? threatForm.category : '__custom__'}
                    onValueChange={(value) => {
                      if (value !== '__custom__') {
                        setThreatForm({ ...threatForm, category: value });
                      }
                    }}
                  >
                    <SelectTrigger id="custom-threat-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {threatCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">Other (custom)</SelectItem>
                    </SelectContent>
                  </Select>
                  {!threatCategories.includes(threatForm.category) && (
                    <Input
                      placeholder="Enter custom category name"
                      value={threatForm.category}
                      onChange={(e) => setThreatForm({ ...threatForm, category: e.target.value })}
                      className="mt-2"
                    />
                  )}
                </>
              ) : (
                <Input
                  id="custom-threat-category"
                  value={threatForm.category}
                  onChange={(e) => setThreatForm({ ...threatForm, category: e.target.value })}
                  placeholder="e.g., Spoofing, Tampering, etc."
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-threat-description">Description</Label>
              <Textarea
                id="custom-threat-description"
                value={threatForm.description}
                onChange={(e) => setThreatForm({ ...threatForm, description: e.target.value })}
                placeholder="Describe the threat in detail"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateThreatDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCustomThreat}>
              Create & Attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Custom Mitigation Dialog */}
      <Dialog open={createMitigationDialogOpen} onOpenChange={(open) => {
        setCreateMitigationDialogOpen(open);
        if (!open) setCurrentThreat(null);
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Custom Mitigation</DialogTitle>
            <DialogDescription>
              Create a custom mitigation for this framework and attach it to this element.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="grid gap-2">
              <Label htmlFor="mitigation-framework">Framework</Label>
              <Input
                id="mitigation-framework"
                value={frameworks.find(f => f.id === modelFrameworkId)?.name || 'Unknown'}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Custom mitigations will be added to the current model's framework
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-mitigation-name">Name</Label>
              <Input
                id="custom-mitigation-name"
                value={mitigationForm.name}
                onChange={(e) => setMitigationForm({ ...mitigationForm, name: e.target.value })}
                placeholder="Enter mitigation name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-mitigation-category">Category</Label>
              {mitigationCategories.length > 0 ? (
                <>
                  <Select
                    value={mitigationCategories.includes(mitigationForm.category) ? mitigationForm.category : '__custom__'}
                    onValueChange={(value) => {
                      if (value !== '__custom__') {
                        setMitigationForm({ ...mitigationForm, category: value });
                      }
                    }}
                  >
                    <SelectTrigger id="custom-mitigation-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {mitigationCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">Other (custom)</SelectItem>
                    </SelectContent>
                  </Select>
                  {!mitigationCategories.includes(mitigationForm.category) && (
                    <Input
                      placeholder="Enter custom category name"
                      value={mitigationForm.category}
                      onChange={(e) => setMitigationForm({ ...mitigationForm, category: e.target.value })}
                      className="mt-2"
                    />
                  )}
                </>
              ) : (
                <Input
                  id="custom-mitigation-category"
                  value={mitigationForm.category}
                  onChange={(e) => setMitigationForm({ ...mitigationForm, category: e.target.value })}
                  placeholder="e.g., Authentication, Encryption, etc."
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-mitigation-description">Description</Label>
              <Textarea
                id="custom-mitigation-description"
                value={mitigationForm.description}
                onChange={(e) => setMitigationForm({ ...mitigationForm, description: e.target.value })}
                placeholder="Describe the mitigation in detail"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateMitigationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCustomMitigation}>
              Create & Attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
