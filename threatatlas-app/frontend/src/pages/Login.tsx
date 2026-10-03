import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Network, AlertCircle, Loader2, KeyRound, Eye, EyeOff, ShieldCheck, Users } from 'lucide-react';
import { authApi, oidcLoginUrl, type LDAPProviderInfo, type OIDCProviderInfo } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ldapUsername, setLdapUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [oidcProviders, setOidcProviders] = useState<OIDCProviderInfo[]>([]);
  const [ldapProviders, setLdapProviders] = useState<LDAPProviderInfo[]>([]);
  const [selectedLdap, setSelectedLdap] = useState<LDAPProviderInfo | null>(null);
  const { login, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const callbackError = searchParams.get('error');
    if (callbackError) {
      setError(`Single sign-on failed: ${callbackError}`);
    }

    Promise.allSettled([authApi.listOidcProviders(), authApi.listLdapProviders()]).then(([oidc, ldap]) => {
      setOidcProviders(oidc.status === 'fulfilled' ? oidc.value.data : []);
      setLdapProviders(ldap.status === 'fulfilled' ? ldap.value.data : []);
    });
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (selectedLdap) {
        const response = await authApi.loginLdap(selectedLdap.name, ldapUsername, password);
        await loginWithToken(response.data.access_token);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(typeof detail === 'string' ? detail : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = (provider: OIDCProviderInfo) => {
    window.location.href = oidcLoginUrl(provider.login_url);
  };

  const hasAlternatives = oidcProviders.length > 0 || ldapProviders.length > 0;

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-background">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-primary text-primary-foreground p-12 xl:p-14">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div aria-hidden className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div aria-hidden className="absolute -right-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-primary-foreground/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/15 ring-1 ring-primary-foreground/25">
            <Network className="h-6 w-6" />
          </div>
          <span className="text-lg font-semibold tracking-tight">OWASP ThreatAtlas</span>
        </div>

        <div className="relative">
          <div className="max-w-lg space-y-4">
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1]">
              Threat modeling, made collaborative.
            </h1>
            <p className="text-base xl:text-lg text-primary-foreground/75 leading-relaxed">
              Map your system, find what can go wrong, and agree on what to do about it, together.
            </p>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-primary-foreground/80">
          {[
            [ShieldCheck, 'Risk and approvals'],
            [Users, 'Team review'],
          ].map(([Icon, text], i) => {
            const I = Icon as typeof Network;
            return (
              <span key={i} className="flex items-center gap-2">
                <I className="h-4 w-4" />
                {text as string}
              </span>
            );
          })}
          <a
            href="https://owasp.org/www-project-threatatlas/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto underline underline-offset-4 text-primary-foreground/70 hover:text-primary-foreground"
          >
            OWASP project
          </a>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Network className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">OWASP ThreatAtlas</span>
          </div>

          <div className="mb-8 space-y-1.5">
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground">
              {selectedLdap
                ? `Sign in with your ${selectedLdap.display_name} credentials.`
                : 'Sign in to your account to continue.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="login-identifier" className="text-sm font-medium">
                {selectedLdap ? 'Directory username' : 'Email'}
              </Label>
              <Input
                id="login-identifier"
                type={selectedLdap ? 'text' : 'email'}
                autoComplete="username"
                value={selectedLdap ? ldapUsername : email}
                onChange={(e) => (selectedLdap ? setLdapUsername(e.target.value) : setEmail(e.target.value))}
                placeholder={selectedLdap ? 'e.g. jdoe' : 'you@example.com'}
                required
                disabled={loading}
                className="h-11 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                  className="h-11 rounded-lg pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div role="alert" className="flex items-center gap-2.5 text-sm text-destructive bg-destructive/10 p-3.5 rounded-lg border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" className="w-full h-11 rounded-lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : selectedLdap ? (
                `Sign in with ${selectedLdap.display_name}`
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {hasAlternatives && (
            <div className="mt-7 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">or continue with</span>
                <div className="flex-1 border-t border-border" />
              </div>
              <div className="grid gap-2">
                {selectedLdap && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 rounded-lg gap-2"
                    onClick={() => { setSelectedLdap(null); setError(''); }}
                    disabled={loading}
                  >
                    Local account
                  </Button>
                )}
                {ldapProviders.map((provider) => (
                  <Button
                    key={`ldap-${provider.name}`}
                    type="button"
                    variant={selectedLdap?.name === provider.name ? 'default' : 'outline'}
                    className="w-full h-11 rounded-lg gap-2"
                    onClick={() => { setSelectedLdap(provider); setError(''); }}
                    disabled={loading}
                  >
                    <Network className="h-4 w-4" />
                    {provider.display_name}
                  </Button>
                ))}
                {oidcProviders.map((provider) => (
                  <Button
                    key={provider.name}
                    type="button"
                    variant="outline"
                    className="w-full h-11 rounded-lg gap-2"
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

          <p className="mt-8 text-center text-sm text-muted-foreground">
            No account? Contact your administrator for an invitation.
          </p>
        </div>
      </main>
    </div>
  );
}
