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

export default function ExpenseForm() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const importoNum = parseFloat(form.importo);
  const formValid =
    form.categoria !== '' &&
    form.data_spesa !== '' &&
    !isNaN(importoNum) && importoNum > 0 &&
    form.descrizione.trim() !== '';

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
    if (!formValid) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Create expense (always INVIATO)
      const createRes = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoria: form.categoria,
          data_spesa: form.data_spesa,
          importo: importoNum,
          descrizione: form.descrizione.trim(),
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? 'Errore creazione rimborso');

      const expenseId: string = createData.reimbursement.id;

      // 2. Upload files to Supabase Storage (bucket: 'expenses')
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

        // 3. Get public URL
        const { data: urlData } = supabase.storage.from('expenses').getPublicUrl(path);

        // 4. Register attachment record
        await fetch(`/api/expenses/${expenseId}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_url: urlData.publicUrl, file_name: file.name }),
        });
      }

      if (uploadFailed.length > 0) {
        setError(`Rimborso salvato, ma ${uploadFailed.length} allegato/i non caricato/i:\n${uploadFailed.join('\n')}`);
        setLoading(false);
        router.push(`/rimborsi/${expenseId}`);
        return;
      }

      router.push('/rimborsi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto');
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 space-y-5">
      <h2 className="text-base font-semibold text-gray-100">Dati rimborso</h2>

      {/* Categoria */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Categoria <span className="text-red-500">*</span></label>
        <select
          value={form.categoria}
          onChange={(e) => set('categoria', e.target.value)}
          className={selectCls}
          required
        >
          <option value="">— Seleziona —</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Data spesa + Importo */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Data spesa <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={form.data_spesa}
            onChange={(e) => set('data_spesa', e.target.value)}
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Importo (€) <span className="text-red-500">*</span></label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.importo}
            onChange={(e) => set('importo', e.target.value)}
            placeholder="0.00"
            className={inputCls}
            required
          />
          {!isNaN(importoNum) && importoNum > 0 && (
            <p className="text-xs text-green-400 mt-1">{formatCurrency(importoNum)}</p>
          )}
        </div>
      </div>

      {/* Descrizione */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Descrizione <span className="text-red-500">*</span></label>
        <textarea
          value={form.descrizione}
          onChange={(e) => set('descrizione', e.target.value)}
          rows={3}
          placeholder="Descrivi la spesa sostenuta…"
          className={inputCls}
          required
        />
      </div>

      {/* File drop zone */}
      <div>
        <label className="block text-xs text-gray-400 mb-2">
          Allegati
          <span className="text-gray-600 ml-1">(PDF, JPG, PNG — max 10 MB ciascuno)</span>
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-dashed border-gray-600 px-4 py-4 cursor-pointer hover:border-gray-500 transition">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2.5 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!formValid || loading}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 px-6 py-2.5 text-sm font-medium text-white transition disabled:opacity-50"
        >
          {loading ? 'Invio in corso…' : 'Invia rimborso'}
        </button>
      </div>
    </div>
  );
}
