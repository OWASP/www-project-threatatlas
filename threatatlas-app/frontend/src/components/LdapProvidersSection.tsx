import { useEffect, useState } from 'react';
import { CheckCircle2, DatabaseZap, Loader2, Pencil, Plus, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ldapApi, type LDAPEncryption, type LDAPProvider } from '@/lib/api';

const emptyForm = {
  name: '',
  display_name: '',
  host: '',
  port: 636,
  encryption: 'simple_tls' as LDAPEncryption,
  verify_cert: true,
  bind_dn: '',
  bind_password: '',
  user_base_dn: '',
  user_filter: '(uid={username})',
  username_attribute: 'uid',
  email_attribute: 'mail',
  display_name_attribute: 'cn',
  active_directory: false,
  auto_create_users: true,
  is_enabled: true,
};

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return 'LDAP operation failed';
}

export default function LdapProvidersSection() {
  const [providers, setProviders] = useState<LDAPProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setProviders((await ldapApi.list()).data);
    } catch (loadError) {
      toast.error(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (provider: LDAPProvider) => {
    setEditingId(provider.id);
    setForm({ ...provider, bind_password: '' });
    setError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editingId === null) {
        await ldapApi.create(form);
      } else {
        const { bind_password, ...data } = form;
        const { name: _name, ...updateData } = data;
        void _name;
        await ldapApi.update(editingId, {
          ...updateData,
          bind_password: bind_password || undefined,
        });
      }
      setDialogOpen(false);
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const test = async (provider: LDAPProvider) => {
    setTestingId(provider.id);
    try {
      const response = await ldapApi.test(provider.id);
      toast.success(response.data.message);
    } catch (testError) {
      toast.error(errorMessage(testError));
    } finally {
      setTestingId(null);
    }
  };

  const remove = async (provider: LDAPProvider) => {
    if (!confirm(`Delete LDAP provider "${provider.display_name}"? Providers with linked users must be disabled instead.`)) return;
    try {
      await ldapApi.delete(provider.id);
      await load();
    } catch (deleteError) {
      toast.error(errorMessage(deleteError));
    }
  };

  const isCreate = editingId === null;
  const canSubmit = form.name && form.display_name && form.host && form.bind_dn && form.user_base_dn
    && form.user_filter.includes('{username}') && (isCreate ? form.bind_password : true);

  return (
    <Card>
      <CardHeader className="border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><DatabaseZap className="h-5 w-5" />LDAP / Active Directory</CardTitle>
          <CardDescription>Direct directory authentication. Use SCIM separately for group provisioning.</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add LDAP</Button></DialogTrigger>
          <DialogContent className="!max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isCreate ? 'Add LDAP Provider' : 'Edit LDAP Provider'}</DialogTitle>
              <DialogDescription>Configure the service bind used to find a user before ThreatAtlas verifies the user password with a separate bind.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2"><Label htmlFor="ldap-name">Name *</Label><Input id="ldap-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="corporate-ad" disabled={!isCreate || saving} /></div>
              <div className="space-y-2"><Label htmlFor="ldap-display">Display name *</Label><Input id="ldap-display" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Corporate Active Directory" disabled={saving} /></div>
              <div className="space-y-2"><Label htmlFor="ldap-host">Host *</Label><Input id="ldap-host" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="ad.example.internal" disabled={saving} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2"><Label htmlFor="ldap-port">Port *</Label><Input id="ldap-port" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} disabled={saving} /></div>
                <div className="space-y-2"><Label>Encryption</Label><Select value={form.encryption} onValueChange={(value: LDAPEncryption) => setForm({ ...form, encryption: value })} disabled={saving}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="simple_tls">LDAPS</SelectItem><SelectItem value="start_tls">STARTTLS</SelectItem><SelectItem value="plain">Plain (test only)</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-2 col-span-2"><Label htmlFor="ldap-bind-dn">Service bind DN *</Label><Input id="ldap-bind-dn" value={form.bind_dn} onChange={(e) => setForm({ ...form, bind_dn: e.target.value })} placeholder="CN=svc-threatatlas,OU=Service Accounts,DC=example,DC=internal" disabled={saving} /></div>
              <div className="space-y-2 col-span-2"><Label htmlFor="ldap-bind-password">Service bind password {isCreate && '*'}</Label><Input id="ldap-bind-password" type="password" value={form.bind_password} onChange={(e) => setForm({ ...form, bind_password: e.target.value })} placeholder={isCreate ? '' : 'Leave blank to keep current password'} disabled={saving} /></div>
              <div className="space-y-2 col-span-2"><Label htmlFor="ldap-user-base">User base DN *</Label><Input id="ldap-user-base" value={form.user_base_dn} onChange={(e) => setForm({ ...form, user_base_dn: e.target.value })} placeholder="OU=Users,DC=example,DC=internal" disabled={saving} /></div>
              <div className="space-y-2 col-span-2"><Label htmlFor="ldap-filter">User filter *</Label><Input id="ldap-filter" value={form.user_filter} onChange={(e) => setForm({ ...form, user_filter: e.target.value })} placeholder="(sAMAccountName={username})" disabled={saving} /><p className="text-xs text-muted-foreground">Must contain exactly one <code>{'{username}'}</code>; input is LDAP-filter escaped.</p></div>
              <div className="space-y-2"><Label htmlFor="ldap-username-attr">Username attribute</Label><Input id="ldap-username-attr" value={form.username_attribute} onChange={(e) => setForm({ ...form, username_attribute: e.target.value })} disabled={saving} /></div>
              <div className="space-y-2"><Label htmlFor="ldap-email-attr">Email attribute</Label><Input id="ldap-email-attr" value={form.email_attribute} onChange={(e) => setForm({ ...form, email_attribute: e.target.value })} disabled={saving} /></div>
              <div className="space-y-2"><Label htmlFor="ldap-name-attr">Display-name attribute</Label><Input id="ldap-name-attr" value={form.display_name_attribute} onChange={(e) => setForm({ ...form, display_name_attribute: e.target.value })} disabled={saving} /></div>
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between"><Label htmlFor="ldap-ad">Active Directory checks</Label><Switch id="ldap-ad" checked={form.active_directory} onCheckedChange={(checked) => setForm({ ...form, active_directory: checked })} /></div>
                <div className="flex items-center justify-between"><Label htmlFor="ldap-create">Auto-create users</Label><Switch id="ldap-create" checked={form.auto_create_users} onCheckedChange={(checked) => setForm({ ...form, auto_create_users: checked })} /></div>
                <div className="flex items-center justify-between"><Label htmlFor="ldap-enabled">Enabled on login</Label><Switch id="ldap-enabled" checked={form.is_enabled} onCheckedChange={(checked) => setForm({ ...form, is_enabled: checked })} /></div>
                <div className="flex items-center justify-between"><Label htmlFor="ldap-verify">Verify TLS certificate</Label><Switch id="ldap-verify" checked={form.verify_cert} onCheckedChange={(checked) => setForm({ ...form, verify_cert: checked })} disabled={form.encryption === 'plain'} /></div>
              </div>
            </div>
            {form.encryption === 'plain' && <p className="text-sm text-destructive">Plain LDAP exposes credentials on the network. Use only for an isolated local test.</p>}
            {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">{error}</div>}
            <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button onClick={save} disabled={!canSubmit || saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{isCreate ? 'Add Provider' : 'Save Changes'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : providers.length === 0 ? <p className="text-sm text-muted-foreground p-6">No LDAP providers configured.</p> : (
          <Table><TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Directory</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{providers.map((provider) => (
            <TableRow key={provider.id}>
              <TableCell><div className="font-medium">{provider.display_name}</div><code className="text-xs text-muted-foreground">{provider.name}</code></TableCell>
              <TableCell><code className="text-xs">{provider.host}:{provider.port}</code><div className="text-xs text-muted-foreground truncate max-w-64">{provider.user_base_dn}</div></TableCell>
              <TableCell><Badge variant="outline">{provider.active_directory ? 'Active Directory' : 'LDAP'}</Badge><div className="text-xs text-muted-foreground mt-1">{provider.encryption}</div></TableCell>
              <TableCell>{provider.is_enabled ? <span className="inline-flex items-center gap-1 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Enabled</span> : <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><XCircle className="h-4 w-4" />Disabled</span>}</TableCell>
              <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => test(provider)} disabled={testingId === provider.id}>{testingId === provider.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}</Button><Button variant="ghost" size="icon" onClick={() => openEdit(provider)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(provider)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
            </TableRow>
          ))}</TableBody></Table>
        )}
      </CardContent>
    </Card>
  );
}
