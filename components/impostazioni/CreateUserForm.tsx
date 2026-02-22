'use client';

import { useState, useEffect } from 'react';

type Role = 'collaboratore' | 'responsabile' | 'amministrazione' | 'super_admin';
type Community = { id: string; name: string; is_active: boolean };
type Credentials = { email: string; password: string };

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'collaboratore',   label: 'Collaboratore' },
  { value: 'responsabile',    label: 'Responsabile' },
  { value: 'amministrazione', label: 'Amministrazione' },
  { value: 'super_admin',     label: 'Super Admin' },
];

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';

const selectCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';

export default function CreateUserForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('collaboratore');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState<'email' | 'password' | null>(null);

  useEffect(() => {
    fetch('/api/admin/communities') // active only (default)
      .then((r) => r.json())
      .then((data) => setCommunities(data.communities ?? []))
      .catch(() => {});
  }, []);

  const toggleCommunity = (id: string) =>
    setSelectedCommunities((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );

  const copyToClipboard = async (text: string, field: 'email' | 'password') => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCredentials(null);

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        role,
        community_ids: role === 'responsabile' ? selectedCommunities : [],
      }),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Errore durante la creazione'); return; }
    setCredentials({ email: data.email, password: data.password });
    setEmail('');
    setRole('collaboratore');
    setSelectedCommunities([]);
  };

  if (credentials) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-green-900/20 border border-green-700/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-green-400">Utente creato con successo</span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Condividi queste credenziali con il nuovo utente. Al primo accesso dovrà impostare una nuova password.
          </p>
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">Email</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-100 font-mono">{credentials.email}</code>
              <button onClick={() => copyToClipboard(credentials.email, 'email')}
                className="rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-2 text-xs text-gray-300 transition whitespace-nowrap">
                {copied === 'email' ? 'Copiato!' : 'Copia'}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Password temporanea</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-100 font-mono tracking-wider">{credentials.password}</code>
              <button onClick={() => copyToClipboard(credentials.password, 'password')}
                className="rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-2 text-xs text-gray-300 transition whitespace-nowrap">
                {copied === 'password' ? 'Copiata!' : 'Copia'}
              </button>
            </div>
          </div>
        </div>
        <button onClick={() => setCredentials(null)}
          className="w-full rounded-lg border border-gray-700 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition">
          Crea un altro utente
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Email</label>
        <input type="email" placeholder="nome@email.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          required disabled={loading} autoComplete="off" className={inputCls} />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Ruolo</label>
        <select value={role} onChange={(e) => { setRole(e.target.value as Role); setSelectedCommunities([]); }}
          disabled={loading} className={selectCls}>
          {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {role === 'responsabile' && communities.length > 0 && (
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Comunità gestite <span className="text-gray-600 ml-1">(opzionale)</span>
          </label>
          <div className="space-y-2">
            {communities.map((c) => (
              <label key={c.id}
                className="flex items-center gap-3 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 cursor-pointer hover:border-gray-600 transition">
                <input type="checkbox" checked={selectedCommunities.includes(c.id)}
                  onChange={() => toggleCommunity(c.id)} disabled={loading}
                  className="accent-blue-600 w-4 h-4" />
                <span className="text-sm text-gray-200">{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2.5 text-xs text-red-400">{error}</div>
      )}
      <button type="submit" disabled={loading || !email}
        className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Creazione in corso…
          </>
        ) : 'Crea utente'}
      </button>
    </form>
  );
}
