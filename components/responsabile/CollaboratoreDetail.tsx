'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { canTransition } from '@/lib/compensation-transitions';
import { canExpenseTransition } from '@/lib/expense-transitions';
import StatusBadge from '@/components/compensation/StatusBadge';
import {
  INTEGRATION_REASONS,
  COMPENSATION_STATUS_LABELS,
  EXPENSE_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_SIGN_STATUS_LABELS,
  type CompensationStatus,
  type ExpenseStatus,
  type DocumentType,
  type DocumentSignStatus,
  type Role,
} from '@/lib/types';

interface CompensationRow {
  id: string;
  tipo: string;
  periodo_riferimento: string | null;
  importo_lordo: number | null;
  importo_netto: number | null;
  totale_fattura: number | null;
  stato: CompensationStatus;
  community_name: string | null;
  created_at: string;
}

interface ExpenseRow {
  id: string;
  categoria: string;
  data_spesa: string;
  importo: number;
  stato: ExpenseStatus;
  created_at: string;
}

interface DocumentRow {
  id: string;
  titolo: string;
  tipo: DocumentType;
  stato_firma: DocumentSignStatus;
  created_at: string;
}

interface CollaboratoreDetailProps {
  collab: {
    id: string;
    nome: string | null;
    cognome: string | null;
    codice_fiscale: string | null;
    telefono: string | null;
    email: string | null;
    tipo_contratto: string | null;
    data_ingresso: string | null;
    luogo_nascita: string | null;
    comune: string | null;
    indirizzo: string | null;
  };
  memberStatus: string | null;
  communityNames: string[];
  compensations: CompensationRow[];
  expenses: ExpenseRow[];
  documents: DocumentRow[];
  role: Role;
}

