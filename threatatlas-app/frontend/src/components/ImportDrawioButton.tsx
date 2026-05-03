import { useState } from 'react';
import { Upload, FileWarning, Cpu, Database, Users, Box, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { diagramsApi, aiConversationsApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getElementColor } from '@/lib/designSystem';

// ── Types ──────────────────────────────────────────────────────────────────

type NodeType = 'process' | 'datastore' | 'external' | 'boundary';
type HandleSide = 'top' | 'right' | 'bottom' | 'left';

interface ParsedNode {
  id: string;
  label: string;
  type: NodeType;
  /** Shape/layout from draw.io (parser heuristic); preserved so import layout matches the file even if AI or user remaps DFD type. */
  layoutType: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  originalStyle: string;
  aiSuggestedType?: NodeType;
}

interface ParsedEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  sourceHandle: string;
  targetHandle: string;
  /** draw.io edge style (exit/entry and routing hints for handle selection) */
  edgeStyle: string;
}

// ── Node type UI metadata ──────────────────────────────────────────────────

const NODE_TYPES: { value: NodeType; label: string; icon: React.ElementType; colorVar: string }[] = [
  { value: 'process',   label: 'Process',        icon: Cpu,      colorVar: 'var(--element-process)' },
  { value: 'datastore', label: 'Data Store',      icon: Database, colorVar: 'var(--element-datastore)' },
  { value: 'external',  label: 'External Entity', icon: Users,    colorVar: 'var(--element-external)' },
  { value: 'boundary',  label: 'Trust Boundary',  icon: Box,      colorVar: 'var(--element-boundary)' },
];

function NodeTypeIcon({ type, className }: { type: NodeType; className?: string }) {
  const meta = NODE_TYPES.find(t => t.value === type)!;
  const Icon = meta.icon;
  return <Icon className={cn('h-4 w-4 shrink-0', className)} style={{ color: meta.colorVar }} />;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Strip HTML tags from draw.io rich-text labels and return the first
 * meaningful line. draw.io uses HTML for multi-line labels like
 * "<b>S3</b><br>Context analyzer" — we want just "S3".
 */
function stripHtml(s: string): string {
  const decoded = s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  const firstLine = decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|h[1-6]|li)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .split('\n').map(l => l.trim()).filter(Boolean)[0] ?? '';
  return firstLine;
}

/** Parse a single style key, e.g. "exitX=1" → 1. */
function styleVal(style: string, key: string): number | null {
  const m = new RegExp(`(?:^|;)${key}=([^;]+)`).exec(style);
  return m ? parseFloat(m[1]) : null;
}

// ── Shape detection ────────────────────────────────────────────────────────

/**
 * Map a draw.io cell style + label to one of our four DFD node types.
 * Covers standard draw.io shapes, mxgraph extras, BPMN, AWS, Azure, GCP,
 * flowchart shapes, and label-based heuristics.
 */
