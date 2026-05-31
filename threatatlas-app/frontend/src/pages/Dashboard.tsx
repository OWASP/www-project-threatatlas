import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { diagramThreatsApi, diagramMitigationsApi, diagramsApi, productsApi, modelsApi, frameworksApi, jiraApi } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Search, AlertTriangle, TrendingUp, CheckCircle2, Activity, Box, Grid3x3, Shield, Package, ChevronRight, ArrowRight, Flame } from 'lucide-react';
import ThreatDetailsSheet from '@/components/ThreatDetailsSheet';
import ThreatCard from '@/components/ThreatCard';
import AuditTerminal from '@/components/AuditTerminal';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface DiagramThreat {
  id: number;
  diagram_id: number;
  model_id: number;
  threat_id: number;
  element_id: string;
  element_type: string;
  status: string;
  comments: string;
  likelihood: number | null;
  impact: number | null;
  risk_score: number | null;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  threat: {
    id: number;
    name: string;
    description: string;
    category: string;
    framework_id: number;
  };
}

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

function DashboardSkeleton() {
  return (
    <div className="flex-1 space-y-6 mx-auto p-4 animate-fadeIn">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="rounded-xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </CardHeader>
            <CardContent className="pb-5 space-y-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-xl border-border/60">
        <CardContent className="p-5 space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-52" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-xl border-border/60">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [threats, setThreats] = useState<DiagramThreat[]>([]);
  const [mitigations, setMitigations] = useState<DiagramMitigation[]>([]);
  const [diagrams, setDiagrams] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [frameworks, setFrameworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [jiraConfigured, setJiraConfigured] = useState(false);
  const [jiraGlobalProjectKey, setJiraGlobalProjectKey] = useState<string | null>(null);

  useEffect(() => {
    loadData(true);
    jiraApi.get()
      .then(r => {
        setJiraConfigured(r.data.configured === true);
        setJiraGlobalProjectKey(r.data.jira_project_key || null);
      })
      .catch(() => {});
  }, []);

  const loadData = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const [threatsRes, mitigationsRes, diagramsRes, productsRes, modelsRes, frameworksRes] = await Promise.all([
        diagramThreatsApi.list(),
        diagramMitigationsApi.list(),
        diagramsApi.list(),
        productsApi.list(),
        modelsApi.list(),
        frameworksApi.list(),
      ]);

      const validDiagramIds = new Set(diagramsRes.data.filter((d: any) => d.product_id).map((d: any) => d.id));
      const filteredThreats = threatsRes.data.filter((t: DiagramThreat) => validDiagramIds.has(t.diagram_id));
      const filteredMitigations = mitigationsRes.data.filter((m: DiagramMitigation) => validDiagramIds.has(m.diagram_id));

      setThreats(filteredThreats);
      setMitigations(filteredMitigations);
      setDiagrams(diagramsRes.data);
      setProducts(productsRes.data);
      setModels(modelsRes.data);
      setFrameworks(frameworksRes.data);

      // Keep selectedItem in sync so the sheet reflects fresh mitigations without closing
      setSelectedItem((prev: any) => {
        if (!prev) return null;
        const linkedMits = filteredMitigations.filter((m: DiagramMitigation) => m.threat_id === prev.id);
        return { ...prev, linkedMitigations: linkedMits };
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const filteredThreats = threats.filter((item) => {
    const matchesSearch =
      item.threat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.threat.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.element_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || item.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredThreats.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedThreats = filteredThreats.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, severityFilter]);

  const handleOpenThreat = (threat: DiagramThreat) => {
    const linkedMits = mitigations.filter(m => m.threat_id === threat.id);
    setSelectedItem({ ...threat, linkedMitigations: linkedMits });
    setSheetOpen(true);
  };

  const getMitigationsForThreat = (threat: DiagramThreat) => {
    return mitigations.filter(m => m.threat_id === threat.id);
  };

  const getProductAndDiagramNames = (threat: DiagramThreat) => {
    const diagram = diagrams.find(d => d.id === threat.diagram_id);
    if (!diagram) return { productName: 'Unknown', diagramName: 'Unknown' };
    const product = products.find(p => p.id === diagram.product_id);
    return {
      productName: product?.name || 'Unknown',
      diagramName: diagram.name || 'Unknown'
    };
  };

  const getModelInfo = (threat: DiagramThreat) => {
    const model = models.find(m => m.id === threat.model_id);
    if (model) {
      return { modelName: model.name, frameworkName: model.framework_name };
    }
    const framework = frameworks.find(f => f.id === threat.threat.framework_id);
    return { modelName: null, frameworkName: framework?.name || 'Unknown' };
  };

  const navigateToDiagram = (threat: DiagramThreat) => {
    const diagram = diagrams.find(d => d.id === threat.diagram_id);
    if (diagram && diagram.product_id) {
      navigate(`/diagrams?product=${diagram.product_id}&diagram=${threat.diagram_id}`);
    }
  };

  const handleUpdateItem = async (comments: string) => {
    if (!selectedItem) return;
    try {
      setSelectedItem((prev: any) => prev ? { ...prev, comments } : null);
      await diagramThreatsApi.update(selectedItem.id, { comments });
      await loadData();
    } catch (error) {
      console.error('Error updating:', error);
      toast.error('Failed to update comments');
    }
  };

  const handleUpdateStatus = async (status: string, acceptanceData?: { justification: string; approver_id?: number; review_date?: string }) => {
    if (!selectedItem) return;
    try {
      setSelectedItem((prev: any) => prev ? { ...prev, status } : null);
      await diagramThreatsApi.update(selectedItem.id, {
        status,
        ...(acceptanceData ? {
          acceptance_justification: acceptanceData.justification,
          acceptance_approver_id: acceptanceData.approver_id ?? null,
          acceptance_review_date: acceptanceData.review_date ?? null,
        } : {}),
      });
      await loadData();
      toast.success(`Status updated to ${status}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleUpdateRisk = async (threatId: number, data: { likelihood?: number; impact?: number }) => {
    try {
      setSelectedItem((prev: any) => prev && prev.id === threatId ? { ...prev, ...data } : prev);
      await diagramThreatsApi.update(threatId, data);
      await loadData();
    } catch (error) {
      console.error('Error updating risk:', error);
      toast.error('Failed to update risk assessment');
    }
  };

  const identifiedCount = threats.filter(t => t.status === 'identified').length;
  const mitigatedCount = threats.filter(t => t.status === 'mitigated').length;
  const coveragePercent = threats.length > 0 ? Math.round((mitigatedCount / threats.length) * 100) : 0;

  const riskStats = {
    critical: threats.filter(t => t.severity === 'critical').length,
    high: threats.filter(t => t.severity === 'high').length,
    medium: threats.filter(t => t.severity === 'medium').length,
    low: threats.filter(t => t.severity === 'low').length,
    total: threats.length,
  };

  const stats = [
    {
      title: 'Total Threats',
      value: threats.length,
      description: 'Across all diagrams',
      icon: AlertTriangle,
      iconColor: 'var(--risk-high)',
      iconBg: 'var(--risk-high-muted)',
      trend: identifiedCount > 0 ? `${identifiedCount} active` : 'No active threats',
      trendPositive: identifiedCount === 0,
    },
    {
      title: 'Critical Risk',
      value: riskStats.critical,
      description: 'Highest priority',
      icon: AlertTriangle,
      iconColor: 'var(--risk-critical)',
      iconBg: 'var(--risk-critical-muted)',
      trend: riskStats.critical > 0 ? 'Immediate action' : 'None',
      trendPositive: riskStats.critical === 0,
    },
    {
      title: 'High Risk',
      value: riskStats.high,
      description: 'Requires attention',
      icon: TrendingUp,
      iconColor: 'var(--risk-high)',
      iconBg: 'var(--risk-high-muted)',
      trend: riskStats.high > 0 ? 'Priority action' : 'None',
      trendPositive: riskStats.high === 0,
    },
    {
      title: 'Mitigated',
      value: mitigatedCount,
      description: 'Threats addressed',
      icon: CheckCircle2,
      iconColor: 'var(--risk-low)',
      iconBg: 'var(--risk-low-muted)',
      trend: `${coveragePercent}% coverage`,
      trendPositive: true,
      showProgress: true,
      progressValue: coveragePercent,
    },
  ];

  if (loading) return <DashboardSkeleton />;

  // Build pagination pages with ellipsis
  const getPaginationPages = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };


  // Products summary for "at risk" section
  const productThreatCounts = products.map(p => {
    const pDiagrams = diagrams.filter(d => d.product_id === p.id);
    const pDiagramIds = new Set(pDiagrams.map(d => d.id));
    const pThreats = threats.filter(t => pDiagramIds.has(t.diagram_id));
    return {
      id: p.id, name: p.name,
      total: pThreats.length,
      critical: pThreats.filter(t => t.severity === 'critical').length,
      high: pThreats.filter(t => t.severity === 'high').length,
    };
  }).filter(p => p.total > 0).sort((a, b) => b.critical - a.critical || b.high - a.high).slice(0, 5);

  const displayName = user?.full_name || user?.username || user?.email || 'there';
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6 lg:p-8 animate-fadeIn">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}, {displayName.split(' ')[0]} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {products.length} product{products.length !== 1 ? 's' : ''} · {threats.length} threats · {mitigations.length} mitigations
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => navigate('/products')}>
            <Package className="h-3.5 w-3.5 mr-1.5" />Products
          </Button>
          <Button size="sm" onClick={() => navigate('/diagrams')}>
            <Grid3x3 className="h-3.5 w-3.5 mr-1.5" />New Diagram
          </Button>
        </div>
      </div>

      {/* ── KPI strip (5 cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 4 metric cards */}
        {[
          { label: 'Total Threats', value: threats.length, sub: `${identifiedCount} active`, color: 'text-foreground', bg: 'bg-muted/40', icon: AlertTriangle, iconColor: 'var(--risk-high)' },
          { label: 'Critical', value: riskStats.critical, sub: riskStats.critical > 0 ? 'Immediate action' : 'None outstanding', color: riskStats.critical > 0 ? 'text-red-600' : 'text-muted-foreground', bg: riskStats.critical > 0 ? 'bg-red-500/8' : 'bg-muted/40', icon: Flame, iconColor: 'var(--risk-critical)' },
          { label: 'High Risk', value: riskStats.high, sub: riskStats.high > 0 ? 'Priority attention' : 'None outstanding', color: riskStats.high > 0 ? 'text-orange-600' : 'text-muted-foreground', bg: riskStats.high > 0 ? 'bg-orange-500/8' : 'bg-muted/40', icon: TrendingUp, iconColor: 'var(--risk-high)' },
          { label: 'Mitigated', value: mitigatedCount, sub: `${coveragePercent}% coverage`, color: 'text-emerald-600', bg: 'bg-emerald-500/8', icon: CheckCircle2, iconColor: 'var(--risk-low)', progress: coveragePercent },
        ].map(({ label, value, sub, color, bg, icon: Icon, iconColor, progress }) => (
          <Card key={label} className={cn('rounded-xl border-border/60 shadow-xs', bg)}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
                <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
              </div>
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
              {progress !== undefined && <Progress value={progress} className="h-1 mt-1.5 mb-0.5" />}
              <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}

        {/* 5th card: Products at Risk */}
        <Card className="rounded-xl border-border/60 shadow-xs bg-muted/40 row-span-1">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">At Risk</p>
              <Shield className="h-3.5 w-3.5 text-destructive" />
            </div>
            {productThreatCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">All clear</p>
            ) : (
              <div className="space-y-1">
                {productThreatCounts.slice(0, 3).map(p => (
                  <button key={p.id} onClick={() => navigate(`/products/${p.id}`)}
                    className="w-full flex items-center gap-1.5 py-0.5 hover:text-primary transition-colors text-left group">
                    <span className="text-xs font-medium truncate flex-1 group-hover:text-primary">{p.name}</span>
                    <div className="flex gap-0.5 shrink-0">
                      {p.critical > 0 && <span className="text-[8px] font-bold px-1 rounded" style={{ backgroundColor: 'var(--risk-critical-muted)', color: 'var(--risk-critical)' }}>{p.critical}C</span>}
                      {p.high > 0 && <span className="text-[8px] font-bold px-1 rounded" style={{ backgroundColor: 'var(--risk-high-muted)', color: 'var(--risk-high)' }}>{p.high}H</span>}
                    </div>
                  </button>
                ))}
                {productThreatCounts.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{productThreatCounts.length - 3} more</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Threats list ── */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <h2 className="text-base font-semibold flex items-center gap-2 shrink-0">
            <AlertTriangle className="h-4.5 w-4.5" style={{ color: 'var(--risk-high)' }} />
            All Threats
            <span className="text-sm font-normal text-muted-foreground">({filteredThreats.length})</span>
          </h2>
          <div className="flex flex-1 gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search threats…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-8 text-sm" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="identified">Identified</SelectItem>
                <SelectItem value="mitigated">Mitigated</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map(sev => (
                <button key={sev} onClick={() => setSeverityFilter(sev)}
                  className={cn('h-8 px-2.5 text-xs rounded-lg border transition-colors capitalize font-medium',
                    severityFilter === sev ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                  )}>
                  {sev === 'all' ? 'All' : `${sev.slice(0,3).toUpperCase()} (${riskStats[sev]})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredThreats.length === 0 ? (
          <Card className="border-dashed border-2 rounded-xl">
            <CardContent className="flex flex-col items-center justify-center p-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-3" style={{ background: 'var(--risk-high-muted)' }}>
                <AlertTriangle className="h-8 w-8" style={{ color: 'var(--risk-high)' }} />
              </div>
              <h3 className="text-lg font-medium mb-1">No threats found</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                {searchTerm || statusFilter !== 'all' || severityFilter !== 'all' ? 'Try adjusting your filters.' : 'No threats have been modeled yet. Open a diagram and run an AI analysis.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2.5">
              {paginatedThreats.map((threat, i) => {
                const linkedMits = mitigations.filter(m => m.diagram_id === threat.diagram_id && m.threat_id === threat.id);
                const { diagramName, productName } = getProductAndDiagramNames(threat);
                // Resolve effective Jira project key: product-level → global fallback
                const diagram = diagrams.find(d => d.id === threat.diagram_id);
                const threatProduct = diagram ? products.find((p: any) => p.id === diagram.product_id) : null;
                const effectiveJiraProjectKey = (threatProduct as any)?.jira_project_key ?? jiraGlobalProjectKey;

                return (
                  <ThreatCard
                    key={threat.id}
                    threat={threat as any}
                    linkedMitigations={linkedMits as any}
                    index={i}
                    jiraConfigured={jiraConfigured}
                    jiraProjectKey={effectiveJiraProjectKey}
                    onOpen={() => { setSelectedItem({ ...threat, linkedMitigations: linkedMits }); setSheetOpen(true); }}
                    onNavigateToDiagram={() => navigateToDiagram(threat)}
                    contextItems={[
                      { icon: <Box className="h-3 w-3" />, label: productName },
                      { icon: <Grid3x3 className="h-3 w-3" />, label: diagramName },
                    ]}
                  />
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center pt-2">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                    </PaginationItem>
                    {getPaginationPages().map((page, i) => (
                      <PaginationItem key={i}>
                        {page === 'ellipsis' ? <PaginationEllipsis /> : (
                          <PaginationLink onClick={() => setCurrentPage(page)} isActive={currentPage === page} className="cursor-pointer">{page}</PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>

      <ThreatDetailsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedItem={selectedItem}
        itemType="threat"
        onUpdateStatus={handleUpdateStatus}
        onUpdateNotes={handleUpdateItem}
        onNavigateToDiagram={navigateToDiagram}
        onUpdateRisk={handleUpdateRisk}
        onMitigationsChange={loadData}
      />
    </div>
  );
}