const MEMBER_STATUS_LABELS: Record<string, string> = {
  attivo: 'Attivo',
  uscente_con_compenso: 'Uscente con compenso',
  uscente_senza_compenso: 'Uscente senza compenso',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function displayAmount(comp: CompensationRow): string {
  const amount = comp.importo_netto ?? comp.importo_lordo ?? comp.totale_fattura;
  if (amount == null) return '—';
  return amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

type ModalTarget = { type: 'comp' | 'exp'; id: string };

export default function CollaboratoreDetail({
  collab,
  memberStatus,
  communityNames,
  compensations,
  expenses,
  documents,
  role,
}: CollaboratoreDetailProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [integrationModal, setIntegrationModal] = useState<ModalTarget | null>(null);
  const [note, setNote] = useState('');
  const [reasons, setReasons] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canAct = role === 'responsabile' || role === 'amministrazione' || role === 'super_admin';

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = async (type: 'comp' | 'exp', id: string) => {
    setLoading(id);
    setError(null);
    const url =
      type === 'comp'
        ? `/api/compensations/${id}/transition`
        : `/api/expenses/${id}/transition`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve_manager' }),
    });
    setLoading(null);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Errore durante l\'approvazione.');
    }
  };

  // ── Integration ───────────────────────────────────────────────────────────
  const openIntegration = (type: 'comp' | 'exp', id: string) => {
    setNote('');
    setReasons([]);
    setError(null);
    setIntegrationModal({ type, id });
  };

  const handleIntegration = async () => {
    if (!integrationModal) return;
    if (note.trim().length < 20) {
      setError('La nota deve contenere almeno 20 caratteri.');
      return;
    }
    setLoading(integrationModal.id);
    setError(null);
    const url =
      integrationModal.type === 'comp'
        ? `/api/compensations/${integrationModal.id}/transition`
        : `/api/expenses/${integrationModal.id}/transition`;
    const body: Record<string, unknown> = { action: 'request_integration', note: note.trim() };
    if (integrationModal.type === 'comp' && reasons.length > 0) body.reasons = reasons;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(null);
    if (res.ok) {
      setIntegrationModal(null);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Errore durante la richiesta.');
    }
  };

  const toggleReason = (r: string) =>
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  // ── Sections ──────────────────────────────────────────────────────────────
  const sectionTitle = (title: string, count: number) => (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{count}</span>
    </div>
  );

  const emptyRow = (msg: string) => (
    <p className="text-xs text-gray-500 py-4 text-center">{msg}</p>
  );

  return (
    <div className="p-6 max-w-4xl space-y-8">
      {/* Back */}
      <Link href="/collaboratori" className="text-xs text-gray-500 hover:text-gray-300 transition">
        ← Torna alla lista
      </Link>

      {/* ── Anagrafica ──────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-100">
              {[collab.nome, collab.cognome].filter(Boolean).join(' ') || 'Collaboratore'}
            </h1>
            {memberStatus && (
              <span className="text-xs text-gray-400 mt-0.5 block">
                {MEMBER_STATUS_LABELS[memberStatus] ?? memberStatus}
              </span>
            )}
          </div>
          {communityNames.length > 0 && (
            <div className="flex gap-1.5 flex-wrap justify-end">
              {communityNames.map((n) => (
                <span key={n} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{n}</span>
              ))}
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {[
            ['Codice fiscale', collab.codice_fiscale],
            ['Telefono', collab.telefono],
            ['Email', collab.email],
            ['Tipo contratto', collab.tipo_contratto],
            ['Data ingresso', collab.data_ingresso ? formatDate(collab.data_ingresso) : null],
            ['Luogo nascita', collab.luogo_nascita],
            ['Comune residenza', collab.comune],
            ['Indirizzo', collab.indirizzo],
          ].map(([label, value]) =>
            value ? (
              <div key={label as string}>
                <dt className="text-[11px] text-gray-500 uppercase tracking-wide mb-0.5">{label}</dt>
                <dd className="text-gray-200 font-mono text-xs">{value}</dd>
              </div>
            ) : null
          )}
        </dl>
      </div>

      {/* ── Compensi ────────────────────────────────────────────────────── */}
      <div>
        {sectionTitle('Compensi', compensations.length)}
        {compensations.length === 0 ? (
          emptyRow('Nessun compenso.')
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Stato', 'Periodo', 'Importo', 'Community', 'Data', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compensations.map((comp) => {
                  const canApprove = canAct && canTransition(role, comp.stato, 'approve_manager');
                  const canReqInt = canAct && canTransition(role, comp.stato, 'request_integration');
                  return (
                    <tr key={comp.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30 transition">
                      <td className="px-4 py-3">
                        <StatusBadge stato={comp.stato} />
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{comp.periodo_riferimento ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-200 font-medium text-xs">{displayAmount(comp)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{comp.community_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(comp.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          {canApprove && (
                            <button
                              onClick={() => handleApprove('comp', comp.id)}
                              disabled={loading === comp.id}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-green-700 hover:bg-green-600 text-white transition disabled:opacity-50"
                            >
                              {loading === comp.id ? '…' : 'Pre-approva'}
                            </button>
                          )}
                          {canReqInt && (
                            <button
                              onClick={() => openIntegration('comp', comp.id)}
                              disabled={loading === comp.id}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-yellow-700 hover:bg-yellow-600 text-white transition disabled:opacity-50"
                            >
                              Integrazioni
                            </button>
                          )}
                          {!canApprove && !canReqInt && (
                            <Link href={`/compensi/${comp.id}`} className="text-xs text-blue-400 hover:text-blue-300">
                              Vedi →
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Rimborsi ────────────────────────────────────────────────────── */}
      <div>
        {sectionTitle('Rimborsi', expenses.length)}
        {expenses.length === 0 ? (
          emptyRow('Nessun rimborso.')
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Stato', 'Categoria', 'Data spesa', 'Importo', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => {
                  const canApprove = canAct && canExpenseTransition(role, exp.stato, 'approve_manager');
                  const canReqInt = canAct && canExpenseTransition(role, exp.stato, 'request_integration');
                  return (
                    <tr key={exp.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30 transition">
                      <td className="px-4 py-3">
                        <StatusBadge stato={exp.stato} />
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{exp.categoria}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(exp.data_spesa)}</td>
                      <td className="px-4 py-3 text-gray-200 font-medium text-xs">
                        {exp.importo.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          {canApprove && (
                            <button
                              onClick={() => handleApprove('exp', exp.id)}
                              disabled={loading === exp.id}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-green-700 hover:bg-green-600 text-white transition disabled:opacity-50"
                            >
                              {loading === exp.id ? '…' : 'Pre-approva'}
                            </button>
                          )}
                          {canReqInt && (
                            <button
                              onClick={() => openIntegration('exp', exp.id)}
                              disabled={loading === exp.id}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-yellow-700 hover:bg-yellow-600 text-white transition disabled:opacity-50"
                            >
                              Integrazioni
                            </button>
                          )}
                          {!canApprove && !canReqInt && (
                            <Link href={`/rimborsi/${exp.id}`} className="text-xs text-blue-400 hover:text-blue-300">
                              Vedi →
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Documenti ───────────────────────────────────────────────────── */}
      <div>
        {sectionTitle('Documenti', documents.length)}
        {documents.length === 0 ? (
          emptyRow('Nessun documento.')
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Titolo', 'Tipo', 'Firma', 'Data', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3 text-gray-200 text-xs">{doc.titolo}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{DOCUMENT_TYPE_LABELS[doc.tipo] ?? doc.tipo}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${
                        doc.stato_firma === 'DA_FIRMARE' ? 'text-yellow-400' :
                        doc.stato_firma === 'FIRMATO' ? 'text-green-400' : 'text-gray-500'
                      }`}>
                        {DOCUMENT_SIGN_STATUS_LABELS[doc.stato_firma] ?? doc.stato_firma}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(doc.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/documenti/${doc.id}`} className="text-xs text-blue-400 hover:text-blue-300">
                        Vedi →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Global error ────────────────────────────────────────────────── */}
      {error && !integrationModal && (
        <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* ── Integration modal ────────────────────────────────────────────── */}
      {integrationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-5 w-[420px] max-w-[90vw]">
            <h3 className="text-sm font-semibold text-gray-100 mb-4">Richiedi integrazioni</h3>

            {integrationModal.type === 'comp' && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">Motivi (opzionale)</p>
                <div className="space-y-1.5">
                  {INTEGRATION_REASONS.map((r) => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reasons.includes(r)}
                        onChange={() => toggleReason(r)}
                        className="rounded border-gray-600 bg-gray-800 text-blue-500"
                      />
                      <span className="text-xs text-gray-300">{r}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1">
                Nota per il collaboratore <span className="text-gray-600">(min. 20 caratteri)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200
                           focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Descrivi cosa manca o cosa correggere…"
              />
              <p className="text-[10px] text-gray-600 mt-0.5 text-right">{note.length} / 20+</p>
            </div>

            {error && (
              <p className="text-xs text-red-400 mb-3">{error}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setIntegrationModal(null); setError(null); }}
                className="px-3 py-1.5 rounded-md text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition"
              >
                Annulla
              </button>
              <button
                onClick={handleIntegration}
                disabled={!!loading || note.trim().length < 20}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-yellow-600 hover:bg-yellow-500
                           text-white transition disabled:opacity-50"
              >
                {loading ? 'Invio…' : 'Richiedi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
