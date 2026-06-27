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
import { diagramsApi, aiConversationsApi, threatsApi, mitigationsApi, diagramThreatsApi, diagramMitigationsApi, modelsApi, frameworksApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  if (!s.includes('<') && !s.includes('&')) return s.trim();

  // Decode XML entities that linkedom may leave encoded in attribute values.
  const decoded = s
    .replace(/&amp;/g, '\x00AMP\x00')   // protect & before other replacements
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/\x00AMP\x00/g, '&');

  // Use a detached DOM div to reliably strip all HTML tags and nested content.
  // Reading textContent never executes scripts, making this safe for untrusted input.
  const div = document.createElement('div');
  // eslint-disable-next-line no-unsanitized/property
  div.innerHTML = decoded;
  const text = (div.textContent ?? div.innerText ?? '').replace(/\s+/g, ' ');

  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] ?? '';
}

/**
 * Derive a human-readable default name from the draw.io shape style when the
 * cell has no label. Covers common AWS, GCP, Azure, and generic shapes.
 */
function shapeDefaultName(style: string): string {
  const s = style.toLowerCase();
  // AWS compute
  if (s.includes('lambda'))                          return 'Lambda Function';
  if (s.includes('api_gateway') || s.includes('apigw')) return 'API Gateway';
  if (s.includes('fargate'))                         return 'Fargate Task';
  if (s.includes('ecs'))                             return 'ECS Service';
  if (s.includes('eks'))                             return 'EKS Cluster';
  if (s.includes('ec2'))                             return 'EC2 Instance';
  if (s.includes('eventbridge'))                     return 'EventBridge';
  // AWS storage / messaging
  if (s.includes('dynamodb') || s.includes('dynamo_db')) return 'DynamoDB';
  if (s.includes('kinesis'))                         return 'Kinesis';
  if (s.includes('elasticache'))                     return 'ElastiCache';
  if (s.includes('aurora'))                          return 'Aurora';
  if (s.includes('rds'))                             return 'RDS';
  if (s.includes('documentdb'))                      return 'DocumentDB';
  if (s.includes('sqs'))                             return 'SQS Queue';
  if (s.includes('sns'))                             return 'SNS Topic';
  if (s.includes('s3'))                              return 'S3 Bucket';
  if (s.includes('efs'))                             return 'EFS';
  // GCP
  if (s.includes('gcp2.function'))                   return 'Cloud Function';
  if (s.includes('gcp2.kubernetes'))                 return 'GKE Cluster';
  if (s.includes('gcp2.cloud_sql'))                  return 'Cloud SQL';
  if (s.includes('gcp2.cloud_storage'))              return 'Cloud Storage';
  if (s.includes('gcp2.cloud_pub_sub'))              return 'Pub/Sub';
  // Azure
  if (s.includes('azure.function'))                  return 'Azure Function';
  if (s.includes('azure.kubernetes'))                return 'AKS Cluster';
  if (s.includes('azure.sql'))                       return 'Azure SQL';
  if (s.includes('azure.blob'))                      return 'Blob Storage';
  if (s.includes('azure.cosmos_db'))                 return 'Cosmos DB';
  if (s.includes('azure.queue'))                     return 'Azure Queue';
  if (s.includes('azure.app_service'))               return 'App Service';
  // Generic shapes
  if (s.includes('cylinder') || s.includes('database')) return 'Database';
  if (s.includes('umlactor') || s.includes('shape=actor')) return 'User';
  if (s.includes('ellipse') || s.includes('doubleellipse')) return 'Process';
  if (s.includes('swimlane'))                        return 'Trust Boundary';
  return '';
}

/** Parse a single style key, e.g. "exitX=1" → 1. */
function styleVal(style: string, key: string): number | null {
  const m = new RegExp(`(?:^|;)${key}=([^;]+)`).exec(style);
  return m ? parseFloat(m[1]) : null;
}

// ── Shape detection ────────────────────────────────────────────────────────

/** Word-boundary label match (ASCII labels from stripHtml). */
function labelHas(re: RegExp, label: string): boolean {
  return re.test(label.toLowerCase());
}

/**
 * Map a draw.io cell style + label (+ size) to one of our four DFD node types.
 * Covers standard draw.io shapes, mxgraph extras, BPMN, AWS, Azure, GCP,
 * flowchart shapes, and label-based heuristics.
 */
