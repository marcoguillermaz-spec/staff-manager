'use client';

import Link from 'next/link';
import type { Document } from '@/lib/types';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_SIGN_STATUS_LABELS } from '@/lib/types';

interface DocumentRow extends Document {
  collaborators?: { nome: string; cognome: string } | null;
}

interface Props {
  documents: DocumentRow[];
  isAdmin: boolean;
}

function SignBadge({ stato }: { stato: string }) {
  const colors: Record<string, string> = {
    DA_FIRMARE:    'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
    FIRMATO:       'bg-green-900/40 text-green-300 border-green-700/40',
    NON_RICHIESTO: 'bg-gray-800 text-gray-400 border-gray-700',
  };
  const labels: Record<string, string> = {
    DA_FIRMARE:    'Da firmare',
    FIRMATO:       'Firmato',
    NON_RICHIESTO: 'Info',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[stato] ?? colors.NON_RICHIESTO}`}>
      {labels[stato] ?? stato}
    </span>
  );
}

export default function DocumentList({ documents, isAdmin }: Props) {
  if (documents.length === 0) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center">
        <p className="text-sm text-gray-500">Nessun documento disponibile.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {isAdmin && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Collaboratore</th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Titolo</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Tipo</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Anno</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Stato</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden lg:table-cell">Data</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-800/50 transition">
              {isAdmin && (
                <td className="px-4 py-3 text-gray-300">
                  {doc.collaborators
                    ? `${doc.collaborators.nome} ${doc.collaborators.cognome}`
                    : '—'}
                </td>
              )}
              <td className="px-4 py-3 text-gray-200 font-medium">{doc.titolo}</td>
              <td className="px-4 py-3 text-gray-400 hidden sm:table-cell text-xs">
                {DOCUMENT_TYPE_LABELS[doc.tipo] ?? doc.tipo}
              </td>
              <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                {doc.anno ?? '—'}
              </td>
              <td className="px-4 py-3">
                <SignBadge stato={doc.stato_firma} />
              </td>
              <td className="px-4 py-3 text-gray-500 hidden lg:table-cell tabular-nums text-xs">
                {new Date(doc.requested_at).toLocaleDateString('it-IT')}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/documenti/${doc.id}`}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Apri →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
