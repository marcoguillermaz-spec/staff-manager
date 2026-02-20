'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Resource, Community } from '@/lib/types';

interface FormData {
  titolo: string;
  descrizione: string;
  link: string;
  file_url: string;
  tag: string;  // comma-separated
  community_id: string;
}

function ResourceForm({
  initial,
  communities,
  onSave,
  onCancel,
}: {
  initial?: Partial<FormData>;
  communities: Community[];
  onSave: (data: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormData>({
    titolo: initial?.titolo ?? '',
    descrizione: initial?.descrizione ?? '',
    link: initial?.link ?? '',
    file_url: initial?.file_url ?? '',
    tag: initial?.tag ?? '',
    community_id: initial?.community_id ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titolo.trim()) { setError('Il titolo è obbligatorio.'); return; }
    setLoading(true); setError(null);
    try { await onSave(form); }
    catch (err) { setError(err instanceof Error ? err.message : 'Errore.'); setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-blue-800 bg-blue-950/30 p-4">
      {error && <p className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-300">{error}</p>}
      <input value={form.titolo} onChange={set('titolo')} placeholder="Titolo *" required
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
      <textarea value={form.descrizione} onChange={set('descrizione')} placeholder="Descrizione" rows={3}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none" />
      <input value={form.link} onChange={set('link')} placeholder="Link (URL)" type="url"
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
      <input value={form.file_url} onChange={set('file_url')} placeholder="URL file alternativo (es. Drive)"
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
      <input value={form.tag} onChange={set('tag')} placeholder="Tag (separati da virgola, es. contratto, onboarding)"
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-400">Community:</label>
        <select value={form.community_id} onChange={set('community_id')}
          className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none">
          <option value="">Tutte</option>
          {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={loading}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-1.5 text-sm font-medium text-white transition">
          {loading ? 'Salvataggio…' : 'Salva'}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 px-4 py-1.5 text-sm text-gray-300 transition">
          Annulla
        </button>
      </div>
    </form>
  );
}

function parseTags(raw: string): string[] {
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

export default function ResourceList({
  resources,
  canWrite,
  communities,
}: {
  resources: Resource[];
  canWrite: boolean;
  communities: Community[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleCreate(data: FormData) {
    const res = await fetch('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titolo: data.titolo,
        descrizione: data.descrizione || undefined,
        link: data.link || undefined,
        file_url: data.file_url || undefined,
        tag: parseTags(data.tag),
        community_id: data.community_id || null,
      }),
    });
    if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Errore.'); }
    setShowForm(false);
    router.refresh();
  }

  async function handleEdit(id: string, data: FormData) {
    const res = await fetch(`/api/resources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titolo: data.titolo,
        descrizione: data.descrizione || null,
        link: data.link || null,
        file_url: data.file_url || null,
        tag: parseTags(data.tag),
        community_id: data.community_id || null,
      }),
    });
    if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Errore.'); }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminare questa risorsa?')) return;
    await fetch(`/api/resources/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canWrite && !showForm && (
        <button onClick={() => setShowForm(true)}
          className="rounded-lg border border-dashed border-gray-700 hover:border-blue-600 px-4 py-2 text-sm text-gray-400 hover:text-blue-400 transition">
          + Nuova risorsa
        </button>
      )}
      {showForm && (
        <ResourceForm communities={communities} onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}
      {resources.length === 0 && !showForm && (
        <p className="text-sm text-gray-500 py-6 text-center">Nessuna risorsa disponibile.</p>
      )}
      {resources.map((r) => (
        <div key={r.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-2">
          {editingId === r.id ? (
            <ResourceForm
              initial={{ titolo: r.titolo, descrizione: r.descrizione ?? '', link: r.link ?? '', file_url: r.file_url ?? '', tag: (r.tag ?? []).join(', '), community_id: r.community_id ?? '' }}
              communities={communities}
              onSave={(data) => handleEdit(r.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-100">{r.titolo}</h3>
                {canWrite && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setEditingId(r.id)} className="text-xs text-gray-500 hover:text-gray-300 transition">Modifica</button>
                    <button onClick={() => handleDelete(r.id)} className="text-xs text-red-600 hover:text-red-400 transition">Elimina</button>
                  </div>
                )}
              </div>
              {r.descrizione && <p className="text-sm text-gray-400">{r.descrizione}</p>}
              <div className="flex items-center gap-2 flex-wrap">
                {r.link && (
                  <a href={r.link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 px-3 py-1 text-xs text-gray-300 transition">
                    🔗 Apri link
                  </a>
                )}
                {r.file_url && (
                  <a href={r.file_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 px-3 py-1 text-xs text-gray-300 transition">
                    📎 File
                  </a>
                )}
              </div>
              {r.tag && r.tag.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {r.tag.map((t) => (
                    <span key={t} className="rounded-full bg-gray-800 border border-gray-700 px-2 py-0.5 text-xs text-gray-400">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
