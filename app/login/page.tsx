'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const supabase = createClient();

  const inputCls =
    'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
    'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600';

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('Email o password non corretti');
    setLoading(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
    } else {
      setInfo('Link di accesso inviato. Controlla la tua email.');
    }
    setLoading(false);
  };

  const spinner = (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 mb-4">
            <span className="text-xl">👥</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-100">Staff Manager</h1>
          <p className="text-sm text-gray-500 mt-1">Accedi alla tua area personale</p>
        </div>

        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 space-y-5">
          {/* Google SSO */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-700
                       bg-gray-800 hover:bg-gray-700 px-4 py-2.5 text-sm font-medium text-gray-100
                       transition disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Accedi con Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">oppure</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 rounded-lg bg-gray-800 p-1">
            <button
              onClick={() => setMode('password')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                mode === 'password' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Email e password
            </button>
            <button
              onClick={() => setMode('magic')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                mode === 'magic' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Link via email
            </button>
          </div>

          {/* Password form */}
          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-3">
              <input type="email" placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
              <input type="password" placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)} className={inputCls} required />
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium
                           text-white transition disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <>{spinner} Accesso…</> : 'Accedi'}
              </button>
            </form>
          )}

          {/* Magic link form */}
          {mode === 'magic' && (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <input type="email" placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium
                           text-white transition disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <>{spinner} Invio…</> : 'Invia link di accesso'}
              </button>
            </form>
          )}

          {/* Feedback */}
          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2.5 text-xs text-red-400">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-lg bg-green-900/30 border border-green-800/40 px-3 py-2.5 text-xs text-green-400">
              {info}
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-gray-600">
          L&apos;accesso è riservato ai collaboratori invitati.
        </p>
      </div>
    </div>
  );
}
