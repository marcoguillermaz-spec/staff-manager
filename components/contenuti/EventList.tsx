'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ContentEvent, Community } from '@/lib/types';

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('it-IT', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  return end ? `${fmt(start)} → ${fmt(end)}` : fmt(start);
}

// datetime-local inputs require 'YYYY-MM-DDTHH:mm' format
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

interface FormData {
  titolo: string;
  descrizione: string;
  start_datetime: string;
  end_datetime: string;
  location: string;
  luma_url: string;
  luma_embed_url: string;
  community_id: string;
}

function EventForm({
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
    start_datetime: initial?.start_datetime ?? '',
    end_datetime: initial?.end_datetime ?? '',
    location: initial?.location ?? '',
    luma_url: initial?.luma_url ?? '',
    luma_embed_url: initial?.luma_embed_url ?? '',
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Data/ora inizio</label>
          <input type="datetime-local" value={form.start_datetime} onChange={set('start_datetime')}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Data/ora fine</label>
          <input type="datetime-local" value={form.end_datetime} onChange={set('end_datetime')}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none" />
        </div>
      </div>
      <input value={form.location} onChange={set('location')} placeholder="Luogo (es. Online, Milano)"
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
      <input value={form.luma_url} onChange={set('luma_url')} placeholder="URL pagina Luma" type="url"
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
      <input value={form.luma_embed_url} onChange={set('luma_embed_url')} placeholder="URL embed Luma (per iframe)"
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

export default function EventList({
  events,
  canWrite,
  communities,
}: {
  events: ContentEvent[];
  canWrite: boolean;
  communities: Community[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleCreate(data: FormData) {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titolo: data.titolo,
        descrizione: data.descrizione || undefined,
        start_datetime: data.start_datetime || null,
        end_datetime: data.end_datetime || null,
        location: data.location || null,
        luma_url: data.luma_url || null,
        luma_embed_url: data.luma_embed_url || null,
        community_id: data.community_id || null,
      }),
    });
    if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Errore.'); }
    setShowForm(false);
    router.refresh();
  }

  async function handleEdit(id: string, data: FormData) {
    const res = await fetch(`/api/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titolo: data.titolo,
        descrizione: data.descrizione || null,
        start_datetime: data.start_datetime || null,
        end_datetime: data.end_datetime || null,
        location: data.location || null,
        luma_url: data.luma_url || null,
        luma_embed_url: data.luma_embed_url || null,
        community_id: data.community_id || null,
      }),
    });
    if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Errore.'); }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminare questo evento?')) return;
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canWrite && !showForm && (
        <button onClick={() => setShowForm(true)}
          className="rounded-lg border border-dashed border-gray-700 hover:border-blue-600 px-4 py-2 text-sm text-gray-400 hover:text-blue-400 transition">
          + Nuovo evento
        </button>
      )}
      {showForm && (
        <EventForm communities={communities} onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}
      {events.length === 0 && !showForm && (
        <p className="text-sm text-gray-500 py-6 text-center">Nessun evento in programma.</p>
      )}
      {events.map((ev) => (
        <div key={ev.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
          {editingId === ev.id ? (
            <EventForm
              initial={{
                titolo: ev.titolo,
                descrizione: ev.descrizione ?? '',
                start_datetime: toDatetimeLocal(ev.start_datetime),
                end_datetime: toDatetimeLocal(ev.end_datetime),
                location: ev.location ?? '',
                luma_url: ev.luma_url ?? '',
                luma_embed_url: ev.luma_embed_url ?? '',
                community_id: ev.community_id ?? '',
              }}
              communities={communities}
              onSave={(data) => handleEdit(ev.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-100">{ev.titolo}</h3>
                {canWrite && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setEditingId(ev.id)} className="text-xs text-gray-500 hover:text-gray-300 transition">Modifica</button>
                    <button onClick={() => handleDelete(ev.id)} className="text-xs text-red-600 hover:text-red-400 transition">Elimina</button>
                  </div>
                )}
              </div>
              {ev.descrizione && <p className="text-sm text-gray-400">{ev.descrizione}</p>}
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                {(ev.start_datetime || ev.end_datetime) && (
                  <span>📅 {formatDateRange(ev.start_datetime, ev.end_datetime)}</span>
                )}
                {ev.location && <span>📍 {ev.location}</span>}
                {ev.luma_url && (
                  <a href={ev.luma_url} target="_blank" rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline transition">
                    Pagina evento →
                  </a>
                )}
              </div>
              {ev.luma_embed_url && (
                <div className="rounded-xl overflow-hidden border border-gray-700 mt-1">
                  <iframe
                    src={ev.luma_embed_url}
                    className="w-full h-64 border-0"
                    title={ev.titolo}
                    loading="lazy"
                    allow="fullscreen"
                  />
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
