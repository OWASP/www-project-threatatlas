import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface InvitationDetails {
  id: number;
  email: string;
  role: 'admin' | 'standard' | 'read_only';
  invited_by: number;
  is_accepted: boolean;
  expires_at: string;
  created_at: string;
  inviter_name?: string;
  inviter_email?: string;
}

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      const response = await api.get(`/invitations/${token}`);
      setInvitation(response.data);

      // Check if already accepted
      if (response.data.is_accepted) {
        setError('This invitation has already been used. Please login instead.');
      }

      // Check if expired
      const expiresAt = new Date(response.data.expires_at);
      if (expiresAt < new Date()) {
        setError('This invitation has expired. Please contact an administrator for a new invitation.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired invitation link.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);

    try {
      // Accept invitation
      await api.post(`/invitations/${token}/accept`, {
        username,
        password,
        full_name: fullName || null,
      });

      // Auto-login
      await login(invitation!.email, password);

      // Redirect to dashboard
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create account. Please try again.');
      setSubmitting(false);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md shadow-lg border-border/60 rounded-2xl">
        <CardHeader className="space-y-2 text-center pt-8 pb-6">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
              <UserPlus className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Welcome to ThreatAtlas!</CardTitle>
          {invitation && !error && (
            <CardDescription className="text-base">
              You've been invited by <span className="font-semibold text-foreground">{invitation.inviter_name || invitation.inviter_email}</span>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pb-8">
          {error ? (
            <div className="space-y-4">
              <div className="text-sm text-destructive bg-destructive/10 p-3.5 rounded-lg border border-destructive/20">
                {error}
              </div>
              <Button
                onClick={() => navigate('/login')}
                className="w-full h-11"
              >
                Go to Login
              </Button>
            </div>
          ) : invitation ? (
            <>
              <div className="mb-6 p-4 bg-muted/40 rounded-lg border border-border/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-muted-foreground">Email</span>
                  <span className="text-sm font-medium">{invitation.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Role</span>
                  <Badge variant={getRoleBadgeVariant(invitation.role)}>
                    {getRoleLabel(invitation.role)}
                  </Badge>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-semibold">Username *</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    required
                    disabled={submitting}
                    className="h-11 rounded-lg border-border/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-semibold">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name (optional)"
                    disabled={submitting}
                    className="h-11 rounded-lg border-border/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    disabled={submitting}
                    className="h-11 rounded-lg border-border/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    disabled={submitting}
                    className="h-11 rounded-lg border-border/60"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 shadow-md hover:shadow-lg transition-all"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    'Accept Invitation & Create Account'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                <p className="text-muted-foreground">
                  Already have an account?{' '}
                  <a href="/login" className="text-primary hover:underline font-semibold transition-all">
                    Sign in
                  </a>
                </p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
