import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collaboratorsApi, productsApi, api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Share2, UserPlus, Trash2, Loader2, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Collaborator {
  id: number;
  product_id: number;
  user_id: number;
  role: 'owner' | 'editor' | 'viewer';
  added_by: number;
  added_at: string;
  user_email: string;
  user_username: string;
  user_full_name: string | null;
  added_by_username: string;
}

interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: 'admin' | 'standard' | 'read_only';
}

interface ShareProductDialogProps {
  productId: number;
  productName: string;
  isPublic?: boolean;
  onProductUpdate?: () => void;
  trigger?: React.ReactNode;
}

export default function ShareProductDialog({ productId, productName, isPublic: initialIsPublic = false, onProductUpdate, trigger }: ShareProductDialogProps) {
  const { user: currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(initialIsPublic);

  // Add collaborator form
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'owner' | 'editor' | 'viewer'>('viewer');
  const [error, setError] = useState('');

  // Remove confirmation
  const [removeCollaborator, setRemoveCollaborator] = useState<Collaborator | null>(null);

  useEffect(() => {
    setIsPublic(initialIsPublic);
  }, [initialIsPublic]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, productId]);

  const handleToggleVisibility = async (newIsPublic: boolean) => {
    setVisibilityLoading(true);
    try {
      await productsApi.update(productId, { is_public: newIsPublic });
      setIsPublic(newIsPublic);
      onProductUpdate?.();
      toast.success(newIsPublic ? 'Product is now public' : 'Product is now private');
    } catch {
      toast.error('Failed to update visibility');
    } finally {
      setVisibilityLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [collabRes, usersRes] = await Promise.all([
        collaboratorsApi.list(productId),
        api.get('/users'), // Get all users
      ]);
      setCollaborators(collabRes.data);
      setAllUsers(usersRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Failed to load collaborators');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }

    setError('');
    setAddLoading(true);

    try {
      await collaboratorsApi.add(productId, {
        user_id: parseInt(selectedUserId),
        role: selectedRole,
      });

      // Reset form
      setSelectedUserId('');
      setSelectedRole('viewer');

      // Reload collaborators
      await loadData();
      toast.success('Collaborator added successfully');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add collaborator');
      toast.error('Failed to add collaborator');
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdateRole = async (userId: number, newRole: 'owner' | 'editor' | 'viewer') => {
    try {
      await collaboratorsApi.update(productId, userId, { role: newRole });
      await loadData();
      toast.success('Role updated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleRemoveCollaborator = async () => {
    if (!removeCollaborator) return;

    try {
      await collaboratorsApi.remove(productId, removeCollaborator.user_id);
      setRemoveCollaborator(null);
      await loadData();
      toast.success('Collaborator removed');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to remove collaborator');
    }
  };


  // Filter out users who are already collaborators
  const availableUsers = allUsers.filter(
    (user) => !collaborators.some((collab) => collab.user_id === user.id) && user.id !== currentUser?.id
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="!max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share Product</DialogTitle>
            <DialogDescription>
              Manage who can access and edit "{productName}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Visibility */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Visibility</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={visibilityLoading}
                  onClick={() => !isPublic || handleToggleVisibility(false)}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors disabled:opacity-50 ${
                    !isPublic
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/50 cursor-pointer'
                  }`}
                >
                  <Lock className="h-4 w-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">Private</div>
                    <div className="text-xs text-muted-foreground">Only shared users</div>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={visibilityLoading}
                  onClick={() => isPublic || handleToggleVisibility(true)}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors disabled:opacity-50 ${
                    isPublic
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/50 cursor-pointer'
                  }`}
                >
                  <Globe className="h-4 w-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">Public</div>
                    <div className="text-xs text-muted-foreground">All users can view</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Add Collaborator Form */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-sm">Add Collaborator</h3>
              <div className="grid gap-4">
                <Field>
                  <FieldLabel htmlFor="user">User</FieldLabel>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger id="user">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">No available users</div>
                      ) : (
                        availableUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.full_name || user.username} ({user.email})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="role">Role</FieldLabel>
                  <Select value={selectedRole} onValueChange={(value: any) => setSelectedRole(value)}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner - Can manage collaborators and edit</SelectItem>
                      <SelectItem value="editor">Editor - Can edit product and diagrams</SelectItem>
                      <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    {error}
                  </div>
                )}

                <Button onClick={handleAddCollaborator} disabled={addLoading || !selectedUserId}>
                  {addLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Collaborator
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Collaborators List */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Collaborators ({collaborators.length})</h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : collaborators.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg border-dashed">
                  No collaborators yet. Add someone to share this product.
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collaborators.map((collab) => (
                        <TableRow key={collab.id}>
                          <TableCell className="font-medium">
                            {collab.user_full_name || collab.user_username}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {collab.user_email}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={collab.role}
                              onValueChange={(value: any) => handleUpdateRole(collab.user_id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="owner">Owner</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRemoveCollaborator(collab)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Collaborator Confirmation */}
      <AlertDialog open={!!removeCollaborator} onOpenChange={() => setRemoveCollaborator(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Collaborator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{removeCollaborator?.user_full_name || removeCollaborator?.user_username}</strong>{' '}
              from this product? They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveCollaborator}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
