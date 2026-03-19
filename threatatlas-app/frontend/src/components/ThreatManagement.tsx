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
import { AlertTriangle, Plus, Trash2, Search, X, Shield, ChevronDown } from 'lucide-react';
import { RiskSelector } from '@/components/RiskSelector';
import { getSeverityVariant } from '@/lib/risk';

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
  notes: string;
  likelihood: number | null;
  impact: number | null;
  risk_score: number | null;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  element_id: string;
  threat: Threat;
}

interface DiagramThreatUpdate {
  status?: string;
  notes?: string;
  likelihood?: number | null;
  impact?: number | null;
}

interface DiagramMitigationUpdate {
  status?: string;
  notes?: string | null;
  threat_id?: number | null;
}

interface ThreatManagementProps {
  diagramId: number;
  activeModelId: number;
  modelFrameworkId: number;
  elementId: string;
  elementType: string;
}

export default function ThreatManagement({ diagramId, activeModelId, modelFrameworkId, elementId, elementType }: ThreatManagementProps) {
  const [attachedThreats, setAttachedThreats] = useState<DiagramThreat[]>([]);
  const [availableThreats, setAvailableThreats] = useState<Threat[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingThreat, setEditingThreat] = useState<DiagramThreat | null>(null);
  const [elementMitigations, setElementMitigations] = useState<any[]>([]);

  // Mitigation dialog states
  const [addMitigationDialogOpen, setAddMitigationDialogOpen] = useState(false);
  const [currentThreat, setCurrentThreat] = useState<DiagramThreat | null>(null);
  const [availableMitigations, setAvailableMitigations] = useState<any[]>([]);
  const [mitigationSearchQuery, setMitigationSearchQuery] = useState('');
  const [editingMitigation, setEditingMitigation] = useState<any>(null);

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
    try {
      setLoading(true);
      const [threatsRes, availableRes, frameworksRes, mitigationsRes, availableMitigationsRes] = await Promise.all([
        diagramThreatsApi.list({ diagram_id: diagramId, model_id: activeModelId }),
        threatsApi.list({ framework_id: modelFrameworkId }),
        frameworksApi.list(),
        diagramMitigationsApi.list({ diagram_id: diagramId, model_id: activeModelId }),
        mitigationsApi.list({ framework_id: modelFrameworkId }),
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
    } finally {
      setLoading(false);
    }
  };

  const handleAttachThreat = async (threat: Threat) => {
    try {
      await diagramThreatsApi.create({
        diagram_id: diagramId,
        model_id: activeModelId,
        threat_id: threat.id,
        element_id: elementId,
        element_type: elementType,
        status: 'identified',
        notes: '',
      });
      setAddDialogOpen(false);
      setSearchQuery('');
      loadData();
    } catch (error) {
      console.error('Error attaching threat:', error);
    }
  };

  const handleUpdateThreat = async (diagramThreatId: number, updates: DiagramThreatUpdate) => {
    try {
      await diagramThreatsApi.update(diagramThreatId, updates);
      loadData();
      setEditingThreat(null);
    } catch (error) {
      console.error('Error updating threat:', error);
    }
  };

  const handleRemoveThreat = async (diagramThreatId: number) => {
    try {
      await diagramThreatsApi.delete(diagramThreatId);
      loadData();
    } catch (error) {
      console.error('Error removing threat:', error);
    }
  };

  const handleAttachMitigation = async (mitigation: any) => {
    try {
      await diagramMitigationsApi.create({
        diagram_id: diagramId,
        model_id: activeModelId,
        mitigation_id: mitigation.id,
        element_id: elementId,
        element_type: elementType,
        threat_id: currentThreat?.id,
        status: 'proposed',
        notes: '',
      });
      setAddMitigationDialogOpen(false);
      setMitigationSearchQuery('');
      setCurrentThreat(null);
      loadData();
    } catch (error) {
      console.error('Error attaching mitigation:', error);
    }
  };

  const handleRemoveMitigation = async (mitigationId: number) => {
    try {
      await diagramMitigationsApi.delete(mitigationId);
      loadData();
    } catch (error) {
      console.error('Error removing mitigation:', error);
    }
  };

  const handleUpdateMitigation = async (mitigationId: number, updates: DiagramMitigationUpdate) => {
    try {
      await diagramMitigationsApi.update(mitigationId, updates);
      loadData();
      setEditingMitigation(null);
    } catch (error) {
      console.error('Error updating mitigation:', error);
    }
  };

  const handleCreateCustomThreat = async () => {
    if (!threatForm.name || !threatForm.category) return;
    try {
      const response = await threatsApi.create({
        ...threatForm,
        framework_id: modelFrameworkId, // Use the model's framework
      });
      setCreateThreatDialogOpen(false);
      setThreatForm({ name: '', description: '', category: '', framework_id: 0 });
      loadData();
      // Optionally attach the newly created threat
      await handleAttachThreat(response.data);
    } catch (error) {
      console.error('Error creating custom threat:', error);
    }
  };

  const handleCreateCustomMitigation = async () => {
    if (!mitigationForm.name || !mitigationForm.category) return;
    try {
      const response = await mitigationsApi.create({
        ...mitigationForm,
        framework_id: modelFrameworkId, // Use the model's framework
      });
      setCreateMitigationDialogOpen(false);
      setMitigationForm({ name: '', description: '', category: '', framework_id: 0 });
      // Attach the newly created mitigation (this will also clear currentThreat and reload data)
      await handleAttachMitigation(response.data);
    } catch (error) {
      console.error('Error creating custom mitigation:', error);
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
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <h3 className="font-semibold text-sm">Threats ({attachedThreats.length})</h3>
          </div>
          <Button
            size="sm"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

      {loading ? (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            Loading threats...
          </CardContent>
        </Card>
      ) : attachedThreats.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">No threats attached</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Threat
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {attachedThreats.map((dt) => (
            <Collapsible
              key={dt.id}
              open={expandedThreats[dt.id] !== false}
              onOpenChange={() => toggleThreat(dt.id)}
            >
              <Card className="hover:bg-muted/30 transition-colors">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <CollapsibleTrigger asChild>
                        <button className="flex-1 pt-2 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-sm">{dt.threat.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {dt.threat.category}
                            </Badge>
                            {dt.severity && (
                              <Badge variant={getSeverityVariant(dt.severity)} className="text-xs capitalize">
                                {dt.severity}
                              </Badge>
                            )}
                            {dt.risk_score !== null && (
                              <Badge variant="outline" className="text-xs">
                                Risk: {dt.risk_score}
                              </Badge>
                            )}
                            <ChevronDown 
                              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ml-auto ${
                                expandedThreats[dt.id] !== false ? 'transform rotate-180' : ''
                              }`}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {dt.threat.description}
                          </p>
                        </button>
                      </CollapsibleTrigger>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setThreatToDelete(dt);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <CollapsibleContent>
                      <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Status:</Label>
                      <Select
                        value={dt.status}
                        onValueChange={(value) =>
                          handleUpdateThreat(dt.id, { status: value })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="identified">Identified</SelectItem>
                          <SelectItem value="mitigated">Mitigated</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge variant={getStatusColor(dt.status)} className="text-xs">
                        {dt.status}
                      </Badge>
                    </div>

                    {/* Risk Assessment */}
                    <div className="space-y-2 pt-1">
                      <Label className="text-xs font-semibold">Risk Assessment</Label>
                      <RiskSelector
                        likelihood={dt.likelihood}
                        impact={dt.impact}
                        onLikelihoodChange={(value) => handleUpdateThreat(dt.id, { likelihood: value })}
                        onImpactChange={(value) => handleUpdateThreat(dt.id, { impact: value })}
                      />
                    </div>

                    {editingThreat?.id === dt.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingThreat.notes}
                          onChange={(e) =>
                            setEditingThreat({ ...editingThreat, notes: e.target.value })
                          }
                          placeholder="Add notes..."
                          rows={2}
                          className="text-xs"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateThreat(dt.id, { notes: editingThreat.notes })}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingThreat(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {dt.notes ? (
                          <div
                            className="text-xs text-muted-foreground bg-muted p-2 rounded cursor-pointer"
                            onClick={() => setEditingThreat(dt)}
                          >
                            {dt.notes}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setEditingThreat({ ...dt, notes: '' })}
                          >
                            Add notes
                          </Button>
                        )}
                      </div>
                    )}

                    <Separator />

                    {/* Mitigations for this threat */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold flex items-center gap-1">
                          <Shield className="h-3 w-3 text-green-600" />
                          Mitigations
                        </Label>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setCurrentThreat(dt);
                            setAddMitigationDialogOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Mitigation
                        </Button>
                      </div>

                      {elementMitigations.filter((dm: any) => dm.threat_id === dt.id).length > 0 ? (
                        <div className="space-y-2">
                          {elementMitigations.filter((dm: any) => dm.threat_id === dt.id).map((dm: any) => (
                            <div
                              key={dm.id}
                              className="p-3 rounded bg-green-500/5 border border-green-500/20 space-y-2"
                            >
                              <div className="flex items-start gap-2">
                                <Shield className="h-3 w-3 text-green-600 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium">{dm.mitigation.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{dm.mitigation.description}</p>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => setMitigationToDelete(dm)}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                              
                              <div className="flex items-center gap-2 pl-5">
                                <Label className="text-xs">Status:</Label>
                                <Select
                                  value={dm.status}
                                  onValueChange={(value) => handleUpdateMitigation(dm.id, { status: value })}
                                >
                                  <SelectTrigger className="h-6 text-xs w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="proposed">Proposed</SelectItem>
                                    <SelectItem value="implemented">Implemented</SelectItem>
                                    <SelectItem value="verified">Verified</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Badge variant="outline" className="text-xs h-5">
                                  {dm.status}
                                </Badge>
                              </div>

                              {editingMitigation?.id === dm.id ? (
                                <div className="space-y-2 pl-5">
                                  <Textarea
                                    value={editingMitigation.notes}
                                    onChange={(e) =>
                                      setEditingMitigation({ ...editingMitigation, notes: e.target.value })
                                    }
                                    placeholder="Add notes..."
                                    rows={2}
                                    className="text-xs"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      className="h-6 text-xs"
                                      onClick={() => handleUpdateMitigation(dm.id, { notes: editingMitigation.notes })}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-xs"
                                      onClick={() => setEditingMitigation(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="pl-5">
                                  {dm.notes ? (
                                    <div
                                      className="text-xs text-muted-foreground bg-muted/50 p-2 rounded cursor-pointer"
                                      onClick={() => setEditingMitigation(dm)}
                                    >
                                      {dm.notes}
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-xs"
                                      onClick={() => setEditingMitigation({ ...dm, notes: '' })}
                                    >
                                      Add notes
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No mitigations added yet</p>
                      )}
                    </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </CardContent>
              </Card>
            </Collapsible>
          ))}
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
      </CardContent>
    </Card>
  );
}
