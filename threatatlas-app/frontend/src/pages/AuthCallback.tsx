import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = params.get('token');
    const providerError = params.get('error');

    if (providerError) {
      setError(`Sign-in failed: ${providerError}`);
      return;
    }
    if (!token) {
      setError('Missing access token in callback.');
      return;
    }

    loginWithToken(token)
      .then(() => navigate('/', { replace: true }))
      .catch(() => setError('Failed to finalize sign-in. Please try again.'));
  }, [params, loginWithToken, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="text-center space-y-3">
        {error ? (
          <>
            <p className="text-destructive font-medium">{error}</p>
            <button
              className="text-sm text-primary underline"
              onClick={() => navigate('/login', { replace: true })}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <p className="text-muted-foreground">Finishing sign-in…</p>
        )}
      </div>
    </div>
  );
}
