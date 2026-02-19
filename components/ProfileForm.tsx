'use client';

import { useState } from 'react';

type Collaborator = {
  nome: string;
  cognome: string;
  email: string;
  codice_fiscale: string | null;
  partita_iva: string | null;
  data_nascita: string | null;
  data_ingresso: string | null;
  telefono: string | null;
  indirizzo: string | null;
  iban: string | null;
  tshirt_size: string | null;
};

type Props = {
  collaborator: Collaborator | null;
  role: string;
  email: string;
  communities: { name: string }[];
};

const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';
const readonlyCls =
  'w-full rounded-lg bg-gray-850 border border-gray-800 px-3 py-2.5 text-sm text-gray-400 select-all';
const labelCls = 'block text-xs text-gray-500 mb-1.5';

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <div className={readonlyCls}>{value || <span className="text-gray-600 italic">—</span>}</div>
    </div>
  );
}

export default function ProfileForm({ collaborator, role, email, communities }: Props) {
  const [telefono, setTelefono] = useState(collaborator?.telefono ?? '');
  const [indirizzo, setIndirizzo] = useState(collaborator?.indirizzo ?? '');
  const [iban, setIban] = useState(collaborator?.iban ?? '');
  const [tshirt, setTshirt] = useState(collaborator?.tshirt_size ?? '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefono: telefono || null,
        indirizzo: indirizzo || null,
        iban: iban.toUpperCase().replace(/\s/g, '') || null,
        tshirt_size: tshirt || null,
      }),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Errore durante il salvataggio'); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!collaborator) {
    return (
      <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 text-center">
        <p className="text-sm text-gray-500">
          Il tuo profilo collaboratore non è ancora stato configurato.<br />
          Contatta l&apos;amministrazione per completare la configurazione.
        </p>
      </div>
    );
  }

  const sectionCls = 'rounded-2xl bg-gray-900 border border-gray-800';
  const sectionHeader = 'px-5 py-4 border-b border-gray-800';

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Personal info — read-only */}
      <div className={sectionCls}>
        <div className={sectionHeader}>
          <h2 className="text-sm font-medium text-gray-200">Informazioni personali</h2>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <Field label="Nome" value={collaborator.nome} />
          <Field label="Cognome" value={collaborator.cognome} />
          <Field label="Email" value={email} />
          <Field label="Codice fiscale" value={collaborator.codice_fiscale} />
          {collaborator.data_nascita && (
            <Field label="Data di nascita" value={new Date(collaborator.data_nascita).toLocaleDateString('it-IT')} />
          )}
          {collaborator.data_ingresso && (
            <Field label="Data ingresso" value={new Date(collaborator.data_ingresso).toLocaleDateString('it-IT')} />
          )}
          {communities.length > 0 && (
            <div className="col-span-2">
              <p className={labelCls}>Community</p>
              <div className="flex gap-2 flex-wrap">
                {communities.map((c) => (
                  <span key={c.name} className="rounded-full bg-blue-900/30 border border-blue-700/40 px-3 py-1 text-xs text-blue-300">
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {collaborator.partita_iva && (
            <Field label="Partita IVA" value={collaborator.partita_iva} />
          )}
        </div>
      </div>

      {/* Contacts — editable */}
      <div className={sectionCls}>
        <div className={sectionHeader}>
          <h2 className="text-sm font-medium text-gray-200">Contatti</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Telefono</label>
            <input
              type="tel"
              placeholder="+39 333 0000000"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              disabled={loading}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Indirizzo</label>
            <textarea
              placeholder="Via Roma 1, 00100 Roma (RM)"
              value={indirizzo}
              onChange={(e) => setIndirizzo(e.target.value)}
              disabled={loading}
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </div>
        </div>
      </div>

      {/* Payment — editable */}
      <div className={sectionCls}>
        <div className={sectionHeader}>
          <h2 className="text-sm font-medium text-gray-200">Dati pagamento</h2>
          <p className="text-xs text-gray-600 mt-0.5">Visibile solo a te e all&apos;amministrazione.</p>
        </div>
        <div className="p-5">
          <label className={labelCls}>IBAN</label>
          <input
            type="text"
            placeholder="IT60 X054 2811 1010 0000 0123 456"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            disabled={loading}
            className={inputCls + ' font-mono'}
            maxLength={34}
          />
          <p className="text-xs text-gray-600 mt-1.5">Inserisci senza spazi. Verrà normalizzato automaticamente.</p>
        </div>
      </div>

      {/* Preferences — editable */}
      <div className={sectionCls}>
        <div className={sectionHeader}>
          <h2 className="text-sm font-medium text-gray-200">Preferenze</h2>
        </div>
        <div className="p-5">
          <label className={labelCls}>Taglia t-shirt</label>
          <select
            value={tshirt}
            onChange={(e) => setTshirt(e.target.value)}
            disabled={loading}
            className={inputCls}
          >
            <option value="">— Non specificata —</option>
            {TSHIRT_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Role badge */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-gray-600">Ruolo:</span>
        <span className="rounded-full bg-gray-800 border border-gray-700 px-2.5 py-0.5 text-xs text-gray-300 capitalize">
          {role.replace('_', ' ')}
        </span>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2.5 text-xs text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium
                   text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Salvataggio…
          </>
        ) : saved ? (
          '✓ Salvato'
        ) : (
          'Salva modifiche'
        )}
      </button>
    </form>
  );
}
