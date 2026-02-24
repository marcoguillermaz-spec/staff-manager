'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Document } from '@/lib/types';

interface Props {
  document: Document;
  originalUrl: string | null;
  firmatoUrl: string | null;
  canSign?: boolean;
}

export default function DocumentSignFlow({ document: doc, originalUrl, firmatoUrl, canSign = true }: Props) {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleUploadSigned = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/documents/${doc.id}/sign`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore durante il salvataggio');

      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-5">
      <h2 className="text-base font-semibold text-gray-100">Documento</h2>

      {/* Original download */}
      <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-800/60 border border-gray-700 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-200 font-medium truncate">{doc.file_original_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">Documento originale</p>
        </div>
        {originalUrl ? (
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-xs font-medium text-gray-200 transition"
          >
            Scarica
          </a>
        ) : (
          <span className="text-xs text-gray-500">URL non disponibile</span>
        )}
      </div>

      {/* Signed file (if present) */}
      {doc.stato_firma === 'FIRMATO' && firmatoUrl && (
        <div className="flex items-center justify-between gap-4 rounded-lg bg-green-900/20 border border-green-800/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm text-green-300 font-medium truncate">
              {doc.file_firmato_name ?? 'Documento firmato'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Firmato il {doc.signed_at ? new Date(doc.signed_at).toLocaleDateString('it-IT') : '—'}
            </p>
          </div>
          <a
            href={firmatoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-green-800 hover:bg-green-700 px-3 py-1.5 text-xs font-medium text-green-200 transition"
          >
            Scarica firmato
          </a>
        </div>
      )}

      {/* Upload signed — only if DA_FIRMARE and user can sign */}
      {doc.stato_firma === 'DA_FIRMARE' && !done && canSign && (
        <div className="space-y-3 border-t border-gray-800 pt-5">
          <p className="text-sm text-gray-300">
            Scarica il documento, firmalo e ricarica il PDF firmato.
          </p>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Carica PDF firmato <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600"
            />
            {file && <p className="mt-1 text-xs text-gray-500">{file.name}</p>}
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleUploadSigned}
            disabled={!file || loading}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition"
          >
            {loading ? 'Caricamento…' : 'Invia documento firmato'}
          </button>
        </div>
      )}

      {done && (
        <div className="rounded-lg bg-green-900/30 border border-green-800/40 px-3 py-2 text-sm text-green-400">
          Documento firmato inviato correttamente.
        </div>
      )}
    </div>
  );
}