function detectNodeType(style: string, label: string): NodeType {
  const s = style.toLowerCase();
  const l = label.toLowerCase();

  // ── Skip classes (handled in extractCells, but guard here too) ──
  if (s.startsWith('edgelabel') || s.startsWith('text;') || s === 'text') return 'external';

  // ── Trust Boundary ──
  // Priority: check boundaries BEFORE process/external to catch
  // rounded+dashed containers (common security zone pattern in draw.io).
  if (
    s.includes('swimlane') ||
    s.includes('shape=mxgraph.dfd.boundary') ||
    s.includes('shape=mxgraph.dfd.trustboundary') ||
    // Rounded dashed rectangle = security zone / network boundary
    (s.includes('dashed=1') && s.includes('dashpattern')) ||
    (s.includes('dashed=1') && (
      s.includes('fillcolor=none') ||
      s.includes('fillcolor=#ffffff00') ||
      s.includes('opacity=0') ||
      s.includes('nofill=1') ||
      !s.includes('fillcolor=')
    )) ||
    (s.includes('container=1') && !s.includes('shape=') && !s.includes('ellipse'))
  ) return 'boundary';

  // ── Process ── (circle / ellipse / cloud services / apps)
  if (
    s.includes('ellipse') ||
    s.includes('shape=mxgraph.dfd.process') ||
    s.includes('shape=process') ||
    s.includes('shape=mxgraph.bpmn.task') ||
    s.includes('shape=mxgraph.bpmn.event') ||
    s.includes('shape=mxgraph.bpmn.shape') ||
    s.includes('shape=mxgraph.flowchart.start_2') ||
    s.includes('shape=mxgraph.flowchart.decision') ||
    s.includes('shape=mxgraph.flowchart.process') ||
    s.includes('shape=mxgraph.cisco.computers_and_peripherals') ||
    s.includes('shape=mxgraph.cisco.servers') ||
    // AWS — compute / integration services
    s.includes('shape=mxgraph.aws4.lambda') ||
    s.includes('shape=mxgraph.aws3.lambda') ||
    s.includes('shape=mxgraph.aws4.resourceicon') ||  // generic AWS resource icon
    s.includes('resicon=mxgraph.aws4.lambda') ||
    s.includes('resicon=mxgraph.aws4.api_gateway') ||
    s.includes('resicon=mxgraph.aws4.eventbridge') ||
    s.includes('resicon=mxgraph.aws4.fargate') ||
    s.includes('resicon=mxgraph.aws4.ecs') ||
    s.includes('resicon=mxgraph.aws4.ec2') ||
    s.includes('shape=mxgraph.aws4.application') ||
    s.includes('shape=mxgraph.aws4.general') ||
    s.includes('shape=mxgraph.aws3.lambda_function') ||
    s.includes('shape=mxgraph.aws3.application') ||
    // GCP / Azure compute
    s.includes('shape=mxgraph.gcp2.function') ||
    s.includes('shape=mxgraph.azure.function') ||
    s.includes('shape=mxgraph.azure.app_service') ||
    // Rounded rectangle (non-dashed) — common process shape
    (s.includes('rounded=1') && !s.includes('dashed') && !s.includes('shape='))
  ) return 'process';

  // ── Data Store ── (cylinder / database / storage / queue / messaging)
  if (
    s.includes('cylinder') ||                     // catches cylinder, cylinder3, shape=cylinder…
    s.includes('shape=mxgraph.dfd.datastore') ||
    s.includes('shape=database') ||
    s.includes('shape=mxgraph.flowchart.stored_data') ||
    s.includes('shape=mxgraph.flowchart.database') ||
    s.includes('shape=mxgraph.cisco.storage') ||
    s.includes('shape=offpageconnector') ||
    s.includes('shape=parallelogram') ||
    // AWS storage / messaging
    s.includes('resicon=mxgraph.aws4.s3') ||
    s.includes('resicon=mxgraph.aws4.dynamodb') ||
    s.includes('resicon=mxgraph.aws4.rds') ||
    s.includes('resicon=mxgraph.aws4.sqs') ||
    s.includes('resicon=mxgraph.aws4.sns') ||
    s.includes('resicon=mxgraph.aws4.kinesis') ||
    s.includes('resicon=mxgraph.aws4.elasticache') ||
    s.includes('resicon=mxgraph.aws4.aurora') ||
    s.includes('shape=mxgraph.aws4.s3') ||
    s.includes('shape=mxgraph.aws4.dynamo_db') ||
    s.includes('shape=mxgraph.aws4.rds') ||
    s.includes('shape=mxgraph.aws4.sqs') ||
    s.includes('shape=mxgraph.aws3.s3') ||
    s.includes('shape=mxgraph.aws3.dynamo_db') ||
    s.includes('shape=mxgraph.aws3.rds') ||
    // GCP / Azure storage
    s.includes('shape=mxgraph.gcp2.cloud_sql') ||
    s.includes('shape=mxgraph.gcp2.cloud_storage') ||
    s.includes('shape=mxgraph.gcp2.cloud_pub_sub') ||
    s.includes('shape=mxgraph.azure.sql') ||
    s.includes('shape=mxgraph.azure.blob') ||
    s.includes('shape=mxgraph.azure.queue') ||
    // Label-based heuristics
    /\b(db|database|datastore|data store|filestore|file store|cache|queue|message queue|topic|s3 bucket|blob storage|redis|mongo|postgres|mysql|sqlite|kafka|sqs|sns|vector store|embedding store|pinecone|chroma|weaviate|opensearch|elasticsearch)\b/.test(l)
  ) return 'datastore';

  // ── External Entity ── (default: rectangles, actors, users)
  return 'external';
}

