import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Shield, ExternalLink, Plus, Trash2, Search, X, MessageSquare, Target } from 'lucide-react';
import { RiskSelector } from '@/components/RiskSelector';
import { diagramMitigationsApi, mitigationsApi, frameworksApi } from '@/lib/api';
import { getSeverityClasses, getStatusClasses } from '@/lib/risk';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { CommentSection } from '@/components/CommentSection';
import { toast } from 'sonner';

interface DiagramMitigation {
  id: number;
  diagram_id: number;
  model_id: number;
  mitigation_id: number;
  element_id: string;
  element_type: string;
  threat_id: number | null;
  status: string;
  comments: string;
  mitigation: {
    id: number;
    name: string;
    description: string;
    category: string;
    framework_id: number;
  };
}

interface KbMitigation {
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

interface ThreatDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem: any;
  itemType: 'threat' | 'mitigation' | null;
  onUpdateStatus: (status: string) => void;
  onUpdateNotes: (comments: string) => void;
  onNavigateToDiagram: (item: any) => void;
  onUpdateRisk?: (threatId: number, data: { likelihood?: number; impact?: number }) => void;
  onMitigationsChange?: () => void;
}

export default function ThreatDetailsSheet({
  open,
  onOpenChange,
  selectedItem,
  itemType,
  onUpdateStatus,
  onUpdateNotes,
  onNavigateToDiagram,
  onUpdateRisk,
  onMitigationsChange,
}: ThreatDetailsSheetProps) {
  const { user, canWrite } = useAuth();
  const authorName = user?.full_name || user?.email || 'Unknown User';

  const [localMitigations, setLocalMitigations] = useState<DiagramMitigation[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [kbMitigations, setKbMitigations] = useState<KbMitigation[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFramework, setSelectedFramework] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loadingKb, setLoadingKb] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DiagramMitigation | null>(null);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (selectedItem) {
      setLocalMitigations(selectedItem.linkedMitigations || []);
    }
  }, [selectedItem]);

  useEffect(() => {
    if (!open) {
      setAddDialogOpen(false);
      setSearchQuery('');
      setSelectedFramework('all');
      setSelectedCategory('all');
      setActiveTab('details');
    }
  }, [open]);

  const handleLikelihoodChange = (value: number) => {
    if (onUpdateRisk && selectedItem?.id) {
      onUpdateRisk(selectedItem.id, { likelihood: value });
    }
  };

  const handleImpactChange = (value: number) => {
    if (onUpdateRisk && selectedItem?.id) {
      onUpdateRisk(selectedItem.id, { impact: value });
    }
  };

  // --- Mitigation CRUD ---
  const handleOpenAddDialog = async () => {
    setLoadingKb(true);
    setAddDialogOpen(true);
    // Pre-select the threat's framework and category
    const threatFrameworkId = selectedItem?.threat?.framework_id;
    const threatCategory = selectedItem?.threat?.category;
    if (threatFrameworkId) {
      setSelectedFramework(threatFrameworkId.toString());
    } else {
      setSelectedFramework('all');
    }
    if (threatCategory) {
      setSelectedCategory(threatCategory);
    } else {
      setSelectedCategory('all');
    }
    try {
      const [mitRes, fwRes] = await Promise.all([
        mitigationsApi.list(),
        frameworksApi.list(),
      ]);
      setKbMitigations(mitRes.data);
      setFrameworks(fwRes.data);
    } catch (err) {
      console.error('Error loading knowledge base:', err);
      toast.error('Failed to load knowledge base');
    } finally {
      setLoadingKb(false);
    }
  };

  const handleAttachMitigation = async (mitigation: KbMitigation) => {
    if (!selectedItem) return;
    try {
      const res = await diagramMitigationsApi.create({
        diagram_id: selectedItem.diagram_id,
        model_id: selectedItem.model_id,
        mitigation_id: mitigation.id,
        element_id: selectedItem.element_id,
        element_type: selectedItem.element_type,
        threat_id: selectedItem.id,
        status: 'proposed',
        comments: '',
      });
      const newDm: DiagramMitigation = {
        ...res.data,
        mitigation: {
          id: mitigation.id,
          name: mitigation.name,
          description: mitigation.description,
          category: mitigation.category,
          framework_id: mitigation.framework_id,
        },
      };
      setLocalMitigations(prev => [...prev, newDm]);
      setAddDialogOpen(false);
      setSearchQuery('');
      onMitigationsChange?.();
      toast.success('Mitigation linked');
    } catch (err) {
      console.error('Error attaching mitigation:', err);
      toast.error('Failed to link mitigation');
    }
  };

  const handleUpdateMitigationStatus = async (dm: DiagramMitigation, status: string) => {
    try {
      setLocalMitigations(prev => prev.map(m => m.id === dm.id ? { ...m, status } : m));
      await diagramMitigationsApi.update(dm.id, { status });
      onMitigationsChange?.();
      toast.success('Status updated');
    } catch (err) {
      console.error('Error updating mitigation status:', err);
      toast.error('Failed to update status');
    }
  };

  const handleSaveMitigationNotes = async (dm: DiagramMitigation, newComments: string) => {
    try {
      setLocalMitigations(prev => prev.map(m => m.id === dm.id ? { ...m, comments: newComments } : m));
      await diagramMitigationsApi.update(dm.id, { comments: newComments });
      onMitigationsChange?.();
    } catch (err) {
      console.error('Error updating mitigation comments:', err);
      toast.error('Failed to save comments');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setLocalMitigations(prev => prev.filter(m => m.id !== deleteTarget.id));
      await diagramMitigationsApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      onMitigationsChange?.();
      toast.success('Mitigation removed');
    } catch (err) {
      console.error('Error deleting mitigation:', err);
      toast.error('Failed to remove mitigation');
    }
  };

  const availableCategories = [...new Set(
    (selectedFramework === 'all'
      ? kbMitigations
      : kbMitigations.filter(m => m.framework_id === parseInt(selectedFramework))
    ).map(m => m.category).filter(Boolean)
  )].sort();

  const filteredKbMitigations = kbMitigations.filter(m => {
    const matchesFramework = selectedFramework === 'all' || m.framework_id === parseInt(selectedFramework);
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase());
    const alreadyLinked = localMitigations.some(lm => lm.mitigation_id === m.id);
    return matchesFramework && matchesCategory && matchesSearch && !alreadyLinked;
  });

  const mitigationProgress = localMitigations.length > 0
    ? Math.round(localMitigations.filter(m => m.status === 'implemented' || m.status === 'verified').length / localMitigations.length * 100)
    : 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="!w-full sm:!max-w-[720px] p-0 overflow-hidden flex flex-col">
          {/* ── Header ── */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-start gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl shrink-0',
                itemType === 'threat' ? 'bg-orange-500/10' : 'bg-green-500/10'
              )}>
                {itemType === 'threat'
                  ? <AlertTriangle className="h-5 w-5 text-orange-600" />
                  : <Shield className="h-5 w-5 text-green-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base font-bold leading-snug mb-1.5">
                  {itemType === 'threat' ? selectedItem?.threat?.name : selectedItem?.mitigation?.name}
                </SheetTitle>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedItem && (
                    <Badge variant="outline" className={cn('text-[11px] capitalize', getStatusClasses(selectedItem.status))}>
                      {selectedItem.status}
                    </Badge>
                  )}
                  {itemType === 'threat' && selectedItem?.severity && (
                    <Badge variant="outline" className={cn('text-[11px] capitalize', getSeverityClasses(selectedItem.severity))}>
                      {selectedItem.severity}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[11px]">
                    {itemType === 'threat' ? selectedItem?.threat?.category : selectedItem?.mitigation?.category}
                  </Badge>
                  {itemType === 'threat' && selectedItem?.risk_score !== null && selectedItem?.risk_score !== undefined && (
                    <Badge variant="secondary" className="text-[11px] font-mono">
                      Risk {selectedItem.risk_score}
                    </Badge>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-1 ml-auto"
                        onClick={() => selectedItem && onNavigateToDiagram(selectedItem)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Diagram
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open in diagram editor</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </SheetHeader>

          {selectedItem && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 pt-2 border-b shrink-0">
                <TabsList variant="line">
                  <TabsTrigger value="details">
                    Details
                  </TabsTrigger>
                  {itemType === 'threat' && (
                    <TabsTrigger value="mitigations" className="gap-1.5">
                      Mitigations
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{localMitigations.length}</Badge>
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="comments">
                    Comments
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ── Details Tab ── */}
              <TabsContent value="details" className="flex-1 overflow-y-auto mt-0 px-6 py-5 space-y-5">
                {/* Description */}
                <div>
                  <p className="text-xs font-bold text-muted-foreground tracking-wider mb-1.5">DESCRIPTION</p>
                  <p className="text-sm leading-relaxed">
                    {itemType === 'threat' ? selectedItem.threat?.description : selectedItem.mitigation?.description}
                  </p>
                </div>

                <Separator />

                {/* Element & Status */}
                <div className="grid gap-4 grid-cols-2">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground tracking-wider mb-1.5">ELEMENT</p>
                    <code className="text-sm bg-muted px-2.5 py-1 rounded-lg border inline-block">
                      {selectedItem.element_id}
                    </code>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground tracking-wider mb-1.5">STATUS</p>
                    {canWrite ? (
                      <Select value={selectedItem.status} onValueChange={onUpdateStatus}>
                        <SelectTrigger className="h-9 text-sm rounded-lg w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {itemType === 'threat' ? (
                            <>
                              <SelectItem value="identified">Identified</SelectItem>
                              <SelectItem value="mitigated">Mitigated</SelectItem>
                              <SelectItem value="accepted">Accepted</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="proposed">Proposed</SelectItem>
                              <SelectItem value="implemented">Implemented</SelectItem>
                              <SelectItem value="verified">Verified</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={cn('capitalize', getStatusClasses(selectedItem.status))}>
                        {selectedItem.status}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Risk Assessment — threats only */}
                {itemType === 'threat' && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-bold text-muted-foreground tracking-wider mb-2">RISK ASSESSMENT</p>
                      <RiskSelector
                        likelihood={selectedItem.likelihood}
                        impact={selectedItem.impact}
                        onLikelihoodChange={handleLikelihoodChange}
                        onImpactChange={handleImpactChange}
                      />
                    </div>
                  </>
                )}

                {/* Mitigation summary for threats */}
                {itemType === 'threat' && localMitigations.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-bold text-muted-foreground tracking-wider mb-2">MITIGATION COVERAGE</p>
                      <div className="flex items-center gap-3">
                        <Progress value={mitigationProgress} className="h-2 flex-1" />
                        <span className="text-sm font-semibold tabular-nums">{mitigationProgress}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {localMitigations.filter(m => m.status === 'implemented' || m.status === 'verified').length} of {localMitigations.length} mitigations active
                      </p>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* ── Mitigations Tab ── */}
              {itemType === 'threat' && (
                <TabsContent value="mitigations" className="flex-1 overflow-y-auto mt-0 px-6 py-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-muted-foreground tracking-wider">
                      LINKED MITIGATIONS ({localMitigations.length})
                    </p>
                    {canWrite && (
                      <Button size="sm" onClick={handleOpenAddDialog} className="h-8 gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    )}
                  </div>

                  {localMitigations.length === 0 ? (
                    <Card className="border-dashed border-2 rounded-xl">
                      <CardContent className="flex flex-col items-center justify-center py-10">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 mb-3">
                          <Shield className="h-6 w-6 text-green-600" />
                        </div>
                        <p className="text-sm font-semibold mb-1">No mitigations linked</p>
                        <p className="text-xs text-muted-foreground text-center max-w-xs">
                          {canWrite ? 'Add mitigations from the knowledge base.' : 'No mitigations linked yet.'}
                        </p>
                        {canWrite && (
                          <Button size="sm" variant="outline" onClick={handleOpenAddDialog} className="mt-3 gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            Add Mitigation
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {localMitigations.map((dm) => (
                        <Card key={dm.id} className="rounded-xl hover:shadow-sm transition-all">
                          <CardContent className="p-4 space-y-3">
                            {/* Mitigation header */}
                            <div className="flex items-start gap-3">
                              <Shield className={cn(
                                'h-4 w-4 shrink-0 mt-0.5',
                                dm.status === 'verified' ? 'text-green-600' :
                                dm.status === 'implemented' ? 'text-emerald-500' :
                                'text-muted-foreground'
                              )} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold">{dm.mitigation.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                                  {dm.mitigation.description}
                                </p>
                              </div>
                              {canWrite && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive shrink-0"
                                      aria-label="Remove mitigation"
                                      onClick={() => setDeleteTarget(dm)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remove mitigation</TooltipContent>
                                </Tooltip>
                              )}
                            </div>

                            {/* Category + Status */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[11px]">{dm.mitigation.category}</Badge>
                              {canWrite ? (
                                <Select
                                  value={dm.status}
                                  onValueChange={(val) => handleUpdateMitigationStatus(dm, val)}
                                >
                                  <SelectTrigger className={cn(
                                    'h-6 text-[11px] w-auto px-2 rounded-md border gap-1',
                                    getStatusClasses(dm.status)
                                  )}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="proposed">Proposed</SelectItem>
                                    <SelectItem value="implemented">Implemented</SelectItem>
                                    <SelectItem value="verified">Verified</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline" className={cn('text-[11px] capitalize', getStatusClasses(dm.status))}>
                                  {dm.status}
                                </Badge>
                              )}
                            </div>

                            {/* Comments */}
                            <CommentSection
                              comments={dm.comments}
                              canWrite={canWrite}
                              authorName={authorName}
                              onSave={(newComments) => handleSaveMitigationNotes(dm, newComments)}
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}

              {/* ── Comments Tab ── */}
              <TabsContent value="comments" className="flex-1 overflow-y-auto mt-0 px-6 py-5">
                <CommentSection
                  comments={selectedItem.comments || ''}
                  canWrite={canWrite}
                  authorName={authorName}
                  onSave={onUpdateNotes}
                />
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Mitigation Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="!max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>Add Mitigation</DialogTitle>
            <DialogDescription>
              Select a mitigation from the knowledge base to link to this threat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search mitigations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-lg"
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
              <Select
                value={selectedFramework}
                onValueChange={(val) => { setSelectedFramework(val); setSelectedCategory('all'); }}
              >
                <SelectTrigger className="w-44 rounded-lg">
                  <SelectValue placeholder="Framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frameworks</SelectItem>
                  {frameworks.map((fw) => (
                    <SelectItem key={fw.id} value={fw.id.toString()}>{fw.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={availableCategories.length === 0}>
                <SelectTrigger className="w-44 rounded-lg">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active filters */}
            {(selectedFramework !== 'all' || selectedCategory !== 'all') && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium">Filters:</span>
                {selectedFramework !== 'all' && (
                  <button
                    onClick={() => { setSelectedFramework('all'); setSelectedCategory('all'); }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    {frameworks.find(f => f.id.toString() === selectedFramework)?.name}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {selectedCategory !== 'all' && (
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    {selectedCategory}
                    <X className="h-3 w-3" />
                  </button>
                )}
                <span className="text-xs text-muted-foreground">
                  — {filteredKbMitigations.length} result{filteredKbMitigations.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            <ScrollArea className="h-[380px] rounded-xl border">
              <div className="p-3">
                {loadingKb ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : filteredKbMitigations.length === 0 ? (
                  <div className="text-center py-10">
                    <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {kbMitigations.length === 0 ? 'No mitigations in the knowledge base' : 'No mitigations match your filters'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                  {filteredKbMitigations.map((mitigation) => (
                    <Card
                      key={mitigation.id}
                      className="cursor-pointer hover:bg-muted/50 hover:border-primary/20 hover:shadow-sm transition-all rounded-xl"
                      onClick={() => handleAttachMitigation(mitigation)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <Shield className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <p className="text-sm font-semibold">{mitigation.name}</p>
                                <Badge variant="outline" className="text-[11px]">{mitigation.category}</Badge>
                                {mitigation.is_custom && (
                                  <Badge variant="secondary" className="text-[11px]">Custom</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                {mitigation.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                            <Plus className="h-4 w-4" />
                          </div>
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
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Mitigation</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <span className="font-semibold">"{deleteTarget?.mitigation.name}"</span> from this threat? The mitigation will remain in the knowledge base.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
