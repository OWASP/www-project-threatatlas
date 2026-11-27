/**
 * CycloneDX TM-BOM import and export (experimental).
 *
 * TM-BOM is the threat model part of CycloneDX 2.0, which is still a draft. This module maps a
 * ThreatAtlas diagram to and from the draft's `blueprints` (architecture) and `threats` / `controls`
 * (analysis) sections, as defined on the specification's `2.0-dev` branch at the commit below.
 * The format may change before 2.0 is released, so both directions are marked experimental.
 *
 * Mapping:
 * - process, data store and external entity nodes ↔ blueprint `assets` (process, external entity)
 *   and `dataStores`
 * - trust boundary nodes ↔ blueprint `zones` (type `trust`); a node inside a boundary gets that
 *   zone as its `zone`
 * - edges ↔ blueprint `flows` (type `data`)
 * - diagram threats ↔ `threats.threats`, attached to elements through `affects`, with a STRIDE
 *   category when the threat's category is one
 * - diagram mitigations ↔ `controls`, linked from the threats they mitigate through `mitigations`
 *
 * What TM-BOM has no field for (canvas positions and sizes, likelihood, impact, threat status) is
 * kept in `threatatlas:` properties, so an exported file imports back without losing it.
 */

/** The `CycloneDX/specification` commit on `2.0-dev` that this mapping follows. */
export const TMBOM_SPEC_COMMIT = '5197d88fcded2521b8cb349a754da4f9df2d8bd1';

export type TmNodeType = 'process' | 'datastore' | 'external' | 'boundary';

export interface TmProperty {
  name: string;
  value: string;
}

/** A diagram element as the import dialog consumes it. */
export interface TmImportNode {
  id: string;
  label: string;
  type: TmNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TmImportEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

/** Shaped like the Threat Dragon threats the import dialog already creates. */
export interface TmImportThreat {
  title: string;
  type: string;
  status: string;
  severity: string;
  description: string;
  mitigation: string;
  likelihood?: number;
  impact?: number;
}

export interface TmImportResult {
  diagramName: string;
  nodes: TmImportNode[];
  edges: TmImportEdge[];
  threats: { elementId: string; threats: TmImportThreat[] }[];
  /** Human-readable notes on what could not be imported. */
  warnings: string[];
}

/** The diagram, threats and mitigations to export, as the ThreatAtlas API returns them. */
export interface TmExportInput {
  name: string;
  description?: string | null;
  nodes: {
    id: string;
    parentId?: string;
    position: { x: number; y: number };
    width?: number | null;
    height?: number | null;
    measured?: { width?: number; height?: number };
    data: { label?: string; type?: string; description?: string };
  }[];
  edges: { id: string; source: string; target: string; label?: unknown; data?: { label?: string } }[];
  threats: {
    id: number;
    element_id: string;
    status?: string | null;
    likelihood?: number | null;
    impact?: number | null;
    severity?: string | null;
    comments?: string | null;
    threat?: { name?: string; description?: string | null; category?: string | null } | null;
  }[];
  mitigations: {
    id: number;
    element_id: string;
    threat_id?: number | null;
    status?: string | null;
    mitigation?: { name?: string; description?: string | null } | null;
  }[];
}

export interface TmExportOptions {
  serialNumber?: string;
  timestamp?: string;
}

type Json = Record<string, unknown>;

const PREFIX = 'threatatlas:';

const STRIDE: Record<string, string> = {
  spoofing: 'spoofing',
  tampering: 'tampering',
  repudiation: 'repudiation',
  'information disclosure': 'information-disclosure',
  'information-disclosure': 'information-disclosure',
  'denial of service': 'denial-of-service',
  'denial-of-service': 'denial-of-service',
  'elevation of privilege': 'elevation-of-privilege',
  'elevation-of-privilege': 'elevation-of-privilege',
};

const STRIDE_LABEL: Record<string, string> = {
  spoofing: 'Spoofing',
  tampering: 'Tampering',
  repudiation: 'Repudiation',
  'information-disclosure': 'Information Disclosure',
  'denial-of-service': 'Denial of Service',
  'elevation-of-privilege': 'Elevation of Privilege',
};

/** ThreatAtlas mitigation statuses that have a TM-BOM implementation status of their own. */
const CONTROL_STATUS: Record<string, string> = {
  proposed: 'proposed',
  planned: 'planned',
  'in-progress': 'in-progress',
  implemented: 'implemented',
  verified: 'verified',
  rejected: 'rejected',
};

/** Asset types that are drawn as an external entity rather than a process. */
const EXTERNAL_ASSET_TYPES = new Set(['actor', 'agent', 'device', 'endpoint']);

// ── Helpers ──────────────────────────────────────────────────────────────────

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);

