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

interface CollabData {
  id: string;
  nome: string | null;
  cognome: string | null;
  codice_fiscale: string | null;
  telefono: string | null;
  email: string | null;
  tipo_contratto: string | null;
  data_ingresso: string | null;
  luogo_nascita: string | null;
  provincia_nascita: string | null;
  comune: string | null;
  provincia_residenza: string | null;
  indirizzo: string | null;
  civico_residenza: string | null;
  data_nascita: string | null;
  tshirt_size: string | null;
  sono_un_figlio_a_carico: boolean;
  importo_lordo_massimale: number | null;
  username: string | null;
}

interface CollaboratoreDetailProps {
  collab: CollabData;
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

  // ── Username inline edit ─────────────────────────────────────────────────
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameEdit, setUsernameEdit] = useState(collab.username ?? '');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // ── Profile edit mode ─────────────────────────────────────────────────────
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  // Form fields
  const [fNome, setFNome]                       = useState(collab.nome ?? '');
  const [fCognome, setFCognome]                 = useState(collab.cognome ?? '');
  const [fCF, setFCF]                           = useState(collab.codice_fiscale ?? '');
  const [fDataNascita, setFDataNascita]         = useState(collab.data_nascita ?? '');
  const [fLuogoNascita, setFLuogoNascita]       = useState(collab.luogo_nascita ?? '');
  const [fProvinciaNascita, setFProvinciaNascita] = useState(collab.provincia_nascita ?? '');
  const [fComune, setFComune]                   = useState(collab.comune ?? '');
  const [fProvinciaRes, setFProvinciaRes]       = useState(collab.provincia_residenza ?? '');
  const [fIndirizzo, setFIndirizzo]             = useState(collab.indirizzo ?? '');
  const [fCivico, setFCivico]                   = useState(collab.civico_residenza ?? '');
  const [fTelefono, setFTelefono]               = useState(collab.telefono ?? '');
  const [fTshirt, setFTshirt]                   = useState(collab.tshirt_size ?? '');
  const [fSonoFiglio, setFSonoFiglio]           = useState(collab.sono_un_figlio_a_carico);
  const [fMassimale, setFMassimale]             = useState<string>(
    collab.importo_lordo_massimale != null ? String(collab.importo_lordo_massimale) : '',
  );
  const [fUsername, setFUsername]               = useState(collab.username ?? '');

  const openProfileEdit = () => {
    setFNome(collab.nome ?? '');
    setFCognome(collab.cognome ?? '');
    setFCF(collab.codice_fiscale ?? '');
    setFDataNascita(collab.data_nascita ?? '');
    setFLuogoNascita(collab.luogo_nascita ?? '');
    setFProvinciaNascita(collab.provincia_nascita ?? '');
    setFComune(collab.comune ?? '');
    setFProvinciaRes(collab.provincia_residenza ?? '');
    setFIndirizzo(collab.indirizzo ?? '');
    setFCivico(collab.civico_residenza ?? '');
    setFTelefono(collab.telefono ?? '');
    setFTshirt(collab.tshirt_size ?? '');
    setFSonoFiglio(collab.sono_un_figlio_a_carico);
    setFMassimale(collab.importo_lordo_massimale != null ? String(collab.importo_lordo_massimale) : '');
    setFUsername(collab.username ?? '');
    setProfileError(null);
    setProfileSaved(false);
    setEditingProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    const body: Record<string, unknown> = {
      nome:                fNome.trim() || undefined,
      cognome:             fCognome.trim() || undefined,
      codice_fiscale:      fCF.trim().toUpperCase() || null,
      data_nascita:        fDataNascita || null,
      luogo_nascita:       fLuogoNascita.trim() || null,
      provincia_nascita:   fProvinciaNascita.trim().toUpperCase() || null,
      comune:              fComune.trim() || null,
      provincia_residenza: fProvinciaRes.trim().toUpperCase() || null,
      indirizzo:           fIndirizzo.trim() || null,
      civico_residenza:    fCivico.trim() || null,
      telefono:            fTelefono.trim() || null,
      tshirt_size:         fTshirt || null,
      sono_un_figlio_a_carico: fSonoFiglio,
      importo_lordo_massimale: fMassimale !== '' ? parseFloat(fMassimale) : null,
    };
    if (fUsername.trim().length >= 3) body.username = fUsername.trim();

    const res = await fetch(`/api/admin/collaboratori/${collab.id}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setProfileSaving(false);
    if (res.ok) {
      setProfileSaved(true);
      setEditingProfile(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setProfileError(data.error ?? 'Errore durante il salvataggio');
    }
  };

  const handleSaveUsername = async () => {
    setUsernameSaving(true);
    setUsernameError(null);
    const res = await fetch(`/api/admin/collaboratori/${collab.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameEdit.trim() }),
    });
    setUsernameSaving(false);
    if (res.ok) {
      setEditingUsername(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setUsernameError(data.error ?? 'Errore durante il salvataggio');
    }
  };

  const canAct = role === 'responsabile_compensi' || role === 'amministrazione';

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
            {/* Username badge + inline edit */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {!editingUsername ? (
                <>
                  {collab.username ? (
                    <span className="text-xs font-mono bg-indigo-900/30 text-indigo-300 border border-indigo-700/40 px-2 py-0.5 rounded-full">
                      @{collab.username}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600 italic">Username non impostato</span>
                  )}
                  <button
                    type="button"
                    onClick={() => { setUsernameEdit(collab.username ?? ''); setEditingUsername(true); setUsernameError(null); }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition"
                  >
                    Modifica
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={usernameEdit}
                    onChange={(e) => setUsernameEdit(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    maxLength={50}
                    placeholder="username"
                    className="rounded-lg bg-gray-800 border border-gray-700 px-2 py-1 text-xs font-mono text-gray-100 w-40 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSaveUsername}
                    disabled={usernameSaving || usernameEdit.trim().length < 3}
                    className="px-2.5 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
                  >
                    {usernameSaving ? '…' : 'Salva'}
                  </button>
                  <button
                    onClick={() => { setEditingUsername(false); setUsernameError(null); }}
                    className="px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-200 transition"
                  >
                    Annulla
                  </button>
                  {usernameError && <span className="text-xs text-red-400">{usernameError}</span>}
                </div>
              )}
            </div>
          </div>
          {communityNames.length > 0 && (
            <div className="flex gap-1.5 flex-wrap justify-end">
              {communityNames.map((n) => (
                <span key={n} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{n}</span>
              ))}
            </div>
          )}
        </div>

        {/* Profile edit toggle */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Anagrafica</span>
          {!editingProfile && (
            <button
              type="button"
              onClick={openProfileEdit}
              className="text-xs text-blue-400 hover:text-blue-300 transition"
            >
              Modifica profilo
            </button>
          )}
        </div>

        {editingProfile ? (
          /* ── Edit form ───────────────────────────────────────────────── */
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Nome</label>
                <input type="text" value={fNome} onChange={(e) => setFNome(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Cognome</label>
                <input type="text" value={fCognome} onChange={(e) => setFCognome(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Username</label>
              <input type="text" value={fUsername}
                onChange={(e) => setFUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={50} placeholder="username"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Codice fiscale</label>
              <input type="text" value={fCF}
                onChange={(e) => setFCF(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={16}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Data di nascita</label>
                <input type="date" value={fDataNascita} onChange={(e) => setFDataNascita(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Città di nascita</label>
                <input type="text" value={fLuogoNascita} onChange={(e) => setFLuogoNascita(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Provincia di nascita</label>
              <input type="text" value={fProvinciaNascita}
                onChange={(e) => setFProvinciaNascita(e.target.value.toUpperCase())}
                maxLength={2}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 font-mono uppercase focus:outline-none focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Comune di residenza</label>
                <input type="text" value={fComune} onChange={(e) => setFComune(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Provincia residenza</label>
                <input type="text" value={fProvinciaRes}
                  onChange={(e) => setFProvinciaRes(e.target.value.toUpperCase())}
                  maxLength={2}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 font-mono uppercase focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] text-gray-500 mb-1">Indirizzo</label>
                <input type="text" value={fIndirizzo} onChange={(e) => setFIndirizzo(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Civico</label>
                <input type="text" value={fCivico} onChange={(e) => setFCivico(e.target.value)}
                  maxLength={10}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Telefono</label>
              <input type="tel" value={fTelefono} onChange={(e) => setFTelefono(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Taglia t-shirt</label>
              <select value={fTshirt} onChange={(e) => setFTshirt(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500">
                <option value="">— Non specificata —</option>
                {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={fSonoFiglio}
                  onChange={(e) => setFSonoFiglio(e.target.checked)}
                  className="accent-blue-600 w-4 h-4" />
                <span className="text-sm text-gray-300">Fiscalmente a carico</span>
              </label>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Massimale lordo annuo (max €5.000)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">€</span>
                <input type="number" min={1} max={5000} step={1} value={fMassimale}
                  onChange={(e) => setFMassimale(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 pl-7 pr-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            {profileError && (
              <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">{profileError}</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => { setEditingProfile(false); setProfileError(null); }}
                className="px-3 py-1.5 rounded-md text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={profileSaving}
                className="px-4 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
              >
                {profileSaving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </form>
        ) : (
          /* ── Read-only dl grid ──────────────────────────────────────── */
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
        )}
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
