import { describe, expect, it } from 'vitest';
import { buildTmBom, isTmBom, parseTmBom, type TmExportInput } from '@/lib/tmbom';

// A small TM-BOM in the CycloneDX 2.0 draft shape: a blueprint with a zone, two assets, a data
// store, an actor and two flows, plus threats and the controls that mitigate them.
const sample = {
  specFormat: 'CycloneDX',
  specVersion: '2.0',
  serialNumber: 'urn:uuid:3e671687-395b-41f5-a30f-a58921a69b79',
  version: 1,
  blueprints: [
    {
      refId: 'bp-shop',
      name: 'Web shop',
      modelTypes: ['data-flow'],
      zones: [{ refId: 'zone-dmz', name: 'DMZ', type: 'trust' }],
      assets: [
        { refId: 'asset-web', name: 'Web server', type: 'service', zone: 'zone-dmz' },
        { refId: 'asset-browser', name: 'Browser', type: 'actor' },
      ],
      dataStores: [{ refId: 'ds-orders', name: 'Orders DB', type: 'relational', zone: 'zone-dmz' }],
      actors: [{ refId: 'actor-admin', party: 'party-admin', description: 'Administrator' }],
      flows: [
        { refId: 'flow-req', name: 'HTTPS request', type: 'data', source: 'asset-browser', destination: 'asset-web' },
        { refId: 'flow-sql', name: 'SQL', type: 'data', source: 'asset-web', destination: 'ds-orders' },
        { refId: 'flow-lost', name: 'To nowhere', type: 'data', source: 'asset-web', destination: 'missing' },
      ],
    },
  ],
  threats: {
    methodologies: ['STRIDE'],
    threats: [
      {
        refId: 'threat-sqli',
        name: 'SQL injection',
        description: 'Crafted input changes the query.',
        categories: [{ taxonomy: 'STRIDE', category: 'tampering' }],
        affects: ['asset-web', 'flow-sql'],
        mitigations: ['ctl-params'],
      },
      { refId: 'threat-floating', name: 'Unattached threat', affects: ['nothing-here'] },
    ],
  },
  controls: [{ refId: 'ctl-params', name: 'Parameterised queries', description: 'Bind every value.' }],
};

describe('isTmBom', () => {
  it('recognises a CycloneDX 2.x BOM with a blueprint or threats', () => {
    expect(isTmBom(sample)).toBe(true);
    expect(isTmBom({ specFormat: 'CycloneDX', specVersion: '2.0', threats: { threats: [] } })).toBe(true);
  });

  it('rejects CycloneDX 1.x, a BOM without a model, and other JSON', () => {
    expect(isTmBom({ bomFormat: 'CycloneDX', specVersion: '1.6', components: [] })).toBe(false);
    expect(isTmBom({ specFormat: 'CycloneDX', specVersion: '2.0', inventories: {} })).toBe(false);
    expect(isTmBom({ detail: { diagrams: [] } })).toBe(false);
    expect(isTmBom(null)).toBe(false);
  });
});