// ── Smart handle selection ─────────────────────────────────────────────────

/**
 * Given source and target node geometry, return the best source/target
 * ReactFlow handle IDs. Prefers horizontal flow when dx ≥ dy, vertical otherwise.
 * Also honours draw.io exit/entry hints when present in the edge style.
 */
function bestHandles(
  src: ParsedNode,
  tgt: ParsedNode,
  edgeStyle: string
): { sourceHandle: string; targetHandle: string } {
  // Honour draw.io's own exit/entry hints first
  const exitX  = styleVal(edgeStyle, 'exitX');
  const exitY  = styleVal(edgeStyle, 'exitY');
  const entryX = styleVal(edgeStyle, 'entryX');
  const entryY = styleVal(edgeStyle, 'entryY');

  const sideFromXY = (x: number | null, y: number | null): HandleSide | null => {
    if (x === null || y === null) return null;
    if (x === 0)   return 'left';
    if (x === 1)   return 'right';
    if (y === 0)   return 'top';
    if (y === 1)   return 'bottom';
    return null;
  };

  const exitSide  = sideFromXY(exitX, exitY);
  const entrySide = sideFromXY(entryX, entryY);

  // Fall back to geometric computation
  const scx = src.x + src.width  / 2;
  const scy = src.y + src.height / 2;
  const tcx = tgt.x + tgt.width  / 2;
  const tcy = tgt.y + tgt.height / 2;
  const dx  = tcx - scx;
  const dy  = tcy - scy;

  let computedExit: HandleSide;
  let computedEntry: HandleSide;

  if (Math.abs(dx) >= Math.abs(dy)) {
    computedExit  = dx >= 0 ? 'right' : 'left';
    computedEntry = dx >= 0 ? 'left'  : 'right';
  } else {
    computedExit  = dy >= 0 ? 'bottom' : 'top';
    computedEntry = dy >= 0 ? 'top'    : 'bottom';
  }

  const exit  = exitSide  ?? computedExit;
  const entry = entrySide ?? computedEntry;

  return {
    sourceHandle: `source-${exit}`,
    targetHandle: `target-${entry}`,
  };
}

// ── Decompressor ───────────────────────────────────────────────────────────

async function decompress(b64: string): Promise<string> {
  // Normalise: strip all whitespace (multi-line base64 from XML), convert URL-safe chars
  const cleaned = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  // Ensure proper padding
  const padded  = cleaned + '=='.slice(0, (4 - cleaned.length % 4) % 4);

  const binary = atob(padded);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const ds     = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(bytes);
  writer.close();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }

  const raw = new TextDecoder('utf-8').decode(out);
  // draw.io URL-encodes XML before deflating; try decode, fall back to raw
  if (raw.trimStart().startsWith('<')) return raw;
  try { return decodeURIComponent(raw); } catch { return raw; }
}

/** Decompress if not already XML. */
async function maybeDecompress(text: string): Promise<string> {
  const t = text.replace(/\s+/g, ''); // strip possible whitespace
  if (text.trimStart().startsWith('<')) return text;
  try { return await decompress(t); } catch { return text; }
}

// ── XML resolver ───────────────────────────────────────────────────────────

/**
 * Get a resolved DOM Document from raw draw.io content (handles
 * single-page XML, compressed single-page, and multi-page .drawio files).
 * For multi-page files we merge all pages into one flat cell list.
 */
