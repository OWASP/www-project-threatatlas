import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { diagramThreatsApi, diagramMitigationsApi, diagramsApi, productsApi, modelsApi, frameworksApi } from '@/lib/api';
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
import { Search, AlertTriangle, TrendingUp, CheckCircle2, Activity, Box, Grid3x3 } from 'lucide-react';
import ThreatDetailsSheet from '@/components/ThreatDetailsSheet';
import ThreatCard from '@/components/ThreatCard';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    loadData(true);
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

  const handleUpdateStatus = async (status: string) => {
    if (!selectedItem) return;
    try {
      setSelectedItem((prev: any) => prev ? { ...prev, status } : null);
      await diagramThreatsApi.update(selectedItem.id, { status });
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
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
      trend: identifiedCount > 0 ? `${identifiedCount} active` : 'No active threats',
      trendPositive: identifiedCount === 0,
    },
    {
      title: 'Critical Risk',
      value: riskStats.critical,
      description: 'Highest priority',
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-500/10',
      trend: riskStats.critical > 0 ? 'Immediate action' : 'None',
      trendPositive: riskStats.critical === 0,
    },
    {
      title: 'High Risk',
      value: riskStats.high,
      description: 'Requires attention',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
      trend: riskStats.high > 0 ? 'Priority action' : 'None',
      trendPositive: riskStats.high === 0,
    },
    {
      title: 'Mitigated',
      value: mitigatedCount,
      description: 'Threats addressed',
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
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

  return (
    <div className="flex-1 space-y-6 mx-auto p-4">
      {/* Stats Cards */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card
            key={stat.title}
            className="animate-fadeInUp hover:shadow-lg hover:border-primary/20 transition-all duration-300 rounded-xl border-border/60 group cursor-default"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
              <CardTitle className="text-xs font-bold text-muted-foreground tracking-wider">{stat.title.toUpperCase()}</CardTitle>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bgColor} shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:scale-110`}>
                <stat.icon className={`h-5 w-5 ${stat.color} transition-transform duration-300 group-hover:rotate-12`} />
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-3xl font-bold tracking-tight mb-0.5">{stat.value}</div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">{stat.description}</p>
              {'showProgress' in stat && stat.showProgress && (
                <Progress value={stat.progressValue} className="h-1.5 mb-2" />
              )}
              <div role="status" className={`text-xs font-semibold ${stat.trendPositive ? 'text-green-600' : 'text-orange-600'} flex items-center gap-1`}>
                {stat.trend}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="animate-fadeInUp flex flex-col md:flex-row md:items-center gap-2" style={{ animationDelay: '200ms' }}>
        <div className="relative group flex-1">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search threats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9 w-full rounded-lg border-border/60 focus:border-primary/50 transition-all"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-40 h-9 rounded-lg border-border/60 hover:border-primary/30 transition-all">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="identified">Identified</SelectItem>
            <SelectItem value="mitigated">Mitigated</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="proposed">Proposed</SelectItem>
            <SelectItem value="implemented">Implemented</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { key: 'all' as const, label: 'All', dot: '', active: 'bg-foreground text-background border-foreground', hover: '' },
            { key: 'critical' as const, label: `Critical (${riskStats.critical})`, dot: 'bg-red-500', active: 'bg-red-100 border-red-400 text-red-800 dark:bg-red-900/40 dark:border-red-600 dark:text-red-300', hover: 'hover:bg-red-50 hover:border-red-300 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:border-red-700 dark:hover:text-red-400' },
            { key: 'high' as const, label: `High (${riskStats.high})`, dot: 'bg-orange-500', active: 'bg-orange-100 border-orange-400 text-orange-800 dark:bg-orange-900/40 dark:border-orange-600 dark:text-orange-300', hover: 'hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 dark:hover:bg-orange-900/20 dark:hover:border-orange-700 dark:hover:text-orange-400' },
            { key: 'medium' as const, label: `Medium (${riskStats.medium})`, dot: 'bg-amber-400', active: 'bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-300', hover: 'hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 dark:hover:bg-amber-900/20 dark:hover:border-amber-700 dark:hover:text-amber-400' },
            { key: 'low' as const, label: `Low (${riskStats.low})`, dot: 'bg-green-500', active: 'bg-green-100 border-green-400 text-green-800 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300', hover: 'hover:bg-green-50 hover:border-green-300 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:border-green-700 dark:hover:text-green-400' },
          ]).map((sev) => (
            <Button
              key={sev.key}
              variant="outline"
              size="sm"
              onClick={() => setSeverityFilter(sev.key)}
              className={cn(
                "h-8 px-2.5 rounded-lg transition-all shadow-sm hover:shadow gap-1.5 text-xs",
                severityFilter === sev.key ? sev.active : sev.hover
              )}
            >
              {sev.dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", sev.dot)} />}
              {sev.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Threats List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Threats & Mitigations ({filteredThreats.length})
          </h2>
          {filteredThreats.length > 0 && (
            <div className="text-sm text-muted-foreground font-medium">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredThreats.length)} of {filteredThreats.length}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {filteredThreats.length === 0 ? (
            <Card className="border-dashed border-2 rounded-xl">
              <CardContent className="flex flex-col items-center justify-center p-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 mb-3 shadow-sm">
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-lg font-bold mb-1.5">No threats found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
                  Start by creating diagrams and attaching threats to elements.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedThreats.map((threat, index) => {
                const linkedMitigations = getMitigationsForThreat(threat);
                const { productName, diagramName } = getProductAndDiagramNames(threat);
                const { modelName, frameworkName } = getModelInfo(threat);

                return (
                  <ThreatCard
                    key={threat.id}
                    threat={threat}
                    linkedMitigations={linkedMitigations}
                    index={index}
                    onOpen={() => handleOpenThreat(threat)}
                    onNavigateToDiagram={() => navigateToDiagram(threat)}
                    contextItems={[
                      { icon: <Box className="h-3 w-3" />, label: productName },
                      { icon: <Grid3x3 className="h-3 w-3" />, label: diagramName },
                      ...(modelName ? [{ icon: <Activity className="h-3 w-3" />, label: modelName }] : []),
                      { icon: <Activity className="h-3 w-3" />, label: frameworkName },
                    ]}
                  />
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground font-medium">
                    Page {currentPage} of {totalPages}
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={cn(currentPage === 1 && 'pointer-events-none opacity-50')}
                          href="#"
                        />
                      </PaginationItem>
                      {getPaginationPages().map((page, idx) =>
                        page === 'ellipsis' ? (
                          <PaginationItem key={`ellipsis-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              isActive={currentPage === page}
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      )}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={cn(currentPage === totalPages && 'pointer-events-none opacity-50')}
                          href="#"
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Threat Details Sheet */}
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
