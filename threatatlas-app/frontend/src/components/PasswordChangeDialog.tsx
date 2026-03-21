import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Key, Loader2, Lock } from 'lucide-react';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';

interface PasswordChangeDialogProps {
  collapsed?: boolean;
}

export default function PasswordChangeDialog({ collapsed = false }: PasswordChangeDialogProps) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      await api.put('/users/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Close dialog after 2 seconds
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={collapsed ? "h-8 w-8 p-0" : "w-full justify-start"}>
          <Key className={`h-4 w-4 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && "Change Password"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Update your account password. Make sure to use a strong password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="current-password">Current Password *</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Lock className="h-4 w-4" />
                </InputGroupAddon>
                <InputGroupInput
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  disabled={loading}
                />
              </InputGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor="new-password">New Password *</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Lock className="h-4 w-4" />
                </InputGroupAddon>
                <InputGroupInput
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  disabled={loading}
                />
              </InputGroup>
              <FieldError>{error.includes('New password') ? error : ''}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="confirm-password">Confirm New Password *</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Lock className="h-4 w-4" />
                </InputGroupAddon>
                <InputGroupInput
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  disabled={loading}
                />
              </InputGroup>
            </Field>

            {error && !error.includes('New password') && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20 animate-in fade-in zoom-in duration-200">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-600 bg-green-50/50 p-3 rounded-lg border border-green-200/50 animate-in fade-in zoom-in duration-200">
                Password changed successfully!
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                'Change Password'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