async function resolveDoc(xmlStr: string): Promise<Document> {
  const parser = new DOMParser();
  const parse = (s: string): Document => {
    const d = parser.parseFromString(s, 'application/xml');
    if (d.querySelector('parsererror')) throw new Error('XML parse error — file may be corrupt or not a draw.io export.');
    return d;
  };

  let doc = parse(xmlStr);

  // ── <mxfile> wrapper (standard .drawio format) ──
  const diagramEls = Array.from(doc.querySelectorAll('mxfile > diagram'));

  if (diagramEls.length === 1) {
    // Single page — decompress and return directly (no merging overhead)
    const pageXml = await maybeDecompress(diagramEls[0].textContent?.trim() ?? '');
    return parse(pageXml);
  }

  if (diagramEls.length > 1) {
    // Multi-page — decompress all pages, merge with per-page ID suffix
    const merged = parse('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>');
    const root   = merged.querySelector('root')!;

    for (let pageIdx = 0; pageIdx < diagramEls.length; pageIdx++) {
      const pageXml = await maybeDecompress(diagramEls[pageIdx].textContent?.trim() ?? '');
      const pageDoc = parse(pageXml);
      const suffix  = pageIdx === 0 ? '' : `_p${pageIdx}`;

      for (const cell of Array.from(pageDoc.querySelectorAll('mxCell, UserObject'))) {
        const id = cell.getAttribute('id');
        if (!id || id === '0' || id === '1') continue;

        const clone  = merged.importNode(cell, true);
        const inner  = clone.querySelector('mxCell'); // for UserObject wrappers
        const setAttr = (attr: string, val: string | null) => {
          if (val) { clone.setAttribute(attr, val); inner?.setAttribute(attr, val); }
        };

        clone.setAttribute('id', id + suffix);
        inner?.setAttribute('id', id + suffix);

        const parent = clone.getAttribute('parent') ?? inner?.getAttribute('parent');
        setAttr('parent', parent && parent !== '0' && parent !== '1' ? parent + suffix : '1');

        const src = clone.getAttribute('source') ?? inner?.getAttribute('source');
        const tgt = clone.getAttribute('target') ?? inner?.getAttribute('target');
        if (src) setAttr('source', src + suffix);
        if (tgt) setAttr('target', tgt + suffix);

        root.appendChild(clone);
      }
    }
    return merged;
  }

  // ── Compressed single-page: <mxGraphModel>BASE64</mxGraphModel> ──
  const model = doc.querySelector('mxGraphModel');
  if (model && !model.querySelector('root') && model.textContent?.trim()) {
    return parse(await maybeDecompress(model.textContent.trim()));
  }

  return doc;
}

// ── Cell extractor ────────────────────────────────────────────────────────

interface RawCell {
  id: string;
  label: string;
  style: string;
  vertex: boolean;
  edge: boolean;
  source: string | null;
  target: string | null;
  parent: string | null;
  x: number; y: number; width: number; height: number;
}

function extractCells(doc: Document): RawCell[] {
  const results: RawCell[] = [];

  // Helper: resolve a cell element (handles both <mxCell> and <UserObject> wrappers)
  const processEl = (el: Element) => {
    let id     = el.getAttribute('id') ?? '';
    let label  = el.getAttribute('value') ?? el.getAttribute('label') ?? '';
    let style  = el.getAttribute('style') ?? '';
    let vertex = el.getAttribute('vertex') === '1';
    let edge   = el.getAttribute('edge')   === '1';
    let source = el.getAttribute('source');
    let target = el.getAttribute('target');
    let parent = el.getAttribute('parent');

    // UserObject wraps an mxCell — pull geometry/edge info from inner cell
    if (el.tagName === 'UserObject') {
      const inner = el.querySelector('mxCell');
      if (!inner) return;
      style  = inner.getAttribute('style')  ?? style;
      vertex = inner.getAttribute('vertex') === '1';
      edge   = inner.getAttribute('edge')   === '1';
      source = source ?? inner.getAttribute('source');
      target = target ?? inner.getAttribute('target');
      parent = parent ?? inner.getAttribute('parent');
    }

    if (!id || id === '0' || id === '1') return;
    if (!vertex && !edge) return;

    const sl = style.toLowerCase();
    // Skip edge-label overlays, pure text annotations, and relative-geometry labels
    if (sl.startsWith('edgelabel') || sl.startsWith('text;') || sl === 'text') return;

    // Skip cells with relative geometry (these are edge waypoint labels, not real nodes)
    const geom = el.querySelector('mxGeometry');
    if (geom?.getAttribute('relative') === '1' && !edge) return;

    // Skip cells with no geometry and no visible style (logical groups)
    if (!geom && vertex && !style) return;

    label = stripHtml(label);

    const x      = parseFloat(geom?.getAttribute('x')      ?? '0')  || 0;
    const y      = parseFloat(geom?.getAttribute('y')      ?? '0')  || 0;
    const width  = parseFloat(geom?.getAttribute('width')  ?? '80') || 80;
    const height = parseFloat(geom?.getAttribute('height') ?? '40') || 40;

    results.push({ id, label, style, vertex, edge, source, target, parent, x, y, width, height });
  };

  doc.querySelectorAll('mxCell, UserObject').forEach(processEl);
  return results;
}

