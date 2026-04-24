import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

// Product API
export const productsApi = {
  list: () => api.get('/products'),
  get: (id: number) => api.get(`/products/${id}`),
  create: (data: { name: string; description?: string }) => api.post('/products', data),
  update: (id: number, data: { name?: string; description?: string }) => api.put(`/products/${id}`, data),
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
  delete: (id: number) => api.delete(`/threats/${id}`),
};

// Mitigation API
export const mitigationsApi = {
  list: (params?: { framework_id?: number; is_custom?: boolean }) => api.get('/mitigations', { params }),
  get: (id: number) => api.get(`/mitigations/${id}`),
  create: (data: { framework_id: number; name: string; description?: string; category?: string; is_custom?: boolean }) => api.post('/mitigations', data),
  update: (id: number, data: { name?: string; description?: string; category?: string }) => api.put(`/mitigations/${id}`, data),
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
  update: (id: number, data: { status?: string; comments?: string; likelihood?: number | null; impact?: number | null }) => api.put(`/diagram-threats/${id}`, data),
  delete: (id: number) => api.delete(`/diagram-threats/${id}`),
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

export default api;
