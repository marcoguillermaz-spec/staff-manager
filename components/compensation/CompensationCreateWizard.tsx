'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Community = { id: string; name: string };

type CollaboratorResult = {
  id: string;
  nome: string;
  cognome: string;
  username: string | null;
  codice_fiscale: string | null;
  is_active: boolean;
  member_status: string | null;
  communities: Community[];
};

type WizardStep = 'choice' | 'step1' | 'step2' | 'step3';

type FormData = {
  community_id: string;
  periodo_riferimento: string;
  data_competenza: string;
  descrizione: string;
  corso_appartenenza: string;
  importo_lordo: string;
};

const RITENUTA_RATE = 0.2;

function formatCurrency(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {([1, 2, 3] as const).map((step) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              step === current
                ? 'bg-blue-600 text-white'
                : step < current
                ? 'bg-green-700 text-white'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {step}
          </div>
          {step < 3 && <div className="w-8 h-px bg-gray-700" />}
        </div>
      ))}
      <span className="ml-2 text-xs text-gray-500">{current} di 3</span>
    </div>
  );
}

export default function CompensationCreateWizard({
  managedCommunities,
}: {
  managedCommunities: Community[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('choice');

  // Step 1 state
  const [searchQ, setSearchQ] = useState('');
  const [communityFilter, setCommunityFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [collaborators, setCollaborators] = useState<CollaboratorResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedCollab, setSelectedCollab] = useState<CollaboratorResult | null>(null);

  // Step 2 state
  const [formData, setFormData] = useState<FormData>({
    community_id: '',
    periodo_riferimento: '',
    data_competenza: '',
    descrizione: '',
    corso_appartenenza: '',
    importo_lordo: '',
  });
  const [step2Error, setStep2Error] = useState('');

  // Step 3 state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchCollaborators = useCallback(async () => {
    setLoadingSearch(true);
    try {
      const params = new URLSearchParams();
      if (searchQ) params.set('q', searchQ);
      if (communityFilter) params.set('community_id', communityFilter);
      params.set('active_only', String(activeOnly));
      const res = await fetch(`/api/admin/collaboratori?${params}`);
      if (res.ok) {
        const json = await res.json();
        setCollaborators(json.collaborators ?? []);
      }
    } finally {
      setLoadingSearch(false);
    }
  }, [searchQ, communityFilter, activeOnly]);

  useEffect(() => {
    if (step === 'step1') {
      const timeout = setTimeout(fetchCollaborators, 300);
      return () => clearTimeout(timeout);
    }
  }, [step, fetchCollaborators]);

  function handleSelectCollab(c: CollaboratorResult) {
    setSelectedCollab(c);
    // Pre-fill community_id from filter or first available community in intersection
    const intersectionCommunities = managedCommunities.length > 0
      ? c.communities.filter((cc) => managedCommunities.some((mc) => mc.id === cc.id))
      : c.communities;
    const prefilledCommunity = communityFilter
      ? intersectionCommunities.find((cc) => cc.id === communityFilter)?.id ?? ''
      : intersectionCommunities[0]?.id ?? '';
    setFormData((prev) => ({ ...prev, community_id: prefilledCommunity }));
    setStep('step2');
  }

  function validateStep2(): string {
    if (!formData.importo_lordo || parseFloat(formData.importo_lordo) <= 0) {
      return 'Importo lordo obbligatorio e deve essere positivo';
    }
    return '';
  }

  function handleStep2Next() {
    const err = validateStep2();
    if (err) { setStep2Error(err); return; }
    setStep2Error('');
    setStep('step3');
  }

  async function handleSubmit() {
    if (!selectedCollab) return;
    setSubmitting(true);
    setSubmitError('');

    const lordo = parseFloat(formData.importo_lordo);
    const ritenuta = Math.round(lordo * RITENUTA_RATE * 100) / 100;
    const netto = Math.round((lordo - ritenuta) * 100) / 100;

    const payload: Record<string, unknown> = {
      collaborator_id: selectedCollab.id,
      importo_lordo: lordo,
      ritenuta_acconto: ritenuta,
      importo_netto: netto,
    };
    if (formData.community_id) payload.community_id = formData.community_id;
    if (formData.periodo_riferimento.trim()) payload.periodo_riferimento = formData.periodo_riferimento.trim();
    if (formData.data_competenza) payload.data_competenza = formData.data_competenza;
    if (formData.descrizione.trim()) payload.descrizione = formData.descrizione.trim();
    if (formData.corso_appartenenza.trim()) payload.corso_appartenenza = formData.corso_appartenenza.trim();

    try {
      const res = await fetch('/api/compensations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        setSubmitError(json.error ?? 'Errore nella creazione del compenso');
        return;
      }
      router.push('/approvazioni?tab=compensi');
    } catch {
      setSubmitError('Errore di rete. Riprova.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Choice screen ──────────────────────────────────────────────────────────
  if (step === 'choice') {
    return (
      <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-100">Carica compensi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Scegli la modalità di caricamento.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setStep('step1')}
            className="rounded-xl bg-gray-900 border border-gray-800 hover:border-blue-600 p-6 text-left transition group"
          >
            <div className="text-2xl mb-3">👤</div>
            <p className="font-medium text-gray-100 group-hover:text-blue-400 transition">
              Singolo per docente
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Inserisci un compenso per un collaboratore specifico.
            </p>
          </button>
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 opacity-50 cursor-not-allowed">
            <div className="text-2xl mb-3">📊</div>
            <p className="font-medium text-gray-400">Caricamento da Excel</p>
            <p className="text-xs text-gray-500 mt-1">
              Carica più compensi da un file .xlsx.
            </p>
            <span className="mt-2 inline-block text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded">
              Prossimamente
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1 — Seleziona collaboratore ──────────────────────────────────────
  if (step === 'step1') {
    return (
      <div className="p-6 max-w-3xl">
        <div className="mb-2">
          <h1 className="text-xl font-semibold text-gray-100">Carica compensi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Seleziona il collaboratore</p>
        </div>
        <StepIndicator current={1} />

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Cerca per nome, cognome o username..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <select
            value={communityFilter}
            onChange={(e) => setCommunityFilter(e.target.value)}
            className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">Tutte le community</option>
            {managedCommunities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-400 whitespace-nowrap">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded"
            />
            Solo attivi
          </label>
        </div>

        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          {loadingSearch ? (
            <p className="p-6 text-sm text-gray-500 text-center">Ricerca in corso...</p>
          ) : collaborators.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">
              {searchQ || communityFilter ? 'Nessun collaboratore trovato.' : 'Inserisci un termine di ricerca o seleziona una community.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Community</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {collaborators.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-800/50 transition">
                    <td className="px-4 py-3 text-gray-100">
                      {c.cognome} {c.nome}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                      {c.username ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {c.communities.map((cc) => cc.name).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSelectCollab(c)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Seleziona →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4">
          <button
            onClick={() => setStep('choice')}
            className="text-sm text-gray-500 hover:text-gray-300 transition"
          >
            ← Indietro
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2 — Dati compenso ────────────────────────────────────────────────
  if (step === 'step2' && selectedCollab) {
    const lordo = parseFloat(formData.importo_lordo) || 0;
    const ritenuta = Math.round(lordo * RITENUTA_RATE * 100) / 100;
    const netto = Math.round((lordo - ritenuta) * 100) / 100;

    const availableCommunities = managedCommunities.length > 0
      ? selectedCollab.communities.filter((cc) => managedCommunities.some((mc) => mc.id === cc.id))
      : selectedCollab.communities;

    return (
      <div className="p-6 max-w-xl">
        <div className="mb-2">
          <h1 className="text-xl font-semibold text-gray-100">Carica compensi</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Dati del compenso per {selectedCollab.cognome} {selectedCollab.nome}
          </p>
        </div>
        <StepIndicator current={2} />

        <div className="space-y-4">
          {availableCommunities.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Community
              </label>
              <select
                value={formData.community_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, community_id: e.target.value }))}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">— Nessuna community —</option>
                {availableCommunities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Descrizione <span className="text-gray-600">(opzionale)</span>
            </label>
            <input
              type="text"
              value={formData.descrizione}
              onChange={(e) => setFormData((prev) => ({ ...prev, descrizione: e.target.value }))}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="Es. Compenso lezioni marzo"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Periodo di riferimento <span className="text-gray-600">(opzionale)</span>
            </label>
            <input
              type="text"
              value={formData.periodo_riferimento}
              onChange={(e) => setFormData((prev) => ({ ...prev, periodo_riferimento: e.target.value }))}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="Es. Febbraio 2025"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Data di competenza <span className="text-gray-600">(opzionale)</span>
            </label>
            <input
              type="date"
              value={formData.data_competenza}
              onChange={(e) => setFormData((prev) => ({ ...prev, data_competenza: e.target.value }))}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Corso di appartenenza <span className="text-gray-600">(opzionale)</span>
            </label>
            <input
              type="text"
              value={formData.corso_appartenenza}
              onChange={(e) => setFormData((prev) => ({ ...prev, corso_appartenenza: e.target.value }))}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="Es. Corso Python avanzato"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Importo lordo (€)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.importo_lordo}
              onChange={(e) => setFormData((prev) => ({ ...prev, importo_lordo: e.target.value }))}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="0,00"
            />
          </div>

          {lordo > 0 && (
            <div className="rounded-lg bg-gray-800/60 border border-gray-700 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Ritenuta d&apos;acconto (20%)</span>
                <span className="text-red-400 tabular-nums">-{formatCurrency(ritenuta)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-300">Importo netto</span>
                <span className="text-green-400 tabular-nums">{formatCurrency(netto)}</span>
              </div>
            </div>
          )}

          {step2Error && (
            <p className="text-xs text-red-400">{step2Error}</p>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep('step1')}
              className="text-sm text-gray-500 hover:text-gray-300 transition"
            >
              ← Indietro
            </button>
            <button
              onClick={handleStep2Next}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white transition"
            >
              Avanti →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3 — Riepilogo ────────────────────────────────────────────────────
  if (step === 'step3' && selectedCollab) {
    const lordo = parseFloat(formData.importo_lordo) || 0;
    const ritenuta = Math.round(lordo * RITENUTA_RATE * 100) / 100;
    const netto = Math.round((lordo - ritenuta) * 100) / 100;
    const communityName = selectedCollab.communities.find((c) => c.id === formData.community_id)?.name;

    const rows: { label: string; value: string }[] = [
      { label: 'Collaboratore', value: `${selectedCollab.cognome} ${selectedCollab.nome}` },
      { label: 'Stato', value: 'In attesa' },
    ];
    if (communityName) rows.push({ label: 'Community', value: communityName });
    if (formData.periodo_riferimento.trim()) rows.push({ label: 'Periodo', value: formData.periodo_riferimento.trim() });
    if (formData.data_competenza) rows.push({ label: 'Data competenza', value: new Date(formData.data_competenza).toLocaleDateString('it-IT') });
    if (formData.corso_appartenenza.trim()) rows.push({ label: 'Corso', value: formData.corso_appartenenza.trim() });
    if (formData.descrizione.trim()) rows.push({ label: 'Descrizione', value: formData.descrizione.trim() });
    rows.push(
      { label: 'Importo lordo', value: formatCurrency(lordo) },
      { label: 'Ritenuta (20%)', value: `-${formatCurrency(ritenuta)}` },
      { label: 'Importo netto', value: formatCurrency(netto) },
    );

    return (
      <div className="p-6 max-w-xl">
        <div className="mb-2">
          <h1 className="text-xl font-semibold text-gray-100">Carica compensi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Riepilogo</p>
        </div>
        <StepIndicator current={3} />

        <div className="rounded-xl bg-gray-900 border border-gray-800 divide-y divide-gray-800">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-gray-500">{row.label}</span>
              <span className="text-sm text-gray-200">{row.value}</span>
            </div>
          ))}
        </div>

        {submitError && (
          <p className="mt-3 text-xs text-red-400">{submitError}</p>
        )}

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setStep('step2')}
            className="text-sm text-gray-500 hover:text-gray-300 transition"
            disabled={submitting}
          >
            ← Indietro
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-2 text-sm font-medium text-white transition"
          >
            {submitting ? 'Creazione...' : 'Crea compenso'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