// ── Position resolver ──────────────────────────────────────────────────────

/**
 * Resolve absolute positions for all cells by walking the parent chain.
 * draw.io child cells have coordinates relative to their parent container.
 */
function resolveAbsolutePositions(cells: RawCell[]): Map<string, { ax: number; ay: number }> {
  const byId = new Map<string, RawCell>(cells.map(c => [c.id, c]));
  const cache = new Map<string, { ax: number; ay: number }>();

  const resolve = (id: string): { ax: number; ay: number } => {
    if (cache.has(id)) return cache.get(id)!;
    const cell = byId.get(id);
    if (!cell) return { ax: 0, ay: 0 };
    const parentId = cell.parent;
    if (!parentId || parentId === '0' || parentId === '1') {
      cache.set(id, { ax: cell.x, ay: cell.y });
    } else {
      const p = resolve(parentId);
      cache.set(id, { ax: p.ax + cell.x, ay: p.ay + cell.y });
    }
    return cache.get(id)!;
  };

  cells.forEach(c => resolve(c.id));
  return cache;
}

// ── Main parser ───────────────────────────────────────────────────────────

async function parseDrawioXml(xmlStr: string): Promise<{ nodes: ParsedNode[]; edges: ParsedEdge[] }> {
  const doc   = await resolveDoc(xmlStr);
  const cells = extractCells(doc);
  const absPos = resolveAbsolutePositions(cells);
  const ts    = Date.now();

  // Build node map for edge routing
  const nodeMap = new Map<string, ParsedNode>();

  // First pass: collect vertices
  for (const cell of cells) {
    if (!cell.vertex) continue;

    const { ax, ay } = absPos.get(cell.id) ?? { ax: cell.x, ay: cell.y };
    const t = detectNodeType(cell.style, cell.label);
    const node: ParsedNode = {
      id:            `drawio-${cell.id}`,
      label:         cell.label || `Element ${cell.id}`,
      type:          t,
      layoutType:    t,
      x:             ax,
      y:             ay,
      width:         cell.width,
      height:        cell.height,
      originalStyle: cell.style,
    };
    nodeMap.set(`drawio-${cell.id}`, node);
  }

  // Second pass: collect edges
  const edges: ParsedEdge[] = [];
  for (const cell of cells) {
    if (!cell.edge || !cell.source || !cell.target) continue;

    const srcKey = `drawio-${cell.source}`;
    const tgtKey = `drawio-${cell.target}`;
    const src    = nodeMap.get(srcKey);
    const tgt    = nodeMap.get(tgtKey);

    const { sourceHandle, targetHandle } = (src && tgt)
      ? bestHandles(src, tgt, cell.style)
      : { sourceHandle: 'source-right', targetHandle: 'target-left' };

    edges.push({
      id:           `drawio-edge-${cell.id}-${ts}`,
      source:       srcKey,
      target:       tgtKey,
      label:        cell.label || 'Data Flow',
      sourceHandle,
      targetHandle,
      edgeStyle:    cell.style,
    });
  }

  // Boundaries behind everything else
  const nodes = Array.from(nodeMap.values())
    .sort((a, b) => (a.layoutType === 'boundary' ? -1 : 1) - (b.layoutType === 'boundary' ? -1 : 1));

  if (nodes.length === 0) throw new Error('No diagram elements found in file.');
  return { nodes, edges };
}

