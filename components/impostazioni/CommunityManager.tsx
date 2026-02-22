'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Community = { id: string; name: string; is_active: boolean };
type Responsabile = { user_id: string; display_name: string; email: string; communities: { id: string; name: string }[] };

export default function CommunityManager({
  communities,
  responsabili,
}: {
  communities: Community[];
  responsabili: Responsabile[];
}) {
  const router = useRouter();

  // ── Create community ──────────────────────────────────────
  const [newName, setNewName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateLoading(true); setCreateError(null);
    const res = await fetch('/api/admin/communities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setCreateLoading(false);
    if (!res.ok) { const j = await res.json(); setCreateError(j.error ?? 'Errore.'); return; }
    setNewName('');
    router.refresh();
  }

  // ── Rename community ──────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    setEditLoading(true);
    await fetch(`/api/admin/communities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditLoading(false);
    setEditingId(null);
    router.refresh();
  }

  // ── Toggle is_active ──────────────────────────────────────
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleToggle(id: string, current: boolean) {
    if (!window.confirm(current ? 'Disattivare questa community? Sarà nascosta da tutti i menu.' : 'Riattivare questa community?')) return;
    setTogglingId(id);
    await fetch(`/api/admin/communities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    });
    setTogglingId(null);
    router.refresh();
  }

  // ── Responsabile assignment ───────────────────────────────
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedComms, setSelectedComms] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  function startEditAssignment(resp: Responsabile) {
    setEditingUserId(resp.user_id);
    setSelectedComms(resp.communities.map((c) => c.id));
  }

  async function saveAssignment(userId: string) {
    setAssignLoading(true);
    await fetch(`/api/admin/responsabili/${userId}/communities`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ community_ids: selectedComms }),
    });
    setAssignLoading(false);
    setEditingUserId(null);
    router.refresh();
  }

  const activeCommunities = communities.filter((c) => c.is_active);

  return (
    <div className="space-y-8">
      {/* ── Create community ────────────────────────────────── */}
      <div className="rounded-2xl bg-gray-900 border border-gray-800">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-medium text-gray-200">Crea community</h2>
        </div>
        <div className="p-5">
          <form onSubmit={handleCreate} className="flex gap-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome community"
              className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600" />
            <button type="submit" disabled={createLoading || !newName.trim()}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition">
              {createLoading ? 'Creazione…' : 'Crea'}
            </button>
          </form>
          {createError && <p className="mt-2 text-xs text-red-400">{createError}</p>}
        </div>
      </div>

      {/* ── Community list ──────────────────────────────────── */}
      <div className="rounded-2xl bg-gray-900 border border-gray-800">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-medium text-gray-200">Community esistenti</h2>
          <p className="text-xs text-gray-500 mt-0.5">Rinomina o disattiva. Le community inattive sono escluse da tutti i menu.</p>
        </div>
        <div className="divide-y divide-gray-800">
          {communities.length === 0 && (
            <p className="px-5 py-4 text-sm text-gray-500">Nessuna community.</p>
          )}
          {communities.map((c) => (
            <div key={c.id} className="px-5 py-3 flex items-center gap-3">
              {editingId === c.id ? (
                <>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600" />
                  <button onClick={() => handleRename(c.id)} disabled={editLoading}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white transition">
                    Salva
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="text-xs text-gray-500 hover:text-gray-300 transition">
                    Annulla
                  </button>
                </>
              ) : (
                <>
                  <span className={`flex-1 text-sm ${c.is_active ? 'text-gray-200' : 'text-gray-500 line-through'}`}>
                    {c.name}
                  </span>
                  {!c.is_active && (
                    <span className="rounded-full bg-gray-800 border border-gray-700 px-2 py-0.5 text-xs text-gray-500">Inattiva</span>
                  )}
                  <button onClick={() => { setEditingId(c.id); setEditName(c.name); }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition">
                    Rinomina
                  </button>
                  <button onClick={() => handleToggle(c.id, c.is_active)}
                    disabled={togglingId === c.id}
                    className={`text-xs transition ${c.is_active ? 'text-yellow-600 hover:text-yellow-400' : 'text-green-700 hover:text-green-500'}`}>
                    {togglingId === c.id ? '…' : c.is_active ? 'Disattiva' : 'Riattiva'}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Responsabili assignment ─────────────────────────── */}
      <div className="rounded-2xl bg-gray-900 border border-gray-800">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-medium text-gray-200">Community per responsabile</h2>
          <p className="text-xs text-gray-500 mt-0.5">Gestisci quali community sono assegnate a ciascun responsabile.</p>
        </div>
        <div className="divide-y divide-gray-800">
          {responsabili.length === 0 && (
            <p className="px-5 py-4 text-sm text-gray-500">Nessun responsabile attivo.</p>
          )}
          {responsabili.map((resp) => (
            <div key={resp.user_id} className="px-5 py-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-200">{resp.display_name}</p>
                  <p className="text-xs text-gray-500">{resp.email}</p>
                </div>
                {editingUserId === resp.user_id ? (
                  <div className="flex gap-2">
                    <button onClick={() => saveAssignment(resp.user_id)} disabled={assignLoading}
                      className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white transition">
                      Salva
                    </button>
                    <button onClick={() => setEditingUserId(null)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition">
                      Annulla
                    </button>
                  </div>
                ) : (
                  <button onClick={() => startEditAssignment(resp)}
                    className="text-xs text-gray-500 hover:text-gray-300 transition">
                    Modifica
                  </button>
                )}
              </div>

              {editingUserId === resp.user_id ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {activeCommunities.map((c) => (
                    <label key={c.id}
                      className="flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 cursor-pointer hover:border-gray-600 transition">
                      <input type="checkbox" checked={selectedComms.includes(c.id)}
                        onChange={() => setSelectedComms((prev) =>
                          prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                        )}
                        className="accent-blue-600 w-4 h-4" />
                      <span className="text-sm text-gray-200">{c.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {resp.communities.length === 0 ? (
                    <span className="text-xs text-gray-600">Nessuna community assegnata</span>
                  ) : resp.communities.map((c) => (
                    <span key={c.id} className="rounded-full bg-gray-800 border border-gray-700 px-2 py-0.5 text-xs text-gray-400">
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