function props(entries: [string, unknown][]): TmProperty[] {
  return entries
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([name, value]) => ({ name: PREFIX + name, value: String(value) }));
}

function readProps(item: Json): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of asArray(item.properties)) {
    if (isObject(p) && typeof p.name === 'string' && p.name.startsWith(PREFIX) && typeof p.value === 'string') {
      out.set(p.name.slice(PREFIX.length), p.value);
    }
  }
  return out;
}

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** A predefined type is a string; a custom one is `{ name }`. */
function typeName(v: unknown): string {
  if (typeof v === 'string') return v;
  if (isObject(v) && typeof v.name === 'string') return v.name;
  return '';
}

function edgeLabel(edge: TmExportInput['edges'][number]): string {
  if (typeof edge.label === 'string' && edge.label) return edge.label;
  return edge.data?.label || 'Data Flow';
}

// ── Detection ────────────────────────────────────────────────────────────────

/** Whether a parsed JSON document is a CycloneDX 2.x BOM with a blueprint or threats. */
export function isTmBom(json: unknown): boolean {
  if (!isObject(json)) return false;
  return (
    json.specFormat === 'CycloneDX' &&
    typeof json.specVersion === 'string' &&
    json.specVersion.startsWith('2.') &&
    (Array.isArray(json.blueprints) || isObject(json.threats))
  );
}

// ── Import ───────────────────────────────────────────────────────────────────

const SIZE = {
  process: { w: 96, h: 96 },
  datastore: { w: 140, h: 40 },
  external: { w: 120, h: 44 },
} as const;
const GAP = 60;
const ZONE_PADDING = 40;
const PER_ROW = 4;

/**
 * Lay out elements that carry no ThreatAtlas position: each zone becomes a box holding its members
 * in a grid, zones sit side by side, and elements outside any zone go in a row underneath.
 */
function layout(nodes: (TmImportNode & { zone?: string; placed: boolean })[]): void {
  const zones = nodes.filter(n => n.type === 'boundary' && !n.placed);
  let cursorX = 0;
  let tallest = 0;
  for (const zone of zones) {
    const members = nodes.filter(n => n.zone === zone.id && n.type !== 'boundary' && !n.placed);
    const cols = Math.max(1, Math.min(PER_ROW, members.length));
    const rows = Math.max(1, Math.ceil(members.length / PER_ROW));
    const cellW = SIZE.datastore.w + GAP;
    const cellH = SIZE.process.h + GAP;
    zone.x = cursorX;
    zone.y = 0;
    zone.width = Math.max(200, cols * cellW + ZONE_PADDING);
    zone.height = Math.max(150, rows * cellH + ZONE_PADDING);
    zone.placed = true;
    members.forEach((m, i) => {
      m.x = zone.x + ZONE_PADDING / 2 + (i % PER_ROW) * cellW;
      m.y = zone.y + ZONE_PADDING / 2 + Math.floor(i / PER_ROW) * cellH;
      m.placed = true;
    });
    cursorX += zone.width + GAP;
    tallest = Math.max(tallest, zone.height);
  }
  const rest = nodes.filter(n => !n.placed);
  const top = zones.length > 0 ? tallest + GAP * 2 : 0;
  rest.forEach((n, i) => {
    n.x = (i % PER_ROW) * (SIZE.datastore.w + GAP * 2);
    n.y = top + Math.floor(i / PER_ROW) * (SIZE.process.h + GAP);
    n.placed = true;
  });
}

