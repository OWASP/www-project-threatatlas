import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token and ensure trailing slashes
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add trailing slash to URL if not present (prevents 307 redirects from FastAPI)
  if (config.url && !config.url.endsWith('/') && !config.url.includes('?')) {
    config.url = `${config.url}/`;
  } else if (config.url && !config.url.endsWith('/') && config.url.includes('?')) {
    // Handle URLs with query parameters
    const [path, query] = config.url.split('?');
    if (!path.endsWith('/')) {
      config.url = `${path}/?${query}`;
    }
  }

  return config;
});

// Add response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth / SSO API
export interface OIDCProviderInfo {
  name: string;
  display_name: string;
  login_url: string;
}

export const authApi = {
  listOidcProviders: () => api.get<OIDCProviderInfo[]>('/auth/oidc/providers'),
};

// Admin-managed SSO provider configuration
export interface SsoProvider {
  id: number;
  name: string;
  display_name: string;
  issuer: string;
  metadata_url: string | null;
  client_id: string;
  scopes: string;
  is_enabled: boolean;
}

export interface SsoProviderCreate {
  name: string;
  display_name: string;
  issuer: string;
  metadata_url?: string | null;
  client_id: string;
  client_secret: string;
  scopes?: string;
  is_enabled?: boolean;
}

export interface SsoProviderUpdate {
  display_name?: string;
  issuer?: string;
  metadata_url?: string | null;
  client_id?: string;
  client_secret?: string;
  scopes?: string;
  is_enabled?: boolean;
}

export const ssoApi = {
  list: () => api.get<SsoProvider[]>('/sso/providers'),
  create: (data: SsoProviderCreate) => api.post<SsoProvider>('/sso/providers', data),
  update: (id: number, data: SsoProviderUpdate) => api.put<SsoProvider>(`/sso/providers/${id}`, data),
  delete: (id: number) => api.delete(`/sso/providers/${id}`),
};

// Groups
export type UserRole = 'admin' | 'standard' | 'read_only';

export interface Group {
  id: number;
  name: string;
  description: string | null;
  role: UserRole;
  scim_external_id: string | null;
  created_at: string;
}

export interface GroupMember {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
}

export interface GroupDetail extends Group {
  members: GroupMember[];
}

export const groupsApi = {
  list: () => api.get<Group[]>('/groups'),
  get: (id: number) => api.get<GroupDetail>(`/groups/${id}`),
  create: (data: { name: string; description?: string | null; role: UserRole }) =>
    api.post<GroupDetail>('/groups', data),
  update: (id: number, data: { name?: string; description?: string | null; role?: UserRole }) =>
    api.put<GroupDetail>(`/groups/${id}`, data),
  delete: (id: number) => api.delete(`/groups/${id}`),
  setMembers: (id: number, userIds: number[]) =>
    api.put<GroupDetail>(`/groups/${id}/members`, { user_ids: userIds }),
  addMember: (id: number, userId: number) => api.post<GroupDetail>(`/groups/${id}/members/${userId}`),
  removeMember: (id: number, userId: number) => api.delete<GroupDetail>(`/groups/${id}/members/${userId}`),
};

// SCIM tokens
export interface ScimToken {
  id: number;
  name: string;
  last_used_at: string | null;
  created_at: string;
}

export interface ScimTokenCreated extends ScimToken {
  token: string;
}

export const scimTokensApi = {
  list: () => api.get<ScimToken[]>('/scim-tokens'),
  create: (name: string) => api.post<ScimTokenCreated>('/scim-tokens', { name }),
  revoke: (id: number) => api.delete(`/scim-tokens/${id}`),
};

// Absolute URL for an OIDC login redirect — consumed via `window.location.href`
// so the browser performs the full authorization flow.
export const oidcLoginUrl = (loginPath: string) => `${API_BASE_URL}${loginPath}`;

/**
 * Fetch an authenticated URL and save the response as a file.
 *
 * Uses axios so the Authorization header is set by our interceptor; then
 * builds a blob URL, clicks a hidden anchor, and cleans up. The filename is
 * taken from the `Content-Disposition` header when present.
 */