describe('parseTmBom', () => {
  const result = parseTmBom(sample);
  const node = (refId: string) => result.nodes.find(n => n.id === `tm-${refId}`)!;

  it('maps zones, assets, data stores and actors to diagram element types', () => {
    expect(result.diagramName).toBe('Web shop');
    expect(node('zone-dmz')).toMatchObject({ label: 'DMZ', type: 'boundary' });
    expect(node('asset-web')).toMatchObject({ label: 'Web server', type: 'process' });
    expect(node('asset-browser')).toMatchObject({ label: 'Browser', type: 'external' });
    expect(node('ds-orders')).toMatchObject({ label: 'Orders DB', type: 'datastore' });
    expect(node('actor-admin')).toMatchObject({ label: 'Administrator', type: 'external' });
  });

  it('lays out a zone around its members when the file has no positions', () => {
    const zone = node('zone-dmz');
    for (const member of [node('asset-web'), node('ds-orders')]) {
      expect(member.x).toBeGreaterThanOrEqual(zone.x);
      expect(member.y).toBeGreaterThanOrEqual(zone.y);
      expect(member.x + member.width).toBeLessThanOrEqual(zone.x + zone.width);
      expect(member.y + member.height).toBeLessThanOrEqual(zone.y + zone.height);
    }
    // An element outside every zone is placed below the zones.
    expect(node('asset-browser').y).toBeGreaterThan(zone.y + zone.height);
  });

  it('maps flows to edges and skips a flow whose end is not an element', () => {
    expect(result.edges).toEqual([
      { id: 'tm-flow-req', source: 'tm-asset-browser', target: 'tm-asset-web', label: 'HTTPS request' },
      { id: 'tm-flow-sql', source: 'tm-asset-web', target: 'tm-ds-orders', label: 'SQL' },
    ]);
    expect(result.warnings).toContain('Skipped flow "To nowhere": its source or destination is not an imported element.');
  });

  it('attaches each threat to the elements and flows it affects, with its controls', () => {
    const expected = {
      title: 'SQL injection',
      type: 'Tampering',
      status: 'open',
      description: 'Crafted input changes the query.',
      mitigation: 'Parameterised queries: Bind every value.',
    };
    expect(result.threats).toEqual([
      { elementId: 'tm-asset-web', threats: [expect.objectContaining(expected)] },
      { elementId: 'tm-flow-sql', threats: [expect.objectContaining(expected)] },
    ]);
    expect(result.warnings).toContain('Skipped threat "Unattached threat": it affects no imported element.');
  });

  it('rejects a file that is not a TM-BOM or has no elements', () => {
    expect(() => parseTmBom({ cells: [] })).toThrow('Not a CycloneDX 2.x TM-BOM.');
    expect(() => parseTmBom({ specFormat: 'CycloneDX', specVersion: '2.0', threats: { threats: [] } })).toThrow(
      'No diagram elements found',
    );
  });
});

// A diagram as the ThreatAtlas API returns it: a boundary holding a process (positioned relative
// to the boundary), a data store and an external entity, two flows, threats and mitigations.
const diagram: TmExportInput = {
  name: 'Payments',
  nodes: [
    { id: 'b1', position: { x: 100, y: 50 }, width: 400, height: 300, data: { label: 'Internal', type: 'boundary' } },
    { id: 'p1', parentId: 'b1', position: { x: 40, y: 60 }, data: { label: 'API', type: 'process' } },
    { id: 'd1', position: { x: 700, y: 120 }, data: { label: 'Ledger', type: 'datastore' } },
    { id: 'e1', position: { x: -200, y: 120 }, data: { label: 'Customer', type: 'external' } },
  ],
  edges: [
    { id: 'f1', source: 'e1', target: 'p1', label: 'Pay' },
    { id: 'f2', source: 'p1', target: 'd1', data: { label: 'Write' } },
  ],
  threats: [
    {
      id: 7,
      element_id: 'p1',
      status: 'mitigated',
      likelihood: 4,
      impact: 5,
      severity: 'critical',
      threat: { name: 'Spoofed customer', description: 'A caller claims to be another customer.', category: 'Spoofing' },
    },
    { id: 8, element_id: 'f2', status: 'identified', threat: { name: 'Replay', category: 'Business logic' } },
  ],
  mitigations: [
    { id: 3, element_id: 'p1', threat_id: 7, status: 'implemented', mitigation: { name: 'Mutual TLS', description: 'Clients present a certificate.' } },
  ],
};

