import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, ExternalLink, Plus, Trash2, Search, X, Check, Pencil } from 'lucide-react';
import { RiskSelector } from '@/components/RiskSelector';
import { diagramMitigationsApi, mitigationsApi, frameworksApi } from '@/lib/api';
import { getSeverityClasses, getStatusClasses } from '@/lib/risk';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface DiagramMitigation {
  id: number;
  diagram_id: number;
  model_id: number;
  mitigation_id: number;
  element_id: string;
  element_type: string;
  threat_id: number | null;
  status: string;
  notes: string;
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
  onUpdateNotes: (notes: string) => void;
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
  const { canWrite } = useAuth();

  // Threat notes state
  const [editNotes, setEditNotes] = useState('');

  // Local mitigations state (source of truth while sheet is open)
  const [localMitigations, setLocalMitigations] = useState<DiagramMitigation[]>([]);

  // Add mitigation dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [kbMitigations, setKbMitigations] = useState<KbMitigation[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFramework, setSelectedFramework] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loadingKb, setLoadingKb] = useState(false);

  // Inline edit state per mitigation
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<DiagramMitigation | null>(null);

  useEffect(() => {
    if (selectedItem) {
      setEditNotes(selectedItem.notes || '');
      setLocalMitigations(selectedItem.linkedMitigations || []);
    }
  }, [selectedItem]);

  // Reset editing state when sheet closes
  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setAddDialogOpen(false);
      setSearchQuery('');
      setSelectedFramework('all');
      setSelectedCategory('all');
    }
  }, [open]);

  const handleUpdateNotes = () => {
    onUpdateNotes(editNotes);
  };

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
    try {
      const [mitRes, fwRes] = await Promise.all([
        mitigationsApi.list(),
        frameworksApi.list(),
      ]);
      setKbMitigations(mitRes.data);
      setFrameworks(fwRes.data);
    } catch (err) {
      console.error('Error loading knowledge base:', err);
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
        notes: '',
      });
      // Build the full local object with nested mitigation data
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
    } catch (err) {
      console.error('Error attaching mitigation:', err);
    }
  };

  const handleUpdateMitigationStatus = async (dm: DiagramMitigation, status: string) => {
    try {
      await diagramMitigationsApi.update(dm.id, { status });
      setLocalMitigations(prev => prev.map(m => m.id === dm.id ? { ...m, status } : m));
      onMitigationsChange?.();
    } catch (err) {
      console.error('Error updating mitigation status:', err);
    }
  };

  const handleSaveMitigationNotes = async (dm: DiagramMitigation) => {
    try {
      await diagramMitigationsApi.update(dm.id, { notes: editingNotes });
      setLocalMitigations(prev => prev.map(m => m.id === dm.id ? { ...m, notes: editingNotes } : m));
      setEditingId(null);
      onMitigationsChange?.();
    } catch (err) {
      console.error('Error updating mitigation notes:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await diagramMitigationsApi.delete(deleteTarget.id);
      setLocalMitigations(prev => prev.filter(m => m.id !== deleteTarget.id));
      setDeleteTarget(null);
      onMitigationsChange?.();
    } catch (err) {
      console.error('Error deleting mitigation:', err);
    }
  };

  // Categories available given the current framework selection
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="!w-full sm:!max-w-[720px] p-0 overflow-y-auto flex flex-col">
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60 bg-gradient-to-b from-muted/30 to-background shrink-0">
            <div className="flex items-start gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl shrink-0 shadow-sm',
                itemType === 'threat'
                  ? 'bg-gradient-to-br from-orange-500/10 to-orange-500/5'
                  : 'bg-gradient-to-br from-green-500/10 to-green-500/5'
              )}>
                <Shield className={cn('h-5 w-5', itemType === 'threat' ? 'text-orange-600' : 'text-green-600')} />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg font-bold leading-snug">
                  {itemType === 'threat' ? selectedItem?.threat?.name : selectedItem?.mitigation?.name}
                </SheetTitle>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {itemType === 'threat' ? selectedItem?.threat?.category : selectedItem?.mitigation?.category}
                  </Badge>
                  {selectedItem && (
                    <Badge variant="outline" className={cn('text-xs border capitalize', getStatusClasses(selectedItem.status))}>
                      {selectedItem.status}
                    </Badge>
                  )}
                  {itemType === 'threat' && selectedItem?.severity && (
                    <Badge variant="outline" className={cn('text-xs border capitalize', getSeverityClasses(selectedItem.severity))}>
                      {selectedItem.severity}
                    </Badge>
                  )}
                  {selectedItem && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigateToDiagram(selectedItem)}
                      className="h-7 px-2.5 text-xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      View Diagram
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>

          {selectedItem && (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Description */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground tracking-wider">DESCRIPTION</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {itemType === 'threat' ? selectedItem.threat?.description : selectedItem.mitigation?.description}
                </p>
              </div>

              <div className="h-px bg-border/60" />

              {/* Element & Status */}
              <div className="grid gap-4 grid-cols-2">
                <Field>
                  <FieldLabel>Element</FieldLabel>
                  <code className="text-sm bg-muted px-2.5 py-1 rounded-lg border border-border/60 inline-block">
                    {selectedItem.element_id}
                  </code>
                </Field>
                <Field>
                  <FieldLabel htmlFor="item-status">Status</FieldLabel>
                  {canWrite ? (
                    <Select value={selectedItem.status} onValueChange={onUpdateStatus}>
                      <SelectTrigger id="item-status" className="h-9 text-sm rounded-lg border-border/60">
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
                    <Badge variant="outline" className={cn('border capitalize', getStatusClasses(selectedItem.status))}>
                      {selectedItem.status}
                    </Badge>
                  )}
                </Field>
              </div>

              <div className="h-px bg-border/60" />

              {/* Risk Assessment — threats only */}
              {itemType === 'threat' && (
                <>
                  <Field>
                    <FieldLabel>Risk Assessment</FieldLabel>
                    <RiskSelector
                      likelihood={selectedItem.likelihood}
                      impact={selectedItem.impact}
                      onLikelihoodChange={handleLikelihoodChange}
                      onImpactChange={handleImpactChange}
                    />
                  </Field>
                  <div className="h-px bg-border/60" />
                </>
              )}

              {/* Notes */}
              <Field>
                <FieldLabel htmlFor="item-notes">Notes</FieldLabel>
                <Textarea
                  id="item-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes or additional context..."
                  rows={4}
                  className="resize-none rounded-lg border-border/60"
                  readOnly={!canWrite}
                />
                {canWrite && (
                  <Button onClick={handleUpdateNotes} size="sm" className="mt-2 rounded-lg shadow-sm">
                    Save Notes
                  </Button>
                )}
              </Field>

              {/* Linked Mitigations — threats only */}
              {itemType === 'threat' && (
                <>
                  <div className="h-px bg-border/60" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-muted-foreground tracking-wider">
                        LINKED MITIGATIONS ({localMitigations.length})
                      </p>
                      {canWrite && (
                        <Button
                          size="sm"
                          onClick={handleOpenAddDialog}
                          className="h-8 px-3 rounded-lg shadow-sm hover:shadow-md transition-all gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Mitigation
                        </Button>
                      )}
                    </div>

                    {localMitigations.length === 0 ? (
                      <Card className="border-dashed border-2 rounded-xl">
                        <CardContent className="flex flex-col items-center justify-center py-8">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 mb-3 shadow-sm">
                            <Shield className="h-6 w-6 text-green-600" />
                          </div>
                          <p className="text-sm font-semibold mb-1">No mitigations linked</p>
                          <p className="text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
                            {canWrite ? 'Add mitigations from the knowledge base to address this threat.' : 'No mitigations have been linked to this threat yet.'}
                          </p>
                          {canWrite && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleOpenAddDialog}
                              className="mt-3 rounded-lg gap-1.5"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add Mitigation
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {localMitigations.map((dm) => (
                          <Card
                            key={dm.id}
                            className="rounded-xl border-border/60 hover:border-primary/20 transition-all duration-200 hover:shadow-sm"
                          >
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                {/* Header row */}
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5 shrink-0 mt-0.5">
                                      <Shield className="h-4 w-4 text-green-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold truncate">{dm.mitigation.name}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                                        {dm.mitigation.description}
                                      </p>
                                    </div>
                                  </div>
                                  {canWrite && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all"
                                      onClick={() => setDeleteTarget(dm)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>

                                {/* Badges row */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs">{dm.mitigation.category}</Badge>
                                  {canWrite ? (
                                    <Select
                                      value={dm.status}
                                      onValueChange={(val) => handleUpdateMitigationStatus(dm, val)}
                                    >
                                      <SelectTrigger className={cn(
                                        'h-6 text-xs w-auto px-2.5 rounded-md border gap-1.5',
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
                                    <Badge variant="outline" className={cn('text-xs border capitalize', getStatusClasses(dm.status))}>
                                      {dm.status}
                                    </Badge>
                                  )}
                                </div>

                                {/* Notes */}
                                {editingId === dm.id ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      value={editingNotes}
                                      onChange={(e) => setEditingNotes(e.target.value)}
                                      placeholder="Add notes..."
                                      rows={2}
                                      className="text-xs resize-none rounded-lg border-border/60"
                                      autoFocus
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        className="h-7 px-3 text-xs rounded-lg gap-1.5"
                                        onClick={() => handleSaveMitigationNotes(dm)}
                                      >
                                        <Check className="h-3 w-3" />
                                        Save
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-3 text-xs rounded-lg"
                                        onClick={() => setEditingId(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    {dm.notes ? (
                                      <div
                                        className={cn(
                                          'text-xs text-muted-foreground bg-muted/60 px-3 py-2 rounded-lg border border-border/40 leading-relaxed',
                                          canWrite && 'cursor-pointer hover:bg-muted/80 transition-colors'
                                        )}
                                        onClick={() => {
                                          if (!canWrite) return;
                                          setEditingId(dm.id);
                                          setEditingNotes(dm.notes);
                                        }}
                                      >
                                        <span className="font-semibold">Notes:</span> {dm.notes}
                                        {canWrite && <Pencil className="inline h-3 w-3 ml-1.5 opacity-50" />}
                                      </div>
                                    ) : canWrite ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground gap-1.5 rounded-lg"
                                        onClick={() => {
                                          setEditingId(dm.id);
                                          setEditingNotes('');
                                        }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                        Add notes
                                      </Button>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Mitigation Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Add Mitigation</DialogTitle>
            <DialogDescription>
              Select a mitigation from the knowledge base to link to this threat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Filters row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search mitigations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-lg border-border/60"
                />
                {searchQuery && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 rounded-md"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Select
                value={selectedFramework}
                onValueChange={(val) => {
                  setSelectedFramework(val);
                  setSelectedCategory('all');
                }}
              >
                <SelectTrigger className="w-44 rounded-lg border-border/60">
                  <SelectValue placeholder="Framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frameworks</SelectItem>
                  {frameworks.map((fw) => (
                    <SelectItem key={fw.id} value={fw.id.toString()}>
                      {fw.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                disabled={availableCategories.length === 0}
              >
                <SelectTrigger className="w-44 rounded-lg border-border/60">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active filter chips */}
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


            <ScrollArea className="h-[380px] rounded-xl border border-border/60">
              <div className="p-3 space-y-2">
                {loadingKb ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : filteredKbMitigations.length === 0 ? (
                  <div className="text-center py-10">
                    <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {kbMitigations.length === 0
                        ? 'No mitigations in the knowledge base'
                        : 'No mitigations match your search'}
                    </p>
                  </div>
                ) : (
                  filteredKbMitigations.map((mitigation) => (
                    <Card
                      key={mitigation.id}
                      className="cursor-pointer hover:bg-muted/50 hover:border-primary/20 hover:shadow-sm transition-all duration-200 rounded-xl border-border/60"
                      onClick={() => handleAttachMitigation(mitigation)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5 shrink-0 mt-0.5">
                              <Shield className="h-4 w-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <p className="text-sm font-semibold">{mitigation.name}</p>
                                <Badge variant="outline" className="text-xs">{mitigation.category}</Badge>
                                {mitigation.is_custom && (
                                  <Badge variant="secondary" className="text-xs">Custom</Badge>
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
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="rounded-lg">
              Close
            </Button>
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