export async function triggerDownload(pathWithLeadingSlash: string): Promise<void> {
  // The path starts with `/api/...`; axios baseURL already includes `/api`, so strip it.
  const url = pathWithLeadingSlash.startsWith('/api/')
    ? pathWithLeadingSlash.slice(4)
    : pathWithLeadingSlash;

  const res = await api.get(url, { responseType: 'blob' });
  const disposition: string | undefined = res.headers['content-disposition'];
  let filename = 'download';
  if (disposition) {
    const m = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
    if (m) filename = m[1];
  }
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

// Product API
export type ProductStatus = 'design' | 'development' | 'testing' | 'deployment' | 'production';

export interface ProductInput {
  name?: string;
  description?: string | null;
  is_public?: boolean;
  status?: ProductStatus | null;
  repository_url?: string | null;
  confluence_url?: string | null;
  application_url?: string | null;
  business_area?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
}

export const productsApi = {
  list: () => api.get('/products'),
  get: (id: number) => api.get(`/products/${id}`),
  create: (data: ProductInput & { name: string }) => api.post('/products', data),
  update: (id: number, data: ProductInput) => api.put(`/products/${id}`, data),
  delete: (id: number) => api.delete(`/products/${id}`),
};

// Framework API
export const frameworksApi = {
  list: () => api.get('/frameworks'),
  get: (id: number) => api.get(`/frameworks/${id}`),
  create: (data: { name: string; description?: string }) => api.post('/frameworks', data),
  update: (id: number, data: { name?: string; description?: string }) => api.put(`/frameworks/${id}`, data),
  delete: (id: number) => api.delete(`/frameworks/${id}`),
};

// Threat API
export const threatsApi = {
  list: (params?: { framework_id?: number; is_custom?: boolean }) => api.get('/threats', { params }),
  get: (id: number) => api.get(`/threats/${id}`),
  create: (data: { framework_id: number; name: string; description?: string; category?: string; is_custom?: boolean }) => api.post('/threats', data),
  update: (id: number, data: { name?: string; description?: string; category?: string }) => api.put(`/threats/${id}`, data),
  revert: (id: number) => api.post(`/threats/${id}/revert`),
  delete: (id: number) => api.delete(`/threats/${id}`),
};

// Mitigation API
export const mitigationsApi = {
  list: (params?: { framework_id?: number; is_custom?: boolean }) => api.get('/mitigations', { params }),
  get: (id: number) => api.get(`/mitigations/${id}`),
  create: (data: { framework_id: number; name: string; description?: string; category?: string; is_custom?: boolean }) => api.post('/mitigations', data),
  update: (id: number, data: { name?: string; description?: string; category?: string }) => api.put(`/mitigations/${id}`, data),
  revert: (id: number) => api.post(`/mitigations/${id}/revert`),
  delete: (id: number) => api.delete(`/mitigations/${id}`),
};

// Diagram API
export const diagramsApi = {
  list: (params?: { product_id?: number }) => api.get('/diagrams', { params }),
  get: (id: number) => api.get(`/diagrams/${id}`),
  create: (data: { product_id: number; name: string; description?: string; diagram_data?: any }) => api.post('/diagrams', data),
  update: (id: number, data: { name?: string; description?: string; diagram_data?: any; auto_version?: boolean; version_comment?: string }) => api.put(`/diagrams/${id}`, data),
  delete: (id: number) => api.delete(`/diagrams/${id}`),
};

// DiagramVersion API
export const diagramVersionsApi = {
  list: (diagramId: number) => api.get(`/diagram-versions/${diagramId}/versions`),
  get: (diagramId: number, versionNumber: number) => api.get(`/diagram-versions/${diagramId}/versions/${versionNumber}`),
  create: (diagramId: number, data: { comment?: string }) => api.post(`/diagram-versions/${diagramId}/versions`, data),
  restore: (diagramId: number, versionNumber: number) => api.post(`/diagram-versions/${diagramId}/versions/${versionNumber}/restore`),
  compare: (diagramId: number, fromVersion: number, toVersion: number) => api.get(`/diagram-versions/${diagramId}/versions/compare`, { params: { from_version: fromVersion, to_version: toVersion } }),
  delete: (diagramId: number, versionNumber: number) => api.delete(`/diagram-versions/${diagramId}/versions/${versionNumber}`),
};

// Model API
export const modelsApi = {
  list: () => api.get('/models'),
  get: (id: number) => api.get(`/models/${id}`),
  listByDiagram: (diagramId: number) => api.get(`/models/diagram/${diagramId}`),
  create: (data: { diagram_id: number; framework_id: number; name: string; description?: string }) => api.post('/models', data),
  update: (id: number, data: { name?: string; description?: string; status?: string; completed_at?: string }) => api.put(`/models/${id}`, data),
  delete: (id: number) => api.delete(`/models/${id}`),
};

// DiagramThreat API
export const diagramThreatsApi = {
  list: (params?: { diagram_id?: number; model_id?: number; element_id?: string }) => api.get('/diagram-threats', { params }),
  get: (id: number) => api.get(`/diagram-threats/${id}`),
  create: (data: { diagram_id: number; model_id: number; threat_id: number; element_id: string; element_type: string; status?: string; comments?: string; likelihood?: number | null; impact?: number | null }) => api.post('/diagram-threats', data),
  update: (id: number, data: {
    status?: string;
    comments?: string;
    likelihood?: number | null;
    impact?: number | null;
    acceptance_justification?: string | null;
    acceptance_approver_id?: number | null;
    acceptance_review_date?: string | null;
    accepted_at?: string | null;
    acceptance_review_status?: string | null;
    acceptance_review_note?: string | null;
  }) => api.put(`/diagram-threats/${id}`, data),
  delete: (id: number) => api.delete(`/diagram-threats/${id}`),
};

// Product members API (for risk acceptance approver dropdown)
export const productMembersApi = {
  list: (productId: number) => api.get<{ id: number; email: string; full_name: string | null; username: string }[]>(`/products/${productId}/members`),
};

// Approvals API
export interface ApprovalItem {
  id: number;
  diagram_threat_id: number;
  threat_name: string;
  category: string | null;
  element_id: string;
  diagram_id: number;
  diagram_name: string | null;
  product_id: number | null;
  product_name: string | null;
  accepted_by_name: string;
  accepted_at: string | null;
  acceptance_justification: string | null;
  acceptance_review_date: string | null;
  acceptance_review_status: string | null;
  acceptance_review_note: string | null;
  acceptance_reviewed_at: string | null;
}

export const approvalsApi = {
  listMine: () => api.get<ApprovalItem[]>('/approvals/my'),
  getCount: () => api.get<{ count: number }>('/approvals/my/count'),
  review: (id: number, data: { acceptance_review_status: string; acceptance_review_note?: string }) =>
    api.put(`/diagram-threats/${id}`, data),
};

// Global Search API
export const searchApi = {
  search: (q: string) => api.get('/search', { params: { q } }),
};

// MITRE ATT&CK technique catalog + threat→technique mapping.
export interface AttackTechnique {
  technique_id: string;
  name: string;
  tactic: string | null;
  url: string | null;
  description: string | null;
}

export const attackApi = {
  listTechniques: (params?: { q?: string; tactic?: string }) =>
    api.get<AttackTechnique[]>('/attack/techniques', { params }),
  listTactics: () => api.get<string[]>('/attack/tactics'),
  listForThreat: (diagramThreatId: number) =>
    api.get<AttackTechnique[]>(`/attack/diagram-threats/${diagramThreatId}/techniques`),
  attach: (diagramThreatId: number, techniqueId: string) =>
    api.post<AttackTechnique>(`/attack/diagram-threats/${diagramThreatId}/techniques`, { technique_id: techniqueId }),
  detach: (diagramThreatId: number, techniqueId: string) =>
    api.delete(`/attack/diagram-threats/${diagramThreatId}/techniques/${techniqueId}`),
};

// Portfolio analytics — server-side rollup across all accessible products.
export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  unscored: number;
}

