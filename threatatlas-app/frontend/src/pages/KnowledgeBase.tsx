import { useState, useEffect } from 'react';
import { frameworksApi, threatsApi, mitigationsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Library, AlertTriangle, Shield, Sparkles, Plus, MoreVertical, Pencil, Trash2, Search, X, Undo2, Map } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { toast } from 'sonner';

interface Framework {
  id: number;
  name: string;
  description: string;
  is_custom: boolean;
  user_id: number | null;
}

interface Threat {
  id: number;
  framework_id: number;
  name: string;
  description: string;
  category: string;
  is_custom: boolean;
  is_modified: boolean;
  original_name: string | null;
  original_description: string | null;
  original_category: string | null;
  user_id: number | null;
}

interface Mitigation {
  id: number;
  framework_id: number;
  name: string;
  description: string;
  category: string;
  is_custom: boolean;
  is_modified: boolean;
  original_name: string | null;
  original_description: string | null;
  original_category: string | null;
  user_id: number | null;
}

export default function KnowledgeBase() {
  const { canWrite } = useAuth();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [selectedFramework, setSelectedFramework] = useState<number | null>(null);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [mitigations, setMitigations] = useState<Mitigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  // Filter state
  const [threatSearch, setThreatSearch] = useState('');
  const [threatCategoryFilter, setThreatCategoryFilter] = useState('all');
  const [mitigationSearch, setMitigationSearch] = useState('');
  const [mitigationCategoryFilter, setMitigationCategoryFilter] = useState('all');

  // Framework dialog state
  const [frameworkDialogOpen, setFrameworkDialogOpen] = useState(false);
  const [editingFramework, setEditingFramework] = useState<Framework | null>(null);
  const [frameworkForm, setFrameworkForm] = useState({ name: '', description: '' });
  const [deleteFrameworkOpen, setDeleteFrameworkOpen] = useState(false);
  const [frameworkToDelete, setFrameworkToDelete] = useState<Framework | null>(null);

  // Threat dialog state
  const [threatDialogOpen, setThreatDialogOpen] = useState(false);
  const [editingThreat, setEditingThreat] = useState<Threat | null>(null);
  const [threatForm, setThreatForm] = useState({ name: '', description: '', category: '' });
  const [deleteThreatOpen, setDeleteThreatOpen] = useState(false);
  const [threatToDelete, setThreatToDelete] = useState<Threat | null>(null);

  // Mitigation dialog state
  const [mitigationDialogOpen, setMitigationDialogOpen] = useState(false);
  const [editingMitigation, setEditingMitigation] = useState<Mitigation | null>(null);
  const [mitigationForm, setMitigationForm] = useState({ name: '', description: '', category: '' });
  const [deleteMitigationOpen, setDeleteMitigationOpen] = useState(false);
  const [mitigationToDelete, setMitigationToDelete] = useState<Mitigation | null>(null);

  useEffect(() => {
    loadFrameworks();
  }, []);

  useEffect(() => {
    if (selectedFramework) {
      setLoadingContent(true);
      setThreatSearch('');
      setThreatCategoryFilter('all');
      setMitigationSearch('');
      setMitigationCategoryFilter('all');
      Promise.all([
        loadThreats(selectedFramework),
        loadMitigations(selectedFramework),
      ]).finally(() => setLoadingContent(false));
    }
  }, [selectedFramework]);

  const loadFrameworks = async () => {
    try {
      setLoading(true);
      const response = await frameworksApi.list();
      setFrameworks(response.data);
      if (response.data.length > 0 && !selectedFramework) {
        setSelectedFramework(response.data[0].id);
      }
    } catch (error) {
      console.error('Error loading frameworks:', error);
      toast.error('Failed to load frameworks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadThreats = async (frameworkId: number) => {
    try {
      const response = await threatsApi.list({ framework_id: frameworkId });
      setThreats(response.data);
    } catch (error) {
      console.error('Error loading threats:', error);
      toast.error('Failed to load threats. Please try again.');
    }
  };

  const loadMitigations = async (frameworkId: number) => {
    try {
      const response = await mitigationsApi.list({ framework_id: frameworkId });
      setMitigations(response.data);
    } catch (error) {
      console.error('Error loading mitigations:', error);
      toast.error('Failed to load mitigations. Please try again.');
    }
  };

  // Framework handlers
  const handleCreateFramework = async () => {
    try {
      const response = await frameworksApi.create(frameworkForm);
      setFrameworkDialogOpen(false);
      setFrameworkForm({ name: '', description: '' });
      loadFrameworks();
      setSelectedFramework(response.data.id);
      toast.success('Framework created successfully.');
    } catch (error) {
      console.error('Error creating framework:', error);
      toast.error('Failed to create framework. Please try again.');
    }
  };

  const handleUpdateFramework = async () => {
    if (!editingFramework) return;
    try {
      await frameworksApi.update(editingFramework.id, frameworkForm);
      setFrameworkDialogOpen(false);
      setEditingFramework(null);
      setFrameworkForm({ name: '', description: '' });
      loadFrameworks();
      toast.success('Framework updated successfully.');
    } catch (error) {
      console.error('Error updating framework:', error);
      toast.error('Failed to update framework. Please try again.');
    }
  };

  const openDeleteFrameworkDialog = (framework: Framework) => {
    if (!framework.is_custom) {
      alert('Cannot delete pre-defined frameworks');
      return;
    }
    setFrameworkToDelete(framework);
    // Defer opening the dialog so DropdownMenu can fully close first
    setTimeout(() => setDeleteFrameworkOpen(true), 0);
  };

  const handleDeleteFramework = async () => {
    if (!frameworkToDelete) return;
    try {
      await frameworksApi.delete(frameworkToDelete.id);
      setDeleteFrameworkOpen(false);
      setFrameworkToDelete(null);
      if (selectedFramework === frameworkToDelete.id) {
        setSelectedFramework(null);
      }
      loadFrameworks();
      toast.success('Framework deleted successfully.');
    } catch (error) {
      console.error('Error deleting framework:', error);
      toast.error('Failed to delete framework. Please try again.');
    }
  };

  const openFrameworkDialog = (framework?: Framework) => {
    if (framework) {
      setEditingFramework(framework);
      setFrameworkForm({
        name: framework.name,
        description: framework.description,
      });
    } else {
      setEditingFramework(null);
      setFrameworkForm({ name: '', description: '' });
    }
    setFrameworkDialogOpen(true);
  };

  // Threat handlers
  const handleCreateThreat = async () => {
    if (!selectedFramework) return;
    try {
      await threatsApi.create({
        ...threatForm,
        framework_id: selectedFramework,
      });
      setThreatDialogOpen(false);
      setThreatForm({ name: '', description: '', category: '' });
      loadThreats(selectedFramework);
      toast.success('Threat created successfully.');
    } catch (error) {
      console.error('Error creating threat:', error);
      toast.error('Failed to create threat. Please try again.');
    }
  };

  const handleUpdateThreat = async () => {
    if (!editingThreat) return;
    try {
      await threatsApi.update(editingThreat.id, threatForm);
      setThreatDialogOpen(false);
      setEditingThreat(null);
      setThreatForm({ name: '', description: '', category: '' });
      if (selectedFramework) loadThreats(selectedFramework);
      toast.success('Threat updated successfully.');
    } catch (error) {
      console.error('Error updating threat:', error);
      toast.error('Failed to update threat. Please try again.');
    }
  };

  const openDeleteThreatDialog = (threat: Threat) => {
    setThreatToDelete(threat);
    setDeleteThreatOpen(true);
  };

  const handleDeleteThreat = async () => {
    if (!threatToDelete) return;
    try {
      await threatsApi.delete(threatToDelete.id);
      setDeleteThreatOpen(false);
      setThreatToDelete(null);
      if (selectedFramework) loadThreats(selectedFramework);
      toast.success('Threat deleted successfully.');
    } catch (error) {
      console.error('Error deleting threat:', error);
      toast.error('Failed to delete threat. Please try again.');
    }
  };

  const handleRevertThreat = async (threat: Threat) => {
    try {
      await threatsApi.revert(threat.id);
      if (selectedFramework) loadThreats(selectedFramework);
      toast.success('Threat reverted to original.');
    } catch (error) {
      console.error('Error reverting threat:', error);
      toast.error('Failed to revert threat.');
    }
  };

  const openThreatDialog = (threat?: Threat) => {
    if (threat) {
      setEditingThreat(threat);
      setThreatForm({
        name: threat.name,
        description: threat.description,
        category: threat.category,
      });
    } else {
      setEditingThreat(null);
      setThreatForm({ name: '', description: '', category: '' });
    }
    setThreatDialogOpen(true);
  };

  // Mitigation handlers
  const handleCreateMitigation = async () => {
    if (!selectedFramework) return;
    try {
      await mitigationsApi.create({
        ...mitigationForm,
        framework_id: selectedFramework,
      });
      setMitigationDialogOpen(false);
      setMitigationForm({ name: '', description: '', category: '' });
      loadMitigations(selectedFramework);
      toast.success('Mitigation created successfully.');
    } catch (error) {
      console.error('Error creating mitigation:', error);
      toast.error('Failed to create mitigation. Please try again.');
    }
  };

  const handleUpdateMitigation = async () => {
    if (!editingMitigation) return;
    try {
      await mitigationsApi.update(editingMitigation.id, mitigationForm);
      setMitigationDialogOpen(false);
      setEditingMitigation(null);
      setMitigationForm({ name: '', description: '', category: '' });
      if (selectedFramework) loadMitigations(selectedFramework);
      toast.success('Mitigation updated successfully.');
    } catch (error) {
      console.error('Error updating mitigation:', error);
      toast.error('Failed to update mitigation. Please try again.');
    }
  };

  const openDeleteMitigationDialog = (mitigation: Mitigation) => {
    setMitigationToDelete(mitigation);
    setDeleteMitigationOpen(true);
  };

  const handleDeleteMitigation = async () => {
    if (!mitigationToDelete) return;
    try {
      await mitigationsApi.delete(mitigationToDelete.id);
      setDeleteMitigationOpen(false);
      setMitigationToDelete(null);
      if (selectedFramework) loadMitigations(selectedFramework);
      toast.success('Mitigation deleted successfully.');
    } catch (error) {
      console.error('Error deleting mitigation:', error);
      toast.error('Failed to delete mitigation. Please try again.');
    }
  };

  const handleRevertMitigation = async (mitigation: Mitigation) => {
    try {
      await mitigationsApi.revert(mitigation.id);
      if (selectedFramework) loadMitigations(selectedFramework);
      toast.success('Mitigation reverted to original.');
    } catch (error) {
      console.error('Error reverting mitigation:', error);
      toast.error('Failed to revert mitigation.');
    }
  };

  const openMitigationDialog = (mitigation?: Mitigation) => {
    if (mitigation) {
      setEditingMitigation(mitigation);
      setMitigationForm({
        name: mitigation.name,
        description: mitigation.description,
        category: mitigation.category,
      });
    } else {
      setEditingMitigation(null);
      setMitigationForm({ name: '', description: '', category: '' });
    }
    setMitigationDialogOpen(true);
  };

  // Unique categories (for filter selects and create/edit forms)
  const threatCategories = Array.from(new Set(threats.map(t => t.category).filter(Boolean))).sort();
  const mitigationCategories = Array.from(new Set(mitigations.map(m => m.category).filter(Boolean))).sort();

  // Filtered lists
  const filteredThreats = threats.filter(t => {
    const matchesSearch =
      t.name.toLowerCase().includes(threatSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(threatSearch.toLowerCase()) ||
      t.category.toLowerCase().includes(threatSearch.toLowerCase());
    const matchesCategory = threatCategoryFilter === 'all' || t.category === threatCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredMitigations = mitigations.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(mitigationSearch.toLowerCase()) ||
      m.description.toLowerCase().includes(mitigationSearch.toLowerCase()) ||
      m.category.toLowerCase().includes(mitigationSearch.toLowerCase());
    const matchesCategory = mitigationCategoryFilter === 'all' || m.category === mitigationCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 space-y-6 mx-auto p-4">
      <div className="flex justify-end">
        {canWrite && (
          <Button onClick={() => openFrameworkDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            New Framework
          </Button>
        )}
      </div>

      {loading ? (
        <Card className="border-dashed rounded-xl animate-pulse">
          <CardContent className="flex items-center justify-center p-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground font-medium">Loading knowledge base...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Framework Selection — 8 per row, compact */}
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
            {frameworks.map((framework) => {
              const isSelected = selectedFramework === framework.id;
              return (
                <Card
                  key={framework.id}
                  className={`cursor-pointer relative transition-all duration-200 rounded-xl group ${
                    isSelected
                      ? 'border-primary/60 ring-2 ring-primary/40 ring-offset-1 shadow-sm bg-primary/5'
                      : 'hover:border-primary/30 hover:shadow-sm'
                  }`}
                  onClick={() => setSelectedFramework(framework.id)}
                >
                  <CardContent className="p-3 flex items-center gap-2.5">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 transition-all duration-200 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-primary/10 text-primary group-hover:bg-primary/20'
                    }`}>
                      <Library className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {framework.name}
                      </p>
                      {framework.is_custom && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Custom</span>
                      )}
                    </div>
                    {framework.is_custom && canWrite && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted rounded-md shrink-0">
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => openFrameworkDialog(framework)} className="cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openDeleteFrameworkDialog(framework)}
                              className="text-destructive cursor-pointer focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Framework Description Panel */}
          {selectedFramework && (() => {
            const fw = frameworks.find(f => f.id === selectedFramework);
            if (!fw) return null;
            return (
              <Card className="border-border/60 rounded-xl">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0 mt-0.5">
                    <Library className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{fw.name}</h3>
                      {fw.is_custom && (
                        <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider">Custom</Badge>
                      )}
                      {loadingContent && (
                        <span className="text-xs text-muted-foreground animate-pulse">Loading threats &amp; mitigations…</span>
                      )}
                      {!loadingContent && (
                        <span className="text-xs text-muted-foreground">
                          {threats.length} threats · {mitigations.length} mitigations
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{fw.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Threats and Mitigations Tabs */}
          <Tabs defaultValue="threats" className="w-full space-y-4">
            <TabsList className="grid w-full max-w-[580px] grid-cols-3 h-11 p-1 rounded-xl shadow-sm">
              <TabsTrigger value="threats" className="gap-2 rounded-lg font-semibold transition-all duration-200 data-[state=active]:shadow-sm">
                <AlertTriangle className="h-4 w-4" />
                Threats ({threats.length})
              </TabsTrigger>
              <TabsTrigger value="mitigations" className="gap-2 rounded-lg font-semibold transition-all duration-200 data-[state=active]:shadow-sm">
                <Shield className="h-4 w-4" />
                Mitigations ({mitigations.length})
              </TabsTrigger>
              <TabsTrigger value="coverage" className="gap-2 rounded-lg font-semibold transition-all duration-200 data-[state=active]:shadow-sm">
                <Map className="h-4 w-4" />
                Coverage
              </TabsTrigger>
            </TabsList>

            <TabsContent value="threats" className="space-y-3 animate-fadeIn">
              {/* Filter bar */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search threats..."
                    value={threatSearch}
                    onChange={(e) => setThreatSearch(e.target.value)}
                    className="pl-9 rounded-lg border-border/60"
                  />
                  {threatSearch && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 rounded-md"
                      onClick={() => setThreatSearch('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Select
                  value={threatCategoryFilter}
                  onValueChange={setThreatCategoryFilter}
                  disabled={threatCategories.length === 0}
                >
                  <SelectTrigger className="w-44 rounded-lg border-border/60">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {threatCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canWrite && (
                  <Button
                    onClick={() => openThreatDialog()}
                    size="sm"
                    className="shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 rounded-lg font-semibold shrink-0"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom Threat
                  </Button>
                )}
              </div>

              {/* Active filter chips */}
              {(threatSearch || threatCategoryFilter !== 'all') && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">Filters:</span>
                  {threatCategoryFilter !== 'all' && (
                    <button
                      onClick={() => setThreatCategoryFilter('all')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      {threatCategoryFilter}
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {threatSearch && (
                    <button
                      onClick={() => setThreatSearch('')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      "{threatSearch}"
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    — {filteredThreats.length} result{filteredThreats.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {threats.length === 0 ? (
                <Card className="border-dashed border-2 rounded-xl">
                  <CardContent className="flex flex-col items-center justify-center p-16">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4 shadow-sm" style={{ backgroundColor: 'var(--risk-high-muted)' }}>
                      <AlertTriangle className="h-8 w-8" style={{ color: 'var(--risk-high)' }} />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No threats available</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
                      This framework doesn't have any threats defined yet.
                    </p>
                  </CardContent>
                </Card>
              ) : filteredThreats.length === 0 ? (
                <Card className="border-dashed rounded-xl">
                  <CardContent className="flex flex-col items-center justify-center p-12">
                    <Search className="h-8 w-8 text-muted-foreground mb-3" />
                    <h3 className="text-base font-medium mb-1">No threats match your filters</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      Try adjusting your search or category filter.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b border-border/60">
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead className="font-bold text-foreground/90">Name</TableHead>
                          <TableHead className="font-bold text-foreground/90">Category</TableHead>
                          <TableHead className="font-bold text-foreground/90">Description</TableHead>
                          <TableHead className="w-[120px] font-bold text-foreground/90">Type</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredThreats.map((threat, index) => (
                          <TableRow
                            key={threat.id}
                            className="hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0"
                            style={{
                              animation: 'fadeIn 0.3s ease-out forwards',
                              animationDelay: `${index * 30}ms`,
                              opacity: 0
                            }}
                          >
                            <TableCell>
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl shadow-sm" style={{ backgroundColor: 'var(--risk-high-muted)' }}>
                                <AlertTriangle className="h-4 w-4" style={{ color: 'var(--risk-high)' }} />
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{threat.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-medium shadow-sm rounded-lg">{threat.category}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs font-medium">
                              <span className="line-clamp-2" title={threat.description}>{threat.description}</span>
                            </TableCell>
                            <TableCell>
                              {threat.is_custom ? (
                                <Badge variant="default" className="gap-1.5 font-semibold shadow-sm rounded-lg">
                                  <Sparkles className="h-3 w-3" />Custom
                                </Badge>
                              ) : threat.is_modified ? (
                                <Badge variant="outline" className="gap-1.5 font-semibold shadow-sm rounded-lg" style={{ borderColor: 'color-mix(in srgb, var(--lemon-500) 40%, transparent)', color: 'var(--risk-medium)' }}>
                                  <Pencil className="h-3 w-3" />Modified
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="font-semibold shadow-sm rounded-lg">Predefined</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {canWrite && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted transition-all rounded-lg">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem onClick={() => openThreatDialog(threat)} className="cursor-pointer">
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    {!threat.is_custom && threat.is_modified && (
                                      <DropdownMenuItem onClick={() => handleRevertThreat(threat)} className="cursor-pointer">
                                        <Undo2 className="mr-2 h-4 w-4" />
                                        Revert to original
                                      </DropdownMenuItem>
                                    )}
                                    {threat.is_custom && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => openDeleteThreatDialog(threat)}
                                          className="text-destructive cursor-pointer focus:text-destructive"
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="mitigations" className="space-y-3 animate-fadeIn">
              {/* Filter bar */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search mitigations..."
                    value={mitigationSearch}
                    onChange={(e) => setMitigationSearch(e.target.value)}
                    className="pl-9 rounded-lg border-border/60"
                  />
                  {mitigationSearch && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 rounded-md"
                      onClick={() => setMitigationSearch('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Select
                  value={mitigationCategoryFilter}
                  onValueChange={setMitigationCategoryFilter}
                  disabled={mitigationCategories.length === 0}
                >
                  <SelectTrigger className="w-44 rounded-lg border-border/60">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {mitigationCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canWrite && (
                  <Button
                    onClick={() => openMitigationDialog()}
                    size="sm"
                    className="shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 rounded-lg font-semibold shrink-0"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom Mitigation
                  </Button>
                )}
              </div>

              {/* Active filter chips */}
              {(mitigationSearch || mitigationCategoryFilter !== 'all') && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">Filters:</span>
                  {mitigationCategoryFilter !== 'all' && (
                    <button
                      onClick={() => setMitigationCategoryFilter('all')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      {mitigationCategoryFilter}
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {mitigationSearch && (
                    <button
                      onClick={() => setMitigationSearch('')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      "{mitigationSearch}"
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    — {filteredMitigations.length} result{filteredMitigations.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {mitigations.length === 0 ? (
                <Card className="border-dashed border-2 rounded-xl">
                  <CardContent className="flex flex-col items-center justify-center p-16">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4 shadow-sm" style={{ backgroundColor: 'var(--risk-low-muted)' }}>
                      <Shield className="h-8 w-8" style={{ color: 'var(--risk-low)' }} />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No mitigations available</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
                      This framework doesn't have any mitigations defined yet.
                    </p>
                  </CardContent>
                </Card>
              ) : filteredMitigations.length === 0 ? (
                <Card className="border-dashed rounded-xl">
                  <CardContent className="flex flex-col items-center justify-center p-12">
                    <Search className="h-8 w-8 text-muted-foreground mb-3" />
                    <h3 className="text-base font-medium mb-1">No mitigations match your filters</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      Try adjusting your search or category filter.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b border-border/60">
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead className="font-bold text-foreground/90">Name</TableHead>
                          <TableHead className="font-bold text-foreground/90">Category</TableHead>
                          <TableHead className="font-bold text-foreground/90">Description</TableHead>
                          <TableHead className="w-[120px] font-bold text-foreground/90">Type</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMitigations.map((mitigation, index) => (
                          <TableRow
                            key={mitigation.id}
                            className="hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0"
                            style={{
                              animation: 'fadeIn 0.3s ease-out forwards',
                              animationDelay: `${index * 30}ms`,
                              opacity: 0
                            }}
                          >
                            <TableCell>
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl shadow-sm" style={{ backgroundColor: 'var(--risk-low-muted)' }}>
                                <Shield className="h-4 w-4" style={{ color: 'var(--risk-low)' }} />
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{mitigation.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-medium shadow-sm rounded-lg">{mitigation.category}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs font-medium">
                              <span className="line-clamp-2" title={mitigation.description}>{mitigation.description}</span>
                            </TableCell>
                            <TableCell>
                              {mitigation.is_custom ? (
                                <Badge variant="default" className="gap-1.5 font-semibold shadow-sm rounded-lg">
                                  <Sparkles className="h-3 w-3" />Custom
                                </Badge>
                              ) : mitigation.is_modified ? (
                                <Badge variant="outline" className="gap-1.5 font-semibold shadow-sm rounded-lg" style={{ borderColor: 'color-mix(in srgb, var(--lemon-500) 40%, transparent)', color: 'var(--risk-medium)' }}>
                                  <Pencil className="h-3 w-3" />Modified
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="font-semibold shadow-sm rounded-lg">Predefined</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {canWrite && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted transition-all rounded-lg">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem onClick={() => openMitigationDialog(mitigation)} className="cursor-pointer">
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    {!mitigation.is_custom && mitigation.is_modified && (
                                      <DropdownMenuItem onClick={() => handleRevertMitigation(mitigation)} className="cursor-pointer">
                                        <Undo2 className="mr-2 h-4 w-4" />
                                        Revert to original
                                      </DropdownMenuItem>
                                    )}
                                    {mitigation.is_custom && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => openDeleteMitigationDialog(mitigation)}
                                          className="text-destructive cursor-pointer focus:text-destructive"
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Coverage Tab */}
            <TabsContent value="coverage" className="space-y-4 animate-fadeIn">
              {(() => {
                const allCategories = Array.from(
                  new Set([...threats.map(t => t.category), ...mitigations.map(m => m.category)])
                ).filter(Boolean).sort();

                if (allCategories.length === 0) {
                  return (
                    <Card className="border-dashed border-2 rounded-xl">
                      <CardContent className="flex flex-col items-center justify-center p-16">
                        <Map className="h-10 w-10 text-muted-foreground mb-3" />
                        <h3 className="text-base font-medium mb-1">No coverage data</h3>
                        <p className="text-sm text-muted-foreground text-center">
                          Add threats and mitigations to this framework to see coverage.
                        </p>
                      </CardContent>
                    </Card>
                  );
                }

                const chartData = allCategories.map(cat => ({
                  category: cat,
                  threats: threats.filter(t => t.category === cat).length,
                  mitigations: mitigations.filter(m => m.category === cat).length,
                }));

                const chartConfig = {
                  threats: { label: 'Threats', color: 'var(--risk-high)' },
                  mitigations: { label: 'Mitigations', color: 'var(--risk-low)' },
                } satisfies ChartConfig;

                const totalThreats = threats.length;
                const totalMitigations = mitigations.length;
                const overallCoverage = Math.round(
                  allCategories.reduce((sum, cat) => {
                    const t = threats.filter(x => x.category === cat).length;
                    const m = mitigations.filter(x => x.category === cat).length;
                    return sum + (t === 0 ? (m > 0 ? 100 : 0) : Math.min(100, Math.round((m / t) * 100)));
                  }, 0) / allCategories.length
                );
                const coverageColor = overallCoverage >= 75 ? 'var(--risk-low)' : overallCoverage >= 40 ? 'var(--risk-medium)' : 'var(--risk-critical)';
                const barHeight = Math.max(320, allCategories.length * 80);

                return (
                  <>
                    {/* Summary strip */}
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'Categories', value: allCategories.length, color: '' },
                        { label: 'Threats', value: totalThreats, colorVar: 'var(--risk-high)' },
                        { label: 'Mitigations', value: totalMitigations, colorVar: 'var(--risk-low)' },
                        { label: 'Avg Coverage', value: `${overallCoverage}%`, colorVar: coverageColor },
                      ].map(({ label, value, colorVar }) => (
                        <Card key={label} className="rounded-xl">
                          <CardContent className="p-3 text-center">
                            <p className="text-xl font-bold tabular-nums" style={colorVar ? { color: colorVar } : {}}>{value}</p>
                            <p className="text-[11px] text-muted-foreground">{label}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Chart */}
                    <Card className="rounded-xl border-border/60">
                      <CardContent className="p-0 pt-4">
                        <ChartContainer config={chartConfig} className="w-full" style={{ height: barHeight }}>
                          <BarChart
                            data={chartData}
                            layout="vertical"
                            margin={{ top: 0, right: 24, left: 0, bottom: 8 }}
                            barCategoryGap="20%"
                            barGap={4}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis
                              type="number"
                              allowDecimals={false}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="category"
                              width={150}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12 }}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8, paddingBottom: 8 }} />
                            <Bar dataKey="threats" fill="var(--risk-high)" radius={[0, 6, 6, 0]} />
                            <Bar dataKey="mitigations" fill="var(--risk-low)" radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Framework Dialog */}
      <Dialog open={frameworkDialogOpen} onOpenChange={setFrameworkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFramework ? 'Edit Framework' : 'Create Custom Framework'}</DialogTitle>
            <DialogDescription>
              {editingFramework ? 'Update framework details.' : 'Define a new threat modeling framework.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="grid gap-2">
              <Label htmlFor="framework-name">Name</Label>
              <Input
                id="framework-name"
                value={frameworkForm.name}
                onChange={(e) => setFrameworkForm({ ...frameworkForm, name: e.target.value })}
                placeholder="e.g., STRIDE for Cloud"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="framework-description">Description</Label>
              <Textarea
                id="framework-description"
                value={frameworkForm.description}
                onChange={(e) => setFrameworkForm({ ...frameworkForm, description: e.target.value })}
                placeholder="Briefly describe the purpose of this framework"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFrameworkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={editingFramework ? handleUpdateFramework : handleCreateFramework}>
              {editingFramework ? 'Save Changes' : 'Create Framework'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Threat Dialog */}
      <Dialog open={threatDialogOpen} onOpenChange={setThreatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingThreat ? 'Edit Threat' : 'Add Custom Threat'}</DialogTitle>
            <DialogDescription>
              {editingThreat ? 'Update threat information.' : 'Create a custom threat for this framework.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="grid gap-2">
              <Label htmlFor="threat-name">Name</Label>
              <Input
                id="threat-name"
                value={threatForm.name}
                onChange={(e) => setThreatForm({ ...threatForm, name: e.target.value })}
                placeholder="Enter threat name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="threat-category">Category</Label>
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
                    <SelectTrigger id="threat-category">
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
                  {(!threatCategories.includes(threatForm.category) || threatForm.category === '') && (
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
                  id="threat-category"
                  value={threatForm.category}
                  onChange={(e) => setThreatForm({ ...threatForm, category: e.target.value })}
                  placeholder="e.g., Spoofing, Tampering, etc."
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="threat-description">Description</Label>
              <Textarea
                id="threat-description"
                value={threatForm.description}
                onChange={(e) => setThreatForm({ ...threatForm, description: e.target.value })}
                placeholder="Describe the threat in detail"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThreatDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={editingThreat ? handleUpdateThreat : handleCreateThreat}>
              {editingThreat ? 'Save Changes' : 'Create Threat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mitigation Dialog */}
      <Dialog open={mitigationDialogOpen} onOpenChange={setMitigationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMitigation ? 'Edit Mitigation' : 'Add Custom Mitigation'}</DialogTitle>
            <DialogDescription>
              {editingMitigation ? 'Update mitigation information.' : 'Create a custom mitigation for this framework.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="grid gap-2">
              <Label htmlFor="mitigation-name">Name</Label>
              <Input
                id="mitigation-name"
                value={mitigationForm.name}
                onChange={(e) => setMitigationForm({ ...mitigationForm, name: e.target.value })}
                placeholder="Enter mitigation name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mitigation-category">Category</Label>
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
                    <SelectTrigger id="mitigation-category">
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
                  {(!mitigationCategories.includes(mitigationForm.category) || mitigationForm.category === '') && (
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
                  id="mitigation-category"
                  value={mitigationForm.category}
                  onChange={(e) => setMitigationForm({ ...mitigationForm, category: e.target.value })}
                  placeholder="e.g., Authentication, Encryption, etc."
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mitigation-description">Description</Label>
              <Textarea
                id="mitigation-description"
                value={mitigationForm.description}
                onChange={(e) => setMitigationForm({ ...mitigationForm, description: e.target.value })}
                placeholder="Describe the mitigation in detail"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMitigationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={editingMitigation ? handleUpdateMitigation : handleCreateMitigation}>
              {editingMitigation ? 'Save Changes' : 'Create Mitigation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Framework Alert Dialog */}
      <AlertDialog open={deleteFrameworkOpen} onOpenChange={setDeleteFrameworkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Framework</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{frameworkToDelete?.name}"? All custom threats and mitigations in this framework will also be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFramework} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Threat Alert Dialog */}
      <AlertDialog open={deleteThreatOpen} onOpenChange={setDeleteThreatOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Threat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{threatToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteThreat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Mitigation Alert Dialog */}
      <AlertDialog open={deleteMitigationOpen} onOpenChange={setDeleteMitigationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mitigation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{mitigationToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMitigation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
