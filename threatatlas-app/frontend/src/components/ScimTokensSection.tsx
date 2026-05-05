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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { scimTokensApi, type ScimToken } from '@/lib/api';

export default function ScimTokensSection() {
  const [tokens, setTokens] = useState<ScimToken[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const [revealOpen, setRevealOpen] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await scimTokensApi.list();
      setTokens(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await scimTokensApi.create(name);
      setRevealedToken(res.data.token);
      setName('');
      setCreateOpen(false);
      setRevealOpen(true);
      await load();
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Failed to create token');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (t: ScimToken) => {
    if (!confirm(`Revoke token "${t.name}"? The IdP using it will stop syncing immediately.`)) return;
    await scimTokensApi.revoke(t.id);
    await load();
  };

  const copy = async () => {
    if (revealedToken) await navigator.clipboard.writeText(revealedToken);
  };

  const scimBase = `${window.location.protocol}//${window.location.hostname}:8000/scim/v2`;

  return (
    <Card>
      <CardHeader className="border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            SCIM Tokens
          </CardTitle>
          <CardDescription>
            Bearer tokens used by your IdP to push users/groups via SCIM 2.0.
            <br />
            Endpoint: <code className="text-xs">{scimBase}</code>
          </CardDescription>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Token
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate SCIM Token</DialogTitle>
              <DialogDescription>
                The plaintext token is shown exactly once. Save it in your IdP configuration
                immediately — we only store a hash.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="token-name">Label *</Label>
              <Input
                id="token-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Keycloak SCIM, Okta production, ..."
                disabled={saving}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving || !name}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate
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
        ) : tokens.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No SCIM tokens. Generate one to let an IdP push users/groups.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.last_used_at ? new Date(t.last_used_at).toLocaleString() : 'never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRevoke(t)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your SCIM token now</DialogTitle>
            <DialogDescription>
              This is the only time you'll see the plaintext. If you lose it, revoke and generate a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 rounded-lg bg-muted text-xs font-mono break-all">
                {revealedToken}
              </code>
              <Button variant="outline" size="sm" onClick={copy}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
