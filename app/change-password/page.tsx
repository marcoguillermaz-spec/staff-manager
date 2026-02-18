'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const inputCls =
    'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
    'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri');
      return;
    }
    if (password !== confirm) {
      setError('Le password non coincidono');
      return;
    }
    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("Errore durante l'aggiornamento della password. Riprova.");
      setLoading(false);
      return;
    }

    // Clear the must_change_password flag server-side
    await fetch('/api/auth/clear-force-change', { method: 'POST' });

    router.push('/');
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
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-600 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-100">Cambia password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Imposta una nuova password per accedere alla piattaforma.
          </p>
        </div>

        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Nuova password</label>
              <input
                type="password"
                placeholder="Minimo 8 caratteri"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete="new-password"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Conferma password</label>
              <input
                type="password"
                placeholder="Ripeti la nuova password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
                required
                autoComplete="new-password"
                className={inputCls}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2.5 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium
                         text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <>{spinner} Aggiornamento…</> : 'Imposta nuova password'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-600">
          Per problemi di accesso contatta l&apos;amministrazione.
        </p>
      </div>
    </div>
  );
}
