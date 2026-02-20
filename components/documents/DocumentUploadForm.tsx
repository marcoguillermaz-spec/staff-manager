'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DOCUMENT_TYPE_LABELS } from '@/lib/types';
import type { DocumentType, DocumentSignStatus } from '@/lib/types';

interface Collaborator {
  id: string;
  nome: string;
  cognome: string;
  user_id: string;
}

interface Props {
  collaborators: Collaborator[];
}

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';

const DOCUMENT_TYPES: DocumentType[] = ['CONTRATTO_OCCASIONALE', 'RICEVUTA_PAGAMENTO', 'CU'];

export default function DocumentUploadForm({ collaborators }: Props) {
  const router = useRouter();

  const [collaboratorId, setCollaboratorId] = useState('');
  const [tipo, setTipo] = useState<DocumentType | ''>('');
  const [anno, setAnno] = useState('');
  const [titolo, setTitolo] = useState('');
  const [statoFirma, setStatoFirma] = useState<DocumentSignStatus>('DA_FIRMARE');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isValid = collaboratorId && tipo && titolo.trim() && file;

  const handleSubmit = async () => {
    if (!isValid || !file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('collaborator_id', collaboratorId);
      formData.append('tipo', tipo);
      formData.append('titolo', titolo.trim());
      formData.append('stato_firma', statoFirma);
      if (anno) formData.append('anno', anno);

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore creazione documento');

      setSuccess(true);
      setCollaboratorId('');
      setTipo('');
      setAnno('');
      setTitolo('');
      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-5">
      <h2 className="text-base font-semibold text-gray-100">Carica documento</h2>

      {success && (
        <div className="rounded-lg bg-green-900/30 border border-green-800/40 px-3 py-2 text-sm text-green-400">
          Documento caricato con successo.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Collaboratore */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">
          Collaboratore <span className="text-red-500">*</span>
        </label>
        <select
          value={collaboratorId}
          onChange={(e) => setCollaboratorId(e.target.value)}
          className={inputCls}
        >
          <option value="">— Seleziona collaboratore —</option>
          {collaborators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.cognome} {c.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Tipo + Anno */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Tipo <span className="text-red-500">*</span>
          </label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as DocumentType)}
            className={inputCls}
          >
            <option value="">— Seleziona —</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Anno</label>
          <input
            type="number"
            value={anno}
            onChange={(e) => setAnno(e.target.value)}
            placeholder="es. 2025"
            min={2000}
            max={2100}
            className={inputCls}
          />
        </div>
      </div>

      {/* Titolo */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">
          Titolo <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
          placeholder="es. Contratto collaborazione febbraio 2026"
          className={inputCls}
        />
      </div>

      {/* Stato firma */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Firma richiesta</label>
        <div className="flex gap-4">
          {(['DA_FIRMARE', 'NON_RICHIESTO'] as DocumentSignStatus[]).map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="stato_firma"
                value={s}
                checked={statoFirma === s}
                onChange={() => setStatoFirma(s)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-300">
                {s === 'DA_FIRMARE' ? 'Sì — richiedi firma' : 'No — solo informativo'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* File */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">
          File PDF <span className="text-red-500">*</span>
        </label>
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600"
        />
        {file && <p className="mt-1 text-xs text-gray-500">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!isValid || loading}
        className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition"
      >
        {loading ? 'Caricamento…' : 'Carica documento'}
      </button>
    </div>
  );
}