/**
 * Read a TM-BOM into diagram elements, flows and per-element threats. Only the first blueprint is
 * read, as a ThreatAtlas diagram holds one model.
 */
export function parseTmBom(json: unknown): TmImportResult {
  if (!isTmBom(json)) throw new Error('Not a CycloneDX 2.x TM-BOM.');
  const bom = json as Json;
  const warnings: string[] = [];

  const blueprints = asArray(bom.blueprints).filter(isObject);
  if (blueprints.length > 1) {
    warnings.push(`The file has ${blueprints.length} blueprints; only the first, "${str(blueprints[0].name) ?? 'unnamed'}", is imported.`);
  }
  const blueprint: Json = blueprints[0] ?? {};

  const nodes: (TmImportNode & { zone?: string; placed: boolean })[] = [];
  const byRef = new Map<string, string>();

  const addNode = (item: Json, type: TmNodeType, label: string | undefined) => {
    const refId = str(item.refId);
    if (!refId) {
      warnings.push(`Skipped a ${type} without a refId.`);
      return;
    }
    const p = readProps(item);
    const x = num(p.get('x'));
    const y = num(p.get('y'));
    const size = type === 'boundary' ? { w: 200, h: 150 } : SIZE[type];
    const id = `tm-${refId}`;
    byRef.set(refId, id);
    nodes.push({
      id,
      label: (label ?? refId).replace(/\s+/g, ' ').trim(),
      type,
      x: x ?? 0,
      y: y ?? 0,
      width: num(p.get('width')) ?? size.w,
      height: num(p.get('height')) ?? size.h,
      zone: str(item.zone),
      placed: x !== undefined && y !== undefined,
    });
  };

  for (const zone of asArray(blueprint.zones).filter(isObject)) addNode(zone, 'boundary', str(zone.name));
  for (const asset of asArray(blueprint.assets).filter(isObject)) {
    const kind = typeName(asset.type);
    const type: TmNodeType = kind === 'data-store' ? 'datastore' : EXTERNAL_ASSET_TYPES.has(kind) ? 'external' : 'process';
    addNode(asset, type, str(asset.name));
  }
  for (const store of asArray(blueprint.dataStores).filter(isObject)) addNode(store, 'datastore', str(store.name));
  for (const actor of asArray(blueprint.actors).filter(isObject)) {
    addNode(actor, 'external', str(actor.description) ?? str(actor.party));
  }

  // Zone refs point at the zone's refId; store the node id instead.
  for (const n of nodes) if (n.zone) n.zone = byRef.get(n.zone);

  // A ThreatAtlas export stores a node inside a boundary relative to that boundary. The import
  // dialog places every node absolutely, so add the boundary's position, and its parents'.
  const byId = new Map(nodes.map(n => [n.id, n]));
  const parentOf = new Map<string, string>();
  for (const item of [...asArray(blueprint.zones), ...asArray(blueprint.assets), ...asArray(blueprint.dataStores)]) {
    if (!isObject(item)) continue;
    const parent = readProps(item).get('parent');
    const id = byRef.get(str(item.refId) ?? '');
    const parentId = parent ? byRef.get(ref(parent)) : undefined;
    if (id && parentId) parentOf.set(id, parentId);
  }
  const absolute = new Map<string, { x: number; y: number }>();
  const resolve = (id: string, seen: Set<string>): { x: number; y: number } => {
    const node = byId.get(id)!;
    const cached = absolute.get(id);
    if (cached) return cached;
    const parentId = parentOf.get(id);
    let pos = { x: node.x, y: node.y };
    if (parentId && byId.get(parentId)?.placed && !seen.has(parentId)) {
      const p = resolve(parentId, new Set(seen).add(id));
      pos = { x: p.x + node.x, y: p.y + node.y };
    }
    absolute.set(id, pos);
    return pos;
  };
  const resolved = nodes.filter(n => n.placed).map(n => [n, resolve(n.id, new Set([n.id]))] as const);
  for (const [n, pos] of resolved) {
    n.x = pos.x;
    n.y = pos.y;
  }
  layout(nodes);

  const edges: TmImportEdge[] = [];
  for (const flow of asArray(blueprint.flows).filter(isObject)) {
    const refId = str(flow.refId);
    const source = byRef.get(str(flow.source) ?? '');
    const target = byRef.get(str(flow.destination) ?? '');
    if (!refId || !source || !target) {
      warnings.push(`Skipped flow "${str(flow.name) ?? refId ?? 'unnamed'}": its source or destination is not an imported element.`);
      continue;
    }
    const id = `tm-${refId}`;
    byRef.set(refId, id);
    edges.push({ id, source, target, label: str(flow.name) ?? 'Data Flow' });
  }

  // Controls, by refId, for the threats' `mitigations`.
  const controls = new Map<string, Json>();
  for (const c of asArray(bom.controls).filter(isObject)) {
    const refId = str(c.refId);
    if (refId) controls.set(refId, c);
  }

  const perElement = new Map<string, TmImportThreat[]>();
  const threatSection = isObject(bom.threats) ? bom.threats : {};
  for (const t of asArray(threatSection.threats).filter(isObject)) {
    const name = str(t.name) ?? str(t.refId) ?? 'Imported Threat';
    const p = readProps(t);
    const stride = asArray(t.categories)
      .filter(isObject)
      .find(c => c.taxonomy === 'STRIDE' && typeof c.category === 'string');
    const category = stride ? STRIDE_LABEL[stride.category as string] ?? (stride.category as string) : '';
    const mitigation = asArray(t.mitigations)
      .map(ref => controls.get(String(ref)))
      .filter(isObject)
      .map(c => [str(c.name), str(c.description)].filter(Boolean).join(': '))
      .filter(Boolean)
      .join('\n');
    const threat: TmImportThreat = {
      title: name,
      type: p.get('category') ?? category,
      status: p.get('status') ?? 'open',
      severity: p.get('severity') ?? '',
      description: str(t.description) ?? '',
      mitigation,
      likelihood: num(p.get('likelihood')),
      impact: num(p.get('impact')),
    };
    const targets = asArray(t.affects)
      .map(ref => byRef.get(String(ref)))
      .filter((id): id is string => Boolean(id));
    if (targets.length === 0) {
      warnings.push(`Skipped threat "${name}": it affects no imported element.`);
      continue;
    }
    for (const elementId of targets) {
      perElement.set(elementId, [...(perElement.get(elementId) ?? []), threat]);
    }
  }

  if (nodes.length === 0) throw new Error('No diagram elements found in the TM-BOM blueprint.');

  return {
    diagramName: str(blueprint.name) ?? 'TM-BOM Import',
    nodes: nodes.map(n => ({ id: n.id, label: n.label, type: n.type, x: n.x, y: n.y, width: n.width, height: n.height })),
    edges,
    threats: [...perElement].map(([elementId, threats]) => ({ elementId, threats })),
    warnings,
  };
}

