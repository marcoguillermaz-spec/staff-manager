'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { EXPENSE_CATEGORIES } from '@/lib/types';
import type { ExpenseCategory } from '@/lib/types';

interface FormData {
  categoria: ExpenseCategory | '';
  data_spesa: string;
  importo: string;
  descrizione: string;
}

const INITIAL_FORM: FormData = {
  categoria: '',
  data_spesa: '',
  importo: '',
  descrizione: '',
};

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';

const selectCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex gap-1.5 mb-6">
      {([1, 2, 3] as const).map((s) => (
        <div
          key={s}
          className={`h-1 flex-1 rounded-full transition-colors ${
            s < step ? 'bg-blue-600' : s === step ? 'bg-blue-500' : 'bg-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

export default function ExpenseForm() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const importoNum = parseFloat(form.importo);
  const step1Valid =
    form.categoria !== '' &&
    form.data_spesa !== '' &&
    !isNaN(importoNum) && importoNum > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...selected.filter((f) => !names.has(f.name))];
    });
    e.target.value = '';
  };

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Create expense (always INVIATO)
      const body: Record<string, unknown> = {
        categoria: form.categoria,
        data_spesa: form.data_spesa,
        importo: importoNum,
      };
      if (form.descrizione.trim()) body.descrizione = form.descrizione.trim();

      const createRes = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? 'Errore creazione rimborso');

      const expenseId: string = createData.reimbursement.id;

      // 2. Upload files to Supabase Storage (bucket: 'expenses')
      if (files.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Sessione scaduta');

        const uploadFailed: string[] = [];

        for (const file of files) {
          const path = `${user.id}/${expenseId}/${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from('expenses')
            .upload(path, file, { upsert: true });

          if (uploadErr) {
            uploadFailed.push(`${file.name}: ${uploadErr.message}`);
            continue;
          }

          const { data: urlData } = supabase.storage.from('expenses').getPublicUrl(path);

          await fetch(`/api/expenses/${expenseId}/attachments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_url: urlData.publicUrl, file_name: file.name }),
          });
        }

        if (uploadFailed.length > 0) {
          setError(
            `Rimborso salvato, ma ${uploadFailed.length} allegato/i non caricato/i:\n${uploadFailed.join('\n')}`,
          );
          setLoading(false);
          router.push(`/rimborsi/${expenseId}`);
          return;
        }
      }

      router.push('/rimborsi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto');
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
      {/* Step indicator */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 mb-2">Step {step} di 3</p>
        <ProgressBar step={step} />
      </div>

      {/* ── Step 1 — Dati rimborso ─────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-gray-100">Dati rimborso</h2>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Categoria <span className="text-red-500">*</span>
            </label>
            <select
              value={form.categoria}
              onChange={(e) => set('categoria', e.target.value)}
              className={selectCls}
            >
              <option value="">— Seleziona —</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Data spesa <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.data_spesa}
                onChange={(e) => set('data_spesa', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Importo (€) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.importo}
                onChange={(e) => set('importo', e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
              {!isNaN(importoNum) && importoNum > 0 && (
                <p className="text-xs text-green-400 mt-1">{formatCurrency(importoNum)}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Descrizione{' '}
              <span className="text-gray-600">(opzionale)</span>
            </label>
            <textarea
              value={form.descrizione}
              onChange={(e) => set('descrizione', e.target.value)}
              rows={3}
              placeholder="Descrivi la spesa sostenuta…"
              className={inputCls}
            />
          </div>

          <div className="flex justify-between pt-1">
            <button
              onClick={() => router.push('/rimborsi')}
              className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition"
            >
              ← Annulla
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-6 py-2.5 text-sm font-medium text-white transition disabled:opacity-50"
            >
              Avanti →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 — Allegati ─────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-gray-100">Allegati</h2>

          <div>
            <label className="block text-xs text-gray-400 mb-2">
              Documenti giustificativi{' '}
              <span className="text-gray-600">(PDF, JPG, PNG — max 10 MB ciascuno — opzionali)</span>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-dashed border-gray-600 px-4 py-6 cursor-pointer hover:border-gray-500 transition">
              <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-sm text-gray-400">Clicca per selezionare file</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-3 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2">
                    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="flex-1 text-sm text-gray-300 truncate">{f.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button
                      onClick={() => removeFile(f.name)}
                      className="shrink-0 text-gray-600 hover:text-red-400 transition"
                      aria-label="Rimuovi"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-between pt-1">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition"
            >
              ← Indietro
            </button>
            <button
              onClick={() => setStep(3)}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-6 py-2.5 text-sm font-medium text-white transition"
            >
              Avanti →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 — Riepilogo ────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-gray-100">Riepilogo</h2>

          <dl className="divide-y divide-gray-800">
            <div className="flex justify-between py-2.5">
              <dt className="text-xs text-gray-500">Categoria</dt>
              <dd className="text-sm text-gray-200">{form.categoria}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-xs text-gray-500">Data spesa</dt>
              <dd className="text-sm text-gray-200">
                {new Date(form.data_spesa + 'T00:00:00').toLocaleDateString('it-IT')}
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-xs text-gray-500">Importo</dt>
              <dd className="text-sm font-semibold text-green-400">{formatCurrency(importoNum)}</dd>
            </div>
            {form.descrizione.trim() && (
              <div className="flex justify-between py-2.5 gap-4">
                <dt className="text-xs text-gray-500 shrink-0">Descrizione</dt>
                <dd className="text-sm text-gray-200 text-right">{form.descrizione.trim()}</dd>
              </div>
            )}
            <div className="flex justify-between py-2.5">
              <dt className="text-xs text-gray-500">Allegati</dt>
              <dd className="text-sm text-gray-200">
                {files.length === 0 ? (
                  <span className="text-gray-500">Nessuno</span>
                ) : (
                  <span>{files.length} {files.length === 1 ? 'file' : 'file'}</span>
                )}
              </dd>
            </div>
            {files.length > 0 && (
              <div className="py-2">
                <ul className="space-y-1 text-right">
                  {files.map((f) => (
                    <li key={f.name} className="text-xs text-gray-500">{f.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </dl>

          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2.5 text-xs text-red-400 whitespace-pre-line">
              {error}
            </div>
          )}

          <div className="flex justify-between pt-1">
            <button
              onClick={() => setStep(2)}
              disabled={loading}
              className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition disabled:opacity-50"
            >
              ← Indietro
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-6 py-2.5 text-sm font-medium text-white transition disabled:opacity-50"
            >
              {loading ? 'Invio in corso…' : 'Conferma e invia'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
