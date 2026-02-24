'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Document, DocumentType, DocumentMacroType } from '@/lib/types';
import { DOCUMENT_SIGN_STATUS_LABELS, DOCUMENT_MACRO_TYPE, DOCUMENT_MACRO_TYPE_LABELS } from '@/lib/types';

interface DocumentRow extends Document {
  collaborators?: { nome: string; cognome: string } | null;
}

interface Props {
  documents: DocumentRow[];
  isAdmin: boolean;
}

function TypeBadge({ tipo }: { tipo: DocumentType | string }) {
  if (tipo === 'CONTRATTO_OCCASIONALE') {
    return <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium bg-violet-900/40 text-violet-300 border-violet-700/40">Occasionale</span>;
  }
  if (tipo === 'CONTRATTO_COCOCO') {
    return <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium bg-violet-900/40 text-violet-300 border-violet-700/40">CoCoCo</span>;
  }
  if (tipo === 'CONTRATTO_PIVA') {
    return <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium bg-violet-900/40 text-violet-300 border-violet-700/40">P.IVA</span>;
  }
  if (tipo === 'CU') {
    return <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium bg-blue-900/40 text-blue-300 border-blue-700/40">CU</span>;
  }
  if (tipo === 'RICEVUTA_PAGAMENTO') {
    return <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium bg-teal-900/40 text-teal-300 border-teal-700/40">Ricevuta</span>;
  }
  return <span className="text-gray-400 text-xs">{tipo}</span>;
}

function SignBadge({ stato }: { stato: string }) {
  const colors: Record<string, string> = {
    DA_FIRMARE:    'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
    FIRMATO:       'bg-green-900/40 text-green-300 border-green-700/40',
    NON_RICHIESTO: 'bg-gray-800 text-gray-400 border-gray-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[stato] ?? colors.NON_RICHIESTO}`}>
      {DOCUMENT_SIGN_STATUS_LABELS[stato as keyof typeof DOCUMENT_SIGN_STATUS_LABELS] ?? stato}
    </span>
  );
}

const MACRO_ORDER: DocumentMacroType[] = ['CONTRATTO', 'RICEVUTA_PAGAMENTO', 'CU'];

export default function DocumentList({ documents, isAdmin }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare definitivamente questo contratto? L\'azione è irreversibile.')) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore eliminazione');
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Errore imprevisto');
    } finally {
      setDeletingId(null);
    }
  };

  // Group documents by macro type
  const grouped = new Map<DocumentMacroType, DocumentRow[]>();
  for (const doc of documents) {
    const macro = DOCUMENT_MACRO_TYPE[doc.tipo as DocumentType] ?? ('CU' as DocumentMacroType);
    const arr = grouped.get(macro) ?? [];
    arr.push(doc);
    grouped.set(macro, arr);
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center">
        <p className="text-sm text-gray-500">Nessun documento disponibile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {deleteError && (
        <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2 text-sm text-red-400">
          {deleteError}
        </div>
      )}

      {MACRO_ORDER.filter((macro) => grouped.has(macro)).map((macro) => {
        const docs = grouped.get(macro)!;
        return (
          <div key={macro} className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-200">{DOCUMENT_MACRO_TYPE_LABELS[macro]}</h3>
              <span className="text-xs text-gray-600 tabular-nums">({docs.length})</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800/60">
                  {isAdmin && (
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Collaboratore</th>
                  )}
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Titolo</th>
                  {macro === 'CONTRATTO' && (
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Tipo</th>
                  )}
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Anno</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Stato</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 hidden lg:table-cell">Data</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-800/50 transition">
                    {isAdmin && (
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        {doc.collaborators
                          ? `${doc.collaborators.nome} ${doc.collaborators.cognome}`
                          : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-200 font-medium text-sm">{doc.titolo}</td>
                    {macro === 'CONTRATTO' && (
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <TypeBadge tipo={doc.tipo} />
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell text-sm">
                      {doc.anno ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <SignBadge stato={doc.stato_firma} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell tabular-nums text-xs">
                      {new Date(doc.requested_at).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {isAdmin && macro === 'CONTRATTO' && (
                          <button
                            onClick={() => handleDelete(doc.id)}
                            disabled={deletingId === doc.id}
                            className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40 transition"
                          >
                            {deletingId === doc.id ? '…' : 'Elimina'}
                          </button>
                        )}
                        <Link
                          href={`/documenti/${doc.id}`}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Apri →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