export interface PortfolioAnalytics {
  totals: { products: number; diagrams: number; threats: number; mitigations: number };
  threats_by_severity: SeverityCounts;
  residual_by_severity: SeverityCounts;
  threats_by_status: Record<string, number>;
  mitigations_by_status: Record<string, number>;
  threats_by_category: { category: string; count: number }[];
  risk_matrix: { likelihood: number; impact: number; count: number }[];
  by_product: {
    product_id: number;
    product_name: string;
    open_high_critical: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    unscored: number;
    threats: number;
    mitigations: number;
  }[];
  mitigation_ratio: number;
  risk_reduction: number;
  unmitigated_high_critical: number;
  top_risk_products: { product_id: number; product_name: string; open_high_critical: number }[];
  stale_diagrams: { diagram_id: number; diagram_name: string; product_id: number; product_name: string; last_updated: string }[];
}

export const analyticsApi = {
  portfolio: (params?: { stale_days?: number; top_n?: number }) =>
    api.get<PortfolioAnalytics>('/analytics/portfolio', { params }),
};

// DiagramMitigation API
export const diagramMitigationsApi = {
  list: (params?: { diagram_id?: number; model_id?: number; element_id?: string }) => api.get('/diagram-mitigations', { params }),
  get: (id: number) => api.get(`/diagram-mitigations/${id}`),
  create: (data: { diagram_id: number; model_id: number; mitigation_id: number; element_id: string; element_type: string; threat_id?: number | null; status?: string; comments?: string | null }) => api.post('/diagram-mitigations', data),
  update: (id: number, data: { status?: string; comments?: string | null }) => api.put(`/diagram-mitigations/${id}`, data),
  delete: (id: number) => api.delete(`/diagram-mitigations/${id}`),
};

