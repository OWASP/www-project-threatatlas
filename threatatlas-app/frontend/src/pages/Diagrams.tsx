import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
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
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import '@xyflow/react/dist/style.css';
import { productsApi, diagramsApi, diagramThreatsApi, diagramMitigationsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
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
  Package,
  ChevronRight,
  Download,
  MessageSquare,
  Pencil,
  Sparkles,
  Upload,
  Flame,
  Maximize,
  Minimize,
  X,
  Map,
  ZoomIn,
  PanelRight,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import DiagramNode from '@/components/DiagramNode';
import DiagramEdge from '@/components/DiagramEdge';
import NewDiagramWizard from '@/components/NewDiagramWizard';
import DiagramVersionHistory from '@/components/DiagramVersionHistory';
import DiagramVersionComparison from '@/components/DiagramVersionComparison';
import ModelSelector from '@/components/ModelSelector';
import { ImportDrawioButton } from '@/components/ImportDrawioButton';
import ComponentLibraryPanel from '@/components/ComponentLibraryPanel';
import ComponentThreatsPanel from '@/components/ComponentThreatsPanel';
import DiagramRightPanel from '@/components/DiagramRightPanel';
import { useCollaboration } from '@/hooks/useCollaboration';
import { CollabPresence } from '@/components/CollabPresence';
import { CollabCursors } from '@/components/CollabCursors';

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

const edgeTypes = {
  custom: DiagramEdge,
};

export function DiagramsContent() {
  const { canWrite } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('product');
  const diagramId = searchParams.get('diagram');
  const { setExtra, clearExtra } = useBreadcrumb();

  // Stable refs so WebSocket callbacks always read the current value without stale closures
  const selectedDiagramRef = useRef<number | null>(null);
  const activeModelIdRef = useRef<number | null>(null);

  // ── Dirty tracking / auto-save / live sync ────────────────────────────────
  const [isDirty, setIsDirty] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saved'>('idle');
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isApplyingRemoteRef = useRef(false);

  // ── Real-time collaboration presence ──────────────────────────────────────
  const [selectedDiagramForCollab, setSelectedDiagramForCollab] = useState<number | null>(null);
  const { users: collabUsers, cursors: collabCursors, notifyDiagramSaved, sendCursorMove, sendDiagramSync } =
    useCollaboration({
      diagramId: selectedDiagramForCollab,
      enabled: !!selectedDiagramForCollab,
      onRemoteSync: (remoteNodes, remoteEdges) => {
        isApplyingRemoteRef.current = true;
        setNodes(remoteNodes);
        setEdges(remoteEdges);
        requestAnimationFrame(() => { isApplyingRemoteRef.current = false; });
      },
      onRemoteSave: (userName) => {
        // Refresh threat/mitigation badges silently when a collaborator saves
        if (selectedDiagramRef.current) {
          loadElementCounts(selectedDiagramRef.current, activeModelIdRef.current);
        }
        toast(`Saved by ${userName}`, { duration: 2000 });
      },
    });

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [selectedDiagram, setSelectedDiagram] = useState<number | null>(null);
  const [diagramName, setDiagramName] = useState('');
  const [saving, setSaving] = useState(false);

  const [nodes, setNodes, _onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, _onEdgesChange] = useEdgesState<Edge>([]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (!isApplyingRemoteRef.current) setIsDirty(true);
    _onNodesChange(changes);
  }, [_onNodesChange]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (!isApplyingRemoteRef.current) setIsDirty(true);
    _onEdgesChange(changes);
  }, [_onEdgesChange]);
  const { fitView, getNodes, getEdges, screenToFlowPosition } = useReactFlow();

  // ── Boundary attach state ──────────────────────────────────────────────────
  const [dragOverBoundaryId, setDragOverBoundaryId] = useState<string | null>(null);

  const handleExportJson = () => {
    const data = {
      name: diagramName,
      nodes,
      edges,
      productId: selectedProduct,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${diagramName.replace(/\s+/g, '_') || 'diagram'}_export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Create-diagram wizard state ────────────────────────────────────────────
  // The wizard UI/creation logic lives in the shared <NewDiagramWizard/>.
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  // Import choice (new diagram vs replace current)
  const [showImportChoice, setShowImportChoice] = useState(false);
  const [importMode, setImportMode] = useState<'new' | 'replace'>('new');

  const openCreateWizard = () => setShowCreateWizard(true);

  // Templates and create/blank/template logic now live in <NewDiagramWizard/>.
  // ── End wizard state ───────────────────────────────────────────────────────

  // ── Right panel tab control ───────────────────────────────────────────────
  const [rightPanelTab, setRightPanelTab] = useState<'inspector' | 'ai'>('inspector');
  const [selectedElement, setSelectedElement] = useState<{ id: string; type: 'node' | 'edge'; label: string; nodeType?: string; description?: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [diagramToDelete, setDiagramToDelete] = useState<Diagram | null>(null);

  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [isEditingModel, setIsEditingModel] = useState(false);
  const [isDeletingModel, setIsDeletingModel] = useState(false);

  // Threat/mitigation count badges per element_id
  const [elementCounts, setElementCounts] = useState<Record<string, { t: number; m: number; maxSeverity?: string }>>({});
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);

  // Track node IDs at last save to detect newly added elements
  const [savedNodeIds, setSavedNodeIds] = useState<Set<string>>(new Set());

  const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

  // ── Live sync + auto-save effect ──────────────────────────────────────────
  useEffect(() => {
    if (!isDirty || !selectedDiagram) return;

    // Broadcast diagram state to other collaborators (throttled in sendDiagramSync)
    const cleanNodes = nodes.map(({ data: { threatCount: _t, mitigationCount: _m, isDropTarget: _d, heatmapEnabled: _he, maxSeverity: _ms, aiFocused: _af, ...restData }, ...rest }) => ({
      ...rest,
      data: restData,
    }));
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      sendDiagramSync(cleanNodes, edges);
    }, 200);

    // Auto-save after 3 seconds of inactivity (only when user has write access)
    if (canWrite) {
      setAutoSaveStatus('pending');
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        // Skip if a manual save is already in progress
        if (!saving) handleSaveDiagram(true);
      }, 3000);
    }

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, nodes, edges, selectedDiagram]);

  const loadElementCounts = async (diagId: number, modelId?: number | null) => {
    try {
      const params: Record<string, number> = { diagram_id: diagId };
      if (modelId) params.model_id = modelId;
      const [threatsRes, mitsRes] = await Promise.all([
        diagramThreatsApi.list(params),
        diagramMitigationsApi.list(params),
      ]);
      const counts: Record<string, { t: number; m: number; maxSeverity?: string }> = {};
      for (const dt of threatsRes.data) {
        if (!counts[dt.element_id]) counts[dt.element_id] = { t: 0, m: 0 };
        counts[dt.element_id].t += 1;
        if (dt.severity) {
          const cur = counts[dt.element_id].maxSeverity;
          if (!cur || (SEVERITY_ORDER[dt.severity] ?? 0) > (SEVERITY_ORDER[cur] ?? 0)) {
            counts[dt.element_id].maxSeverity = dt.severity;
          }
        }
      }
      for (const dm of mitsRes.data) {
        if (!counts[dm.element_id]) counts[dm.element_id] = { t: 0, m: 0 };
        counts[dm.element_id].m += 1;
      }
      setElementCounts(counts);
    } catch {
      // non-critical — silently ignore
    }
  };

  // Model state
  const [activeModelId, setActiveModelId] = useState<number | null>(null);
  const [activeModel, setActiveModel] = useState<any>(null);

  // Reload element counts whenever the selected model changes so badges
  // reflect only threats/mitigations belonging to the active model.
  useEffect(() => {
    if (selectedDiagram) {
      loadElementCounts(selectedDiagram, activeModelId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModelId, selectedDiagram]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showZoomControls, setShowZoomControls] = useState(true);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Version controls
  const [versionComment, setVersionComment] = useState('');
  const [showVersionComment, setShowVersionComment] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [compareVersions, setCompareVersions] = useState<{ from: number; to: number } | null>(null);

  // ── Context menu ──────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{
    type: 'node' | 'edge' | 'pane';
    nodeId?: string;
    edgeId?: string;
    position?: { x: number; y: number };  // flow coords (for adding nodes)
    screenPos?: { x: number; y: number }; // screen coords (for menu placement)
  } | null>(null);

  const clipboardRef = useRef<Node[]>([]);

  // ── AI Focus ──────────────────────────────────────────────────────────────
  const [aiFocusNodeIds, setAiFocusNodeIds] = useState<string[]>([]);

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
      const id = parseInt(diagramId);
      selectedDiagramRef.current = id;
      setSelectedDiagram(id);
      setSelectedDiagramForCollab(id);
      loadDiagram(id);
    } else {
      selectedDiagramRef.current = null;
      setSelectedDiagramForCollab(null);
    }
  }, [diagramId]);

  const loadProducts = async () => {
    try {
      const response = await productsApi.list();
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products.');
    }
  };

  const loadDiagrams = async (prodId: number) => {
    try {
      const response = await diagramsApi.list({ product_id: prodId });
      setDiagrams(response.data);
    } catch (error) {
      console.error('Error loading diagrams:', error);
      toast.error('Failed to load diagrams.');
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
        })).sort((a: Node, b: Node) => (a.zIndex || 0) - (b.zIndex || 0));
        isApplyingRemoteRef.current = true;
        setNodes(loadedNodes);
        setEdges(diagram.diagram_data.edges || []);
        setSavedNodeIds(new Set(loadedNodes.map((n: Node) => n.id)));
        setIsDirty(false);
        setAutoSaveStatus('idle');
        requestAnimationFrame(() => { isApplyingRemoteRef.current = false; });
      }
      loadElementCounts(diagId, activeModelId);
    } catch (error) {
      console.error('Error loading diagram:', error);
      toast.error('Failed to load diagram.');
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
      toast.success('Diagram created successfully.');
    } catch (error) {
      console.error('Error creating diagram:', error);
      toast.error('Failed to create diagram.');
    }
  };

  const handleSaveDiagram = async (silent = false) => {
    if (!selectedDiagram) return;

    try {
      setSaving(true);
      const cleanNodes = nodes.map(({ data: { threatCount: _t, mitigationCount: _m, isDropTarget: _d, heatmapEnabled: _he, maxSeverity: _ms, aiFocused: _af, ...restData }, ...rest }) => ({
        ...rest,
        data: restData,
      }));
      await diagramsApi.update(selectedDiagram, {
        name: diagramName,
        diagram_data: { nodes: cleanNodes, edges },
        version_comment: versionComment || undefined,
      });

      setIsDirty(false);
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2500);

      // Clear version comment after successful save
      setVersionComment('');
      setShowVersionComment(false);

      // Snapshot current node IDs so newly added nodes can be detected after next edit
      setSavedNodeIds(new Set(nodes.map(n => n.id)));

      // Reload diagram to get updated version number
      await loadDiagram(selectedDiagram);
      // Notify collaborators that the diagram was saved
      notifyDiagramSaved();
      if (!silent) toast.success('Diagram saved successfully.');
    } catch (error) {
      console.error('Error saving diagram:', error);
      setAutoSaveStatus('idle');
      if (!silent) toast.error('Failed to save diagram.');
    } finally {
      setSaving(false);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'custom', animated: true, label: 'Data Flow' } as Edge, eds)),
    [setEdges]
  );

  // ── Boundary grouping ──────────────────────────────────────────────────────
  // Fixed rendered sizes for non-boundary nodes (used to compute center point)
  const ATTACH_SIZE: Record<string, { w: number; h: number }> = {
    process:   { w: 96,  h: 96  },
    datastore: { w: 140, h: 40  },
    external:  { w: 120, h: 44  },
  };

  const getBoundaryUnder = useCallback((node: Node): Node | undefined => {
    const allNodes = getNodes();
    // Absolute position: child positions are relative to parentId node
    const parent = node.parentId ? allNodes.find(n => n.id === node.parentId) : undefined;
    const absX = (parent ? parent.position.x : 0) + node.position.x;
    const absY = (parent ? parent.position.y : 0) + node.position.y;
    const size = ATTACH_SIZE[node.data.type as string] ?? { w: node.width ?? 80, h: node.height ?? 40 };
    const cx = absX + size.w / 2;
    const cy = absY + size.h / 2;
    return allNodes.find(n => {
      if (n.data.type !== 'boundary' || n.id === node.id) return false;
      const bx = n.position.x; const by = n.position.y;
      const bw = n.width ?? 300; const bh = n.height ?? 200;
      return cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh;
    });
  }, [getNodes]);

  const onNodeDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.data.type === 'boundary') { setDragOverBoundaryId(null); return; }
    const boundary = getBoundaryUnder(node);
    setDragOverBoundaryId(boundary?.id ?? null);
  }, [getBoundaryUnder]);

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.data.type === 'boundary') return;
    setDragOverBoundaryId(null);

    const allNodes = getNodes();
    const parent = node.parentId ? allNodes.find(n => n.id === node.parentId) : undefined;
    const absX = (parent ? parent.position.x : 0) + node.position.x;
    const absY = (parent ? parent.position.y : 0) + node.position.y;
    const containingBoundary = getBoundaryUnder(node);

    if (containingBoundary) {
      if (node.parentId === containingBoundary.id) return; // unchanged
      const relPos = { x: absX - containingBoundary.position.x, y: absY - containingBoundary.position.y };
      setNodes(nds => nds.map(n =>
        n.id !== node.id ? n : { ...n, parentId: containingBoundary.id, position: relPos }
      ));
    } else if (node.parentId) {
      // Dragged outside its boundary — detach
      setNodes(nds => nds.map(n => {
        if (n.id !== node.id) return n;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { parentId: _p, extent: _e, ...rest } = n as any;
        return { ...rest, position: { x: absX, y: absY } };
      }));
    }
  }, [getNodes, getBoundaryUnder, setNodes]);
  // ── End boundary grouping ──────────────────────────────────────────────────

  const componentNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addNode = (type: string, label?: string): string => {
    const nodeId = `${type}-${Date.now()}`;
    const newNode: Node = {
      id: nodeId,
      type: 'custom',
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      data: { label: label ?? `New ${type}`, type },
      zIndex: type === 'boundary' ? -1 : 10,
    };
    setNodes((nds) => {
      const nextNodes = [...nds, newNode];
      return nextNodes.sort((a: Node, b: Node) => (a.zIndex || 0) - (b.zIndex || 0));
    });
    return nodeId;
  };

  // State for component KB threats panel (shown when a predefined component is dropped)
  const [componentThreatTarget, setComponentThreatTarget] = useState<{
    nodeId: string; nodeName: string; nodeType: string; componentId: number;
  } | null>(null);

  const addComponentNode = (name: string, nodeType: string, componentId: number) => {
    const nodeId = addNode(nodeType, name);
    // Show KB threat proposals for this component
    setComponentThreatTarget({ nodeId, nodeName: name, nodeType, componentId });
  };

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedElement({
      id: node.id,
      type: 'node',
      label: node.data.label as string,
      nodeType: node.data.type as string,
      description: (node.data.description as string) ?? ''
    });
    setRightPanelTab('inspector');
  };

  const handleEdgeClick = (_event: React.MouseEvent, edge: Edge) => {
    setSelectedElement({
      id: edge.id,
      type: 'edge',
      label: (edge.label as string) || 'Data Flow'
    });
    setRightPanelTab('inspector');
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
      toast.success('Diagram deleted successfully.');
    } catch (error) {
      console.error('Error deleting diagram:', error);
      toast.error('Failed to delete diagram.');
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

  // ── Context menu handlers ─────────────────────────────────────────────────
  const handleCopy = useCallback((nodeId: string) => {
    const node = getNodes().find(n => n.id === nodeId);
    if (node) clipboardRef.current = [node];
  }, [getNodes]);

  const handleDuplicate = useCallback((nodeId: string) => {
    const node = getNodes().find(n => n.id === nodeId);
    if (!node) return;
    const newId = `${node.data.type || 'node'}-${Date.now()}`;
    const newNode: Node = {
      ...node,
      id: newId,
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      selected: false,
    };
    setNodes(nds => [...nds, newNode]);
    setIsDirty(true);
  }, [getNodes, setNodes]);

  const handlePaste = useCallback(() => {
    if (clipboardRef.current.length === 0) return;
    const newNodes = clipboardRef.current.map(node => ({
      ...node,
      id: `${node.data.type || 'node'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      selected: false,
    }));
    setNodes(nds => [...nds, ...newNodes]);
    setIsDirty(true);
  }, [setNodes]);

  const handleSelectAll = useCallback(() => {
    setNodes(nds => nds.map(n => ({ ...n, selected: true })));
  }, [setNodes]);

  const handleDeleteFromContext = useCallback((nodeId?: string, edgeId?: string) => {
    if (nodeId) {
      setNodes(nds => nds.filter(n => n.id !== nodeId));
      setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
      // Remove from AI focus if focused
      setAiFocusNodeIds(prev => prev.filter(id => id !== nodeId));
    } else if (edgeId) {
      setEdges(eds => eds.filter(e => e.id !== edgeId));
    }
    setIsDirty(true);
  }, [setNodes, setEdges]);

  const handleAddFromContext = useCallback((type: string, position?: { x: number; y: number }) => {
    const nodeId = `${type}-${Date.now()}`;
    const newNode: Node = {
      id: nodeId,
      type: 'custom',
      position: position ?? { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      data: { label: `New ${type}`, type },
      zIndex: type === 'boundary' ? -1 : 10,
    };
    setNodes(nds => {
      const next = [...nds, newNode];
      return next.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    });
    setIsDirty(true);
  }, [setNodes]);

  const handleSetAIFocus = useCallback((nodeId: string) => {
    setAiFocusNodeIds(prev =>
      prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
    );
    setRightPanelTab('ai');
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return;
      if (!selectedDiagram) return;

      const isMac = navigator.platform.includes('Mac');
      const ctrl = isMac ? e.metaKey : e.ctrlKey;

      if (ctrl && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
      }
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        const selected = getNodes().filter(n => n.selected);
        if (selected.length > 0) clipboardRef.current = selected;
      }
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      }
      if (ctrl && e.key === 'd') {
        e.preventDefault();
        const selected = getNodes().filter(n => n.selected);
        if (selected.length > 0) {
          selected.forEach(n => handleDuplicate(n.id));
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNodes = getNodes().filter(n => n.selected);
        const selectedEdges = getEdges().filter(e2 => e2.selected);
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          const nodeIds = new Set(selectedNodes.map(n => n.id));
          setNodes(nds => nds.filter(n => !n.selected));
          setEdges(eds => eds.filter(e2 => {
            if (e2.selected) return false;
            if (nodeIds.has(e2.source) || nodeIds.has(e2.target)) return false;
            return true;
          }));
          setAiFocusNodeIds(prev => prev.filter(id => !nodeIds.has(id)));
          setIsDirty(true);
        }
      }
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, selectedDiagram]);

  // Close context menu when clicking outside it (bubble phase — fires AFTER item onClick)
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  const handleImportSuccess = (diagramId: number) => {
    if (importMode === 'replace') {
      loadDiagram(diagramId);
    } else {
      loadDiagrams(selectedProduct!);
      navigate(`/diagrams?product=${selectedProduct}&diagram=${diagramId}`);
    }
    setImportMode('new');
  };

  // Non-boundary nodes with no threats analyzed yet (for incremental re-analysis)
  const unanalyzedNodes = useMemo(() =>
    nodes
      .filter(n => (n.data.type as string) !== 'boundary' && (elementCounts[n.id]?.t ?? 0) === 0)
      .map(n => ({ id: n.id, label: (n.data.label as string) || n.id, type: (n.data.type as string) || 'unknown' })),
    [nodes, elementCounts]
  );

  // Non-boundary nodes added to the diagram since the last save
  const newNodesSinceSave = useMemo(() =>
    nodes
      .filter(n => (n.data.type as string) !== 'boundary' && !savedNodeIds.has(n.id))
      .map(n => ({ id: n.id, label: (n.data.label as string) || n.id, type: (n.data.type as string) || 'unknown' })),
    [nodes, savedNodeIds]
  );

  // Merge threat/mitigation counts into node data for rendering only (never saved)
  const nodesWithCounts = useMemo(() =>
    nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        threatCount: elementCounts[node.id]?.t ?? 0,
        mitigationCount: elementCounts[node.id]?.m ?? 0,
        isDropTarget: node.id === dragOverBoundaryId,
        heatmapEnabled,
        maxSeverity: elementCounts[node.id]?.maxSeverity,
        aiFocused: aiFocusNodeIds.includes(node.id),
      },
    })),
    [nodes, elementCounts, dragOverBoundaryId, heatmapEnabled, aiFocusNodeIds]
  );

  // Merge threat/mitigation counts into edge data for rendering only (never saved)
  const edgesWithCounts = useMemo(() =>
    edges.map(edge => ({
      ...edge,
      type: edge.type || 'custom',
      data: {
        ...edge.data,
        threatCount: elementCounts[edge.id]?.t ?? 0,
        mitigationCount: elementCounts[edge.id]?.m ?? 0,
      },
    })),
    [edges, elementCounts]
  );

  const selectedProductData = products.find(p => p.id === selectedProduct);

  // Push breadcrumb crumbs: Products → product name → diagram name (editable)
  useEffect(() => {
    if (!selectedProductData) { clearExtra(); return; }
    setExtra([
      {
        label: 'Products',
        href: '/products',
      },
      {
        label: selectedProductData.name,
        href: `/diagrams?product=${selectedProduct}`,
      },
      ...(selectedDiagram ? [{
        label: diagramName,
        editable: true,
        value: diagramName,
        onChange: (v: string) => setDiagramName(v),
      }] : []),
    ]);
    return () => clearExtra();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductData?.name, selectedDiagram, diagramName, selectedProduct]);

  if (!selectedProduct) {
    return (
      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-medium tracking-tight">Data Flow Diagrams</h1>
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
                <SelectTrigger className="w-full max-w-64">
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

  // Creation dialogs (New Diagram wizard + import flow) — shared by both the
  // list view and the editor view so the "New Diagram" button works in both.
  const creationDialogs = (
    <>
      {/* New Diagram wizard — shared with the Products page (no model step here) */}
      <NewDiagramWizard
        open={showCreateWizard}
        onOpenChange={setShowCreateWizard}
        productId={selectedProduct}
        withModelStep={false}
        onRequestImport={() => { setImportMode('new'); setImportDialogOpen(true); }}
        onCreated={() => { if (selectedProduct) loadDiagrams(selectedProduct); }}
      />

      {/* Import choice dialog — new diagram vs replace current */}
      <Dialog open={showImportChoice} onOpenChange={setShowImportChoice}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Import Draw.io</DialogTitle>
            <DialogDescription>
              {nodes.length === 0
                ? 'The current diagram is empty — it will be replaced with your import.'
                : 'How would you like to import the file?'}
            </DialogDescription>
          </DialogHeader>
          {nodes.length === 0 ? (
            /* Empty diagram — skip the choice and go straight to replace */
            <div className="flex flex-col gap-3 py-2">
              <button
                type="button"
                autoFocus
                onClick={() => { setImportMode('replace'); setShowImportChoice(false); setImportDialogOpen(true); }}
                className="flex items-center gap-4 rounded-xl border-2 border-primary/40 bg-primary/5 p-4 hover:bg-primary/10 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">Import into this diagram</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Replace the empty canvas with your file</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setImportMode('new'); setShowImportChoice(false); setImportDialogOpen(true); }}
                className="flex items-center gap-4 rounded-xl border-2 border-border/50 bg-muted/20 p-4 hover:border-border hover:bg-muted/40 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 shrink-0">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-muted-foreground">Create a new separate diagram</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Keep this diagram and add another</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 py-2">
              <button
                type="button"
                onClick={() => { setImportMode('new'); setShowImportChoice(false); setImportDialogOpen(true); }}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-border/60 bg-muted/30 p-5 hover:border-primary/50 hover:bg-primary/5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-center">New Diagram</p>
                  <p className="text-xs text-muted-foreground text-center mt-0.5">Create a separate diagram</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setImportMode('replace'); setShowImportChoice(false); setImportDialogOpen(true); }}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-border/60 bg-muted/30 p-5 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500/10">
                  <Upload className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-center">Replace Current</p>
                  <p className="text-xs text-muted-foreground text-center mt-0.5">Overwrite this diagram</p>
                </div>
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Controlled ImportDrawioButton */}
      {selectedProduct && (
        <ImportDrawioButton
          productId={selectedProduct}
          onImportSuccess={handleImportSuccess}
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          targetDiagramId={importMode === 'replace' && selectedDiagram ? selectedDiagram : undefined}
          initialName={importMode === 'replace' ? diagramName : undefined}
        />
      )}
    </>
  );

  if (!selectedDiagram) {
    return (
      <div className="flex-1 p-4 md:p-6">
        {creationDialogs}
        <div className="flex-1 space-y-6 mx-auto">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-medium tracking-tight">Data Flow Diagrams</h1>
              <p className="text-muted-foreground mt-1">
                <Package className="inline-block mr-2 h-4 w-4 text-muted-foreground" />
                {selectedProductData?.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedProduct.toString()} onValueChange={(val) => navigate(`/diagrams?product=${val}`)}>
                <SelectTrigger className="w-full sm:w-48">
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
                <Button onClick={openCreateWizard}>
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
                  <Button onClick={openCreateWizard}>
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
    <div ref={containerRef} className="h-full flex flex-col bg-background overflow-hidden"
      style={{ colorScheme: 'light dark' }}
    >
      {/* ── Toolbar (h-12) ── */}
      <div className="h-12 border-b bg-background flex items-center justify-between px-3 z-20 shadow-sm relative shrink-0">

        {/* Left: collab presence + save status */}
        <div className="flex items-center gap-2 min-w-0">
          <CollabPresence users={collabUsers} />
          {autoSaveStatus === 'saved' && !saving && (
            <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1 shrink-0">
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Auto-saved
            </span>
          )}
          {autoSaveStatus === 'pending' && !saving && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              Unsaved
            </span>
          )}
        </div>

        {/* Right: model selector + actions + save */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="shrink-0">
            <ModelSelector
              diagramId={selectedDiagram}
              selectedModelId={activeModelId}
              onModelChange={(modelId, model) => {
                activeModelIdRef.current = modelId;
                setActiveModelId(modelId);
                setActiveModel(model);
              }}
              externalCreateOpen={isCreatingModel}
              onExternalCreateClose={() => setIsCreatingModel(false)}
              externalEditOpen={isEditingModel}
              onExternalEditClose={() => setIsEditingModel(false)}
              externalDeleteOpen={isDeletingModel}
              onExternalDeleteClose={() => setIsDeletingModel(false)}
            />
          </div>

          {canWrite && (
            <TooltipProvider>
              <div className="h-8 w-px bg-border/40 mx-0.5 shrink-0" />

              <div className="flex items-center bg-muted/40 rounded-lg p-0.5 gap-0.5">
                {/* Model actions */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10"
                      onClick={() => setIsCreatingModel(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New Model</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setIsEditingModel(true)} disabled={!activeModelId}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Model</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setIsDeletingModel(true)} disabled={!activeModelId}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Model</TooltipContent>
                </Tooltip>

                <div className="h-4 w-px bg-border/60 mx-0.5" />

                {/* Diagram actions */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={showVersionComment ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8"
                      onClick={() => setShowVersionComment(!showVersionComment)}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Revision Note</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExportJson}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download (JSON)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVersionHistoryOpen(true)}>
                      <History className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Version History</TooltipContent>
                </Tooltip>

                <div className="h-4 w-px bg-border/60 mx-0.5" />

                {/* AI + View */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={rightPanelTab === 'ai' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => setRightPanelTab(rightPanelTab === 'ai' ? 'inspector' : 'ai')}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>AI Threat Analysis</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fitView({ duration: 800 })}>
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fit View</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={heatmapEnabled ? 'secondary' : 'ghost'}
                      size="icon"
                      className={`h-8 w-8 ${heatmapEnabled ? 'text-orange-500' : ''}`}
                      onClick={() => setHeatmapEnabled(v => !v)}
                    >
                      <Flame className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Risk Heat Map</TooltipContent>
                </Tooltip>

                {/* Import Draw.io */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => {
                        if (selectedDiagram) {
                          setShowImportChoice(true);
                        } else {
                          setImportMode('new');
                          setImportDialogOpen(true);
                        }
                      }}>
                      <Upload className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Import Draw.io</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen}>
                      {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</TooltipContent>
                </Tooltip>

                <div className="h-4 w-px bg-border/60 mx-0.5" />

                {/* Canvas overlay toggles */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showMiniMap ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setShowMiniMap(v => !v)}
                    >
                      <Map className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{showMiniMap ? 'Hide Overview' : 'Show Overview'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showZoomControls ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setShowZoomControls(v => !v)}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{showZoomControls ? 'Hide Zoom Controls' : 'Show Zoom Controls'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={rightPanelOpen ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setRightPanelOpen(v => !v)}
                    >
                      <PanelRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{rightPanelOpen ? 'Collapse Panel' : 'Expand Panel'}</TooltipContent>
                </Tooltip>
              </div>

              <div className="h-8 w-px bg-border/40 mx-0.5 shrink-0" />

              <Button
                onClick={() => handleSaveDiagram(false)}
                disabled={saving}
                size="sm"
                className="h-8 px-4 font-semibold shadow-sm bg-primary hover:bg-primary/90 transition-all active:scale-95"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Floating Version Note */}
      {showVersionComment && (
        <div className="absolute top-14 right-4 z-50 w-80 shadow-2xl animate-in slide-in-from-top-4 duration-200">
          <Card className="border-primary/20 bg-background/95 backdrop-blur">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Version Note</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Close version note" onClick={() => setShowVersionComment(false)}>
                  <Plus className="h-3 w-3 rotate-45" />
                </Button>
              </div>
              <Textarea
                value={versionComment}
                onChange={(e) => setVersionComment(e.target.value)}
                placeholder="What changed in this version?"
                className="text-sm min-h-[100px] resize-none focus-visible:ring-1"
                autoFocus
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Three-panel body ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Left sidebar */}
        <ToolPanel onAddNode={addNode} onAddComponent={addComponentNode} frameworkId={activeModel?.framework_id ?? null} />

        {/* Canvas */}
        <div
          className="flex-1 relative min-w-0"
          onContextMenu={e => {
            setContextMenu(prev => prev ? { ...prev, screenPos: { x: e.clientX, y: e.clientY } } : null);
          }}
        >
          <ReactFlow
            nodes={nodesWithCounts}
            edges={edgesWithCounts}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onNodeContextMenu={(e, node) => {
              e.preventDefault();
              setContextMenu({ type: 'node', nodeId: node.id, screenPos: { x: e.clientX, y: e.clientY } });
            }}
            onEdgeContextMenu={(e, edge) => {
              e.preventDefault();
              setContextMenu({ type: 'edge', edgeId: edge.id, screenPos: { x: e.clientX, y: e.clientY } });
            }}
            onPaneContextMenu={(e) => {
              e.preventDefault();
              const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
              setContextMenu({ type: 'pane', position: pos, screenPos: { x: e.clientX, y: e.clientY } });
            }}
            onPaneClick={() => setContextMenu(null)}
            onMouseMove={(e) => {
              const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const flowPos = screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
              sendCursorMove(flowPos.x, flowPos.y);
            }}
            elevateNodesOnSelect={false}
            fitView
            className="bg-background"
            proOptions={{ hideAttribution: true }}
          >
            {/* Live collaboration cursors */}
            <CollabCursors cursors={collabCursors} />

            {showZoomControls && <Controls className="bg-background border shadow-xl rounded-lg overflow-hidden" />}
            {showMiniMap && (
              <MiniMap
                className="bg-background border shadow-xl rounded-xl"
                nodeColor={(node) => {
                  const type = node.data.type as string;
                  if (type === 'process') return 'var(--primary)';
                  if (type === 'datastore') return 'var(--element-datastore)';
                  if (type === 'external') return 'var(--element-external)';
                  return 'var(--element-boundary)';
                }}
                maskColor="rgba(0, 0, 0, 0.05)"
              />
            )}
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="bg-muted/10" />
          </ReactFlow>

          {/* Context menu */}
          {contextMenu?.screenPos && (
            <div
              className="fixed z-[9999] w-52 rounded-lg border border-border/60 bg-popover shadow-xl p-1 text-sm animate-in fade-in-0 zoom-in-95 duration-100"
              style={{
                left: Math.min(contextMenu.screenPos.x, window.innerWidth - 220),
                top: Math.min(contextMenu.screenPos.y, window.innerHeight - 240),
              }}
              onContextMenu={e => e.preventDefault()}
              onClick={e => e.stopPropagation()}
            >
              {contextMenu.type === 'pane' && (
                <>
                  {(['process', 'datastore', 'external', 'boundary'] as const).map((t) => (
                    <button key={t} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                      onClick={() => { handleAddFromContext(t, contextMenu.position); setContextMenu(null); }}>
                      {t === 'process' ? 'Add Process' : t === 'datastore' ? 'Add Data Store' : t === 'external' ? 'Add External Entity' : 'Add Trust Boundary'}
                    </button>
                  ))}
                  <div className="my-1 h-px bg-border" />
                  {clipboardRef.current.length > 0 && (
                    <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                      onClick={() => { handlePaste(); setContextMenu(null); }}>
                      <span>Paste</span><span className="text-[11px] text-muted-foreground">Ctrl+V</span>
                    </button>
                  )}
                  <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                    onClick={() => { handleSelectAll(); setContextMenu(null); }}>
                    <span>Select All</span><span className="text-[11px] text-muted-foreground">Ctrl+A</span>
                  </button>
                </>
              )}
              {contextMenu.type === 'node' && contextMenu.nodeId && (
                <>
                  <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                    onClick={() => { handleCopy(contextMenu.nodeId!); setContextMenu(null); }}>
                    <span>Copy</span><span className="text-[11px] text-muted-foreground">Ctrl+C</span>
                  </button>
                  <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                    onClick={() => { handleDuplicate(contextMenu.nodeId!); setContextMenu(null); }}>
                    <span>Duplicate</span><span className="text-[11px] text-muted-foreground">Ctrl+D</span>
                  </button>
                  <div className="my-1 h-px bg-border" />
                  <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-primary/10 hover:text-primary transition-colors text-left text-primary/80"
                    onClick={() => { handleSetAIFocus(contextMenu.nodeId!); setContextMenu(null); }}>
                    <span>✦</span>
                    <span>{aiFocusNodeIds.includes(contextMenu.nodeId!) ? 'Remove AI Focus' : 'Set as AI Focus'}</span>
                  </button>
                  <div className="my-1 h-px bg-border" />
                  <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors text-left text-destructive/80"
                    onClick={() => { handleDeleteFromContext(contextMenu.nodeId); setContextMenu(null); }}>
                    <span>Delete</span><span className="text-[11px]">Del</span>
                  </button>
                </>
              )}
              {contextMenu.type === 'edge' && contextMenu.edgeId && (
                <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors text-left text-destructive/80"
                  onClick={() => { handleDeleteFromContext(undefined, contextMenu.edgeId); setContextMenu(null); }}>
                  <span>Delete</span><span className="text-[11px]">Del</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        {rightPanelOpen && <DiagramRightPanel
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
          diagramId={selectedDiagram}
          activeModelId={activeModelId}
          frameworkId={activeModel?.framework_id ?? null}
          unanalyzedNodes={unanalyzedNodes}
          newNodesSinceSave={newNodesSinceSave}
          focusedNodeIds={aiFocusNodeIds}
          focusedNodeLabels={aiFocusNodeIds.map(id => {
            const node = nodes.find(n => n.id === id);
            return (node?.data.label as string) || id;
          })}
          onClearFocus={() => setAiFocusNodeIds([])}
          onModelCreated={(modelId, model) => {
            setActiveModelId(modelId);
            setActiveModel(model);
          }}
          onProposalApproved={() => {
            if (selectedDiagram) loadElementCounts(selectedDiagram, activeModelId);
          }}
          selectedElement={selectedElement}
          onRename={(_id, name) => {
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
          onDescriptionChange={(_id, description) => {
            if (!selectedElement || selectedElement.type !== 'node') return;
            setNodes((nds) =>
              nds.map((node) =>
                node.id === selectedElement.id
                  ? { ...node, data: { ...node.data, description } }
                  : node
              )
            );
            setSelectedElement({ ...selectedElement, description });
          }}
          onChangeNodeType={(_id, newType) => {
            if (!selectedElement || selectedElement.type !== 'node') return;
            const FIXED_SIZE: Record<string, { w: number; h: number }> = {
              process:   { w: 96,  h: 96  },
              datastore: { w: 140, h: 40  },
              external:  { w: 120, h: 44  },
            };
            setNodes((nds) =>
              nds.map((node) => {
                if (node.id !== selectedElement.id) return node;
                const oldType = node.data.type as string;
                const fixed = FIXED_SIZE[newType];
                let position = node.position;
                if (oldType === 'boundary' && fixed && node.width && node.height) {
                  const cx = node.position.x + node.width / 2;
                  const cy = node.position.y + node.height / 2;
                  position = { x: cx - fixed.w / 2, y: cy - fixed.h / 2 };
                }
                return {
                  ...node,
                  position,
                  zIndex: newType === 'boundary' ? -1 : 10,
                  width:  newType === 'boundary' ? (node.width  ?? 300) : undefined,
                  height: newType === 'boundary' ? (node.height ?? 200) : undefined,
                  data: { ...node.data, type: newType },
                };
              })
            );
            setSelectedElement({ ...selectedElement, nodeType: newType });
            requestAnimationFrame(() => setNodes(nds => [...nds]));
          }}
          onDeleteElement={handleDeleteElement}
          canWrite={canWrite}
        />}
      </div>

      {/* Delete Element Confirmation Dialog — kept for keyboard-shortcut delete path */}
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

      {creationDialogs}

      {/* Component KB Threats Panel */}
      {componentThreatTarget && selectedDiagram && (
        <ComponentThreatsPanel
          componentId={componentThreatTarget.componentId}
          nodeName={componentThreatTarget.nodeName}
          nodeId={componentThreatTarget.nodeId}
          nodeType={componentThreatTarget.nodeType}
          diagramId={selectedDiagram}
          modelId={activeModelId}
          frameworkId={activeModel?.framework_id ?? null}
          frameworkName={activeModel?.framework_name ?? null}
          onClose={() => setComponentThreatTarget(null)}
          onApplied={() => {
            setComponentThreatTarget(null);
            if (selectedDiagram) loadElementCounts(selectedDiagram, activeModelId);
          }}
        />
      )}

    </div>
  );
}

// ── Diagram Tool Panel (icon-only by default, expands on toggle) ──────────────
const TOOLS = [
  { type: 'process',  Icon: Cpu,      label: 'Process',        color: 'var(--primary)',          hoverBg: 'color-mix(in srgb, var(--primary) 12%, transparent)' },
  { type: 'datastore',Icon: Database, label: 'Data Store',     color: 'var(--element-datastore)', hoverBg: 'color-mix(in srgb, var(--element-datastore) 12%, transparent)' },
  { type: 'external', Icon: Users,    label: 'External Entity',color: 'var(--element-external)',  hoverBg: 'color-mix(in srgb, var(--element-external) 12%, transparent)' },
  { type: 'boundary', Icon: BoxIcon,  label: 'Trust Boundary', color: 'var(--element-boundary)',  hoverBg: 'color-mix(in srgb, var(--element-boundary) 15%, transparent)' },
] as const;

function ToolPanel({
  onAddNode,
  onAddComponent,
  frameworkId,
}: {
  onAddNode: (type: string) => void;
  onAddComponent: (name: string, nodeType: string, id: number) => void;
  frameworkId?: number | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      data-tool-panel
      className={`flex flex-col border-r border-border/50 bg-background transition-all duration-200 shrink-0 min-h-0 ${expanded ? 'w-52' : 'w-12'}`}
    >
      {/* Expand/collapse toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center justify-center h-10 w-full hover:bg-muted/40 transition-colors border-b border-border/40 shrink-0"
        title={expanded ? 'Collapse panel' : 'Expand panel'}
      >
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Tool buttons + component library — scrollable */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {TOOLS.map(({ type, Icon, label, color, hoverBg }) => (
          <button
            key={type}
            onClick={() => onAddNode(type)}
            title={label}
            className={`flex items-center gap-2.5 rounded-lg transition-all h-9 group ${expanded ? 'w-full px-2.5' : 'w-9 justify-center'}`}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
          >
            <Icon className="h-4.5 w-4.5 shrink-0 group-hover:scale-110 transition-transform" style={{ color }} />
            {expanded && <span className="text-sm font-medium text-left leading-none">{label}</span>}
          </button>
        ))}

        {/* Component Library — only shown when expanded */}
        {expanded && (
          <>
            <div className="pt-1 pb-0.5">
              <div className="h-px bg-border/60 mx-0.5" />
              <div className="px-1 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                Components
                <span className="text-[9px] font-normal text-primary bg-primary/10 rounded px-1">KB</span>
              </div>
            </div>
            <ComponentLibraryPanel onAddComponent={onAddComponent} frameworkId={frameworkId} />
          </>
        )}
      </div>
    </aside>
  );
}

// Wrapper to provide ReactFlow context
export default function Diagrams() {
  return (
    <ReactFlowProvider>
      <DiagramsContent />
    </ReactFlowProvider>
  );
}
