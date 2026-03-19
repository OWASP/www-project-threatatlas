import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { productsApi, diagramsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Save,
  Cpu,
  Database,
  Users,
  Box as BoxIcon,
  Trash2,
  Grid3x3,
  History,
  FileText,
  Package,
} from 'lucide-react';
import DiagramNode from '@/components/DiagramNode';
import ElementPropertiesSheet from '@/components/ElementPropertiesSheet';
import DiagramVersionHistory from '@/components/DiagramVersionHistory';
import DiagramVersionComparison from '@/components/DiagramVersionComparison';
import ModelSelector from '@/components/ModelSelector';

interface Product {
  id: number;
  name: string;
}

interface Diagram {
  id: number;
  product_id: number;
  name: string;
  diagram_data: any;
}

const nodeTypes = {
  custom: DiagramNode,
};

export default function Diagrams() {
  const { canWrite } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('product');
  const diagramId = searchParams.get('diagram');

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [selectedDiagram, setSelectedDiagram] = useState<number | null>(null);
  const [diagramName, setDiagramName] = useState('');
  const [saving, setSaving] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{ id: string; type: 'node' | 'edge'; label: string; nodeType?: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [diagramToDelete, setDiagramToDelete] = useState<Diagram | null>(null);

  // Model state
  const [activeModelId, setActiveModelId] = useState<number | null>(null);
  const [activeModel, setActiveModel] = useState<any>(null);

  // Version controls
  const [versionComment, setVersionComment] = useState('');
  const [showVersionComment, setShowVersionComment] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [compareVersions, setCompareVersions] = useState<{ from: number; to: number } | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (productId) {
      setSelectedProduct(parseInt(productId));
    }
  }, [productId]);

  useEffect(() => {
    if (selectedProduct) {
      loadDiagrams(selectedProduct);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (diagramId) {
      setSelectedDiagram(parseInt(diagramId));
      loadDiagram(parseInt(diagramId));
    }
  }, [diagramId]);

  const loadProducts = async () => {
    try {
      const response = await productsApi.list();
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadDiagrams = async (prodId: number) => {
    try {
      const response = await diagramsApi.list({ product_id: prodId });
      setDiagrams(response.data);
    } catch (error) {
      console.error('Error loading diagrams:', error);
    }
  };

  const loadDiagram = async (diagId: number) => {
    try {
      const response = await diagramsApi.get(diagId);
      const diagram = response.data;
      setDiagramName(diagram.name);
      setCurrentVersion(diagram.current_version || 0);

      if (diagram.diagram_data) {
        const loadedNodes = (diagram.diagram_data.nodes || []).map((node: Node) => ({
          ...node,
          zIndex: node.data.type === 'boundary' ? -1 : (node.zIndex || 0)
        }));
        setNodes(loadedNodes);
        setEdges(diagram.diagram_data.edges || []);
      }
    } catch (error) {
      console.error('Error loading diagram:', error);
    }
  };

  const handleCreateDiagram = async () => {
    if (!selectedProduct) return;

    try {
      const response = await diagramsApi.create({
        product_id: selectedProduct,
        name: 'New Diagram',
        diagram_data: { nodes: [], edges: [] },
      });

      navigate(`/diagrams?product=${selectedProduct}&diagram=${response.data.id}`);
      loadDiagrams(selectedProduct);
    } catch (error) {
      console.error('Error creating diagram:', error);
    }
  };

  const handleSaveDiagram = async () => {
    if (!selectedDiagram) return;

    try {
      setSaving(true);
      await diagramsApi.update(selectedDiagram, {
        name: diagramName,
        diagram_data: { nodes, edges },
        version_comment: versionComment || undefined,
      });

      // Clear version comment after successful save
      setVersionComment('');
      setShowVersionComment(false);

      // Reload diagram to get updated version number
      await loadDiagram(selectedDiagram);
    } catch (error) {
      console.error('Error saving diagram:', error);
    } finally {
      setSaving(false);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, label: 'Data Flow' } as Edge, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type: 'custom',
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      data: { label: `New ${type}`, type },
      // Set z-index lower for boundaries so they appear behind other elements
      zIndex: type === 'boundary' ? -1 : 0,
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedElement({
      id: node.id,
      type: 'node',
      label: node.data.label as string,
      nodeType: node.data.type as string
    });
    setSheetOpen(true);
  };

  const handleEdgeClick = (_event: React.MouseEvent, edge: Edge) => {
    setSelectedElement({
      id: edge.id,
      type: 'edge',
      label: (edge.label as string) || 'Data Flow'
    });
    setSheetOpen(true);
  };

  const handleDeleteElement = () => {
    if (!selectedElement) return;

    if (selectedElement.type === 'node') {
      setNodes((nds) => nds.filter((node) => node.id !== selectedElement.id));
      setEdges((eds) => eds.filter((edge) =>
        edge.source !== selectedElement.id && edge.target !== selectedElement.id
      ));
    } else {
      setEdges((eds) => eds.filter((edge) => edge.id !== selectedElement.id));
    }
    setSheetOpen(false);
    setSelectedElement(null);
  };

  const handleDeleteDiagram = async () => {
    if (!diagramToDelete || !selectedProduct) return;

    try {
      const deletedId = diagramToDelete.id;
      await diagramsApi.delete(deletedId);
      setDiagramToDelete(null);

      // If currently viewing the deleted diagram, navigate back to diagram list
      if (selectedDiagram === deletedId) {
        navigate(`/diagrams?product=${selectedProduct}`);
      }

      loadDiagrams(selectedProduct);
    } catch (error) {
      console.error('Error deleting diagram:', error);
    }
  };

  const handleVersionRestore = async () => {
    if (!selectedDiagram) return;
    await loadDiagram(selectedDiagram);
    setVersionHistoryOpen(false);
  };

  const handleVersionCompare = (fromVersion: number, toVersion: number) => {
    setCompareVersions({ from: fromVersion, to: toVersion });
    setVersionHistoryOpen(false);
  };

  const selectedProductData = products.find(p => p.id === selectedProduct);

  if (!selectedProduct) {
    return (
      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Data Flow Diagrams</h1>
            <p className="text-muted-foreground mt-1">
              Create and visualize data flow diagrams for your products
            </p>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12">
              <Grid3x3 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Select a product to get started</p>
              <p className="text-sm text-muted-foreground mb-6 text-center">
                Choose a product to view and create diagrams
              </p>
              <Select value={selectedProduct?.toString()} onValueChange={(val) => navigate(`/diagrams?product=${val}`)}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!selectedDiagram) {
    return (
      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="flex-1 space-y-6 mx-auto p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Data Flow Diagrams</h1>
              <p className="text-muted-foreground mt-1">
                <Package className="inline-block mr-2 h-4 w-4 text-muted-foreground" />
                {selectedProductData?.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedProduct.toString()} onValueChange={(val) => navigate(`/diagrams?product=${val}`)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canWrite && (
                <Button onClick={handleCreateDiagram}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Diagram
                </Button>
              )}
            </div>
          </div>

          {diagrams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12">
                <Grid3x3 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No diagrams yet</p>
                <p className="text-sm text-muted-foreground mb-6">
                  {canWrite ? 'Create your first diagram to start threat modeling' : 'No diagrams available for this product'}
                </p>
                {canWrite && (
                  <Button onClick={handleCreateDiagram}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Diagram
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {diagrams.map((diagram) => (
                <Card
                  key={diagram.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow group"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div 
                        className="flex items-center gap-3 flex-1"
                        onClick={() => navigate(`/diagrams?product=${selectedProduct}&diagram=${diagram.id}`)}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Grid3x3 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{diagram.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {diagram.diagram_data?.nodes?.length || 0} elements
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Toolbar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="flex flex-col gap-3 px-4 py-3">
          {/* Row 1: Product & Diagram Selection */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Select value={selectedProduct.toString()} onValueChange={(val) => navigate(`/diagrams?product=${val}`)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Separator orientation="vertical" className="h-8" />
              <Input
                value={diagramName}
                onChange={(e) => setDiagramName(e.target.value)}
                className="w-64 font-medium"
                placeholder="Diagram name"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVersionHistoryOpen(true)}
              >
                <History className="mr-2 h-4 w-4" />
                History
              </Button>
              {canWrite && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVersionComment(!showVersionComment)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Add Note
                  </Button>
                  <Button onClick={handleSaveDiagram} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Separator orientation="vertical" className="h-8" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const diagram = diagrams.find(d => d.id === selectedDiagram);
                      if (diagram) {
                        setDiagramToDelete(diagram);
                      }
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Model Selector & Node Tools */}
          <div className="flex items-center justify-between">
            <ModelSelector
              diagramId={selectedDiagram!}
              selectedModelId={activeModelId}
              onModelChange={(modelId, model) => {
                setActiveModelId(modelId);
                setActiveModel(model);
              }}
            />

            <div className="flex flex-wrap items-center gap-2">
            {canWrite && (
              <div className="flex flex-wrap items-center gap-1 bg-muted/50 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addNode('process')}
                  className="gap-2"
                >
                  <Cpu className="h-4 w-4 text-blue-600" />
                  Process
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addNode('datastore')}
                  className="gap-2"
                >
                  <Database className="h-4 w-4 text-amber-600" />
                  Data Store
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addNode('external')}
                  className="gap-2"
                >
                  <Users className="h-4 w-4 text-pink-600" />
                  External
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addNode('boundary')}
                  className="gap-2"
                >
                  <BoxIcon className="h-4 w-4 text-slate-600" />
                  Boundary
                </Button>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Version Comment Textarea */}
        {showVersionComment && (
          <div className="px-4 pb-3">
            <Textarea
              value={versionComment}
              onChange={(e) => setVersionComment(e.target.value)}
              placeholder="Add a comment about this version (optional)..."
              className="text-sm"
              rows={2}
            />
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative" style={{ minHeight: '400px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          elevateNodesOnSelect={false}
          fitView
          className="bg-muted/20"
          proOptions={{ hideAttribution: true }}
        >
          <Controls className="bg-background border shadow-lg" />
          <MiniMap
            className="bg-background border shadow-lg rounded-lg"
            nodeColor={(node) => {
              const type = node.data.type as string;
              if (type === 'process') return '#3b82f6';
              if (type === 'datastore') return '#f59e0b';
              if (type === 'external') return '#ec4899';
              return '#94a3b8';
            }}
            maskColor="rgba(0, 0, 0, 0.05)"
          />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="bg-muted/10" />
          <Panel position="top-left" className="bg-background/95 backdrop-blur-sm border rounded-xl shadow-xl p-3">
            <div className="text-xs space-y-2">
              <div className="font-semibold text-sm mb-2 text-foreground">DFD Elements</div>
              <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-600" />
                <span>Process</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <div className="w-4 h-1 bg-amber-500 border-t-2 border-b-2 border-amber-600" />
                <span>Data Store</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <div className="w-4 h-3 bg-pink-500 border-2 border-pink-600" />
                <span>External Entity</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <div className="w-4 h-3 border-2 border-dashed border-slate-400 rounded" />
                <span>Trust Boundary</span>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Element Properties Sheet */}
      <ElementPropertiesSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedElement={selectedElement}
        diagramId={selectedDiagram}
        activeModelId={activeModelId}
        activeModelFrameworkId={activeModel?.framework_id || null}
        onRename={(name) => {
          if (!selectedElement) return;
          if (selectedElement.type === 'node') {
            setNodes((nds) =>
              nds.map((node) =>
                node.id === selectedElement.id
                  ? { ...node, data: { ...node.data, label: name } }
                  : node
              )
            );
          } else if (selectedElement.type === 'edge') {
            setEdges((eds) =>
              eds.map((edge) =>
                edge.id === selectedElement.id
                  ? { ...edge, label: name }
                  : edge
              )
            );
          }
          setSelectedElement({ ...selectedElement, label: name });
        }}
        onDelete={() => setShowDeleteConfirm(true)}
      />

      {/* Delete Element Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Element</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedElement?.label}"? This action cannot be undone and will also remove all associated threats and mitigations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleDeleteElement();
                setShowDeleteConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Diagram Confirmation Dialog */}
      <AlertDialog open={!!diagramToDelete} onOpenChange={() => setDiagramToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Diagram</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{diagramToDelete?.name}"? This action cannot be undone and will delete all elements, threats, and mitigations in this diagram.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDiagram}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Version History Sheet */}
      <DiagramVersionHistory
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        diagramId={selectedDiagram}
        currentVersion={currentVersion}
        onRestore={handleVersionRestore}
        onCompare={handleVersionCompare}
      />

      {/* Version Comparison Dialog */}
      {compareVersions && (
        <DiagramVersionComparison
          open={!!compareVersions}
          onOpenChange={(open) => !open && setCompareVersions(null)}
          diagramId={selectedDiagram}
          fromVersion={compareVersions.from}
          toVersion={compareVersions.to}
        />
      )}
    </div>
  );
}