function detectNodeType(style: string, label: string, width = 0, height = 0): NodeType {
  const s = style.toLowerCase();
  const l = label.toLowerCase();
  const area = Math.max(0, width) * Math.max(0, height);

  // ── Skip classes (handled in extractCells, but guard here too) ──
  if (s.startsWith('edgelabel') || s.startsWith('text;') || s === 'text') return 'external';

  // ── Trust boundary: explicit label first (common in DFD zone titles) ──
  if (
    labelHas(
      /\b(trust\s*zone|trust\s*boundary|security\s*zone|network\s*zone|network\s*boundary|attack\s*surface|demilitarized|dmz|perimeter|isolation\s*boundary|vpc\s*boundary|subnet\s*group)\b/i,
      l,
    )
  ) {
    return 'boundary';
  }

  // ── Trust boundary: structured styles (avoid classifying every dashed box as a zone) ──
  if (
    s.includes('swimlane') ||
    s.includes('shape=mxgraph.dfd.boundary') ||
    s.includes('shape=mxgraph.dfd.trustboundary') ||
    (s.includes('dashed=1') && s.includes('dashpattern')) ||
    (s.includes('dashed=1') &&
      (s.includes('fillcolor=none') ||
        s.includes('fillcolor=#ffffff00') ||
        s.includes('fillcolor=#fff0') ||
        s.includes('opacity=0') ||
        s.includes('nofill=1'))) ||
    // Large dashed rounded frame — typical “security zone” wrapper (not small dashed connectors)
    (s.includes('dashed=1') && s.includes('rounded=1') && area >= 55_000) ||
    // Group-style container used as a zone (must look like a frame, not an icon group)
    (s.includes('container=1') && s.includes('dashed=1') && !s.includes('shape=') && !s.includes('ellipse'))
  ) {
    return 'boundary';
  }

  // ── Data store: label before generic shapes (e.g. “Postgres” in a rectangle) ──
  if (
    labelHas(
      /\b(db|database|datastore|data\s*store|filestore|file\s*store|object\s*store|blob\s*store|data\s*warehouse|lakehouse|iceberg|delta\s*lake|cache|message\s*queue|queue|topic|partition|s3\s*bucket|blob\s*storage|key\s*value|kv\s*store|redis|mongo|postgres|postgresql|mysql|mariadb|sqlite|cassandra|cockroach|kafka|sqs|sns|kinesis|event\s*hubs|service\s*bus|vector\s*store|embedding|pinecone|chroma|weaviate|opensearch|elasticsearch|hdfs|dynamodb|cosmos|bigquery|snowflake|redshift|aurora)\b/i,
      l,
    )
  ) {
    return 'datastore';
  }

  // ── Process: label hints before “external” so “User API”, “Client service” stay process ──
  if (
    labelHas(
      /\b(api|rest|graphql|grpc|microservice|microservices|service|web\s*server|app\s*server|application|backend|frontend|bff|orchestrator|scheduler|cron|worker|job\s*runner|lambda|function|container|pod|kubernetes|k8s|docker|ecs|fargate|vm|instance|compute|ingress|api\s*gateway|gateway|load\s*balancer|lb|reverse\s*proxy|proxy|cdn|waf|ids|ips|siem|soc|scanner|ci\s*[\/-]?\s*cd|pipeline|build|deploy|iac|terraform|helm|service\s*mesh|istio|linkerd)\b/i,
      l,
    )
  ) {
    return 'process';
  }

  // ── External entity: actor / human / client language ──
  if (
    labelHas(
      /\b(user|users|human|actor|person|people|customer|client|browser|mobile\s*app|mobile|admin|administrator|operator|third[-\s]?party|external\s*(system|entity|service)?|vendor|partner|stakeholder|attacker|hacker|penetration|pentester|internet|public\s*web)\b/i,
      l,
    )
  ) {
    return 'external';
  }

  // ── External: UML actor / user icons (before ellipse — actors are often ellipses) ──
  if (
    s.includes('umlactor') ||
    s.includes('shape=uml.actor') ||
    s.includes('mxgraph.uml.actor') ||
    s.includes('shape=mxgraph.uml.actor') ||
    s.includes('shape=actor') ||
    s.includes('shape=mxgraph.general.user') ||
    s.includes('shape=mxgraph.office.users')
  ) {
    return 'external';
  }

  // ── Process ── (circle / ellipse / cloud services / apps)
  if (
    s.includes('ellipse') ||
    s.includes('doubleellipse') ||
    s.includes('rhombus') ||
    s.includes('shape=hexagon') ||
    s.includes('shape=mxgraph.flowchart.hexagon') ||
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
    s.includes('shape=mxgraph.kubernetes') ||
    s.includes('shape=mxgraph.networks.kubernetes') ||
    s.includes('shape=mxgraph.devicons.docker') ||
    s.includes('shape=mxgraph.devicons.github') ||
    s.includes('shape=mxgraph.azure.kubernetes') ||
    // AWS — compute / integration services
    s.includes('shape=mxgraph.aws4.lambda') ||
    s.includes('shape=mxgraph.aws3.lambda') ||
    s.includes('shape=mxgraph.aws4.resourceicon') ||
    s.includes('resicon=mxgraph.aws4.lambda') ||
    s.includes('resicon=mxgraph.aws4.api_gateway') ||
    s.includes('resicon=mxgraph.aws4.eventbridge') ||
    s.includes('resicon=mxgraph.aws4.fargate') ||
    s.includes('resicon=mxgraph.aws4.ecs') ||
    s.includes('resicon=mxgraph.aws4.ec2') ||
    s.includes('resicon=mxgraph.aws4.eks') ||
    s.includes('shape=mxgraph.aws4.application') ||
    s.includes('shape=mxgraph.aws4.general') ||
    s.includes('shape=mxgraph.aws3.lambda_function') ||
    s.includes('shape=mxgraph.aws3.application') ||
    // GCP / Azure compute
    s.includes('shape=mxgraph.gcp2.function') ||
    s.includes('shape=mxgraph.gcp2.kubernetes') ||
    s.includes('shape=mxgraph.azure.function') ||
    s.includes('shape=mxgraph.azure.app_service') ||
    s.includes('shape=mxgraph.azure.kubernetes') ||
    // UML / generic “subsystem” rounded rect (still often a process in DFDs)
    (s.includes('shape=uml') && (s.includes('lollipop') || s.includes('component'))) ||
    // Rounded rectangle with no other strong shape — common process / subprocess box
    (s.includes('rounded=1') && !s.includes('dashed') && !s.includes('shape=')) ||
    (s.includes('rounded=1') && !s.includes('dashed') && /\bshape=rectangle\b/.test(s)) ||
    s.includes('hexagon')
  ) {
    return 'process';
  }

  // ── Data Store ── (cylinder / database / storage / queue / messaging)
  if (
    s.includes('cylinder') ||
    s.includes('shape=mxgraph.dfd.datastore') ||
    s.includes('shape=database') ||
    s.includes('shape=mxgraph.flowchart.stored_data') ||
    s.includes('shape=mxgraph.flowchart.database') ||
    s.includes('shape=mxgraph.flowchart.data') ||
    s.includes('shape=mxgraph.flowchart.tape') ||
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
    s.includes('resicon=mxgraph.aws4.efs') ||
    s.includes('resicon=mxgraph.aws4.documentdb') ||
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
    s.includes('shape=mxgraph.azure.cosmos_db')
  ) {
    return 'datastore';
  }

  // ── External Entity ── (default: plain rectangles, unclassified boxes)
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
  if (t.startsWith('<')) return text;
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
    const d = parser.parseFromString(s, 'text/xml');
    if (d.querySelector('parsererror')) throw new Error('XML parse error — file may be corrupt or not a draw.io export.');
    if (!d.documentElement) throw new Error('XML parse error — file may be corrupt or not a draw.io export.');
    return d;
  };

  let doc = parse(xmlStr);

  // Serialize element inner content — uses XMLSerializer for child elements
  // (uncompressed XML) and falls back to textContent for plain text (base64).
  const serializer = new XMLSerializer();
  const innerContent = (el: Element): string => {
    if (el.children.length > 0) {
      return Array.from(el.childNodes).map(n => serializer.serializeToString(n)).join('');
    }
    return el.textContent?.trim() ?? '';
  };

  // ── <mxfile> wrapper (standard .drawio format) ──
  const diagramEls = Array.from(doc.querySelectorAll('mxfile > diagram'));

  if (diagramEls.length === 1) {
    // Single page — decompress and return directly (no merging overhead)
    const pageXml = await maybeDecompress(innerContent(diagramEls[0]));
    return parse(pageXml);
  }

  if (diagramEls.length > 1) {
    // Multi-page — decompress all pages, merge with per-page ID suffix
    const merged = parse('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>');
    const root   = merged.querySelector('root')!;

    for (let pageIdx = 0; pageIdx < diagramEls.length; pageIdx++) {
      const pageXml = await maybeDecompress(innerContent(diagramEls[pageIdx]));
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
  if (model && !model.querySelector('root') && innerContent(model)) {
    return parse(await maybeDecompress(innerContent(model)));
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
    const t = detectNodeType(cell.style, cell.label, cell.width, cell.height);
    const node: ParsedNode = {
      id:            `drawio-${cell.id}`,
      label:         cell.label || shapeDefaultName(cell.style) || `Element ${cell.id}`,
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
    .sort((a, b) => (a.layoutType === 'boundary' ? 0 : 1) - (b.layoutType === 'boundary' ? 0 : 1));

  if (nodes.length === 0) throw new Error('No diagram elements found in file.');
  return { nodes, edges };
}

// ── Threat Dragon JSON parser ─────────────────────────────────────────────

interface ThreatDragonThreat {
  title?: string;
  type?: string;
  status?: string;
  severity?: string;
  description?: string;
  mitigation?: string;
}

interface ThreatDragonCell {
  type?: string;
  shape?: string;
  attrs?: Record<string, { text?: string }>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  data?: { name?: string; type?: string; threats?: ThreatDragonThreat[] };
  source?: { cell?: string; id?: string; x?: number; y?: number };
  target?: { cell?: string; id?: string; x?: number; y?: number };
  id?: string;
  labels?: string[];
}

/**
 * Map Threat Dragon shape types to DFD node types.
 */
function mapTdType(cell: ThreatDragonCell): NodeType {
  const shape = (typeof cell.shape === 'string' ? cell.shape : '').toLowerCase();
  const dataType = (cell.data?.type ?? '').toLowerCase();

  if (shape.includes('trust-boundary') || dataType.includes('boundarybox')) return 'boundary';
  if (shape === 'process' || dataType.includes('process')) return 'process';
  if (shape === 'store' || dataType.includes('store')) return 'datastore';
  if (shape === 'actor' || dataType.includes('actor')) return 'external';
  return 'external';
}

/**
 * Parse Threat Dragon JSON (v1 and v2 formats).
 * Returns parsed nodes, edges, and extracted threats per element.
 */
function parseThreatDragonJson(json: Record<string, unknown>): {
  nodes: ParsedNode[];
  edges: ParsedEdge[];
  threats: { elementId: string; threats: ThreatDragonThreat[] }[];
  diagramName: string;
} {
  // v2: cells directly on diagram; v1: diagramJson.cells
  let cells: ThreatDragonCell[] = [];
  let diagramName = 'Threat Dragon Import';

  if (json.detail && typeof json.detail === 'object') {
    // v2 format: { detail: { diagrams: [{ cells, ... }] } }
    const detail = json.detail as { diagrams?: { cells?: ThreatDragonCell[]; title?: string }[] };
    if (detail.diagrams?.[0]) {
      cells = detail.diagrams[0].cells ?? [];
      diagramName = detail.diagrams[0].title ?? diagramName;
    }
  } else if (json.cells && Array.isArray(json.cells)) {
    // v2 direct format
    cells = json.cells as ThreatDragonCell[];
    diagramName = (json.title as string) ?? diagramName;
  } else if (json.diagramJson && typeof json.diagramJson === 'object') {
    // v1 format
    const dj = json.diagramJson as { cells?: ThreatDragonCell[] };
    cells = dj.cells ?? [];
    diagramName = (json.title as string) ?? diagramName;
  }

  const nodes: ParsedNode[] = [];
  const edges: ParsedEdge[] = [];
  const threats: { elementId: string; threats: ThreatDragonThreat[] }[] = [];
  const ts = Date.now();

  // Track edges between same source/target for fan-out
  const edgePairs = new Map<string, number>();

  // Find min Y for coordinate normalization
  let minY = 0;
  for (const cell of cells) {
    if (cell.position?.y !== undefined && cell.position.y < minY) {
      minY = cell.position.y;
    }
  }
  const yOffset = minY < 0 ? -minY + 50 : 0;

  for (const cell of cells) {
    const cellType = (cell.shape ?? cell.type ?? '').toLowerCase();
    const id = cell.id ?? `td-${ts}-${Math.random().toString(36).slice(2, 8)}`;

    // Skip trust-boundary-curve (decorative lines with x/y source/target, not cell references)
    if (cellType === 'trust-boundary-curve') continue;

    // Flows → edges
    if (cellType === 'flow') {
      // TD flows use { cell: "uuid", port: "uuid" } for source/target
      const sourceId = (cell.source as { cell?: string })?.cell;
      const targetId = (cell.target as { cell?: string })?.cell;
      if (sourceId && targetId) {
        const pairKey = [sourceId, targetId].sort().join('-');
        const pairCount = edgePairs.get(pairKey) ?? 0;
        edgePairs.set(pairKey, pairCount + 1);

        const label = cell.labels?.[0]
          ?? cell.data?.name
          ?? 'Data Flow';

        edges.push({
          id: `td-edge-${id}-${ts}`,
          source: `td-${sourceId}`,
          target: `td-${targetId}`,
          label: typeof label === 'string' ? label : 'Data Flow',
          sourceHandle: 'source-right',
          targetHandle: 'target-left',
          edgeStyle: pairCount > 0 ? `curvature=${0.3 * pairCount}` : '',
        });

        // Collect threats from data flows too
        if (cell.data?.threats?.length) {
          threats.push({ elementId: `td-edge-${id}-${ts}`, threats: cell.data.threats });
        }
      }
      continue;
    }

    // Nodes (processes, actors, stores, boundaries)
    const position = cell.position ?? { x: 0, y: 0 };
    const size = cell.size ?? { width: 100, height: 60 };
    const label = cell.data?.name
      ?? cell.attrs?.text?.text
      ?? (cell.attrs as Record<string, { text?: string }>)?.label?.text
      ?? `Element ${id}`;
    const nodeType = mapTdType(cell);

    nodes.push({
      id: `td-${id}`,
      label: label.replace(/\n/g, ' ').trim(),
      type: nodeType,
      layoutType: nodeType,
      x: position.x,
      y: position.y + yOffset,
      width: size.width,
      height: size.height,
      originalStyle: cellType,
    });

    // Collect threats from this element
    if (cell.data?.threats?.length) {
      threats.push({ elementId: `td-${id}`, threats: cell.data.threats });
    }
  }

  // Re-compute edge handles — all parallel edges use same best handles but get curvature offsets
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Group edges by undirected node pair
  const pairGroups = new Map<string, ParsedEdge[]>();
  for (const edge of edges) {
    const key = [edge.source, edge.target].sort().join('|');
    const group = pairGroups.get(key) ?? [];
    group.push(edge);
    pairGroups.set(key, group);
  }

  for (const [, group] of pairGroups) {
    const edge0 = group[0];
    const src = nodeMap.get(edge0.source);
    const tgt = nodeMap.get(edge0.target);

    // All edges in the group use the same handles (best geometric)
    const handles = src && tgt ? bestHandles(src, tgt, '') : { sourceHandle: 'source-right', targetHandle: 'target-left' };

    for (let i = 0; i < group.length; i++) {
      const edge = group[i];
      edge.sourceHandle = handles.sourceHandle;
      edge.targetHandle = handles.targetHandle;
      // Store parallel info for curvature fan-out in DiagramEdge
      if (group.length > 1) {
        edge.edgeStyle = `parallelIndex=${i};parallelCount=${group.length}`;
      }
    }
  }

  if (nodes.length === 0) throw new Error('No diagram elements found in Threat Dragon file.');
  return { nodes, edges, threats, diagramName };
}

// ── ThreatAtlas export JSON parser ────────────────────────────────────────

interface ThreatAtlasExportDiagram {
  name: string;
  nodes: { id: string; type: string; position: { x: number; y: number }; data: { label: string; type: string }; width?: number; height?: number; zIndex?: number }[];
  edges: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string; animated?: boolean }[];
}

/**
 * Parse a ThreatAtlas product-level export JSON.
 * Format: { product, exported_at, diagrams: [...] }
 */
function parseThreatAtlasExport(json: Record<string, unknown>): {
  nodes: ParsedNode[];
  edges: ParsedEdge[];
  diagramName: string;
} {
  const diagrams = json.diagrams as ThreatAtlasExportDiagram[];
  if (!diagrams?.length) throw new Error('No diagrams found in ThreatAtlas export.');

  // Import first diagram (user can re-import to get others)
  const diagram = diagrams[0];
  const nodes: ParsedNode[] = diagram.nodes.map(n => ({
    id: n.id,
    label: n.data.label,
    type: (n.data.type as NodeType) ?? 'external',
    layoutType: (n.data.type as NodeType) ?? 'external',
    x: n.position.x,
    y: n.position.y,
    width: n.width ?? 100,
    height: n.height ?? 60,
    originalStyle: '',
  }));

  const edges: ParsedEdge[] = diagram.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label ?? 'Data Flow',
    sourceHandle: e.sourceHandle ?? 'source-right',
    targetHandle: e.targetHandle ?? 'target-left',
    edgeStyle: '',
  }));

  return { nodes, edges, diagramName: diagram.name };
}

