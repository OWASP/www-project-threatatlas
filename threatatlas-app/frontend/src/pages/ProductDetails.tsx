import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productsApi, diagramsApi, diagramThreatsApi, diagramMitigationsApi, modelsApi, frameworksApi, triggerDownload } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Grid3x3,
  AlertTriangle,
  Shield,
  Calendar,
  ExternalLink,
  Layers,
  Link2,
  Plus,
  Check,
  Loader2,
  MessageSquare,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText as FileReport,
  Package,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getSeverityClasses, getStatusClasses } from '@/lib/risk';
import { cn } from '@/lib/utils';
import ThreatDetailsSheet from '@/components/ThreatDetailsSheet';

interface Product {
  id: number;
  name: string;
  description: string | null;
  status: 'design' | 'development' | 'testing' | 'deployment' | 'production' | null;
  repository_url: string | null;
  confluence_url: string | null;
  application_url: string | null;
  business_area: string | null;
  owner_name: string | null;
  owner_email: string | null;
  created_at: string;
  updated_at: string;
}

interface Diagram {
  id: number;
  product_id: number;
  name: string;
  created_at: string;
}

interface DiagramThreat {
  id: number;
  diagram_id: number;
  model_id: number;
  threat_id: number;
  element_id: string;
  element_type: string;
  status: string;
  comments: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  risk_score: number | null;
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
  };
}

