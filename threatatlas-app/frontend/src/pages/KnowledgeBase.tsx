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
import { Library, AlertTriangle, Shield, Sparkles, Plus, MoreVertical, Pencil, Trash2, Search, X } from 'lucide-react';

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
  user_id: number | null;
}

interface Mitigation {
  id: number;
  framework_id: number;
  name: string;
  description: string;
  category: string;
  is_custom: boolean;
  user_id: number | null;
}

export default function KnowledgeBase() {
  const { canWrite } = useAuth();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [selectedFramework, setSelectedFramework] = useState<number | null>(null);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [mitigations, setMitigations] = useState<Mitigation[]>([]);
  const [loading, setLoading] = useState(true);

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
      loadThreats(selectedFramework);
      loadMitigations(selectedFramework);
      setThreatSearch('');
      setThreatCategoryFilter('all');
      setMitigationSearch('');
      setMitigationCategoryFilter('all');
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
    }
  };

  const loadMitigations = async (frameworkId: number) => {
    try {
      const response = await mitigationsApi.list({ framework_id: frameworkId });
      setMitigations(response.data);
    } catch (error) {
      console.error('Error loading mitigations:', error);
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
    } catch (error) {
      console.error('Error creating framework:', error);
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
    } catch (error) {
      console.error('Error updating framework:', error);
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
    } catch (error) {
      console.error('Error deleting framework:', error);
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
    } catch (error) {
      console.error('Error creating threat:', error);
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
    } catch (error) {
      console.error('Error updating threat:', error);
    }
  };

  const openDeleteThreatDialog = (threat: Threat) => {
    if (!threat.is_custom) {
      alert('Cannot delete pre-defined threats');
      return;
    }
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
    } catch (error) {
      console.error('Error deleting threat:', error);
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
    } catch (error) {
      console.error('Error creating mitigation:', error);
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
    } catch (error) {
      console.error('Error updating mitigation:', error);
    }
  };

  const openDeleteMitigationDialog = (mitigation: Mitigation) => {
    if (!mitigation.is_custom) {
      alert('Cannot delete pre-defined mitigations');
      return;
    }
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
    } catch (error) {
      console.error('Error deleting mitigation:', error);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Explore and manage threat modeling frameworks, threats, and mitigations.
          </p>
        </div>
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
          {/* Framework Selection */}
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {frameworks.map((framework, index) => {
              const isSelected = selectedFramework === framework.id;
              return (
                <Card
                  key={framework.id}
                  className={`cursor-pointer relative transition-all duration-300 hover:shadow-lg rounded-xl group ${isSelected ? 'border-primary/60 ring-2 ring-primary/50 ring-offset-2 shadow-md' : 'hover:border-primary/30'
                    }`}
                  onClick={() => setSelectedFramework(framework.id)}
                  style={{
                    animation: 'slideUp 0.5s ease-out forwards',
                    animationDelay: `${index * 100}ms`,
                    opacity: 0
                  }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 shadow-sm transition-all duration-300 ${isSelected
                        ? 'bg-primary text-primary-foreground shadow-lg scale-110'
                        : 'bg-primary/10 text-primary group-hover:bg-primary/15 group-hover:scale-105'
                        }`}>
                        <Library className={`h-5 w-5 transition-transform duration-300 ${isSelected ? 'rotate-12' : 'group-hover:rotate-12'}`} />
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <div className="flex items-center gap-2 mb-1.5 ">
                          <h3 className="font-bold text-base bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text truncate">
                            {framework.name}
                          </h3>
                          {framework.is_custom && (
                            <Badge variant="outline" className="text-[10px] py-2 font-semibold uppercase tracking-wider">
                              Custom
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed font-medium">
                          {framework.description}
                        </p>
                      </div>
                    </div>

                    {framework.is_custom && canWrite && (
                      <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted transition-all rounded-lg">
                              <MoreVertical className="h-4 w-4" />
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

          {/* Threats and Mitigations Tabs */}
          <Tabs defaultValue="threats" className="w-full space-y-4">
            <TabsList className="grid w-full max-w-[420px] grid-cols-2 h-11 p-1 rounded-xl shadow-sm">
              <TabsTrigger value="threats" className="gap-2 rounded-lg font-semibold transition-all duration-200 data-[state=active]:shadow-sm">
                <AlertTriangle className="h-4 w-4" />
                Threats ({threats.length})
              </TabsTrigger>
              <TabsTrigger value="mitigations" className="gap-2 rounded-lg font-semibold transition-all duration-200 data-[state=active]:shadow-sm">
                <Shield className="h-4 w-4" />
                Mitigations ({mitigations.length})
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
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 mb-4 shadow-sm">
                      <AlertTriangle className="h-8 w-8 text-orange-600" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">No threats available</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
                      This framework doesn't have any threats defined yet.
                    </p>
                  </CardContent>
                </Card>
              ) : filteredThreats.length === 0 ? (
                <Card className="border-dashed rounded-xl">
                  <CardContent className="flex flex-col items-center justify-center p-12">
                    <Search className="h-8 w-8 text-muted-foreground mb-3" />
                    <h3 className="text-base font-bold mb-1">No threats match your filters</h3>
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
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 shadow-sm">
                                <AlertTriangle className="h-4 w-4 text-orange-600" />
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{threat.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-medium shadow-sm rounded-lg">{threat.category}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-md font-medium">
                              {threat.description}
                            </TableCell>
                            <TableCell>
                              <Badge variant={threat.is_custom ? 'default' : 'secondary'} className="gap-1.5 font-semibold shadow-sm rounded-lg">
                                {threat.is_custom && <Sparkles className="h-3 w-3" />}
                                {threat.is_custom ? 'Custom' : 'Predefined'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {threat.is_custom && canWrite && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted transition-all rounded-lg">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => openThreatDialog(threat)} className="cursor-pointer">
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => openDeleteThreatDialog(threat)}
                                      className="text-destructive cursor-pointer focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
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
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 mb-4 shadow-sm">
                      <Shield className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">No mitigations available</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
                      This framework doesn't have any mitigations defined yet.
                    </p>
                  </CardContent>
                </Card>
              ) : filteredMitigations.length === 0 ? (
                <Card className="border-dashed rounded-xl">
                  <CardContent className="flex flex-col items-center justify-center p-12">
                    <Search className="h-8 w-8 text-muted-foreground mb-3" />
                    <h3 className="text-base font-bold mb-1">No mitigations match your filters</h3>
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
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 shadow-sm">
                                <Shield className="h-4 w-4 text-green-600" />
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{mitigation.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-medium shadow-sm rounded-lg">{mitigation.category}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-md font-medium">
                              {mitigation.description}
                            </TableCell>
                            <TableCell>
                              <Badge variant={mitigation.is_custom ? 'default' : 'secondary'} className="gap-1.5 font-semibold shadow-sm rounded-lg">
                                {mitigation.is_custom && <Sparkles className="h-3 w-3" />}
                                {mitigation.is_custom ? 'Custom' : 'Predefined'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {mitigation.is_custom && canWrite && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted transition-all rounded-lg">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => openMitigationDialog(mitigation)} className="cursor-pointer">
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => openDeleteMitigationDialog(mitigation)}
                                      className="text-destructive cursor-pointer focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
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
