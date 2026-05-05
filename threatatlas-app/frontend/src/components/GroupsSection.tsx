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
import { Loader2, Pencil, Plus, Trash2, Users, UserMinus, UserPlus2 } from 'lucide-react';
import { groupsApi, api, type Group, type GroupDetail, type UserRole } from '@/lib/api';

interface UserRow {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: UserRole;
}

const roleBadge = (role: UserRole): 'destructive' | 'default' | 'secondary' => {
  if (role === 'admin') return 'destructive';
  if (role === 'standard') return 'default';
  return 'secondary';
};

const emptyForm = { name: '', description: '', role: 'standard' as UserRole };

export default function GroupsSection() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [membersOpen, setMembersOpen] = useState(false);
  const [membersGroup, setMembersGroup] = useState<GroupDetail | null>(null);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [memberSaving, setMemberSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await groupsApi.list();
      setGroups(res.data);
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
    setEditorOpen(true);
  };

  const openEdit = (g: Group) => {
    setEditingId(g.id);
    setForm({ name: g.name, description: g.description ?? '', role: g.role });
    setError(null);
    setEditorOpen(true);
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
        await groupsApi.create({
          name: form.name,
          description: form.description || null,
          role: form.role,
        });
      } else {
        await groupsApi.update(editingId, {
          name: form.name,
          description: form.description || null,
          role: form.role,
        });
      }
      setEditorOpen(false);
      await load();
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g: Group) => {
    if (!confirm(`Delete group "${g.name}"? Members won't be deleted — they just lose this group's role grant.`)) return;
    try {
      await groupsApi.delete(g.id);
      await load();
    } catch (err: any) {
      alert(extractError(err));
    }
  };

  const openMembers = async (g: Group) => {
    const [detail, usersRes] = await Promise.all([groupsApi.get(g.id), api.get<UserRow[]>('/users')]);
    setMembersGroup(detail.data);
    setAllUsers(usersRes.data);
    setMembersOpen(true);
  };

  const toggleMember = async (userId: number) => {
    if (!membersGroup) return;
    setMemberSaving(true);
    try {
      const isMember = membersGroup.members.some((m) => m.id === userId);
      const res = isMember
        ? await groupsApi.removeMember(membersGroup.id, userId)
        : await groupsApi.addMember(membersGroup.id, userId);
      setMembersGroup(res.data);
    } finally {
      setMemberSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Groups
          </CardTitle>
          <CardDescription>
            Grant roles to users via group membership. A user's effective role is the most permissive
            between their direct role and any group they belong to.
          </CardDescription>
        </div>
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="!max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingId === null ? 'Create Group' : 'Edit Group'}</DialogTitle>
              <DialogDescription>
                A group is a named bucket of users sharing a role. SCIM sync populates groups
                automatically from your IdP.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="g-name">Name *</Label>
                <Input
                  id="g-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Threat Modelers"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-desc">Description</Label>
                <Input
                  id="g-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-role">Role granted *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as UserRole })}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — full access</SelectItem>
                    <SelectItem value="standard">Standard — create & edit own resources</SelectItem>
                    <SelectItem value="read_only">Read-only — view only</SelectItem>
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
              <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving || !form.name}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId === null ? 'Create' : 'Save'}
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
        ) : groups.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No groups yet. Create one above or let SCIM sync populate them from your IdP.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {g.description || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleBadge(g.role)}>{g.role}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {g.scim_external_id ? (
                      <Badge variant="outline">SCIM</Badge>
                    ) : (
                      <span>local</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openMembers(g)}>
                        <Users className="h-4 w-4 mr-2" />
                        Members
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(g)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(g)}
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

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="!max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Members of {membersGroup?.name}</DialogTitle>
            <DialogDescription>
              Click a user to add or remove them from this group. Changes apply immediately.
            </DialogDescription>
          </DialogHeader>
          {membersGroup && (
            <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
              {allUsers.map((u) => {
                const isMember = membersGroup.members.some((m) => m.id === u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={memberSaving}
                    onClick={() => toggleMember(u.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                      isMember
                        ? 'bg-primary/5 border-primary/40 hover:bg-primary/10'
                        : 'border-border/60 hover:bg-muted/40'
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-medium">{u.full_name || u.username}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    {isMember ? (
                      <span className="flex items-center text-sm text-primary">
                        <UserMinus className="h-4 w-4 mr-1" />
                        Member
                      </span>
                    ) : (
                      <span className="flex items-center text-sm text-muted-foreground">
                        <UserPlus2 className="h-4 w-4 mr-1" />
                        Add
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setMembersOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