// ── Component ─────────────────────────────────────────────────────────────

interface ImportDrawioButtonProps {
  productId: number;
  onImportSuccess: (diagramId: number) => void;
  /** Controlled open state — when provided the trigger button is hidden. */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  /** When set, replaces this diagram's content instead of creating a new diagram. */
  targetDiagramId?: number;
  /** Pre-fills the diagram name field (used in replace mode). */
  initialName?: string;
}

type Step = 'upload' | 'remap';

export function ImportDrawioButton({ productId, onImportSuccess, open: controlledOpen, onOpenChange: controlledOnOpenChange, targetDiagramId, initialName }: ImportDrawioButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open  = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (v: boolean) => controlledOnOpenChange?.(v)
    : setInternalOpen;

  const isReplaceMode = targetDiagramId !== undefined;

  const [step,  setStep]  = useState<Step>('upload');
  const [file,  setFile]  = useState<File | null>(null);
  const [name,  setName]  = useState(initialName ?? '');
  const [parsing,    setParsing]    = useState(false);
  const [aiParsing,  setAiParsing]  = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ParsedNode[]>([]);
  const [edges, setEdges] = useState<ParsedEdge[]>([]);
  const [useAiAssist, setUseAiAssist] = useState(false);
  const [importedThreats, setImportedThreats] = useState<{ elementId: string; threats: ThreatDragonThreat[] }[]>([]);

  const reset = () => {
    setStep('upload'); setFile(null); setName(initialName ?? '');
    setParseError(null); setNodes([]); setEdges([]);
    setAiParsing(false); setImportedThreats([]);
  };

  const handleOpenChange = (v: boolean) => { if (!v) reset(); setOpen(v); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setName(f.name.replace(/\.(xml|drawio|json)$/i, ''));
    setParseError(null);
  };

  const handleParse = async () => {
    if (!file || !name.trim()) { setParseError('Please select a file and provide a diagram name.'); return; }
    try {
      setParsing(true); setParseError(null);

      const rawText = await file.text();
      const trimmed = rawText.trimStart();

      // Detect JSON vs XML
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // JSON import path
        const json = JSON.parse(rawText) as Record<string, unknown>;

        // Format 0: ThreatAtlas diagram-level export { name, nodes, edges, productId, exportedAt, version }
        if (json.nodes && json.edges && json.exportedAt && json.version) {
          const rawNodes = json.nodes as { id: string; position?: { x: number; y: number }; data?: { label?: string; type?: string }; width?: number; height?: number; x?: number; y?: number; label?: string; type?: string }[];
          const n: ParsedNode[] = rawNodes.map(node => ({
            id: node.id,
            label: node.data?.label ?? node.label ?? `Element ${node.id}`,
            type: (node.data?.type ?? node.type ?? 'external') as NodeType,
            layoutType: (node.data?.type ?? node.type ?? 'external') as NodeType,
            x: node.position?.x ?? node.x ?? 0,
            y: node.position?.y ?? node.y ?? 0,
            width: node.width ?? 100,
            height: node.height ?? 60,
            originalStyle: '',
          }));
          const rawEdges = json.edges as { id: string; source: string; target: string; label?: string; data?: { label?: string }; sourceHandle?: string; targetHandle?: string }[];
          const e: ParsedEdge[] = rawEdges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label ?? edge.data?.label ?? 'Data Flow',
            sourceHandle: edge.sourceHandle ?? 'source-right',
            targetHandle: edge.targetHandle ?? 'target-left',
            edgeStyle: '',
          }));
          setNodes(n);
          setEdges(e);
          // Restore threats and mitigations if present (v1.1)
          const importThreats = (json.threats as unknown[]) ?? [];
          const importMitigations = (json.mitigations as unknown[]) ?? [];
          setImportedThreats([]);
          if (!name.trim() || name === file.name.replace(/\.json$/i, '')) setName((json.name as string) ?? 'Imported Diagram');
          setStep('remap');
          if (importThreats.length > 0 || importMitigations.length > 0) {
            toast.info(`Found ${importThreats.length} threats and ${importMitigations.length} mitigations — they will be restored on import.`);
          }
          return;
        }

        // Detect format: ThreatAtlas product-level export
        if (json.product && json.exported_at && json.diagrams) {
          const { nodes: n, edges: e, diagramName } = parseThreatAtlasExport(json);
          setNodes(n);
          setEdges(e);
          if (!name.trim() || name === file.name.replace(/\.json$/i, '')) setName(diagramName);
          setImportedThreats([]);
          setStep('remap');
          return;
        }

        // Detect format: Threat Dragon (v1 or v2)
        const { nodes: n, edges: e, threats, diagramName } = parseThreatDragonJson(json);
        setNodes(n);
        setEdges(e);
        setImportedThreats(threats);
        if (!name.trim() || name === file.name.replace(/\.json$/i, '')) setName(diagramName);
        setStep('remap');
        return;
      }

      // XML import path (draw.io)
      // Sniff XML encoding declaration and re-read with correct charset if needed
      let xmlText = rawText;
      const encodingMatch = xmlText.match(/^<\?xml[^?]*encoding=["']([^"']+)["']/i);
      if (encodingMatch) {
        const declared = encodingMatch[1].toLowerCase();
        if (declared !== 'utf-8' && declared !== 'utf8') {
          xmlText = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file, encodingMatch[1]);
          });
        }
      }

      const { nodes: n, edges: e } = await parseDrawioXml(xmlText);

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
              return { ...node, type: 'boundary' as NodeType, aiSuggestedType: 'boundary' as NodeType };
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
        edges: finalEdges.map(e => {
          // Parse parallel edge info if present
          const parallelMatch = e.edgeStyle?.match(/parallelIndex=(\d+);parallelCount=(\d+)/);
          const data: Record<string, unknown> = {};
          if (parallelMatch) {
            data.parallelIndex = parseInt(parallelMatch[1]);
            data.parallelCount = parseInt(parallelMatch[2]);
          }
          return {
            id:           e.id,
            source:       e.source,
            target:       e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            animated:     true,
            label:        e.label,
            type:         'custom',
            data,
          };
        }),
      };

      if (isReplaceMode) {
        await diagramsApi.update(targetDiagramId!, { name: name.trim(), diagram_data: diagramData });
        toast.success(`Diagram replaced — ${nodes.length} elements, ${edges.length} flows`);
        handleOpenChange(false);
        onImportSuccess(targetDiagramId!);
      } else {
        const res = await diagramsApi.create({ product_id: productId, name: name.trim(), diagram_data: diagramData });
        const diagramId = res.data.id;

        // Import threats and mitigations from Threat Dragon
        let threatCount = 0;
        let mitigationCount = 0;
        if (importedThreats.length > 0) {
          // Ensure we have a model — create one if the diagram doesn't come with one
          let modelId: number | null = res.data.model_id ?? null;
          let frameworkId: number = (res.data.framework_id as number) ?? 0;

          if (!modelId) {
            try {
              // Get or create a framework to attach threats to
              if (!frameworkId) {
                const fwRes = await frameworksApi.list();
                const customFw = fwRes.data.find((fw: { name: string; id: number }) => fw.name.toLowerCase().includes('custom'));
                frameworkId = customFw?.id ?? fwRes.data[0]?.id ?? 0;
              }

              // Create a model for this diagram
              const modelRes = await modelsApi.create({
                diagram_id: diagramId,
                framework_id: frameworkId,
                name: `${name.trim()} — Imported Threats`,
              });
              modelId = modelRes.data.id;
            } catch {
              // If model creation fails, skip threat import
              modelId = null;
            }
          }

          if (modelId) {
            for (const { elementId, threats: tdThreats } of importedThreats) {
              const node = nodes.find(n => n.id === elementId);
              const elementType = node?.type ?? 'process';

              for (const t of tdThreats) {
                try {
                  // Create the threat as a custom knowledge base entry
                  const threatRes = await threatsApi.create({
                    framework_id: frameworkId,
                    name: t.title ?? 'Imported Threat',
                    description: t.description ?? '',
                    category: t.type ?? 'imported',
                    is_custom: true,
                  });
                  const threatId = threatRes.data.id;

                  // Link threat to the element — map TD severity to likelihood/impact
                  const severityMap: Record<string, { likelihood: number; impact: number }> = {
                    critical: { likelihood: 5, impact: 5 },
                    high: { likelihood: 4, impact: 4 },
                    medium: { likelihood: 3, impact: 3 },
                    low: { likelihood: 2, impact: 2 },
                  };
                  const sev = severityMap[(t.severity ?? '').toLowerCase()] ?? null;

                  // Map TD status to ThreatAtlas status
                  const tdStatus = (t.status ?? 'open').toLowerCase();
                  const statusMap: Record<string, string> = {
                    open: 'identified',
                    mitigated: 'mitigated',
                    'not applicable': 'accepted',
                    accepted: 'accepted',
                    closed: 'mitigated',
                  };
                  const mappedStatus = statusMap[tdStatus] ?? 'identified';

                  const dtRes = await diagramThreatsApi.create({
                    diagram_id: diagramId,
                    model_id: modelId,
                    threat_id: threatId,
                    element_id: elementId,
                    element_type: elementType,
                    status: mappedStatus,
                    likelihood: sev?.likelihood ?? null,
                    impact: sev?.impact ?? null,
                  });
                  const diagramThreatId = dtRes.data.id;
                  threatCount++;

                  // Create mitigation if present
                  if (t.mitigation) {
                    try {
                      const mitRes = await mitigationsApi.create({
                        framework_id: frameworkId,
                        name: `Mitigate: ${t.title ?? 'Imported Threat'}`,
                        description: t.mitigation,
                        category: t.type ?? 'imported',
                        is_custom: true,
                      });

                      await diagramMitigationsApi.create({
                        diagram_id: diagramId,
                        model_id: modelId,
                        mitigation_id: mitRes.data.id,
                        element_id: elementId,
                        element_type: elementType,
                        threat_id: diagramThreatId,
                        status: 'proposed',
                      });
                      mitigationCount++;
                    } catch (mitErr) {
                      console.warn('[TD Import] Mitigation creation failed:', mitErr);
                    }
                  }
              } catch {
                // Continue with remaining threats if one fails
              }
            }
          }
          } // end if (modelId)
        }

        const parts = [`${nodes.length} elements`, `${edges.length} flows`];
        if (threatCount > 0) parts.push(`${threatCount} threats`);
        if (mitigationCount > 0) parts.push(`${mitigationCount} mitigations`);
        toast.success(`"${name}" imported — ${parts.join(', ')}`);
        handleOpenChange(false);
        onImportSuccess(diagramId);
      }
    } catch {
      toast.error('Import failed. Please try again.');
    } finally { setImporting(false); }
  };

  const typeCounts = NODE_TYPES.map(t => ({ ...t, count: nodes.filter(n => n.type === t.value).length }));

  return (
    <>
      {!isControlled && (
        <Button variant="outline" size="sm" className="h-10 px-3" onClick={() => setOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import Draw.io or JSON
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className={cn("max-h-[90vh] overflow-hidden", step === 'remap' ? "sm:max-w-4xl" : "sm:max-w-2xl")}>

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <>
              <DialogHeader>
                <DialogTitle>{isReplaceMode ? 'Replace Current Diagram' : 'Import Draw.io or JSON'}</DialogTitle>
                <DialogDescription>
                  {isReplaceMode
                    ? 'Upload a Draw.io or JSON file to replace the content of this diagram. The existing elements will be overwritten.'
                    : <>Supports <code className="font-mono text-xs">.drawio</code>, <code className="font-mono text-xs">.xml</code> or <code className="font-mono text-xs">.json</code> files — including Threat Dragon exports, ThreatAtlas exports, multi-page, compressed, and cloud-exported formats.</>
                  }
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="drawio-file">File</Label>
                  <Input id="drawio-file" type="file" accept=".xml,.drawio,.json" onChange={handleFileChange} disabled={parsing} />
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
                      <Icon className="h-3 w-3" style={{ color: t.colorVar }} />
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
                                      <Icon className="h-3.5 w-3.5" style={{ color: t.colorVar }} />
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
                  {importing ? (isReplaceMode ? 'Replacing…' : 'Importing…') : (isReplaceMode ? `Replace with ${nodes.length} elements` : `Import ${nodes.length} elements`)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
