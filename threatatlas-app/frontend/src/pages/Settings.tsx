import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Bot, Webhook, Copy, Check, Plus, Trash2, Eye, EyeOff, KeyRound, Clock, Activity, FilePlus, FileX, ShieldCheck, ShieldOff, GitCommit, Loader2, ExternalLink, Terminal } from 'lucide-react';
import UserManagement from '@/pages/UserManagement';
import AIConfigTab from '@/components/AIConfigTab';
import AuditTerminal from '@/components/AuditTerminal';
import SsoProvidersSection from '@/components/SsoProvidersSection';
import ScimTokensSection from '@/components/ScimTokensSection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { API_BASE_URL, apiTokensApi, jiraApi } from '@/lib/api';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// ── Settings sidebar nav ──────────────────────────────────────────────────────

type SettingsSection = 'team' | 'sso' | 'ai' | 'audit' | 'integrations';

interface NavItem { id: SettingsSection; label: string; icon: React.ElementType; adminOnly?: boolean; description?: string; }

const NAV_ITEMS: NavItem[] = [
  { id: 'team',         label: 'Team',          icon: Users,    description: 'Users & invitations' },
  { id: 'sso',          label: 'SSO & SCIM',    icon: ShieldCheck, adminOnly: true, description: 'Single sign-on & provisioning' },
  { id: 'ai',           label: 'AI Model',      icon: Bot,     adminOnly: true, description: 'LLM configuration' },
  { id: 'integrations', label: 'Integrations',  icon: Webhook,  description: 'API tokens, JIRA, CI/CD' },
  { id: 'audit',        label: 'Audit Log',     icon: Terminal, adminOnly: true, description: 'System activity log' },
];

