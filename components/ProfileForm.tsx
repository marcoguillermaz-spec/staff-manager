'use client';

import { useState, useRef } from 'react';

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
  foto_profilo_url: string | null;
  // ha_figli_a_carico: true = il collaboratore stesso è fiscalmente a carico di un familiare
  ha_figli_a_carico: boolean;
};

type GuideContent = { titolo: string; descrizione: string | null } | null;

type Props = {
  collaborator: Collaborator | null;
  role: string;
  email: string;
  communities: { name: string }[];
  guidaFigli: GuideContent;
  guidaPiva: GuideContent;
};

const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';
const readonlyCls =
  'w-full rounded-lg bg-gray-850 border border-gray-800 px-3 py-2.5 text-sm text-gray-400 select-all';
const labelCls = 'block text-xs text-gray-500 mb-1.5';
const sectionCls = 'rounded-2xl bg-gray-900 border border-gray-800';
const sectionHeader = 'px-5 py-4 border-b border-gray-800';

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <div className={readonlyCls}>{value || <span className="text-gray-600 italic">—</span>}</div>
    </div>
  );
}

function GuideBox({ guide }: { guide: GuideContent }) {
  const [open, setOpen] = useState(false);
  if (!guide) return null;
  return (
    <div className="mt-3 rounded-lg bg-blue-950/40 border border-blue-800/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-blue-300 hover:text-blue-200 transition"
      >
        <span className="font-medium">{guide.titolo}</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && guide.descrizione && (
        <div className="px-3 pb-3 text-xs text-gray-400 whitespace-pre-wrap border-t border-blue-800/40 pt-2.5">
          {guide.descrizione}
        </div>
      )}
    </div>
  );
}

export default function ProfileForm({ collaborator, role, email, communities, guidaFigli, guidaPiva }: Props) {
  const [telefono, setTelefono] = useState(collaborator?.telefono ?? '');
  const [indirizzo, setIndirizzo] = useState(collaborator?.indirizzo ?? '');
  const [iban, setIban] = useState(collaborator?.iban ?? '');
  const [tshirt, setTshirt] = useState(collaborator?.tshirt_size ?? '');
  const [partitaIva, setPartitaIva] = useState(collaborator?.partita_iva ?? '');
  const [haFigliACarico, setHaFigliACarico] = useState(collaborator?.ha_figli_a_carico ?? false);
  const [avatarUrl, setAvatarUrl] = useState(collaborator?.foto_profilo_url ?? '');
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        partita_iva: partitaIva.trim() || null,
        ha_figli_a_carico: haFigliACarico,
      }),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Errore durante il salvataggio'); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    setAvatarError(null);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData });
    const data = await res.json();
    setAvatarLoading(false);
    if (!res.ok) { setAvatarError(data.error ?? 'Errore caricamento foto'); return; }
    setAvatarUrl(data.url);
    // Reset input so same file can be re-uploaded if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const initials = collaborator
    ? `${collaborator.nome.charAt(0)}${collaborator.cognome.charAt(0)}`.toUpperCase()
    : '?';

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

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Foto profilo */}
      <div className={sectionCls}>
        <div className={sectionHeader}>
          <h2 className="text-sm font-medium text-gray-200">Foto profilo</h2>
        </div>
        <div className="p-5 flex items-center gap-4">
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Foto profilo"
                className="w-16 h-16 rounded-full object-cover border border-gray-700"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center border border-gray-600">
                <span className="text-lg font-medium text-gray-300">{initials}</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              disabled={avatarLoading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-2 text-xs text-gray-300 transition disabled:opacity-50"
            >
              {avatarLoading ? 'Caricamento…' : avatarUrl ? 'Cambia foto' : 'Carica foto'}
            </button>
            <p className="text-xs text-gray-600 mt-1.5">JPG, PNG o WebP · max 2 MB</p>
            {avatarError && (
              <p className="text-xs text-red-400 mt-1">{avatarError}</p>
            )}
          </div>
        </div>
      </div>

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

      {/* Dati fiscali */}
      <div className={sectionCls}>
        <div className={sectionHeader}>
          <h2 className="text-sm font-medium text-gray-200">Dati fiscali</h2>
        </div>
        <div className="p-5 space-y-5">
          {/* Partita IVA */}
          <div>
            <label className={labelCls}>Partita IVA <span className="text-gray-600">(se applicabile)</span></label>
            <input
              type="text"
              placeholder="01234567890"
              value={partitaIva}
              onChange={(e) => setPartitaIva(e.target.value)}
              disabled={loading}
              className={inputCls + ' font-mono'}
              maxLength={16}
            />
            {partitaIva.trim() && <GuideBox guide={guidaPiva} />}
          </div>

          {/* Sono fiscalmente a carico */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={haFigliACarico}
                onChange={(e) => setHaFigliACarico(e.target.checked)}
                disabled={loading}
                className="accent-blue-600 w-4 h-4 mt-0.5 flex-shrink-0"
              />
              <div>
                <span className="text-sm text-gray-200">Sono fiscalmente a carico</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Seleziona se sei fiscalmente a carico di un familiare (es. genitore).
                </p>
              </div>
            </label>
            {haFigliACarico && <GuideBox guide={guidaFigli} />}
          </div>
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