// Collaborators API
export const collaboratorsApi = {
  list: (productId: number) => api.get(`/products/${productId}/collaborators`),
  add: (productId: number, data: { user_id: number; role: 'owner' | 'editor' | 'viewer' }) =>
    api.post(`/products/${productId}/collaborators`, data),
  update: (productId: number, userId: number, data: { role: 'owner' | 'editor' | 'viewer' }) =>
    api.put(`/products/${productId}/collaborators/${userId}`, data),
  remove: (productId: number, userId: number) =>
    api.delete(`/products/${productId}/collaborators/${userId}`),
};

// AI Config API (admin only)
export const aiConfigApi = {
  get: () => api.get('/ai-config'),
  create: (data: {
    provider: string; model_name: string; api_key: string;
    base_url?: string; temperature?: number; max_tokens?: number;
  }) => api.post('/ai-config', data),
  update: (id: number, data: {
    provider?: string; model_name?: string; api_key?: string;
    base_url?: string; temperature?: number; max_tokens?: number; is_active?: boolean;
  }) => api.put(`/ai-config/${id}`, data),
  delete: (id: number) => api.delete(`/ai-config/${id}`),
  tokenStats: () => api.get('/ai-config/token-stats'),
  test: (data: { provider: string; model_name: string; api_key: string; base_url?: string; temperature?: number; max_tokens?: number }) =>
    api.post('/ai-config/test', data),
};

// AI Conversations API
export const aiConversationsApi = {
  list: (params?: { diagram_id?: number }) => api.get('/ai-conversations', { params }),
  create: (data: { diagram_id: number; title?: string }) => api.post('/ai-conversations', data),
  // One-click "analyze this diagram": creates a conversation seeded for a full
  // STRIDE pass and returns the prompt to POST to the streaming messages endpoint.
  analyzeDiagram: (diagramId: number) =>
    api.post<{ conversation_id: number; diagram_id: number; prompt: string }>(
      '/ai-conversations/analyze-diagram', { diagram_id: diagramId }),
  get: (id: number) => api.get(`/ai-conversations/${id}`),
  delete: (id: number) => api.delete(`/ai-conversations/${id}`),
  getMessages: (convId: number) => api.get(`/ai-conversations/${convId}/messages`),
  approveProposal: (convId: number, msgId: number, proposalId: string) =>
    api.post(`/ai-conversations/${convId}/messages/${msgId}/approve-proposal`, { proposal_id: proposalId }),
  dismissProposal: (convId: number, msgId: number, proposalId: string) =>
    api.post(`/ai-conversations/${convId}/messages/${msgId}/dismiss-proposal`, { proposal_id: proposalId }),
  approveAll: (convId: number) =>
    api.post(`/ai-conversations/${convId}/approve-all`),
  classifyElements: (elements: { id: string; label: string; style: string }[]) =>
    api.post<{ id: string; suggested_type: string; reasoning: string }[]>(
      '/ai-conversations/classify-elements',
      { elements },
    ),
};

// API Tokens (machine-to-machine / CI access)
export const apiTokensApi = {
  list: () => api.get('/api-tokens'),
  create: (data: { name: string }) => api.post('/api-tokens', data),
  revoke: (id: number) => api.delete(`/api-tokens/${id}`),
};

// JIRA Integration
export interface JiraProject {
  key: string;
  name: string;
  project_type: string;
}

