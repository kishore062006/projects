import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { API_BASE } from '../lib/api';

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
};

interface AuthPageProps {
  onAuthSuccess: (user: AuthUser) => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verifyToken');
    const nextResetToken = params.get('resetToken');

    const clearQueryParams = () => {
      const nextUrl = `${window.location.origin}${window.location.pathname}${window.location.hash || ''}`;
      window.history.replaceState({}, document.title, nextUrl);
    };

    if (nextResetToken) {
      setResetToken(nextResetToken);
      setMode('reset');
      setSuccess('Please enter your new password.');
      clearQueryParams();
      return;
    }

    if (!verifyToken) {
      return;
    }

    const verifyEmail = async () => {
      if (!API_BASE) {
        setError('Verification service is unavailable. Set VITE_API_BASE_URL and retry.');
        clearQueryParams();
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: verifyToken }),
        });

        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? await response.json() : null;
        if (!response.ok) {
          const message = data && typeof data === 'object' && 'message' in data ? String((data as { message: unknown }).message) : 'Email verification failed.';
          setError(message);
          return;
        }

        const message = data && typeof data === 'object' && 'message' in data ? String((data as { message: unknown }).message) : 'Email verified successfully.';
        setSuccess(message);
        setMode('login');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Network request failed';
        setError(`Unable to verify email right now. ${message}`);
      } finally {
        clearQueryParams();
      }
    };

    void verifyEmail();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if ((mode === 'register' || mode === 'reset') && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (mode === 'reset' && !resetToken) {
      setError('Reset token is missing. Please use the reset link from your email.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!API_BASE && !import.meta.env.DEV) {
        setError('API is not configured for production. Set VITE_API_BASE_URL in Vercel and redeploy.');
        return;
      }

      let endpoint = '';
      let payload: Record<string, string> = {};

      if (mode === 'login') {
        endpoint = 'login';
        payload = { email, password };
      } else if (mode === 'register') {
        endpoint = 'register';
        payload = { name, email, password };
      } else if (mode === 'forgot') {
        endpoint = 'forgot-password';
        payload = { email };
      } else {
        endpoint = 'reset-password';
        payload = { token: resetToken, password };
      }

      const requestUrl = `${API_BASE}/api/auth/${endpoint}`;

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : null;
      if (!response.ok) {
        if (data && typeof data === 'object' && 'message' in data) {
          setError(String((data as { message: unknown }).message));
        } else {
          setError(`Authentication failed (${response.status}). Check VITE_API_BASE_URL and backend deployment.`);
        }
        return;
      }

      if (mode === 'login') {
        onAuthSuccess(data as AuthUser);
        return;
      }

      const message = data && typeof data === 'object' && 'message' in data ? String((data as { message: unknown }).message) : 'Request completed successfully.';
      setSuccess(message);

      if (mode === 'register') {
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      }

      if (mode === 'forgot') {
        setMode('login');
      }

      if (mode === 'reset') {
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setResetToken('');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network request failed';
      setError(`Unable to connect to the authentication service. ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6 py-12">
      <div className="relative max-w-2xl w-full bg-white/5 border border-white/10 rounded-[2rem] p-10 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 rounded-[2rem] pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-400 mb-3">EcoSync</p>
              <h1 className="text-4xl font-bold tracking-tight">
                {mode === 'register'
                  ? 'Create your account'
                  : mode === 'forgot'
                  ? 'Forgot password'
                  : mode === 'reset'
                  ? 'Reset password'
                  : 'Welcome back'}
              </h1>
              <p className="mt-3 text-zinc-400 max-w-xl">
                {mode === 'register'
                  ? 'Sign up, verify your email, and start earning Leaves for civic impact.'
                  : mode === 'forgot'
                  ? 'Enter your email and we will send you a password reset link.'
                  : mode === 'reset'
                  ? 'Set a new password to regain access to your EcoSync account.'
                  : 'Securely sign in to access your civic dashboard, report issues, and earn EcoPoints.'}
              </p>
            </div>
            {(mode === 'login' || mode === 'register') && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                {mode === 'login' ? 'New to EcoSync?' : 'Already registered?'}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setMode(mode === 'login' ? 'register' : 'login');
                  }}
                  className="ml-2 font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  {mode === 'login' ? 'Create account' : 'Sign in'}
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'register' && (
              <label className="block">
                <span className="text-sm text-zinc-400">Full name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-3 w-full rounded-3xl border border-white/10 bg-black/40 px-5 py-4 text-white outline-none focus:border-emerald-400"
                  placeholder="Jane Doe"
                  required
                />
              </label>
            )}

            <label className="block">
              <span className="text-sm text-zinc-400">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-3 w-full rounded-3xl border border-white/10 bg-black/40 px-5 py-4 text-white outline-none focus:border-emerald-400"
                placeholder="you@example.com"
                required
              />
            </label>

            {mode !== 'forgot' && (
              <label className="block">
                <span className="text-sm text-zinc-400">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-3 w-full rounded-3xl border border-white/10 bg-black/40 px-5 py-4 text-white outline-none focus:border-emerald-400"
                  placeholder="Enter your password"
                  required
                />
              </label>
            )}

            {(mode === 'register' || mode === 'reset') && (
              <label className="block">
                <span className="text-sm text-zinc-400">Confirm password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-3 w-full rounded-3xl border border-white/10 bg-black/40 px-5 py-4 text-white outline-none focus:border-emerald-400"
                  placeholder="Repeat your password"
                  required
                />
              </label>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setMode('forgot');
                  }}
                  className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-3xl bg-emerald-500 px-6 py-4 text-base font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create account'
                : mode === 'forgot'
                ? 'Send reset link'
                : 'Reset password'}
            </button>

            {(mode === 'forgot' || mode === 'reset') && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setMode('login');
                }}
                className="w-full rounded-3xl border border-white/15 bg-white/5 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/10"
              >
                Back to sign in
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
