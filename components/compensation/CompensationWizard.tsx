'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type CompensationType = 'OCCASIONALE' | 'PIVA';

interface Community {
  id: string;
  name: string;
}

// ── Step 1 form state ─────────────────────────────────────────
interface FormData {
  tipo: CompensationType;
  community_id: string;
  periodo_riferimento: string;
  data_competenza: string;
  descrizione: string;
  // Occasionale
  importo_lordo: string;
  // PIVA
  numero_fattura: string;
  data_fattura: string;
  imponibile: string;
  iva_percentuale: string;
}

const INITIAL_FORM: FormData = {
  tipo: 'OCCASIONALE',
  community_id: '',
  periodo_riferimento: '',
  data_competenza: '',
  descrizione: '',
  importo_lordo: '',
  numero_fattura: '',
  data_fattura: '',
  imponibile: '',
  iva_percentuale: '22',
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

// ── Derived calculations ──────────────────────────────────────
function deriveOccasionale(lordo: number) {
  const ritenuta = Math.round(lordo * 0.2 * 100) / 100;
  const netto = Math.round((lordo - ritenuta) * 100) / 100;
  return { ritenuta, netto };
}

function derivePiva(imponibile: number, iva: number) {
  const totale = Math.round((imponibile + imponibile * (iva / 100)) * 100) / 100;
  return { totale };
}

export default function CompensationWizard() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load communities on mount
  useEffect(() => {
    fetch('/api/compensations/communities')
      .then((r) => r.json())
      .then((d) => {
        const list: Community[] = d.communities ?? [];
        setCommunities(list);
        if (list.length === 1) setForm((f) => ({ ...f, community_id: list[0].id }));
      })
      .catch(() => {});
  }, []);

  const set = (field: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  // Derived values
  const lordo = parseFloat(form.importo_lordo);
  const occasionaleValid = !isNaN(lordo) && lordo > 0;
  const { ritenuta, netto } = occasionaleValid
    ? deriveOccasionale(lordo)
    : { ritenuta: 0, netto: 0 };

  const imp = parseFloat(form.imponibile);
  const ivaP = parseFloat(form.iva_percentuale);
  const pivaValid = !isNaN(imp) && imp > 0 && !isNaN(ivaP);
  const { totale } = pivaValid ? derivePiva(imp, ivaP) : { totale: 0 };

  // Step 1 validation
  const step1Valid =
    form.community_id !== '' &&
    form.descrizione.trim() !== '' &&
    (form.tipo === 'OCCASIONALE' ? occasionaleValid : pivaValid);

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

  // ── Submit flow ───────────────────────────────────────────────
  const handleSubmit = async (draft: boolean) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Build payload — always create as BOZZA first so attachments can be uploaded
      // (RLS only allows attachment inserts in BOZZA/INTEGRAZIONI_RICHIESTE)
      // If the user clicked "Invia" we'll transition to INVIATO after uploads.
      let payload: Record<string, unknown> = {
        tipo: form.tipo,
        community_id: form.community_id,
        descrizione: form.descrizione.trim(),
        periodo_riferimento: form.periodo_riferimento.trim() || undefined,
        data_competenza: form.data_competenza || undefined,
        stato: 'BOZZA',
      };

      if (form.tipo === 'OCCASIONALE') {
        payload = {
          ...payload,
          importo_lordo: lordo,
          ritenuta_acconto: ritenuta,
          importo_netto: netto,
        };
      } else {
        payload = {
          ...payload,
          numero_fattura: form.numero_fattura.trim() || undefined,
          data_fattura: form.data_fattura || undefined,
          imponibile: imp,
          iva_percentuale: ivaP,
          totale_fattura: totale,
        };
      }

      // 2. Create compensation record
      const createRes = await fetch('/api/compensations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? 'Errore creazione compenso');

      const compId: string = createData.compensation.id;

      // 3. Upload files to Supabase Storage
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessione scaduta');

      const uploadFailed: string[] = [];

      for (const file of files) {
        const path = `${user.id}/${compId}/${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('compensations')
          .upload(path, file, { upsert: true });

        if (uploadErr) {
          uploadFailed.push(`${file.name}: ${uploadErr.message}`);
          continue;
        }

        // 4. Get public URL
        const { data: urlData } = supabase.storage.from('compensations').getPublicUrl(path);

        // 5. Register attachment record
        await fetch(`/api/compensations/${compId}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_url: urlData.publicUrl, file_name: file.name }),
        });
      }

      if (uploadFailed.length > 0) {
        // Compensation saved, but some uploads failed — go to detail page so user can retry
        setError(`Compenso salvato, ma ${uploadFailed.length} allegato/i non caricato/i:\n${uploadFailed.join('\n')}`);
        setLoading(false);
        router.push(`/compensi/${compId}`);
        return;
      }

      // 6. If user clicked "Invia" (not draft), transition BOZZA → INVIATO now that
      //    all attachments are registered (RLS requires BOZZA for attachment inserts)
      if (!draft) {
        const transRes = await fetch(`/api/compensations/${compId}/transition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'submit' }),
        });
        if (!transRes.ok) {
          const transData = await transRes.json();
          throw new Error(transData.error ?? 'Errore durante l\'invio del compenso');
        }
      }

      router.push('/compensi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto');
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                s < step
                  ? 'bg-blue-600 text-white'
                  : s === step
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-950'
                  : 'bg-gray-800 text-gray-500'
              }`}
            >
              {s < step ? '✓' : s}
            </div>
            <span className={`text-xs ${s === step ? 'text-gray-200' : 'text-gray-600'}`}>
              {s === 1 ? 'Dati' : s === 2 ? 'Allegati' : 'Riepilogo'}
            </span>
            {s < 3 && <div className="w-8 h-px bg-gray-700" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Data entry */}
      {step === 1 && (
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-100">Dati compenso</h2>

          {/* Tipo */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Tipologia</label>
            <div className="flex gap-3">
              {(['OCCASIONALE', 'PIVA'] as const).map((t) => (
                <label
                  key={t}
                  className={`flex-1 flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition ${
                    form.tipo === t ? 'border-blue-600 bg-blue-900/20' : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo"
                    value={t}
                    checked={form.tipo === t}
                    onChange={() => set('tipo', t)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-200">{t === 'OCCASIONALE' ? 'Prestazione occasionale' : 'P.IVA / Fattura'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Community */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Community</label>
            <select
              value={form.community_id}
              onChange={(e) => set('community_id', e.target.value)}
              className={selectCls}
              required
            >
              <option value="">— Seleziona —</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Periodo + data competenza */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Periodo di riferimento</label>
              <input
                type="text"
                value={form.periodo_riferimento}
                onChange={(e) => set('periodo_riferimento', e.target.value)}
                placeholder="Es. Marzo 2025"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Data competenza</label>
              <input
                type="date"
                value={form.data_competenza}
                onChange={(e) => set('data_competenza', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Descrizione */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Descrizione attività <span className="text-red-500">*</span></label>
            <textarea
              value={form.descrizione}
              onChange={(e) => set('descrizione', e.target.value)}
              rows={3}
              placeholder="Descrivi l'attività svolta…"
              className={inputCls}
              required
            />
          </div>

          {/* OCCASIONALE fields */}
          {form.tipo === 'OCCASIONALE' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Importo lordo (€) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.importo_lordo}
                  onChange={(e) => set('importo_lordo', e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                  required
                />
              </div>
              {occasionaleValid && (
                <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-4 py-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Ritenuta acconto (20%)</p>
                    <p className="text-sm font-medium text-red-400">− {formatCurrency(ritenuta)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Importo netto</p>
                    <p className="text-sm font-medium text-green-400">{formatCurrency(netto)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PIVA fields */}
          {form.tipo === 'PIVA' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">N. Fattura</label>
                  <input
                    type="text"
                    value={form.numero_fattura}
                    onChange={(e) => set('numero_fattura', e.target.value)}
                    placeholder="Es. 001/2025"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Data fattura</label>
                  <input
                    type="date"
                    value={form.data_fattura}
                    onChange={(e) => set('data_fattura', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Imponibile (€) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.imponibile}
                    onChange={(e) => set('imponibile', e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">IVA (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={form.iva_percentuale}
                    onChange={(e) => set('iva_percentuale', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              {pivaValid && (
                <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-4 py-3">
                  <p className="text-xs text-gray-500">Totale fattura (imponibile + IVA)</p>
                  <p className="text-sm font-medium text-green-400">{formatCurrency(totale)}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
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

      {/* Step 2 — Attachments */}
      {step === 2 && (
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-100">Allegati</h2>

          {form.tipo === 'PIVA' && (
            <div className="rounded-lg bg-blue-900/20 border border-blue-700/40 px-4 py-3">
              <p className="text-xs text-blue-300">
                Per P.IVA si raccomanda di allegare la fattura (PDF).
              </p>
            </div>
          )}

          {/* File input */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">
              Aggiungi file
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
          </div>

          {/* File list */}
          {files.length > 0 && (
            <ul className="space-y-2">
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

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition"
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

      {/* Step 3 — Summary */}
      {step === 3 && (
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-100">Riepilogo</h2>

          {/* Summary table */}
          <div className="rounded-xl bg-gray-800/50 border border-gray-700 divide-y divide-gray-700">
            {[
              ['Tipologia', form.tipo],
              ['Community', communities.find((c) => c.id === form.community_id)?.name ?? '—'],
              ['Periodo', form.periodo_riferimento || '—'],
              ['Data competenza', form.data_competenza || '—'],
              ['Descrizione', form.descrizione],
              ...(form.tipo === 'OCCASIONALE'
                ? [
                    ['Importo lordo', formatCurrency(lordo)],
                    ['Ritenuta (20%)', `− ${formatCurrency(ritenuta)}`],
                    ['Importo netto', formatCurrency(netto)],
                  ]
                : [
                    ['N. Fattura', form.numero_fattura || '—'],
                    ['Data fattura', form.data_fattura || '—'],
                    ['Imponibile', formatCurrency(imp)],
                    ['IVA', `${form.iva_percentuale}%`],
                    ['Totale', formatCurrency(totale)],
                  ]),
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3 px-4 py-2.5">
                <span className="w-36 shrink-0 text-xs text-gray-500">{label}</span>
                <span className="text-sm text-gray-200">{value}</span>
              </div>
            ))}
          </div>

          {/* Files to upload */}
          {files.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Allegati da caricare ({files.length})</p>
              <ul className="space-y-1">
                {files.map((f) => (
                  <li key={f.name} className="text-xs text-gray-400">· {f.name}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-between">
            <button
              onClick={() => setStep(2)}
              disabled={loading}
              className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition disabled:opacity-50"
            >
              ← Indietro
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => handleSubmit(true)}
                disabled={loading}
                className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition disabled:opacity-50"
              >
                {loading ? 'Salvataggio…' : 'Salva bozza'}
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={loading}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-6 py-2.5 text-sm font-medium text-white transition disabled:opacity-50"
              >
                {loading ? 'Invio in corso…' : 'Invia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
