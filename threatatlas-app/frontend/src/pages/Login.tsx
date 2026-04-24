import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Network, KeyRound } from 'lucide-react';
import { authApi, oidcLoginUrl, type OIDCProviderInfo } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<OIDCProviderInfo[]>([]);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const callbackError = searchParams.get('error');
    if (callbackError) {
      setError(`Single sign-on failed: ${callbackError}`);
    }

    authApi
      .listOidcProviders()
      .then((res) => setProviders(res.data))
      .catch(() => setProviders([]));
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = (provider: OIDCProviderInfo) => {
    window.location.href = oidcLoginUrl(provider.login_url);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-lg shadow-lg border-border/60 rounded-2xl">
        <CardHeader className="space-y-2 text-center pt-8 pb-6">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
              <Network className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Welcome to ThreatAtlas</CardTitle>
          <CardDescription className="text-base">Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                className="h-11 rounded-lg border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
                className="h-11 rounded-lg border-border/60"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3.5 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full h-11 shadow-md hover:shadow-lg transition-all" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {providers.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="relative flex items-center">
                <div className="flex-grow border-t border-border/60" />
                <span className="mx-3 text-xs uppercase tracking-wider text-muted-foreground">or continue with</span>
                <div className="flex-grow border-t border-border/60" />
              </div>
              <div className="grid gap-2">
                {providers.map((provider) => (
                  <Button
                    key={provider.name}
                    type="button"
                    variant="outline"
                    className="w-full h-11 rounded-lg justify-center gap-2"
                    onClick={() => handleSsoLogin(provider)}
                    disabled={loading}
                  >
                    <KeyRound className="h-4 w-4" />
                    {provider.display_name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Don't have an account? Contact your administrator for an invitation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