export default function Settings() {
  const { isAdmin } = useAuth();
  const [active, setActive] = useState<SettingsSection>('team');

  const visibleNav = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="flex-1 flex min-h-0 p-4 md:p-6 lg:p-8 gap-6 animate-fadeIn">

      {/* Left sidebar */}
      <aside className="w-52 shrink-0">
        <div className="sticky top-6">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-2">Settings</p>
          <nav className="space-y-0.5">
            {visibleNav.map(item => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={cn(
                    'w-full flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors text-left',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{item.label}</p>
                    {item.description && (
                      <p className="text-[10px] opacity-60 leading-tight">{item.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Right content */}
      <div className="flex-1 min-w-0">
        {active === 'team' && <UserManagement />}
        {active === 'sso' && isAdmin && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">SSO & SCIM</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Configure Single Sign-On providers and SCIM user provisioning.</p>
            </div>
            <SsoProvidersSection />
            <ScimTokensSection />
          </div>
        )}
        {active === 'ai' && isAdmin && <AIConfigTab />}
        {active === 'integrations' && <IntegrationsTab />}
        {active === 'audit' && isAdmin && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">System Audit Log</h2>
              <p className="text-sm text-muted-foreground mt-0.5">All security-relevant actions across every product.</p>
            </div>
            <AuditTerminal height={600} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Copy-to-clipboard helper ──────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CodeBlock({ code, language = '' }: { code: string; language?: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Map our language keys to hljs language identifiers
  const langMap: Record<string, string> = {
    bash: 'bash', shell: 'bash', yaml: 'yaml', yml: 'yaml',
    json: 'json', groovy: 'groovy', javascript: 'javascript',
  };
  const hlLang = langMap[language.toLowerCase()] || 'plaintext';

  return (
    <div className="relative rounded-lg border border-border/60 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40"
        style={{ backgroundColor: isDark ? '#282c34' : '#f5f5f5' }}>
        {language && (
          <span className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: isDark ? '#abb2bf' : '#666' }}>
            {language}
          </span>
        )}
        <CopyButton text={code} />
      </div>
      <SyntaxHighlighter
        language={hlLang}
        style={isDark ? atomOneDark : atomOneLight}
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.75rem',
          lineHeight: '1.6',
          borderRadius: 0,
          background: isDark ? '#282c34' : '#fafafa',
        }}
        wrapLongLines={false}
        showLineNumbers={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// ── API Token management ──────────────────────────────────────────────────────
function ApiTokensSection() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [revealedVisible, setRevealedVisible] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadTokens = () => {
    apiTokensApi.list()
      .then(r => setTokens(r.data))
      .catch(() => toast.error('Failed to load API tokens'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTokens(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await apiTokensApi.create({ name: newName.trim() });
      setRevealedToken(r.data.token);
      setRevealedVisible(true);
      setNewName('');
      setShowCreate(false);
      loadTokens();
    } catch {
      toast.error('Failed to create token');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: number, name: string) => {
    try {
      await apiTokensApi.revoke(id);
      setTokens(prev => prev.filter(t => t.id !== id));
      toast.success(`Token "${name}" revoked`);
    } catch {
      toast.error('Failed to revoke token');
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              API Tokens
            </CardTitle>
            <CardDescription className="mt-1">
              Long-lived tokens for CI/CD pipelines and machine-to-machine access. Each token is shown only once — copy it immediately.
            </CardDescription>
          </div>
          {!showCreate && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 shrink-0" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Token
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New token form */}
        {showCreate && (
          <div className="flex gap-2 items-center p-3 rounded-lg border border-primary/20 bg-primary/3">
            <Input
              placeholder="Token name (e.g. github-actions-prod)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="h-8 text-sm"
              autoFocus
            />
            <Button size="sm" className="h-8 shrink-0" onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={() => { setShowCreate(false); setNewName(''); }}>
              Cancel
            </Button>
          </div>
        )}

        {/* Newly created token — show once */}
        {revealedToken && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Token created — copy it now. It won't be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs bg-background rounded px-2 py-1.5 border border-border/60 break-all">
                {revealedVisible ? revealedToken : '••••••••••••••••••••••••••••••••••••••••'}
              </code>
              <button onClick={() => setRevealedVisible(v => !v)} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                {revealedVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => copyText(revealedToken, 'new')} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                {copiedId === 'new' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setRevealedToken(null); setRevealedVisible(false); }}>
              I've copied it — dismiss
            </Button>
          </div>
        )}

        {/* Token list */}
        {loading ? (
          <p className="text-xs text-muted-foreground py-2">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No API tokens yet. Create one to get started.</p>
        ) : (
          <div className="space-y-1.5">
            {tokens.map(token => (
              <div key={token.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 text-sm">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate">{token.name}</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {token.prefix}…
                  </span>
                </div>
                <div className="text-xs text-muted-foreground shrink-0 text-right">
                  {token.last_used_at
                    ? <span>Last used {format(new Date(token.last_used_at), 'MMM d')}</span>
                    : <span className="italic">Never used</span>}
                  <div>Created {format(new Date(token.created_at), 'MMM d, yyyy')}</div>
                </div>
                <button
                  onClick={() => handleRevoke(token.id, token.name)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Revoke token"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── JIRA Integration config section ──────────────────────────────────────────
function JiraConfigSection() {
  const [config, setConfig] = useState<{
    jira_url: string;
    jira_email: string;
    jira_token: string;
    jira_project_key: string;
    configured: boolean;
  }>({
    jira_url: '',
    jira_email: '',
    jira_token: '',
    jira_project_key: '',
    configured: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const loadConfig = () => {
    jiraApi.get()
      .then(r => {
        const data = r.data;
        setConfig({
          jira_url: data.jira_url || '',
          jira_email: data.jira_email || '',
          jira_token: data.configured ? '' : '',
          jira_project_key: data.jira_project_key || '',
          configured: data.configured,
        });
      })
      .catch(() => {/* not configured yet, leave defaults */})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadConfig(); }, []);

  const handleSave = async () => {
    if (!config.jira_url || !config.jira_email || !config.jira_token || !config.jira_project_key) {
      toast.error('All JIRA fields are required');
      return;
    }
    setSaving(true);
    try {
      await jiraApi.save({
        jira_url: config.jira_url,
        jira_email: config.jira_email,
        jira_token: config.jira_token,
        jira_project_key: config.jira_project_key,
      });
      toast.success('JIRA configuration saved');
      setConfig(prev => ({ ...prev, configured: true, jira_token: '' }));
    } catch {
      toast.error('Failed to save JIRA configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const r = await jiraApi.test();
      toast.success(`Connected as ${r.data.display_name} (${r.data.email})`);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Connection test failed';
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await jiraApi.remove();
      setConfig({ jira_url: '', jira_email: '', jira_token: '', jira_project_key: '', configured: false });
      toast.success('JIRA integration removed');
    } catch {
      toast.error('Failed to remove JIRA integration');
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardContent className="space-y-2 py-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {/* JIRA-style icon */}
              <svg className="h-4 w-4 text-[#0052CC]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 11.429 6.857 6.714A.571.571 0 0 1 7.27 5.77l4.3 4.3 4.3-4.3a.571.571 0 0 1 .414 1.072l-4.714 4.586zm0 5.714L6.857 12.43a.571.571 0 0 1 .413-.944l4.3 4.3 4.3-4.3a.571.571 0 1 1 .808.808l-4.714 4.848z" />
              </svg>
              JIRA Integration
            </CardTitle>
            <CardDescription className="mt-1">
              Connect your JIRA instance to create security issues directly from threat cards.
            </CardDescription>
          </div>
          {config.configured && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="h-3.5 w-3.5" />
              Connected
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              JIRA URL
            </label>
            <Input
              placeholder="https://yourcompany.atlassian.net"
              value={config.jira_url}
              onChange={e => setConfig(prev => ({ ...prev, jira_url: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Email
            </label>
            <Input
              type="email"
              placeholder="you@company.com"
              value={config.jira_email}
              onChange={e => setConfig(prev => ({ ...prev, jira_email: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              API Token
              {config.configured && (
                <span className="ml-2 text-[10px] text-muted-foreground font-normal normal-case tracking-normal">
                  (leave blank to keep existing token)
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder={config.configured ? '••••••••••••••••' : 'Your JIRA API token'}
                  value={config.jira_token}
                  onChange={e => setConfig(prev => ({ ...prev, jira_token: e.target.value }))}
                  className="h-9 text-sm pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center h-9 px-2.5 rounded-md border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground text-xs transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Get API token from Atlassian</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Default Project Key <span className="normal-case tracking-normal font-normal">(global fallback)</span>
            </label>
            <Input
              placeholder="SEC"
              value={config.jira_project_key}
              onChange={e => setConfig(prev => ({ ...prev, jira_project_key: e.target.value.toUpperCase() }))}
              className="h-9 text-sm w-40 font-mono"
              maxLength={20}
            />
            <p className="text-[11px] text-muted-foreground">
              Used when no product-level default is set. Products can override this in their settings (e.g. SEC, INFRA, OPS).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            className="h-8"
            onClick={handleSave}
            disabled={saving || (!config.jira_token && !config.configured)}
          >
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : 'Save'}
          </Button>
          {config.configured && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Testing…</> : 'Test Connection'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                onClick={handleRemove}
                disabled={removing}
              >
                {removing ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Removing…</> : <><Trash2 className="h-3.5 w-3.5 mr-1.5" />Remove</>}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Integrations tab ──────────────────────────────────────────────────────────
function CiCdDocsSection() {
  const [vcs, setVcs] = useState<'github' | 'gitlab' | 'azure' | 'jenkins' | 'bitbucket'>('github');
  const base = API_BASE_URL;
  const exampleProductId = '{product_id}';
  const statusEndpoint = `${base}/api/products/${exampleProductId}/security-status`;
  const markdownEndpoint = `${base}/api/products/${exampleProductId}/download/report.md`;

  const curlExample = `curl -s \\
  -H "Authorization: Bearer $THREATATLAS_TOKEN" \\
  "${base}/api/products/1/security-status?fail_on_critical=true&min_mitigation_ratio=0.7"`;

  const githubActionsExample = `- name: ThreatAtlas Security Gate
  id: threat_check
  run: |
    RESULT=$(curl -sf \\
      -H "Authorization: Bearer \${{ secrets.THREATATLAS_TOKEN }}" \\
      "${base}/api/products/\${{ vars.PRODUCT_ID }}/security-status?fail_on_critical=true&fail_on_unmitigated_high=true")
    echo "$RESULT" | jq .
    PASS=$(echo "$RESULT" | jq -r '.pass')
    if [ "$PASS" != "true" ]; then
      echo "Security gate failed:"
      echo "$RESULT" | jq -r '.failures[]'
      exit 1
    fi`;

  const exampleResponse = `{
  "product_id": 1,
  "product_name": "Payment Service",
  "generated_at": "2026-05-20T10:30:00Z",
  "thresholds": {
    "fail_on_critical": true,
    "fail_on_unmitigated_high": true,
    "min_mitigation_ratio": 0.7
  },
  "summary": {
    "total_threats": 18,
    "by_severity": { "critical": 0, "high": 3, "medium": 9, "low": 6, "unscored": 0 },
    "total_mitigations": 14,
    "active_mitigations": 13,
    "mitigated_threats": 13,
    "mitigation_ratio": 0.7222
  },
  "pass": true,
  "failures": []
}`;

  return (
    <div className="space-y-6">
      {/* Security Gate */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Security Gate Endpoint</CardTitle>
            <Badge variant="secondary" className="text-[10px] h-5">GET</Badge>
          </div>
          <CardDescription>
            Call this from your pipeline to check security posture. Returns JSON with a{' '}
            <code className="text-xs bg-muted px-1 rounded">pass</code> field you can use as a build gate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Endpoint</p>
            <div className="flex items-center gap-1 font-mono text-sm bg-muted/50 px-3 py-2 rounded-lg border border-border/60 break-all">
              <span className="text-primary font-semibold mr-1">GET</span>
              <span className="flex-1">/api/products/{exampleProductId}/security-status</span>
              <CopyButton text={statusEndpoint} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Query Parameters</p>
            <div className="rounded-lg border border-border/60 overflow-hidden text-xs">
              {[
                { param: 'fail_on_critical', type: 'boolean', default: 'false', desc: 'Fail if any critical-severity threats exist' },
                { param: 'fail_on_unmitigated_high', type: 'boolean', default: 'false', desc: 'Fail if high/critical threats have no active mitigation' },
                { param: 'min_mitigation_ratio', type: 'float', default: 'null', desc: 'Fail if mitigation ratio is below this threshold (0.0–1.0)' },
              ].map((row, i) => (
                <div key={row.param} className={`flex items-start gap-3 px-3 py-2 ${i % 2 === 0 ? 'bg-muted/20' : ''}`}>
                  <code className="font-mono text-primary w-44 shrink-0">{row.param}</code>
                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">{row.type}</Badge>
                  <span className="text-muted-foreground flex-1">{row.desc}</span>
                  <span className="text-muted-foreground/60 shrink-0">default: <code>{row.default}</code></span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">curl</p>
            <CodeBlock code={curlExample} language="bash" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">CI/CD Integration</p>
            {/* VCS platform tabs */}
            <div className="flex gap-1 mb-3 flex-wrap">
              {([
                { id: 'github',    label: 'GitHub Actions', logo: '/images/vcs/github.svg' },
                { id: 'gitlab',    label: 'GitLab CI',      logo: '/images/vcs/gitlab.svg' },
                { id: 'azure',     label: 'Azure DevOps',   logo: '/images/vcs/azure.svg' },
                { id: 'jenkins',   label: 'Jenkins',        logo: '/images/vcs/jenkins.svg' },
                { id: 'bitbucket', label: 'Bitbucket',      logo: '/images/vcs/bitbucket.svg' },
              ] as const).map(p => (
                <button key={p.id} onClick={() => setVcs(p.id)}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors ${vcs === p.id ? 'bg-primary/10 border-primary text-primary' : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'}`}>
                  <img src={p.logo} alt={p.label} className="h-4 w-4 object-contain" />
                  {p.label}
                </button>
              ))}
            </div>
            {vcs === 'github' && <CodeBlock code={githubActionsExample} language="yaml" />}
            {vcs === 'gitlab' && <CodeBlock language="yaml" code={`security-gate:
  stage: test
  script:
    - |
      RESULT=$(curl -sf
        -H "Authorization: Bearer $THREATATLAS_TOKEN"
        "${base}/api/products/$PRODUCT_ID/security-status?fail_on_critical=true&fail_on_unmitigated_high=true")
      echo "$RESULT" | jq .
      PASS=$(echo "$RESULT" | jq -r '.pass')
      if [ "$PASS" != "true" ]; then
        echo "Security gate failed:"
        echo "$RESULT" | jq -r '.failures[]'
        exit 1
      fi
  variables:
    PRODUCT_ID: "1"
  only:
    - main
    - merge_requests`} />}
            {vcs === 'azure' && <CodeBlock language="yaml" code={`- task: Bash@3
  displayName: 'ThreatAtlas Security Gate'
  inputs:
    targetType: inline
    script: |
      RESULT=$(curl -sf \\
        -H "Authorization: Bearer $(THREATATLAS_TOKEN)" \\
        "${base}/api/products/$(PRODUCT_ID)/security-status?fail_on_critical=true&fail_on_unmitigated_high=true")
      echo "$RESULT" | jq .
      PASS=$(echo "$RESULT" | jq -r '.pass')
      if [ "$PASS" != "true" ]; then
        echo "##vso[task.logissue type=error]Security gate failed"
        echo "$RESULT" | jq -r '.failures[]'
        exit 1
      fi`} />}
            {vcs === 'jenkins' && <CodeBlock language="groovy" code={`stage('ThreatAtlas Security Gate') {
    steps {
        script {
            def result = sh(
                script: """curl -sf \\
                    -H 'Authorization: Bearer \${THREATATLAS_TOKEN}' \\
                    '${base}/api/products/\${PRODUCT_ID}/security-status?fail_on_critical=true'""",
                returnStdout: true
            ).trim()
            def json = readJSON text: result
            if (!json.pass) {
                error "Security gate failed: \${json.failures}"
            }
        }
    }
}`} />}
            {vcs === 'bitbucket' && <CodeBlock language="yaml" code={`pipelines:
  default:
    - step:
        name: ThreatAtlas Security Gate
        script:
          - |
            RESULT=$(curl -sf
              -H "Authorization: Bearer $THREATATLAS_TOKEN"
              "${base}/api/products/$PRODUCT_ID/security-status?fail_on_critical=true")
            PASS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['pass'])")
            if [ "$PASS" != "True" ]; then
              echo "Security gate failed"
              exit 1
            fi`} />}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Example Response</p>
            <CodeBlock code={exampleResponse} language="json" />
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Authentication</p>
            <p>Generate a long-lived API token in the <strong>Access Tokens</strong> tab, store it as <code>THREATATLAS_TOKEN</code> in your CI secrets. The endpoint always returns HTTP 200 — check the <code className="bg-muted px-1 rounded">pass</code> field.</p>
          </div>
        </CardContent>
      </Card>

      {/* Markdown Report */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Markdown Report Export</CardTitle>
            <Badge variant="secondary" className="text-[10px] h-5">GET</Badge>
          </div>
          <CardDescription>
            Download the threat model report as Markdown for GitHub PRs, Confluence, or CI job summaries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-1 font-mono text-sm bg-muted/50 px-3 py-2 rounded-lg border border-border/60 break-all">
            <span className="text-primary font-semibold mr-1">GET</span>
            <span className="flex-1">/api/products/{exampleProductId}/download/report.md</span>
            <CopyButton text={markdownEndpoint} />
          </div>
          <CodeBlock
            language="bash"
            code={`# Post to GitHub Actions / GitLab CI job summary\ncurl -sf \\\n  -H "Authorization: Bearer $THREATATLAS_TOKEN" \\\n  "${base}/api/products/1/download/report.md" >> $GITHUB_STEP_SUMMARY\n\n# Azure DevOps — attach as artifact\ncurl -sf \\\n  -H "Authorization: Bearer $(THREATATLAS_TOKEN)" \\\n  "${base}/api/products/$(PRODUCT_ID)/download/report.md" > threat-model-report.md`}
          />
          <p className="text-xs text-muted-foreground">Also included in the ZIP bundle on the product page.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <Tabs defaultValue="tokens" className="w-full">
      <TabsList className="mb-6 h-10 p-1 bg-muted/40">
        <TabsTrigger value="tokens" className="gap-2 px-4">
          <KeyRound className="h-3.5 w-3.5" />
          Access Tokens
        </TabsTrigger>
        <TabsTrigger value="connections" className="gap-2 px-4">
          <Webhook className="h-3.5 w-3.5" />
          Connections
        </TabsTrigger>
        <TabsTrigger value="cicd" className="gap-2 px-4">
          <GitCommit className="h-3.5 w-3.5" />
          CI/CD
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tokens">
        <ApiTokensSection />
      </TabsContent>

      <TabsContent value="connections">
        <JiraConfigSection />
      </TabsContent>

      <TabsContent value="cicd">
        <CiCdDocsSection />
      </TabsContent>
    </Tabs>
  );
}

