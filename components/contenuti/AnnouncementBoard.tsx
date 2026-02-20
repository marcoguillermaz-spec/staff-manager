'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Announcement, Community } from '@/lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface AnnouncementFormData {
  titolo: string;
  contenuto: string;
  pinned: boolean;
  community_id: string;
}

function AnnouncementForm({
  initial,
  communities,
  onSave,
  onCancel,
}: {
  initial?: Partial<AnnouncementFormData>;
  communities: Community[];
  onSave: (data: AnnouncementFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [titolo, setTitolo] = useState(initial?.titolo ?? '');
  const [contenuto, setContenuto] = useState(initial?.contenuto ?? '');
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [communityId, setCommunityId] = useState(initial?.community_id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titolo.trim() || !contenuto.trim()) {
      setError('Titolo e contenuto sono obbligatori.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSave({ titolo, contenuto, pinned, community_id: communityId || '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-blue-800 bg-blue-950/30 p-4">
      {error && (
        <p className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
      <input
        value={titolo}
        onChange={(e) => setTitolo(e.target.value)}
        placeholder="Titolo *"
        required
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />
      <textarea
        value={contenuto}
        onChange={(e) => setContenuto(e.target.value)}
        placeholder="Contenuto *"
        rows={4}
        required
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
      />
      <div className="flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            className="rounded border-gray-600 bg-gray-800"
          />
          Fissa in cima
        </label>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Community:</label>
          <select
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Tutte</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-1.5 text-sm font-medium text-white transition"
        >
          {loading ? 'Salvataggio…' : 'Salva'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 px-4 py-1.5 text-sm text-gray-300 transition"
        >
          Annulla
        </button>
      </div>
    </form>
  );
}

export default function AnnouncementBoard({
  announcements,
  canWrite,
  communities,
}: {
  announcements: Announcement[];
  canWrite: boolean;
  communities: Community[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleCreate(data: AnnouncementFormData) {
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titolo: data.titolo,
        contenuto: data.contenuto,
        pinned: data.pinned,
        community_id: data.community_id || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json();
      throw new Error(j.error ?? 'Errore durante la creazione.');
    }
    setShowForm(false);
    router.refresh();
  }

  async function handleEdit(id: string, data: AnnouncementFormData) {
    const res = await fetch(`/api/announcements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titolo: data.titolo,
        contenuto: data.contenuto,
        pinned: data.pinned,
        community_id: data.community_id || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json();
      throw new Error(j.error ?? 'Errore durante la modifica.');
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminare questo annuncio?')) return;
    await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canWrite && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg border border-dashed border-gray-700 hover:border-blue-600 px-4 py-2 text-sm text-gray-400 hover:text-blue-400 transition"
        >
          + Nuovo annuncio
        </button>
      )}

      {showForm && (
        <AnnouncementForm
          communities={communities}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {announcements.length === 0 && !showForm && (
        <p className="text-sm text-gray-500 py-6 text-center">Nessun annuncio pubblicato.</p>
      )}

      {announcements.map((a) => (
        <div
          key={a.id}
          className={`rounded-xl border p-4 space-y-2 ${
            a.pinned
              ? 'border-blue-700 bg-blue-950/20'
              : 'border-gray-800 bg-gray-900'
          }`}
        >
          {editingId === a.id ? (
            <AnnouncementForm
              initial={{
                titolo: a.titolo,
                contenuto: a.contenuto,
                pinned: a.pinned,
                community_id: a.community_id ?? '',
              }}
              communities={communities}
              onSave={(data) => handleEdit(a.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {a.pinned && <span className="text-blue-400 text-sm">📌</span>}
                  <h3 className="text-sm font-semibold text-gray-100">{a.titolo}</h3>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setEditingId(a.id)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition"
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-xs text-red-600 hover:text-red-400 transition"
                    >
                      Elimina
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{a.contenuto}</p>
              <p className="text-xs text-gray-600">{formatDate(a.published_at)}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
