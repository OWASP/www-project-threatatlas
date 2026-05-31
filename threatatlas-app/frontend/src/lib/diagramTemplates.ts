// Canonical pre-built diagram templates, shared by the New Diagram wizard on
// both the Products and Diagrams pages. Node/edge shapes mirror a real saved
// diagram: boundary nodes carry width/height (so they render as containers) and
// edges carry source/target handle ids + animated:true (DiagramNode exposes only
// named handles, so handleless edges would not render, and the main canvas
// animates every edge). This keeps templates — and their previews — identical to
// the main canvas.

export interface DiagramTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodes: {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: { label: string; type: string };
    zIndex?: number;
    width?: number;
    height?: number;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    type: string;
    animated?: boolean;
    sourceHandle?: string;
    targetHandle?: string;
    data?: { label?: string };
  }[];
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    id: 'web-app', name: 'Web Application', description: 'Browser → API → Backend → Database',
    icon: '🌐',
    nodes: [
      { id: 'boundary1', type: 'custom', position: { x: 250, y: 90 }, width: 620, height: 360, data: { label: 'Internal Network', type: 'boundary' }, zIndex: -1 },
      { id: 'browser', type: 'custom', position: { x: 80, y: 180 }, data: { label: 'Web Browser', type: 'external' } },
      { id: 'api-gw', type: 'custom', position: { x: 300, y: 180 }, data: { label: 'API Gateway', type: 'process' } },
      { id: 'backend', type: 'custom', position: { x: 520, y: 180 }, data: { label: 'Backend Service', type: 'process' } },
      { id: 'db', type: 'custom', position: { x: 740, y: 180 }, data: { label: 'Database', type: 'datastore' } },
      { id: 'auth', type: 'custom', position: { x: 300, y: 360 }, data: { label: 'Auth Service', type: 'process' } },
    ],
    edges: [
      { id: 'e1', source: 'browser', target: 'api-gw', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'HTTPS' } },
      { id: 'e2', source: 'api-gw', target: 'backend', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'Internal API' } },
      { id: 'e3', source: 'backend', target: 'db', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'SQL/ORM' } },
      { id: 'e4', source: 'api-gw', target: 'auth', type: 'custom', animated: true, sourceHandle: 'source-bottom', targetHandle: 'target-top', data: { label: 'Auth check' } },
    ],
  },
  {
    id: 'microservices', name: 'Microservices', description: 'API Gateway → Services → Message Queue → DB',
    icon: '⚡',
    nodes: [
      { id: 'client', type: 'custom', position: { x: 60, y: 200 }, data: { label: 'Client', type: 'external' } },
      { id: 'gw', type: 'custom', position: { x: 260, y: 200 }, data: { label: 'API Gateway', type: 'process' } },
      { id: 'svc-a', type: 'custom', position: { x: 460, y: 80 }, data: { label: 'Service A', type: 'process' } },
      { id: 'svc-b', type: 'custom', position: { x: 460, y: 320 }, data: { label: 'Service B', type: 'process' } },
      { id: 'queue', type: 'custom', position: { x: 660, y: 200 }, data: { label: 'Message Queue', type: 'datastore' } },
      { id: 'db-a', type: 'custom', position: { x: 860, y: 80 }, data: { label: 'DB A', type: 'datastore' } },
      { id: 'db-b', type: 'custom', position: { x: 860, y: 320 }, data: { label: 'DB B', type: 'datastore' } },
    ],
    edges: [
      { id: 'e1', source: 'client', target: 'gw', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'HTTPS' } },
      { id: 'e2', source: 'gw', target: 'svc-a', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e3', source: 'gw', target: 'svc-b', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e4', source: 'svc-a', target: 'queue', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'Publish' } },
      { id: 'e5', source: 'svc-b', target: 'queue', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'Subscribe' } },
      { id: 'e6', source: 'svc-a', target: 'db-a', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e7', source: 'svc-b', target: 'db-b', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left' },
    ],
  },
  {
    id: 'mobile-api', name: 'Mobile + API', description: 'Mobile App → Backend API → Database + Auth',
    icon: '📱',
    nodes: [
      { id: 'mobile', type: 'custom', position: { x: 60, y: 200 }, data: { label: 'Mobile App', type: 'external' } },
      { id: 'cdn', type: 'custom', position: { x: 260, y: 60 }, data: { label: 'CDN', type: 'process' } },
      { id: 'api', type: 'custom', position: { x: 460, y: 200 }, data: { label: 'REST API', type: 'process' } },
      { id: 'auth', type: 'custom', position: { x: 260, y: 340 }, data: { label: 'OAuth2 Provider', type: 'external' } },
      { id: 'db', type: 'custom', position: { x: 680, y: 200 }, data: { label: 'Database', type: 'datastore' } },
      { id: 'push', type: 'custom', position: { x: 680, y: 360 }, data: { label: 'Push Service', type: 'process' } },
    ],
    edges: [
      { id: 'e1', source: 'mobile', target: 'cdn', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'Static assets' } },
      { id: 'e2', source: 'mobile', target: 'api', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'HTTPS + JWT' } },
      { id: 'e3', source: 'mobile', target: 'auth', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'OAuth login' } },
      { id: 'e4', source: 'api', target: 'db', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left' },
      { id: 'e5', source: 'api', target: 'push', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'Notify' } },
    ],
  },
  {
    id: 'cicd', name: 'CI/CD Pipeline', description: 'Developer → CI → Registry → Deploy',
    icon: '🚀',
    nodes: [
      { id: 'dev', type: 'custom', position: { x: 60, y: 200 }, data: { label: 'Developer', type: 'external' } },
      { id: 'repo', type: 'custom', position: { x: 260, y: 200 }, data: { label: 'Git Repository', type: 'datastore' } },
      { id: 'ci', type: 'custom', position: { x: 460, y: 200 }, data: { label: 'CI/CD Pipeline', type: 'process' } },
      { id: 'registry', type: 'custom', position: { x: 660, y: 80 }, data: { label: 'Container Registry', type: 'datastore' } },
      { id: 'secrets', type: 'custom', position: { x: 660, y: 320 }, data: { label: 'Secrets Store', type: 'datastore' } },
      { id: 'prod', type: 'custom', position: { x: 860, y: 200 }, data: { label: 'Production', type: 'process' } },
    ],
    edges: [
      { id: 'e1', source: 'dev', target: 'repo', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'git push' } },
      { id: 'e2', source: 'repo', target: 'ci', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'Webhook trigger' } },
      { id: 'e3', source: 'ci', target: 'registry', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'docker push' } },
      { id: 'e4', source: 'ci', target: 'secrets', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'Read secrets' } },
      { id: 'e5', source: 'registry', target: 'prod', type: 'custom', animated: true, sourceHandle: 'source-right', targetHandle: 'target-left', data: { label: 'Pull & deploy' } },
    ],
  },
];