// ── Component ─────────────────────────────────────────────────────────────

interface ImportDrawioButtonProps {
  productId: number;
  onImportSuccess: (diagramId: number) => void;
}

type Step = 'upload' | 'remap';

export function ImportDrawioButton({ productId, onImportSuccess }: ImportDrawioButtonProps) {
  const [open,  setOpen]  = useState(false);
  const [step,  setStep]  = useState<Step>('upload');
  const [file,  setFile]  = useState<File | null>(null);
  const [name,  setName]  = useState('');
  const [parsing,    setParsing]    = useState(false);
  const [aiParsing,  setAiParsing]  = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ParsedNode[]>([]);
  const [edges, setEdges] = useState<ParsedEdge[]>([]);
  const [useAiAssist, setUseAiAssist] = useState(false);

  const reset = () => {
    setStep('upload'); setFile(null); setName('');
    setParseError(null); setNodes([]); setEdges([]);
    setAiParsing(false);
  };

  const handleOpenChange = (v: boolean) => { if (!v) reset(); setOpen(v); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setName(f.name.replace(/\.(xml|drawio)$/i, ''));
    setParseError(null);
  };

  const handleParse = async () => {
    if (!file || !name.trim()) { setParseError('Please select a file and provide a diagram name.'); return; }
    try {
      setParsing(true); setParseError(null);
      const { nodes: n, edges: e } = await parseDrawioXml(await file.text());

      if (useAiAssist && n.length > 0) {
        setParsing(false);
        setAiParsing(true);
        try {
          const res = await aiConversationsApi.classifyElements(
            n.map(node => ({ id: node.id, label: node.label, style: node.originalStyle }))
          );
          const aiMap = new Map(res.data.map(r => [r.id, r]));
          const enriched = n.map(node => {
            // Trust-zone shapes from the file: keep DFD + layout as boundary so the canvas matches the upload.
            if (node.layoutType === 'boundary') {
              return { ...node, type: 'boundary', aiSuggestedType: 'boundary' };
            }
            const ai = aiMap.get(node.id);
            if (!ai) return node;
            const validTypes: NodeType[] = ['process', 'datastore', 'external', 'boundary'];
            const suggestedType = validTypes.includes(ai.suggested_type as NodeType)
              ? (ai.suggested_type as NodeType)
              : node.type;
            return {
              ...node,
              type: suggestedType,
              aiSuggestedType: suggestedType,
            };
          });
          setNodes(enriched);
        } catch {
          toast.warning('AI classification failed — using automatic detection instead.');
          setNodes(n);
        } finally {
          setAiParsing(false);
        }
      } else {
        setNodes(n);
      }

      setEdges(e);
      setStep('remap');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file.');
    } finally {
      setParsing(false);
      setAiParsing(false);
    }
  };

  const handleTypeChange = (id: string, t: NodeType) =>
    setNodes(prev => prev.map(n => n.id === id ? { ...n, type: t, layoutType: t } : n));

  const handleAutoRemap = () =>
    setNodes(prev => prev.map(n => {
      const t = detectNodeType(n.originalStyle, n.label);
      return { ...n, type: t, layoutType: t };
    }));

  const handleImport = async () => {
    try {
      setImporting(true);

      // Re-compute smart handles after any manual type remapping
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const finalEdges = edges.map(e => {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        const style = e.edgeStyle ?? '';
        const handles = src && tgt ? bestHandles(src, tgt, style) : { sourceHandle: e.sourceHandle, targetHandle: e.targetHandle };
        return { ...e, ...handles };
      });

      // Fixed dimensions of our DiagramNode shapes (used to center-align with DrawIO geometry)
      const FIXED = {
        process:   { w: 96,  h: 96  },  // w-24 h-24 circle
        datastore: { w: 140, h: 40  },  // min-w-[140px] + py-3 padding
        external:  { w: 120, h: 44  },  // min-w-[120px] + py-3 padding
      } as const;

      const diagramData = {
        nodes: nodes.map(n => {
          // Layout (boundary box vs centered icon) follows draw.io shape + user type; not raw AI type alone.
          const boundaryBox = n.layoutType === 'boundary' || n.type === 'boundary';
          if (boundaryBox) {
            // Boundaries fill their ReactFlow container — pass the DrawIO size exactly
            return {
              id:       n.id,
              type:     'custom',
              position: { x: n.x, y: n.y },
              data:     { label: n.label, type: 'boundary' as const },
              zIndex:   -1,
              width:    Math.max(n.width,  200),
              height:   Math.max(n.height, 150),
            };
          }
          // For fixed-size nodes, shift position so the centre of the DrawIO shape
          // aligns with the centre of our rendered node.
          const fixed = FIXED[n.type as keyof typeof FIXED] ?? FIXED.external;
          const cx = n.x + n.width  / 2;
          const cy = n.y + n.height / 2;
          return {
            id:       n.id,
            type:     'custom',
            position: { x: cx - fixed.w / 2, y: cy - fixed.h / 2 },
            data:     { label: n.label, type: n.type },
            zIndex:   10,
          };
        }),
        edges: finalEdges.map(e => ({
          id:           e.id,
          source:       e.source,
          target:       e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          animated:     true,
          label:        e.label,
        })),
      };

      const res = await diagramsApi.create({ product_id: productId, name: name.trim(), diagram_data: diagramData });
      toast.success(`"${name}" imported — ${nodes.length} elements, ${edges.length} flows`);
      handleOpenChange(false);
      onImportSuccess(res.data.id);
    } catch {
      toast.error('Import failed. Please try again.');
    } finally { setImporting(false); }
  };

  const typeCounts = NODE_TYPES.map(t => ({ ...t, count: nodes.filter(n => n.type === t.value).length }));

  return (
    <>
      <Button variant="outline" size="sm" className="h-10 px-3" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-2" />
        Import Draw.io
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className={cn("max-h-[90vh] overflow-hidden", step === 'remap' ? "sm:max-w-4xl" : "sm:max-w-2xl")}>

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <>
              <DialogHeader>
                <DialogTitle>Import Draw.io Diagram</DialogTitle>
                <DialogDescription>
                  Supports <code className="font-mono text-xs">.xml</code> and{' '}
                  <code className="font-mono text-xs">.drawio</code> files — including multi-page,
                  compressed, and cloud-exported formats. Shapes are auto-detected and you can
                  remap any element before importing.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="drawio-file">File</Label>
                  <Input id="drawio-file" type="file" accept=".xml,.drawio" onChange={handleFileChange} disabled={parsing} />
                  {file && <p className="text-xs text-muted-foreground">{file.name} — {(file.size / 1024).toFixed(1)} KB</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="drawio-name">Diagram Name</Label>
                  <Input id="drawio-name" value={name} onChange={e => setName(e.target.value)} placeholder="My threat model" disabled={parsing} />
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Automatic shape mapping</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2"><Cpu      className="h-3.5 w-3.5" style={{ color: 'var(--element-process)'   }} /><span>Ellipse / BPMN task → <strong>Process</strong></span></div>
                    <div className="flex items-center gap-2"><Database className="h-3.5 w-3.5" style={{ color: 'var(--element-datastore)' }} /><span>Cylinder / DB / Cloud storage → <strong>Data Store</strong></span></div>
                    <div className="flex items-center gap-2"><Users    className="h-3.5 w-3.5" style={{ color: 'var(--element-external)'  }} /><span>Rectangle / Actor → <strong>External Entity</strong></span></div>
                    <div className="flex items-center gap-2"><Box      className="h-3.5 w-3.5" style={{ color: 'var(--element-boundary)'  }} /><span>Swimlane / Dashed container → <strong>Trust Boundary</strong></span></div>
                  </div>
                  <p className="text-xs text-muted-foreground/70 pt-1">
                    Edge connectors are routed to the geometrically optimal side of each element.
                  </p>
                </div>

                <div className="flex items-start gap-3 rounded-lg border px-3 py-3" style={{ borderColor: useAiAssist ? 'color-mix(in srgb, var(--matcha-600) 40%, transparent)' : 'var(--border)', backgroundColor: useAiAssist ? 'color-mix(in srgb, var(--matcha-600) 6%, transparent)' : 'transparent' }}>
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0" style={{ color: useAiAssist ? 'var(--matcha-600)' : 'var(--muted-foreground)' }} />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">AI Assist</span>
                      <Switch checked={useAiAssist} onCheckedChange={setUseAiAssist} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Uses the configured AI model to classify elements more accurately from labels and context — especially useful for complex or custom-styled diagrams.
                    </p>
                  </div>
                </div>

                {parseError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                    <FileWarning className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{parseError}</span>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <Button onClick={handleParse} disabled={!file || !name.trim() || parsing || aiParsing}>
                  {parsing ? 'Parsing…' : aiParsing ? (
                    <><Sparkles className="h-4 w-4 mr-1.5 animate-pulse" style={{ color: 'var(--matcha-300)' }} />AI classifying…</>
                  ) : 'Parse & Review'}
                  {!parsing && !aiParsing && <ArrowRight className="h-4 w-4 ml-1.5" />}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ── Step 2: Remap ── */}
          {step === 'remap' && (
            <>
              <DialogHeader>
                <DialogTitle>Review Element Mapping</DialogTitle>
                <DialogDescription>
                  {nodes.length} elements and {edges.length} data flows detected.
                  {nodes.some(n => n.aiSuggestedType) && (
                    <> <span style={{ color: 'var(--matcha-600)' }} className="font-medium">AI classified {nodes.filter(n => n.aiSuggestedType).length} elements</span> — review and adjust below.</>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap gap-2 py-1">
                {typeCounts.filter(t => t.count > 0).map(t => {
                  const Icon = t.icon;
                  return (
                    <Badge key={t.value} variant="outline" className="gap-1.5 font-normal">
                      <Icon className={cn('h-3 w-3', t.color)} />
                      {t.count} {t.label}{t.count !== 1 ? 's' : ''}
                    </Badge>
                  );
                })}
                {edges.length > 0 && (
                  <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
                    {edges.length} data flow{edges.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                {nodes.some(n => n.aiSuggestedType) && (
                  <Badge variant="outline" className="gap-1.5 font-normal" style={{ borderColor: 'color-mix(in srgb, var(--matcha-600) 40%, transparent)', color: 'var(--matcha-600)' }}>
                    <Sparkles className="h-3 w-3" />
                    AI assisted
                  </Badge>
                )}
              </div>

              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="grid grid-cols-[1fr_160px] px-3 py-2 bg-muted text-xs font-medium text-muted-foreground border-b border-border/50">
                  <span>Element</span>
                  <span>DFD Type</span>
                </div>
                <ScrollArea className="h-120">
                  <div className="divide-y divide-border/40">
                    {nodes.map(node => (
                        <div key={node.id} className="grid grid-cols-[1fr_160px] items-center px-3 py-2 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <NodeTypeIcon type={node.type} />
                            <span className="text-sm truncate">{node.label}</span>
                            {node.aiSuggestedType && (
                              <Sparkles className="h-3 w-3 shrink-0" style={{ color: 'var(--matcha-600)' }} />
                            )}
                          </div>
                          <Select value={node.type} onValueChange={v => handleTypeChange(node.id, v as NodeType)}>
                            <SelectTrigger className="h-7 text-xs border-border/60">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {NODE_TYPES.map(t => {
                                const Icon = t.icon;
                                return (
                                  <SelectItem key={t.value} value={t.value}>
                                    <div className="flex items-center gap-2">
                                      <Icon className={cn('h-3.5 w-3.5', t.color)} />
                                      {t.label}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" size="sm" className="mr-auto text-muted-foreground" onClick={handleAutoRemap} title="Re-run automatic detection">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Auto-detect
                </Button>
                <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? 'Importing…' : `Import ${nodes.length} elements`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
