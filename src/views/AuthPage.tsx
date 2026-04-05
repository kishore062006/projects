import { useState } from 'react';
import { motion } from 'framer-motion';

const API_BASE = 'http://localhost:4001';

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
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const endpoint = mode === 'login' ? 'login' : 'register';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, string> = {
        email,
        password,
      };

      if (mode === 'register') {
        payload.name = name;
      }

      const response = await fetch(`${API_BASE}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.message || 'Authentication failed.');
        return;
      }

      onAuthSuccess(data as AuthUser);
    } catch (err) {
      setError('Unable to connect to the authentication service.');
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
              <h1 className="text-4xl font-bold tracking-tight">Welcome back</h1>
              <p className="mt-3 text-zinc-400 max-w-xl">Securely sign in to access your civic dashboard, report issues, and earn EcoPoints.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              {mode === 'login' ? 'New to EcoSync?' : 'Already registered?'}
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="ml-2 font-semibold text-emerald-400 hover:text-emerald-300"
              >
                {mode === 'login' ? 'Create account' : 'Sign in'}
              </button>
            </div>
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

            {mode === 'register' && (
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

            {error && (
              <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-3xl bg-emerald-500 px-6 py-4 text-base font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
