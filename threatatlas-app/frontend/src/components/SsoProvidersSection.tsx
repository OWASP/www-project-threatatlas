import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import { ssoApi, type SsoProvider } from '@/lib/api';

const emptyForm = {
  name: '',
  display_name: '',
  issuer: '',
  metadata_url: '',
  client_id: '',
  client_secret: '',
  scopes: 'openid email profile',
  is_enabled: true,
};

export default function SsoProvidersSection() {
  const [providers, setProviders] = useState<SsoProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ssoApi.list();
      setProviders(res.data);
    } catch (err) {
      console.error('Failed to load SSO providers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (provider: SsoProvider) => {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      display_name: provider.display_name,
      issuer: provider.issuer,
      metadata_url: provider.metadata_url ?? '',
      client_id: provider.client_id,
      client_secret: '',
      scopes: provider.scopes,
      is_enabled: provider.is_enabled,
    });
    setError(null);
    setDialogOpen(true);
  };

  const extractError = (err: any): string => {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: any) => `${d.loc?.[d.loc.length - 1] ?? ''}: ${d.msg}`).join(' | ');
    }
    return 'An unexpected error occurred';
  };

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      if (editingId === null) {
        await ssoApi.create({
          name: form.name,
          display_name: form.display_name,
          issuer: form.issuer,
          metadata_url: form.metadata_url || null,
          client_id: form.client_id,
          client_secret: form.client_secret,
          scopes: form.scopes || undefined,
          is_enabled: form.is_enabled,
        });
      } else {
        await ssoApi.update(editingId, {
          display_name: form.display_name,
          issuer: form.issuer,
          metadata_url: form.metadata_url || null,
          client_id: form.client_id,
          client_secret: form.client_secret ? form.client_secret : undefined,
          scopes: form.scopes,
          is_enabled: form.is_enabled,
        });
      }
      setDialogOpen(false);
      await load();
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (provider: SsoProvider) => {
    if (!confirm(`Delete OIDC provider "${provider.display_name}"?`)) return;
    try {
      await ssoApi.delete(provider.id);
      await load();
    } catch (err: any) {
      alert(extractError(err));
    }
  };

  const isCreate = editingId === null;
  const canSubmit =
    form.display_name &&
    form.issuer &&
    form.client_id &&
    (isCreate ? form.name && form.client_secret : true);

  return (
    <Card>
      <CardHeader className="border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            SSO Providers
          </CardTitle>
          <CardDescription>
            OIDC identity providers available on the login screen. Callback URL:{' '}
            <code className="text-xs">/api/auth/oidc/&#123;name&#125;/callback</code>
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="!max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isCreate ? 'Add OIDC Provider' : 'Edit OIDC Provider'}</DialogTitle>
              <DialogDescription>
                {isCreate
                  ? 'Register a new OIDC identity provider (EntraID, Okta, Keycloak, Ping, etc.)'
                  : 'Update provider configuration. Leave the client secret blank to keep the existing value.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sso-name">Name (slug) *</Label>
                <Input
                  id="sso-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="entraid, okta, keycloak"
                  disabled={!isCreate || saving}
                />
                <p className="text-xs text-muted-foreground">
                  Used in the callback URL. Lowercase, digits, '-' and '_'. Immutable after creation.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sso-display">Display name *</Label>
                <Input
                  id="sso-display"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="Microsoft Entra ID"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sso-issuer">Issuer URL *</Label>
                <Input
                  id="sso-issuer"
                  value={form.issuer}
                  onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                  placeholder="https://login.microsoftonline.com/<tenant-id>/v2.0"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Discovery document will be fetched from{' '}
                  <code>&#123;issuer&#125;/.well-known/openid-configuration</code>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sso-metadata">Discovery URL (optional)</Label>
                <Input
                  id="sso-metadata"
                  value={form.metadata_url}
                  onChange={(e) => setForm({ ...form, metadata_url: e.target.value })}
                  placeholder="Leave blank to derive from issuer"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Override the .well-known URL when the IdP is reachable at a different host
                  from the backend than the issuer claim (e.g. docker-net internal hostname).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sso-client-id">Client ID *</Label>
                <Input
                  id="sso-client-id"
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sso-client-secret">
                  Client Secret {isCreate && '*'}
                </Label>
                <Input
                  id="sso-client-secret"
                  type="password"
                  value={form.client_secret}
                  onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                  placeholder={isCreate ? '' : 'Leave blank to keep current secret'}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sso-scopes">Scopes</Label>
                <Input
                  id="sso-scopes"
                  value={form.scopes}
                  onChange={(e) => setForm({ ...form, scopes: e.target.value })}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sso-enabled">Status</Label>
                <Select
                  value={form.is_enabled ? 'enabled' : 'disabled'}
                  onValueChange={(v) => setForm({ ...form, is_enabled: v === 'enabled' })}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enabled">Enabled — shown on login</SelectItem>
                    <SelectItem value="disabled">Disabled — hidden from login</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                  {error}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving || !canSubmit}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : isCreate ? (
                  'Add Provider'
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : providers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No SSO providers configured. Click "Add Provider" to connect an identity provider.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead>Client ID</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.is_enabled ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.name}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{p.display_name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[280px] truncate" title={p.issuer}>
                    {p.issuer}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate" title={p.client_id}>
                    {p.client_id}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(p)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