describe('buildTmBom', () => {
  const bom = buildTmBom(diagram, { serialNumber: 'urn:uuid:00000000-0000-4000-8000-000000000000', timestamp: '2026-11-26T00:00:00Z' });
  const blueprint = (bom.blueprints as Record<string, unknown>[])[0];

  it('writes a CycloneDX 2.0 document with one data-flow blueprint', () => {
    expect(bom).toMatchObject({ specFormat: 'CycloneDX', specVersion: '2.0', version: 1 });
    expect(blueprint).toMatchObject({ refId: 'ta-blueprint', name: 'Payments', modelTypes: ['data-flow'] });
  });

  it('maps elements to zones, assets and data stores, with the zone of a node inside a boundary', () => {
    expect(blueprint.zones).toEqual([expect.objectContaining({ refId: 'ta-b1', name: 'Internal', type: 'trust' })]);
    expect(blueprint.assets).toEqual([
      expect.objectContaining({ refId: 'ta-p1', name: 'API', type: 'process', zone: 'ta-b1' }),
      expect.objectContaining({ refId: 'ta-e1', name: 'Customer', type: 'actor' }),
    ]);
    expect(blueprint.dataStores).toEqual([expect.objectContaining({ refId: 'ta-d1', name: 'Ledger' })]);
    expect(blueprint.flows).toEqual([
      { refId: 'ta-f1', name: 'Pay', type: 'data', source: 'ta-e1', destination: 'ta-p1' },
      { refId: 'ta-f2', name: 'Write', type: 'data', source: 'ta-p1', destination: 'ta-d1' },
    ]);
  });

  it('writes threats with STRIDE categories, affected elements and mitigating controls', () => {
    const threats = (bom.threats as { threats: Record<string, unknown>[] }).threats;
    expect(threats[0]).toMatchObject({
      refId: 'ta-t7',
      name: 'Spoofed customer',
      categories: [{ taxonomy: 'STRIDE', category: 'spoofing' }],
      affects: ['ta-p1'],
      mitigations: ['ta-m3'],
    });
    // A category outside STRIDE is kept as a property instead.
    expect(threats[1].categories).toBeUndefined();
    expect(threats[1].properties).toContainEqual({ name: 'threatatlas:category', value: 'Business logic' });
    expect(bom.controls).toEqual([
      expect.objectContaining({ refId: 'ta-m3', name: 'Mutual TLS', status: 'implemented', appliesTo: ['ta-p1'] }),
    ]);
  });
});

describe('TM-BOM round trip', () => {
  const back = parseTmBom(JSON.parse(JSON.stringify(buildTmBom(diagram))));
  const node = (id: string) => back.nodes.find(n => n.id === `tm-ta-${id}`)!;

  it('keeps every element, its type and its absolute position', () => {
    expect(back.nodes).toHaveLength(4);
    expect(node('b1')).toMatchObject({ label: 'Internal', type: 'boundary', x: 100, y: 50, width: 400, height: 300 });
    // The process was 40,60 inside the boundary at 100,50.
    expect(node('p1')).toMatchObject({ label: 'API', type: 'process', x: 140, y: 110 });
    expect(node('d1')).toMatchObject({ type: 'datastore', x: 700, y: 120 });
    expect(node('e1')).toMatchObject({ type: 'external', x: -200, y: 120 });
    expect(back.edges.map(e => [e.source, e.target, e.label])).toEqual([
      ['tm-ta-e1', 'tm-ta-p1', 'Pay'],
      ['tm-ta-p1', 'tm-ta-d1', 'Write'],
    ]);
  });

  it('keeps each threat on its element with its status, scores and mitigation', () => {
    expect(back.warnings).toEqual([]);
    expect(back.threats).toEqual([
      {
        elementId: 'tm-ta-p1',
        threats: [
          expect.objectContaining({
            title: 'Spoofed customer',
            type: 'Spoofing',
            status: 'mitigated',
            severity: 'critical',
            likelihood: 4,
            impact: 5,
            mitigation: 'Mutual TLS: Clients present a certificate.',
          }),
        ],
      },
      { elementId: 'tm-ta-f2', threats: [expect.objectContaining({ title: 'Replay', type: 'Business logic', status: 'identified' })] },
    ]);
  });
});