// ── Export ───────────────────────────────────────────────────────────────────

/** Turn a ThreatAtlas id into a refId, which may not start with `urn:cdx:`. */
const ref = (id: string | number) => `ta-${id}`;

/** Build a CycloneDX 2.0 (draft) TM-BOM for one diagram. */
export function buildTmBom(input: TmExportInput, options: TmExportOptions = {}): Json {
  const nodeById = new Map(input.nodes.map(n => [n.id, n]));
  const zoneOf = (node: TmExportInput['nodes'][number]): string | undefined => {
    const parent = node.parentId ? nodeById.get(node.parentId) : undefined;
    return parent?.data.type === 'boundary' ? ref(parent.id) : undefined;
  };
  const layoutProps = (node: TmExportInput['nodes'][number]) =>
    props([
      ['x', node.position.x],
      ['y', node.position.y],
      ['width', node.width ?? node.measured?.width],
      ['height', node.height ?? node.measured?.height],
      ['parent', node.parentId],
    ]);

  const zones: Json[] = [];
  const assets: Json[] = [];
  const dataStores: Json[] = [];
  for (const node of input.nodes) {
    const name = node.data.label?.trim() || node.id;
    const common = {
      refId: ref(node.id),
      name,
      ...(node.data.description ? { description: node.data.description } : {}),
    };
    const zone = zoneOf(node);
    switch (node.data.type) {
      case 'boundary':
        zones.push({ ...common, type: 'trust', ...(zone ? { parent: zone } : {}), properties: layoutProps(node) });
        break;
      case 'datastore':
        dataStores.push({ ...common, type: { name: 'data-store' }, ...(zone ? { zone } : {}), properties: layoutProps(node) });
        break;
      case 'external':
        assets.push({ ...common, type: 'actor', ...(zone ? { zone } : {}), properties: layoutProps(node) });
        break;
      default:
        assets.push({ ...common, type: 'process', ...(zone ? { zone } : {}), properties: layoutProps(node) });
    }
  }

  const flows: Json[] = input.edges
    .filter(e => nodeById.has(e.source) && nodeById.has(e.target))
    .map(e => ({
      refId: ref(e.id),
      name: edgeLabel(e),
      type: 'data',
      source: ref(e.source),
      destination: ref(e.target),
    }));

  const controls: Json[] = input.mitigations.map(m => {
    const status = CONTROL_STATUS[(m.status ?? '').toLowerCase()];
    return {
      refId: ref(`m${m.id}`),
      name: m.mitigation?.name?.trim() || `Mitigation ${m.id}`,
      ...(m.mitigation?.description ? { description: m.mitigation.description } : {}),
      ...(status ? { status } : {}),
      appliesTo: [ref(m.element_id)],
      properties: props([['status', m.status]]),
    };
  });

  const threats: Json[] = input.threats.map(t => {
    const category = (t.threat?.category ?? '').trim();
    const stride = STRIDE[category.toLowerCase()];
    const mitigations = input.mitigations.filter(m => m.threat_id === t.id).map(m => ref(`m${m.id}`));
    return {
      refId: ref(`t${t.id}`),
      name: t.threat?.name?.trim() || `Threat ${t.id}`,
      ...(t.threat?.description ? { description: t.threat.description } : {}),
      ...(stride ? { categories: [{ taxonomy: 'STRIDE', category: stride }] } : {}),
      affects: [ref(t.element_id)],
      ...(mitigations.length > 0 ? { mitigations } : {}),
      properties: props([
        ['category', stride ? undefined : category],
        ['status', t.status],
        ['likelihood', t.likelihood],
        ['impact', t.impact],
        ['severity', t.severity],
        ['comments', t.comments],
      ]),
    };
  });

  const blueprint: Json = {
    refId: 'ta-blueprint',
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    modelTypes: ['data-flow'],
    ...(assets.length > 0 ? { assets } : {}),
    ...(dataStores.length > 0 ? { dataStores } : {}),
    ...(zones.length > 0 ? { zones } : {}),
    ...(flows.length > 0 ? { flows } : {}),
  };

  // Drop empty `properties` arrays, which carry nothing.
  const prune = (items: Json[]) => {
    for (const item of items) if (Array.isArray(item.properties) && item.properties.length === 0) delete item.properties;
  };
  prune(zones);
  prune(assets);
  prune(dataStores);
  prune(controls);
  prune(threats);

  return {
    specFormat: 'CycloneDX',
    specVersion: '2.0',
    serialNumber: options.serialNumber ?? `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: options.timestamp ?? new Date().toISOString(),
      tools: { components: [{ type: 'application', name: 'ThreatAtlas' }] },
      properties: [{ name: `${PREFIX}tmbom-spec-commit`, value: TMBOM_SPEC_COMMIT }],
    },
    blueprints: [blueprint],
    ...(threats.length > 0 ? { threats: { methodologies: ['STRIDE'], threats } } : {}),
    ...(controls.length > 0 ? { controls } : {}),
  };
}
