import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { diagramThreatsApi, diagramMitigationsApi, diagramsApi, productsApi, modelsApi, frameworksApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, AlertTriangle, Shield, TrendingUp, CheckCircle2, Activity, Link2, Box, Grid3x3, ExternalLink, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import ThreatDetailsSheet from '@/components/ThreatDetailsSheet';
import { getSeverityClasses, getSeverityStripeClass, getStatusClasses } from '@/lib/risk';
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
  const [itemsPerPage] = useState(5);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [threatsRes, mitigationsRes, diagramsRes, productsRes, modelsRes, frameworksRes] = await Promise.all([
        diagramThreatsApi.list(),
        diagramMitigationsApi.list(),
        diagramsApi.list(),
        productsApi.list(),
        modelsApi.list(),
        frameworksApi.list(),
      ]);

      // Get all diagram IDs that have products
      const validDiagramIds = new Set(diagramsRes.data.filter((d: any) => d.product_id).map((d: any) => d.id));

      // Filter only threats and mitigations that belong to diagrams with products
      const filteredThreats = threatsRes.data.filter((t: DiagramThreat) => validDiagramIds.has(t.diagram_id));
      const filteredMitigations = mitigationsRes.data.filter((m: DiagramMitigation) => validDiagramIds.has(m.diagram_id));

      setThreats(filteredThreats);
      setMitigations(filteredMitigations);
      setDiagrams(diagramsRes.data);
      setProducts(productsRes.data);
      setModels(modelsRes.data);
      setFrameworks(frameworksRes.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
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

  // Get mitigations for a specific threat
  const getMitigationsForThreat = (threat: DiagramThreat) => {
    return mitigations.filter(
      m => m.threat_id === threat.id
    );
  };

  // Get product and diagram names for a threat
  const getProductAndDiagramNames = (threat: DiagramThreat) => {
    const diagram = diagrams.find(d => d.id === threat.diagram_id);
    if (!diagram) return { productName: 'Unknown', diagramName: 'Unknown' };

    const product = products.find(p => p.id === diagram.product_id);
    return {
      productName: product?.name || 'Unknown',
      diagramName: diagram.name || 'Unknown'
    };
  };

  // Get model name and framework for a threat
  const getModelInfo = (threat: DiagramThreat) => {
    const model = models.find(m => m.id === threat.model_id);

    // If model exists, use its framework
    if (model) {
      return {
        modelName: model.name,
        frameworkName: model.framework_name
      };
    }

    // If no model, get framework from the threat itself
    const framework = frameworks.find(f => f.id === threat.threat.framework_id);
    return {
      modelName: null,
      frameworkName: framework?.name || 'Unknown'
    };
  };

  // Navigate to diagram
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
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedItem) return;
    try {
      setSelectedItem((prev: any) => prev ? { ...prev, status } : null);
      await diagramThreatsApi.update(selectedItem.id, { status });
      await loadData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleUpdateRisk = async (threatId: number, data: { likelihood?: number; impact?: number }) => {
    try {
      setSelectedItem((prev: any) => prev && prev.id === threatId ? { ...prev, ...data } : prev);
      await diagramThreatsApi.update(threatId, data);
      await loadData();
    } catch (error) {
      console.error('Error updating risk:', error);
    }
  };


  const identifiedCount = threats.filter(t => t.status === 'identified').length;
  const mitigatedCount = threats.filter(t => t.status === 'mitigated').length;

  // Risk severity counts
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
      trend: threats.length > 0 ? `${Math.round((mitigatedCount / threats.length) * 100)}% coverage` : '0% coverage',
      trendPositive: true,
    },
  ];

  return (
    <div className="flex-1 space-y-6 mx-auto p-4">
      {loading ? (
        <Card className="border-dashed rounded-xl">
          <CardContent className="flex items-center justify-center p-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground font-medium">Loading dashboard...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat, index) => (
                <Card
                  key={stat.title}
                  className="hover:shadow-lg hover:border-primary/20 transition-all duration-300 rounded-xl border-border/60 group cursor-default"
                  style={{
                    animation: 'slideUp 0.5s ease-out forwards',
                    animationDelay: `${index * 100}ms`,
                    opacity: 0
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
                    <CardTitle className="text-xs font-bold text-muted-foreground tracking-wider">{stat.title.toUpperCase()}</CardTitle>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bgColor} shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:scale-110`}>
                      <stat.icon className={`h-5 w-5 ${stat.color} transition-transform duration-300 group-hover:rotate-12`} />
                    </div>
                  </CardHeader>
                  <CardContent className="pb-5">
                    <div className="text-3xl font-bold tracking-tight mb-1 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mb-2 font-medium">{stat.description}</p>
                    <div className={`text-xs font-semibold ${stat.trendPositive ? 'text-green-600' : 'text-orange-600'} flex items-center gap-1`}>
                      {stat.trend}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters */}
            <Card className="border-border/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        placeholder="Search threats, mitigations, elements..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 rounded-lg border-border/60 focus:border-primary/50 transition-all"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-52 h-10 rounded-lg border-border/60 hover:border-primary/30 transition-all">
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
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground tracking-wider">RISK LEVEL:</span>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSeverityFilter('all')}
                        className={cn(
                          "h-8 px-3 rounded-lg transition-all shadow-sm hover:shadow hover:scale-105",
                          severityFilter === 'all' && 'bg-foreground text-background border-foreground'
                        )}
                      >
                        All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSeverityFilter('critical')}
                        className={cn(
                          "h-8 px-3 rounded-lg transition-all shadow-sm hover:shadow hover:scale-105 gap-1.5",
                          severityFilter === 'critical'
                            ? 'bg-red-100 border-red-400 text-red-800 dark:bg-red-900/40 dark:border-red-600 dark:text-red-300'
                            : 'hover:bg-red-50 hover:border-red-300 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:border-red-700 dark:hover:text-red-400'
                        )}
                      >
                        <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                        Critical ({riskStats.critical})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSeverityFilter('high')}
                        className={cn(
                          "h-8 px-3 rounded-lg transition-all shadow-sm hover:shadow hover:scale-105 gap-1.5",
                          severityFilter === 'high'
                            ? 'bg-orange-100 border-orange-400 text-orange-800 dark:bg-orange-900/40 dark:border-orange-600 dark:text-orange-300'
                            : 'hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 dark:hover:bg-orange-900/20 dark:hover:border-orange-700 dark:hover:text-orange-400'
                        )}
                      >
                        <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
                        High ({riskStats.high})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSeverityFilter('medium')}
                        className={cn(
                          "h-8 px-3 rounded-lg transition-all shadow-sm hover:shadow hover:scale-105 gap-1.5",
                          severityFilter === 'medium'
                            ? 'bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-300'
                            : 'hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 dark:hover:bg-amber-900/20 dark:hover:border-amber-700 dark:hover:text-amber-400'
                        )}
                      >
                        <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                        Medium ({riskStats.medium})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSeverityFilter('low')}
                        className={cn(
                          "h-8 px-3 rounded-lg transition-all shadow-sm hover:shadow hover:scale-105 gap-1.5",
                          severityFilter === 'low'
                            ? 'bg-green-100 border-green-400 text-green-800 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300'
                            : 'hover:bg-green-50 hover:border-green-300 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:border-green-700 dark:hover:text-green-400'
                        )}
                      >
                        <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                        Low ({riskStats.low})
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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

                    // Determine icon background and status badge color based on status and mitigations
                    const getIconClass = () => {
                      if (threat.status === 'mitigated') {
                        return 'bg-gradient-to-br from-green-500/10 to-green-500/5';
                      } else if (threat.status === 'accepted') {
                        return 'bg-gradient-to-br from-slate-500/10 to-slate-500/5';
                      } else if (linkedMitigations.length === 0) {
                        // No mitigations - red/orange (danger)
                        return 'bg-gradient-to-br from-red-500/10 to-red-500/5';
                      } else {
                        // Has mitigations but not yet mitigated - amber (in progress)
                        return 'bg-gradient-to-br from-amber-500/10 to-amber-500/5';
                      }
                    };

                    const getIconColor = () => {
                      if (threat.status === 'mitigated') {
                        return 'text-green-600';
                      } else if (threat.status === 'accepted') {
                        return 'text-slate-600';
                      } else if (linkedMitigations.length === 0) {
                        return 'text-red-600';
                      } else {
                        return 'text-amber-600';
                      }
                    };

                    return (
                      <Card
                        key={threat.id}
                        className="hover:shadow-lg hover:border-primary/20 transition-all duration-300 rounded-xl group/card relative overflow-hidden"
                        style={{
                          animation: 'slideUp 0.5s ease-out forwards',
                          animationDelay: `${index * 50}ms`,
                          opacity: 0
                        }}
                      >
                        {/* Severity stripe */}
                        <div className={cn('absolute left-0 top-0 bottom-0 w-1', getSeverityStripeClass(threat.severity))} />
                        <CardContent className="p-5 pl-6">
                          <div className="flex gap-5">
                            {/* Threat Information */}
                            <div
                              className="flex-1 space-y-3 cursor-pointer min-w-0"
                              onClick={() => handleOpenThreat(threat)}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 shadow-sm ${getIconClass()}`}>
                                  <AlertTriangle className={`h-5 w-5 ${getIconColor()}`} />
                                </div>
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <h3 className="font-bold text-sm">{threat.threat.name}</h3>
                                    <div className="flex items-center gap-2">
                                      {threat.severity && (
                                        <Badge variant="outline" className={cn('capitalize shadow-sm border', getSeverityClasses(threat.severity))}>
                                          {threat.severity}
                                        </Badge>
                                      )}
                                      <Badge variant="outline" className={cn('shadow-sm border capitalize', getStatusClasses(threat.status))}>{threat.status}</Badge>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 hover:bg-primary/10 rounded-lg transition-all"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigateToDiagram(threat);
                                        }}
                                        title="View in diagram"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="text-xs shadow-sm">{threat.threat.category}</Badge>
                                    {threat.risk_score !== null && (
                                      <Badge variant="outline" className="text-xs shadow-sm">
                                        Risk: {threat.risk_score}
                                      </Badge>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                      <Box className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground font-medium">{productName}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground font-medium">{diagramName}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                                      {modelName && (
                                        <span className="text-xs text-muted-foreground font-medium">{modelName}</span>
                                      )}
                                      <Badge variant="secondary" className="text-xs">{frameworkName}</Badge>
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {threat.threat.description}
                                  </p>
                                  {threat.comments && threat.comments !== '[]' && (
                                    <div className="pt-3 pb-1 flex justify-end">
                                      <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 hover:bg-muted/60 transition-colors border shadow-sm rounded-md" title="Has comments">
                                        <MessageSquare className="h-3.5 w-3.5 text-blue-500/80" />
                                        <span className="text-[10px] font-medium text-muted-foreground">Comments</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Linked Mitigations */}
                            {linkedMitigations.length > 0 && (
                              <div className="flex-2 space-y-2 border-l border-border/60 pl-5 min-w-0">
                                <div className="flex items-center gap-2 text-xs font-bold">
                                  <Link2 className="h-4 w-4 text-green-600" />
                                  <span>Linked Mitigations ({linkedMitigations.length})</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {linkedMitigations.map((mitigation) => {
                                    // Determine mitigation background based on status
                                    const getMitigationClass = () => {
                                      switch (mitigation.status) {
                                        case 'verified':
                                          return 'bg-gradient-to-br from-green-400/30 to-green-400/20 border-green-500/40 hover:bg-green-400/35 hover:border-green-500/50 dark:from-green-400/20 dark:to-green-400/10';
                                        case 'implemented':
                                          return 'bg-gradient-to-br from-green-200/30 to-green-200/20 border-green-400/40 hover:bg-green-200/35 hover:border-green-400/50 dark:from-green-200/15 dark:to-green-200/10';
                                        case 'proposed':
                                        default:
                                          return 'bg-gradient-to-br from-green-50/60 to-green-50/40 border-green-300/40 hover:bg-green-50/70 hover:border-green-300/50 dark:from-green-50/10 dark:to-green-50/5';
                                      }
                                    };

                                    return (
                                      <div
                                        key={mitigation.id}
                                        className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all duration-200 shadow-sm ${getMitigationClass()}`}
                                        onClick={() => handleOpenThreat(threat)}
                                      >

                                      <Shield className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                                      <div className="flex-1 min-w-0 space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-xs font-semibold truncate">{mitigation.mitigation.name}</p>
                                          <Badge variant="outline" className={cn("text-xs shrink-0 shadow-sm border capitalize", getStatusClasses(mitigation.status))}>
                                            {mitigation.status}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                          {mitigation.mitigation.description}
                                        </p>
                                        {mitigation.comments && mitigation.comments !== '[]' && (
                                          <div className="pt-3 pb-1 flex justify-end">
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 hover:bg-muted/60 transition-colors border shadow-sm rounded-md" title="Has comments">
                                              <MessageSquare className="h-3.5 w-3.5 text-blue-500/80" />
                                              <span className="text-[10px] font-medium text-muted-foreground">Comments</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <Card className="border-border/60 rounded-xl shadow-sm mt-4">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground font-medium">
                            Page {currentPage} of {totalPages}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                              className="h-9 px-3 rounded-lg transition-all hover:shadow-sm"
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Previous
                            </Button>

                            {/* Page numbers */}
                            <div className="flex items-center gap-1">
                              {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(page => {
                                  // Show first page, last page, current page, and pages around current
                                  return (
                                    page === 1 ||
                                    page === totalPages ||
                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                  );
                                })
                                .map((page, idx, arr) => (
                                  <div key={page} className="flex items-center">
                                    {/* Show ellipsis if there's a gap */}
                                    {idx > 0 && page - arr[idx - 1] > 1 && (
                                      <span className="px-2 text-muted-foreground">...</span>
                                    )}
                                    <Button
                                      variant={currentPage === page ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => setCurrentPage(page)}
                                      className={`h-9 w-9 p-0 rounded-lg transition-all hover:shadow-sm ${
                                        currentPage === page ? 'shadow-md' : ''
                                      }`}
                                    >
                                      {page}
                                    </Button>
                                  </div>
                                ))
                              }
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                              className="h-9 px-3 rounded-lg transition-all hover:shadow-sm"
                            >
                              Next
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  </>
                )}
              </div>
            </div>
        </>
      )}

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
