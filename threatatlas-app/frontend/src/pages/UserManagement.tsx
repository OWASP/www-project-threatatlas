import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { UserPlus, Mail, Trash2, RefreshCw, Loader2, Pencil, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: 'admin' | 'standard' | 'read_only';
  is_active: boolean;
  created_at: string;
}

interface Invitation {
  id: number;
  email: string;
  role: 'admin' | 'standard' | 'read_only';
  invited_by: number;
  is_accepted: boolean;
  expires_at: string;
  created_at: string;
}

export default function UserManagement() {
  const { isAdmin, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'standard' | 'read_only'>('standard');
  const [inviteError, setInviteError] = useState<React.ReactNode>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'admin' | 'standard' | 'read_only'>('standard');
  const [createError, setCreateError] = useState<React.ReactNode>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Edit User State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'standard' | 'read_only'>('standard');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<React.ReactNode>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Delete User State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]); // navigate is stable and doesn't need to be in deps

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, invitationsRes] = await Promise.all([
        api.get('/users'),
        api.get('/invitations?include_expired=false&include_accepted=false'),
      ]);
      setUsers(usersRes.data);
      setInvitations(invitationsRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Failed to load user data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatError = (err: any): React.ReactNode => {
    const detail = err.response?.data?.detail;
    if (!detail) return 'An unexpected error occurred';
    
    if (typeof detail === 'string') return detail;
    
    if (Array.isArray(detail)) {
      return (
        <div className="space-y-1">
          <p className="font-semibold text-xs mb-1 opacity-80 flex items-center">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Please fix the following:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            {detail.map((d: any, i: number) => (
              <li key={i} className="leading-relaxed">
                <span className="font-bold uppercase tracking-tight text-[10px] bg-destructive/10 px-1 rounded mr-1">
                  {d.loc[d.loc.length - 1]}
                </span>
                {d.msg}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    
    return JSON.stringify(detail);
  };

  const handleInviteUser = async () => {
    setInviteError('');
    setInviteLoading(true);

    try {
      await api.post('/invitations', {
        email: inviteEmail,
        role: inviteRole,
      });

      // Reset form and close dialog
      setInviteEmail('');
      setInviteRole('standard');
      setInviteDialogOpen(false);
      toast.success('Invitation sent successfully.');

      // Reload data
      await loadData();
    } catch (err: any) {
      setInviteError(formatError(err));
      toast.error('Failed to send invitation.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleResendInvitation = async (id: number) => {
    try {
      await api.post(`/invitations/${id}/resend`);
      toast.success('Invitation email resent successfully.');
    } catch (err: any) {
      toast.error('Failed to resend invitation.');
    }
  };

  const handleCreateUser = async () => {
    setCreateError('');
    setCreateLoading(true);

    try {
      await api.post('/users', {
        username: createUsername,
        email: createEmail,
        full_name: createFullName || null,
        password: createPassword,
        role: createRole,
      });

      // Reset form and close dialog
      setCreateUsername('');
      setCreateEmail('');
      setCreateFullName('');
      setCreatePassword('');
      setCreateRole('standard');
      setCreateDialogOpen(false);
      toast.success('User created successfully.');

      // Reload data
      await loadData();
    } catch (err: any) {
      setCreateError(formatError(err));
      toast.error('Failed to create user.');
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditUsername(user.username || '');
    setEditEmail(user.email || '');
    setEditFullName(user.full_name || '');
    setEditPassword('');
    setEditRole(user.role);
    setEditIsActive(user.is_active);
    setEditError('');
    setEditDialogOpen(true);
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    
    setEditError('');
    setEditLoading(true);

    try {
      const updateData: any = {
        username: editUsername,
        email: editEmail,
        full_name: editFullName || null,
        role: editRole,
        is_active: editIsActive,
      };

      if (editPassword) {
        updateData.password = editPassword;
      }

      await api.put(`/users/${editingUser.id}`, updateData);

      setEditDialogOpen(false);
      setEditingUser(null);
      toast.success('User updated successfully.');
      await loadData();
    } catch (err: any) {
      setEditError(formatError(err));
      toast.error('Failed to update user.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      await api.delete(`/users/${userToDelete.id}`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      toast.success('User deleted successfully.');
      await loadData();
    } catch (err: any) {
      toast.error('Failed to delete user.');
    }
  };

  const handleRevokeInvitation = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) {
      return;
    }

    try {
      await api.delete(`/invitations/${id}`);
      toast.success('Invitation revoked successfully.');
      await loadData();
    } catch (err: any) {
      toast.error('Failed to revoke invitation.');
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'standard':
        return 'default';
      case 'read_only':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'standard':
        return 'Standard';
      case 'read_only':
        return 'Read-only';
      default:
        return role;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 mx-auto p-4 animate-fadeIn">
      <div className="flex items-center justify-end">
        <div className="flex gap-3">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline" className="shadow-md">
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="!max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a user account directly (no invitation email required)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="create-username">Username *</Label>
                  <Input
                    id="create-username"
                    value={createUsername}
                    onChange={(e) => setCreateUsername(e.target.value)}
                    placeholder="username"
                    required
                    disabled={createLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-email">Email Address *</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                    disabled={createLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-fullname">Full Name</Label>
                  <Input
                    id="create-fullname"
                    value={createFullName}
                    onChange={(e) => setCreateFullName(e.target.value)}
                    placeholder="John Doe"
                    disabled={createLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">Password *</Label>
                  <Input
                    id="create-password"
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    disabled={createLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-role">Role *</Label>
                  <Select
                    value={createRole}
                    onValueChange={(value: any) => setCreateRole(value)}
                    disabled={createLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin - Full access</SelectItem>
                      <SelectItem value="standard">Standard - Create & edit own resources</SelectItem>
                      <SelectItem value="read_only">Read-only - View only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {createError && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    {createError}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={createLoading || !createUsername || !createEmail || !createPassword}>
                  {createLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create User
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-md">
                <Mail className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Send an invitation email to add a new user to ThreatAtlas
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                    disabled={inviteLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value: any) => setInviteRole(value)}
                    disabled={inviteLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin - Full access</SelectItem>
                      <SelectItem value="standard">Standard - Create & edit own resources</SelectItem>
                      <SelectItem value="read_only">Read-only - View only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {inviteError && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    {inviteError}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                  disabled={inviteLoading}
                >
                  Cancel
                </Button>
                <Button onClick={handleInviteUser} disabled={inviteLoading || !inviteEmail}>
                  {inviteLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Active Users</CardTitle>
          <CardDescription>Users with active accounts in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 mb-3">
                <UserPlus className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-1">No users found</h3>
              <p className="text-sm text-muted-foreground">Invite users to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      {user.is_active ? (
                        <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--risk-low)' }} />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.full_name || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        {currentUser?.id !== user.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setUserToDelete(user);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            Invitations that have been sent but not yet accepted
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 mb-3">
                <Mail className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-1">No pending invitations</h3>
              <p className="text-sm text-muted-foreground">Send invitations to add new team members</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(invitation.role)}>
                        {getRoleLabel(invitation.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invitation.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invitation.expires_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendInvitation(invitation.id)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Resend
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeInvitation(invitation.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Revoke
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="!max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User: {editingUser?.username}</DialogTitle>
            <DialogDescription>
              Update user details or set a new password
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="username"
                disabled={editLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="user@example.com"
                disabled={editLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fullname">Full Name</Label>
              <Input
                id="edit-fullname"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="John Doe"
                disabled={editLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password</Label>
              <Input
                id="edit-password"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                disabled={editLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editRole}
                onValueChange={(value: any) => setEditRole(value)}
                disabled={editLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Full access</SelectItem>
                  <SelectItem value="standard">Standard - Create & edit own resources</SelectItem>
                  <SelectItem value="read_only">Read-only - View only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-active">Account Status</Label>
              <Select
                value={editIsActive ? 'active' : 'inactive'}
                onValueChange={(value) => setEditIsActive(value === 'active')}
                disabled={editLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active - User can log in</SelectItem>
                  <SelectItem value="inactive">Inactive - User is blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                {editError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingUser(null);
              }}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleEditUser} disabled={editLoading}>
              {editLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{userToDelete?.username}</strong>?
              <br /><br />
              This action cannot be undone. All associated data, including products, diagrams, and invitations, will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleDeleteUser();
              }}
              disabled={editLoading}
            >
              {editLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