export default function ProductDetails() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [threats, setThreats] = useState<DiagramThreat[]>([]);
  const [mitigations, setMitigations] = useState<DiagramMitigation[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [frameworks, setFrameworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // New Diagram dialog state
  const [newDiagramOpen, setNewDiagramOpen] = useState(false);
  const [newDiagramStep, setNewDiagramStep] = useState(1);
  const [newDiagramName, setNewDiagramName] = useState('New Diagram');
  const [newDiagramNameError, setNewDiagramNameError] = useState('');
  const [newDiagramFrameworks, setNewDiagramFrameworks] = useState<number[]>([]);
  const [newDiagramFrameworkError, setNewDiagramFrameworkError] = useState('');
  const [newDiagramSubmitting, setNewDiagramSubmitting] = useState(false);

  useEffect(() => {
    if (productId) {
      loadProductData();
    }
  }, [productId]);

  const loadProductData = async () => {
    if (!productId) return;

    try {
      setLoading(true);
      const [productRes, diagramsRes] = await Promise.all([
        productsApi.get(parseInt(productId)),
        diagramsApi.list({ product_id: parseInt(productId) }),
      ]);

      setProduct(productRes.data);
      setDiagrams(diagramsRes.data);

      // Load threats, mitigations, models, and frameworks for all diagrams
      const diagramIds = diagramsRes.data.map((d: Diagram) => d.id);

      if (diagramIds.length > 0) {
        const [threatsRes, mitigationsRes, modelsRes, frameworksRes] = await Promise.all([
          Promise.all(diagramIds.map((id: number) => diagramThreatsApi.list({ diagram_id: id }))),
          Promise.all(diagramIds.map((id: number) => diagramMitigationsApi.list({ diagram_id: id }))),
          Promise.all(diagramIds.map((id: number) => modelsApi.listByDiagram(id))),
          frameworksApi.list(),
        ]);

        const allThreats = threatsRes.flatMap(res => res.data);
        const allMitigations = mitigationsRes.flatMap(res => res.data);
        const allModels = modelsRes.flatMap(res => res.data);

        setThreats(allThreats);
        setMitigations(allMitigations);
        setModels(allModels);
        setFrameworks(frameworksRes.data);
      }
    } catch (error) {
      console.error('Error loading product data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDiagramName = (diagramId: number) => {
    return diagrams.find(d => d.id === diagramId)?.name || 'Unknown Diagram';
  };

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

  const navigateToDiagram = (item: any) => {
    const diagramId = item?.diagram_id ?? item;
    navigate(`/diagrams?product=${productId}&diagram=${diagramId}`);
  };

  const handleOpenThreat = (threat: DiagramThreat) => {
    const linkedMits = mitigations.filter(m => m.threat_id === threat.id);
    setSelectedItem({ ...threat, linkedMitigations: linkedMits });
    setSheetOpen(true);
  };

  const handleUpdateItem = async (comments: string) => {
    if (!selectedItem) return;
    try {
      setSelectedItem((prev: any) => prev ? { ...prev, comments } : null);
      await diagramThreatsApi.update(selectedItem.id, { comments });
      await loadProductData();
    } catch (error) {
      console.error('Error updating:', error);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedItem) return;
    try {
      setSelectedItem((prev: any) => prev ? { ...prev, status } : null);
      await diagramThreatsApi.update(selectedItem.id, { status });
      await loadProductData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleUpdateRisk = async (threatId: number, data: { likelihood?: number; impact?: number }) => {
    try {
      setSelectedItem((prev: any) => prev && prev.id === threatId ? { ...prev, ...data } : prev);
      await diagramThreatsApi.update(threatId, data);
      await loadProductData();
    } catch (error) {
      console.error('Error updating risk:', error);
    }
  };

  const getMitigationsForThreat = (threat: DiagramThreat) => {
    return mitigations.filter(m => m.threat_id === threat.id);
  };

  const openNewDiagramDialog = () => {
    setNewDiagramStep(1);
    setNewDiagramName('New Diagram');
    setNewDiagramNameError('');
    setNewDiagramFrameworks([]);
    setNewDiagramFrameworkError('');
    setNewDiagramSubmitting(false);
    setNewDiagramOpen(true);
  };

  const handleNewDiagramNext = () => {
    if (!newDiagramName.trim()) {
      setNewDiagramNameError('Diagram name is required.');
      return;
    }
    setNewDiagramNameError('');
    setNewDiagramStep(2);
  };

  const toggleNewDiagramFramework = (id: number) => {
    setNewDiagramFrameworkError('');
    setNewDiagramFrameworks(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleNewDiagramSubmit = async () => {
    if (newDiagramFrameworks.length === 0) {
      setNewDiagramFrameworkError('Select at least one framework.');
      return;
    }
    if (!productId) return;
    setNewDiagramSubmitting(true);
    try {
      const diagramRes = await diagramsApi.create({
        product_id: parseInt(productId),
        name: newDiagramName.trim(),
        diagram_data: { nodes: [], edges: [] },
      });
      const diagramId: number = diagramRes.data.id;
      await Promise.all(
        newDiagramFrameworks.map(fwId => {
          const fw = frameworks.find((f: any) => f.id === fwId);
          return modelsApi.create({
            diagram_id: diagramId,
            framework_id: fwId,
            name: fw ? `${fw.name} Analysis` : 'Analysis',
          });
        })
      );
      setNewDiagramOpen(false);
      navigate(`/diagrams?product=${productId}&diagram=${diagramId}`);
    } catch (err) {
      console.error('Error creating diagram:', err);
    } finally {
      setNewDiagramSubmitting(false);
    }
  };

  // Stats
  const criticalThreats = threats.filter(t => t.severity === 'critical').length;
  const highThreats = threats.filter(t => t.severity === 'high').length;
  const mitigatedThreats = threats.filter(t => t.status === 'mitigated').length;

  if (loading) {
    return (
      <div className="flex-1 space-y-6 p-6 md:p-8 pb-16">
        <Card className="border-dashed rounded-xl animate-pulse">
          <CardContent className="flex items-center justify-center p-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground font-medium">Loading product details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex-1 space-y-6 p-6 md:p-8 pb-16">
        <Card className="border-dashed border-2 rounded-xl">
          <CardContent className="flex flex-col items-center justify-center p-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-muted/60 to-muted/40 mb-4 shadow-sm">
              <Box className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">Product not found</h3>
            <p className="text-sm text-muted-foreground mb-6">
              The requested product could not be found.
            </p>
            <Button onClick={() => navigate('/products')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Products
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2 mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between animate-fadeIn">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/products')}
          className="-ml-2 hover:bg-muted/70 rounded-lg cursor-pointer transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shadow-sm">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Export this product</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => triggerDownload(`/api/products/${product.id}/download/diagrams`)}
            >
              <FileJson className="mr-2 h-4 w-4" />
              Diagrams (JSON)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => triggerDownload(`/api/products/${product.id}/download/threats-mitigations`)}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Threats & Mitigations (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => triggerDownload(`/api/products/${product.id}/download/report`)}
            >
              <FileReport className="mr-2 h-4 w-4" />
              Full report (HTML)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => triggerDownload(`/api/products/${product.id}/download/bundle`)}
            >
              <Package className="mr-2 h-4 w-4" />
              All files (ZIP bundle)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Product Info & Stats */}
      <div className="grid gap-2 lg:grid-cols-2">
        {/* Left: Product Information */}
        <div className="lg:col-span-1">
          <Card className="rounded-xl border-border/60 shadow-sm h-full">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5 text-primary" />
                {product.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-full m-2 p-0 space-y-2">
              <div className="p-2 border-dashed border rounded-lg">
                <p className="text-sm leading-relaxed">
                  {product.description || 'No description provided'}
                </p>
              </div>

              {(product.status ||
                product.business_area ||
                product.owner_name ||
                product.owner_email ||
                product.repository_url ||
                product.confluence_url ||
                product.application_url) && (
                <div className="p-3 border border-border/60 rounded-lg bg-muted/20 space-y-2 text-sm">
                  {product.status && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0">Status</span>
                      <Badge variant="outline" className="capitalize">{product.status}</Badge>
                    </div>
                  )}
                  {product.business_area && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0 mt-0.5">Business area</span>
                      <span>{product.business_area}</span>
                    </div>
                  )}
                  {(product.owner_name || product.owner_email) && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0 mt-0.5">Owner</span>
                      <span>
                        {product.owner_name}
                        {product.owner_name && product.owner_email && ' · '}
                        {product.owner_email && (
                          <a href={`mailto:${product.owner_email}`} className="text-primary hover:underline">
                            {product.owner_email}
                          </a>
                        )}
                      </span>
                    </div>
                  )}
                  {product.repository_url && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0 mt-0.5">Repository</span>
                      <a href={product.repository_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                        {product.repository_url}
                      </a>
                    </div>
                  )}
                  {product.confluence_url && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0 mt-0.5">Confluence</span>
                      <a href={product.confluence_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                        {product.confluence_url}
                      </a>
                    </div>
                  )}
                  {product.application_url && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground w-28 shrink-0 mt-0.5">Application</span>
                      <a href={product.application_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                        {product.application_url}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex-col items-start gap-4 bottom-0 sticky">
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">
                    Created: {new Date(product.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">
                    Updated: {new Date(product.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* Right: Stats in 2x2 Grid */}
        <div className="grid gap-2 grid-cols-2">
          <Card className="rounded-xl border-border/60 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-muted-foreground tracking-wider">DIAGRAMS</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 shadow-sm">
                    <Grid3x3 className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{diagrams.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-muted-foreground tracking-wider">THREATS</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-500/5 shadow-sm">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{threats.length}</p>
                <p className="text-xs text-muted-foreground">
                  {criticalThreats + highThreats} critical/high
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-muted-foreground tracking-wider">MITIGATIONS</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5 shadow-sm">
                    <Shield className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{mitigations.length}</p>
                <p className="text-xs text-muted-foreground">
                  {mitigations.filter(m => m.status === 'implemented').length} implemented
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-muted-foreground tracking-wider">COVERAGE</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm">
                    <Layers className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold">
                  {threats.length > 0 ? Math.round((mitigatedThreats / threats.length) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {mitigatedThreats} mitigated
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Diagrams List */}
      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Grid3x3 className="h-5 w-5 text-primary" />
                Diagrams ({diagrams.length})
              </CardTitle>
              <CardDescription className="mt-1">
                Data flow diagrams for this product
              </CardDescription>
            </div>
            <Button size="sm" onClick={openNewDiagramDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Diagram
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {diagrams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
              No diagrams created yet
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {diagrams.map((diagram) => {
                const diagramThreats = threats.filter(t => t.diagram_id === diagram.id);
                const diagramMitigations = mitigations.filter(m => m.diagram_id === diagram.id);
                const diagramModels = models.filter(m => m.diagram_id === diagram.id);

                return (
                  <Card
                    key={diagram.id}
                    className="hover:shadow-lg hover:border-primary/30 transition-all duration-300 rounded-xl cursor-pointer group"
                    onClick={() => navigateToDiagram(diagram.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm group-hover:shadow-md transition-all">
                          <Grid3x3 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm mb-1 truncate flex items-center gap-2">
                            {diagram.name}
                            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Layers className="h-3 w-3 text-primary" />
                              {diagramModels.length} {diagramModels.length === 1 ? 'model' : 'models'}
                            </span>
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-orange-600" />
                              {diagramThreats.length}
                            </span>
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3 text-green-600" />
                              {diagramMitigations.length}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Threats & Mitigations */}
      <div className="space-y-3">
        <div className="flex items-center justify-betwee mt-4">
          <h2 className="text-base font-bold flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Threats & Mitigations ({threats.length})
          </h2>
        </div>

        <div className="space-y-3">
          {threats.length === 0 ? (
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
            threats.map((threat) => {
              const linkedMitigations = getMitigationsForThreat(threat);
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
                  className="hover:shadow-lg hover:border-primary/20 transition-all duration-300 rounded-xl group/card"
                >
                  <CardContent className="p-5">
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
                                <Badge variant="outline" className={cn('shadow-sm border capitalize', getStatusClasses(threat.status))}>
                                  {threat.status}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs shadow-sm">{threat.threat.category}</Badge>
                              {threat.risk_score !== null && (
                                <Badge variant="outline" className="text-xs shadow-sm">
                                  Risk: {threat.risk_score}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                <Grid3x3 className="h-3 w-3" />
                                {getDiagramName(threat.diagram_id)}
                              </Badge>
                              <div className="flex items-center gap-1.5">
                                <Layers className="h-3 w-3 text-muted-foreground" />
                                {modelName && (
                                  <Badge variant="outline" className="text-xs">
                                    {modelName}
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-xs">
                                  {frameworkName}
                                </Badge>
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
                                      <Badge variant="outline" className={cn('text-xs shrink-0 shadow-sm border capitalize', getStatusClasses(mitigation.status))}>
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
            })
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
        onMitigationsChange={loadProductData}
      />

      {/* New Diagram Dialog (2-step) */}
      <Dialog open={newDiagramOpen} onOpenChange={setNewDiagramOpen}>
        <DialogContent className="sm:max-w-[480px]">
          {/* Step indicator */}
          <div className="flex items-center gap-1 mb-1">
            {['Diagram', 'Framework'].map((label, i) => {
              const num = i + 1;
              const done = newDiagramStep > num;
              const current = newDiagramStep === num;
              return (
                <div key={label} className="flex items-center gap-1">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${done ? 'bg-primary text-primary-foreground'
                      : current ? 'border border-primary bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                    {done ? <Check className="h-3 w-3" /> : num}
                  </div>
                  <span className={`text-xs font-medium ${current ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                  {i < 1 && (
                    <div className={`mx-1 h-px w-6 transition-colors ${newDiagramStep > num ? 'bg-primary' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
          </div>

          <DialogHeader>
            <DialogTitle>
              {newDiagramStep === 1 ? 'New Diagram' : 'Select Frameworks'}
            </DialogTitle>
            <DialogDescription>
              {newDiagramStep === 1
                ? 'Give your diagram a name.'
                : 'Choose the threat modeling frameworks to apply.'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 min-h-[140px]">
            {/* Step 1: Diagram name */}
            {newDiagramStep === 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="nd-name">Diagram name <span className="text-destructive">*</span></Label>
                <Input
                  id="nd-name"
                  value={newDiagramName}
                  onChange={e => { setNewDiagramName(e.target.value); setNewDiagramNameError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleNewDiagramNext()}
                  autoFocus
                />
                {newDiagramNameError && <p className="text-xs text-destructive">{newDiagramNameError}</p>}
              </div>
            )}

            {/* Step 2: Frameworks */}
            {newDiagramStep === 2 && (
              <div className="space-y-2">
                <div className="grid gap-2">
                  {frameworks.map((fw: any) => {
                    const selected = newDiagramFrameworks.includes(fw.id);
                    return (
                      <div
                        key={fw.id}
                        onClick={() => toggleNewDiagramFramework(fw.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${selected
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border hover:border-border/80 hover:bg-muted/40'
                          }`}
                      >
                        <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40 bg-background'
                          }`}>
                          {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight">{fw.name}</p>
                          {fw.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{fw.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {newDiagramFrameworkError && (
                  <p className="text-xs text-destructive">{newDiagramFrameworkError}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-row items-center gap-2">
            <Button variant="ghost" onClick={() => setNewDiagramOpen(false)} disabled={newDiagramSubmitting} className="mr-auto">
              Cancel
            </Button>
            {newDiagramStep === 2 && (
              <Button variant="outline" onClick={() => setNewDiagramStep(1)} disabled={newDiagramSubmitting}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
            )}
            {newDiagramStep === 1 ? (
              <Button onClick={handleNewDiagramNext}>
                Next
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleNewDiagramSubmit} disabled={newDiagramSubmitting}>
                {newDiagramSubmitting ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</>
                ) : (
                  <>Create &amp; Open<ArrowRight className="ml-1.5 h-4 w-4" /></>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