export const jiraApi = {
  get: () => api.get('/integrations/jira'),
  save: (data: { jira_url: string; jira_email: string; jira_token: string; jira_project_key: string }) =>
    api.put('/integrations/jira', data),
  remove: () => api.delete('/integrations/jira'),
  test: () => api.post('/integrations/jira/test'),
  listProjects: () => api.get<JiraProject[]>('/integrations/jira/projects'),
  createIssue: (data: {
    summary: string;
    description: string;
    issue_type?: string;
    priority?: string;
    threat_id?: number;
    project_key?: string;
  }) => api.post('/integrations/jira/issues', data),
};

// Component Template Library
export const componentTemplatesApi = {
  listGrouped: (frameworkId?: number | null) => api.get<ComponentTemplateGroup[]>('/component-templates', { params: frameworkId ? { framework_id: frameworkId } : {} }),
  get: (id: number, frameworkId?: number | null) => api.get<ComponentTemplateDetail>('/component-templates/' + id, { params: frameworkId ? { framework_id: frameworkId } : {} }),
  create: (data: { name: string; slug: string; category: string; node_type: string; icon?: string; description?: string; threat_ids?: number[]; mitigation_ids?: number[] }) => api.post('/component-templates', data),
  update: (id: number, data: { name?: string; slug?: string; category?: string; node_type?: string; icon?: string; description?: string; threat_ids?: number[]; mitigation_ids?: number[] }) => api.put('/component-templates/' + id, data),
  remove: (id: number) => api.delete('/component-templates/' + id),
  revert: (id: number) => api.post(`/component-templates/${id}/revert`),
  apply: (id: number, data: { diagram_id: number; model_id: number; element_id: string; element_type?: string; threat_ids?: number[]; mitigation_ids?: number[] }) =>
    api.post<{ threats_added: number; mitigations_added: number; threats_skipped: number; mitigations_skipped: number }>(`/component-templates/${id}/apply`, data),
  addKbLinks: (id: number, data: { threat_ids?: number[]; mitigation_ids?: number[] }) => api.post(`/component-templates/${id}/kb-links`, data),
  removeKbThreat: (id: number, threatId: number) => api.delete(`/component-templates/${id}/kb-links/threats/${threatId}`),
  removeKbMitigation: (id: number, mitigationId: number) => api.delete(`/component-templates/${id}/kb-links/mitigations/${mitigationId}`),
  // KB browse endpoints for the form
  listFrameworks: () => api.get<{ id: number; name: string; threat_count: number }[]>('/component-templates/kb/frameworks'),
  listKbThreats: (frameworkId: number, q?: string) => api.get<{ id: number; name: string; category: string; description: string }[]>('/component-templates/kb/threats', { params: { framework_id: frameworkId, q: q ?? '' } }),
  listKbMitigations: (frameworkId: number, q?: string) => api.get<{ id: number; name: string; category: string; description: string }[]>('/component-templates/kb/mitigations', { params: { framework_id: frameworkId, q: q ?? '' } }),
};

export interface ComponentThreat {
  name: string;
  description: string;
  category: string;
  severity_hint?: string;
}

export interface ComponentMitigation {
  name: string;
  description: string;
  category: string;
}

// KB-linked threat/mitigation (from the Knowledge Base)
export interface KBThreatItem {
  id: number;
  name: string;
  description: string | null;
  category: string;
  framework_id: number;
  framework_name: string;
}

export interface KBMitigationItem {
  id: number;
  name: string;
  description: string | null;
  category: string;
  framework_id: number;
  framework_name: string;
}

export interface ComponentTemplateListItem {
  id: number;
  name: string;
  slug: string;
  category: string;
  node_type: string;
  icon: string | null;
  description: string | null;
  threat_count: number;
  is_custom: boolean;
  is_modified: boolean;
}

export interface ComponentTemplateGroup {
  category: string;
  components: ComponentTemplateListItem[];
}

export interface ComponentTemplateDetail extends ComponentTemplateListItem {
  // KB-linked threats/mitigations (single source of truth, framework-filtered)
  threats: KBThreatItem[];
  mitigations: KBMitigationItem[];
  // Inline fallback descriptions (for display when no KB links or for custom components)
  inline_threats?: ComponentThreat[];
  inline_mitigations?: ComponentMitigation[];
}

// Users list (for owner/approver selection dropdowns)
export const usersApi = {
  list: () => api.get<{ id: number; email: string; full_name: string | null; username: string; role: string }[]>('/users'),
};

// In-app notifications
export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export const notificationsApi = {
  list: () => api.get<AppNotification[]>('/notifications'),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: number) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  remove: (id: number) => api.delete(`/notifications/${id}`),
};

export default api;
