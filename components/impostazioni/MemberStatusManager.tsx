'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type MemberStatus = 'attivo' | 'uscente_con_compenso' | 'uscente_senza_compenso';

type Member = {
  id: string;
  user_id: string;
  nome: string;
  cognome: string;
  member_status: MemberStatus;
  is_active: boolean;
};

const STATUS_LABELS: Record<MemberStatus, string> = {
  attivo:                   'Attivo',
  uscente_con_compenso:     'Uscente (con compenso)',
  uscente_senza_compenso:   'Uscente (senza compenso)',
};

const STATUS_COLORS: Record<MemberStatus, string> = {
  attivo:                   'text-green-400',
  uscente_con_compenso:     'text-yellow-400',
  uscente_senza_compenso:   'text-gray-500',
};

export default function MemberStatusManager({ members }: { members: Member[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(id: string, newStatus: MemberStatus) {
    setLoadingId(id);
    setError(null);
    const res = await fetch(`/api/admin/members/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_status: newStatus }),
    });
    setLoadingId(null);
    if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Errore.'); return; }
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-800">
      <div className="px-5 py-4 border-b border-gray-800">
        <h2 className="text-sm font-medium text-gray-200">Stato collaboratori</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Gestisci lo stato di uscita dei collaboratori. Lo stato influisce sulla visibilità di documenti e richieste.
        </p>
      </div>

      {error && (
        <div className="mx-5 mt-4 rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2 text-xs text-red-400">{error}</div>
      )}

      <div className="divide-y divide-gray-800">
        {members.length === 0 && (
          <p className="px-5 py-4 text-sm text-gray-500">Nessun collaboratore trovato.</p>
        )}
        {members.map((m) => (
          <div key={m.id} className="px-5 py-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 truncate">{m.cognome} {m.nome}</p>
              <p className={`text-xs ${STATUS_COLORS[m.member_status]}`}>
                {STATUS_LABELS[m.member_status]}
              </p>
            </div>
            <select
              value={m.member_status}
              disabled={loadingId === m.id}
              onChange={(e) => handleChange(m.id, e.target.value as MemberStatus)}
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
            >
              {(Object.entries(STATUS_LABELS) as [MemberStatus, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            {loadingId === m.id && <span className="text-xs text-gray-500">…</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
