'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

type Collaborator = {
  nome: string;
  cognome: string;
  email: string;
  codice_fiscale: string | null;
  data_nascita: string | null;
  luogo_nascita: string | null;
  provincia_nascita: string | null;
  comune: string | null;
  provincia_residenza: string | null;
  data_ingresso: string | null;
  telefono: string | null;
  indirizzo: string | null;
  civico_residenza: string | null;
  iban: string | null;
  tshirt_size: string | null;
  foto_profilo_url: string | null;
  sono_un_figlio_a_carico: boolean;
  importo_lordo_massimale: number | null;
};

type GuideContent = { titolo: string; descrizione: string | null } | null;

type Props = {
  collaborator: Collaborator | null;
  role: string;
  email: string;
  communities: { name: string }[];
  guidaFigli: GuideContent;
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

export default function ProfileForm({ collaborator, role, email, communities, guidaFigli }: Props) {
  // Editable personal data
  const [emailVal, setEmailVal]       = useState(email);
  const [nome, setNome]               = useState(collaborator?.nome ?? '');
  const [cognome, setCognome]         = useState(collaborator?.cognome ?? '');
  const [codiceFiscale, setCodiceFiscale] = useState(collaborator?.codice_fiscale ?? '');
  const [dataNascita, setDataNascita] = useState(collaborator?.data_nascita ?? '');
  const [luogoNascita, setLuogoNascita] = useState(collaborator?.luogo_nascita ?? '');
  const [provinciaNascita, setProvinciaNascita] = useState(collaborator?.provincia_nascita ?? '');
  const [comuneRes, setComuneRes]     = useState(collaborator?.comune ?? '');
  const [provinciaRes, setPrvinciaRes] = useState(collaborator?.provincia_residenza ?? '');
  // Contacts
  const [telefono, setTelefono]   = useState(collaborator?.telefono ?? '');
  const [indirizzo, setIndirizzo] = useState(collaborator?.indirizzo ?? '');
  const [civico, setCivico]       = useState(collaborator?.civico_residenza ?? '');
  // Payment
  const [iban, setIban] = useState(collaborator?.iban ?? '');
  // Fiscal
  const [sonoFiglio, setSonoFiglio]   = useState(collaborator?.sono_un_figlio_a_carico ?? false);
  const [massimale, setMassimale]     = useState<string>(
    collaborator?.importo_lordo_massimale != null ? String(collaborator.importo_lordo_massimale) : '',
  );
  const [showGuida, setShowGuida]     = useState(false);
  // Preferences
  const [tshirt, setTshirt]     = useState(collaborator?.tshirt_size ?? '');
  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(collaborator?.foto_profilo_url ?? '');

  const [loading, setLoading]           = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [saved, setSaved]               = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [avatarError, setAvatarError]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const emailTrimmed = emailVal.trim().toLowerCase();
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:               emailTrimmed !== email.toLowerCase() ? emailTrimmed : undefined,
        nome:                nome.trim() || undefined,
        cognome:             cognome.trim() || undefined,
        codice_fiscale:      codiceFiscale.trim().toUpperCase() || null,
        data_nascita:        dataNascita || null,
        luogo_nascita:       luogoNascita.trim() || null,
        provincia_nascita:   provinciaNascita.trim().toUpperCase() || null,
        comune:              comuneRes.trim() || null,
        provincia_residenza: provinciaRes.trim().toUpperCase() || null,
        telefono:            telefono || null,
        indirizzo:           indirizzo || null,
        civico_residenza:    civico.trim() || null,
        iban:                iban.toUpperCase().replace(/\s/g, '') || null,
        tshirt_size:               tshirt || null,
        sono_un_figlio_a_carico:   sonoFiglio,
        importo_lordo_massimale:   massimale !== '' ? parseFloat(massimale) : null,
      }),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Errore durante il salvataggio'); return; }
    if (data.emailChanged) {
      const supabase = createClient();
      await supabase.auth.refreshSession();
    }
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
            {avatarError && <p className="text-xs text-red-400 mt-1">{avatarError}</p>}
          </div>
        </div>
      </div>

      {/* Informazioni personali — editable */}
      <div className={sectionCls}>
        <div className={sectionHeader}>
          <h2 className="text-sm font-medium text-gray-200">Informazioni personali</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nome</label>
              <input type="text" placeholder="Mario" value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={loading} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cognome</label>
              <input type="text" placeholder="Rossi" value={cognome}
                onChange={(e) => setCognome(e.target.value)}
                disabled={loading} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input
              type="email"
              value={emailVal}
              onChange={(e) => setEmailVal(e.target.value)}
              disabled={loading}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Codice fiscale</label>
            <input type="text" placeholder="RSSMRA80A01H501U" value={codiceFiscale}
              onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
              disabled={loading} maxLength={16} className={inputCls + ' font-mono'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Data di nascita</label>
              <input type="date" value={dataNascita}
                onChange={(e) => setDataNascita(e.target.value)}
                disabled={loading} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Città di nascita</label>
              <input type="text" placeholder="Roma" value={luogoNascita}
                onChange={(e) => setLuogoNascita(e.target.value)}
                disabled={loading} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Provincia di nascita (sigla)</label>
            <input type="text" placeholder="RM" value={provinciaNascita}
              onChange={(e) => setProvinciaNascita(e.target.value.toUpperCase())}
              disabled={loading} maxLength={2} className={inputCls + ' font-mono uppercase'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Comune di residenza</label>
              <input type="text" placeholder="Milano" value={comuneRes}
                onChange={(e) => setComuneRes(e.target.value)}
                disabled={loading} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Provincia di residenza (sigla)</label>
              <input type="text" placeholder="MI" value={provinciaRes}
                onChange={(e) => setPrvinciaRes(e.target.value.toUpperCase())}
                disabled={loading} maxLength={2} className={inputCls + ' font-mono uppercase'} />
            </div>
          </div>
          {collaborator.data_ingresso && (
            <Field label="Data ingresso" value={new Date(collaborator.data_ingresso).toLocaleDateString('it-IT')} />
          )}
          {communities.length > 0 && (
            <div>
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
            <label className={labelCls}>Telefono di contatto</label>
            <input
              type="tel"
              placeholder="+39 333 0000000"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              disabled={loading}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Via/Piazza di residenza</label>
              <input
                type="text"
                placeholder="Via Roma"
                value={indirizzo}
                onChange={(e) => setIndirizzo(e.target.value)}
                disabled={loading}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Civico</label>
              <input
                type="text"
                placeholder="1"
                value={civico}
                onChange={(e) => setCivico(e.target.value)}
                disabled={loading}
                maxLength={10}
                className={inputCls}
              />
            </div>
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-200">Dati fiscali</h2>
            <button
              type="button"
              onClick={() => setShowGuida(true)}
              className="text-xs text-blue-400 hover:text-blue-300 transition underline underline-offset-2"
            >
              Come funziona la prestazione occasionale?
            </button>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sonoFiglio}
                onChange={(e) => setSonoFiglio(e.target.checked)}
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
            {sonoFiglio && <GuideBox guide={guidaFigli} />}
          </div>

          {role === 'collaboratore' && (
            <div>
              <label className={labelCls}>
                Massimale lordo annuo <span className="text-gray-600">(max €5.000)</span>
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">€</span>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  step={1}
                  placeholder="es. 2840 o 4000 o 5000"
                  value={massimale}
                  onChange={(e) => setMassimale(e.target.value)}
                  disabled={loading}
                  required
                  className={inputCls + ' pl-7'}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Importo lordo massimo che vuoi ricevere da noi nell&apos;anno solare.
                Se hai altre collaborazioni, abbassa questo valore per rispettare i tuoi limiti personali.
                <button type="button" onClick={() => setShowGuida(true)}
                  className="ml-1 text-blue-400 hover:text-blue-300 underline underline-offset-2">
                  Come scegliere il valore?
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Guida fiscale — modal */}
      {showGuida && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowGuida(false); }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-800 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-100">Guida fiscale — prestazione occasionale</h2>
              <button type="button" onClick={() => setShowGuida(false)}
                className="text-gray-500 hover:text-gray-300 transition text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-gray-300">

              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cos&apos;è la prestazione occasionale?</h3>
                <p>Quando lavori con noi vieni pagato come <strong className="text-gray-200">prestatore occasionale</strong>: puoi guadagnare senza aprire la partita IVA, in modo semplice e legale. È lo strumento pensato per chi fa lavori saltuari, come studenti o chi ha pochi committenti.</p>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">La ritenuta d&apos;acconto (−20%)</h3>
                <p>Sul tuo compenso lordo viene automaticamente trattenuto il <strong className="text-gray-200">20%</strong> come &quot;ritenuta d&apos;acconto&quot;. Lo paga l&apos;azienda al tuo posto all&apos;Agenzia delle Entrate. Nella dichiarazione dei redditi la recuperi o la conguagli.</p>
                <div className="mt-2 rounded-lg bg-gray-800 px-4 py-3 text-xs font-mono text-gray-300">
                  Compenso lordo: 100€ → tu ricevi: 80€ → versati al fisco: 20€
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">La soglia dei 5.000€/anno</h3>
                <p>Puoi guadagnare fino a <strong className="text-gray-200">5.000€ lordi all&apos;anno</strong> da prestazioni occasionali senza dover versare contributi INPS:</p>
                <ul className="mt-2 space-y-1.5 list-none">
                  <li className="flex gap-2"><span className="text-green-400">✓</span> Sotto 5.000€: nessun contributo INPS da versare</li>
                  <li className="flex gap-2"><span className="text-yellow-400">⚠</span> Sopra 5.000€: sulla parte eccedente devi versare ~33% alla Gestione Separata INPS</li>
                </ul>
                <p className="mt-2 text-xs text-gray-500">Questa soglia vale sulla <strong className="text-gray-400">somma di tutti i compensi occasionali dell&apos;anno</strong>, non solo quelli con noi.</p>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Se sei figlio fiscalmente a carico</h3>
                <p>I tuoi genitori hanno diritto a detrazioni fiscali finché sei loro &quot;figlio a carico&quot;. Perdi questo status se il tuo reddito annuo supera:</p>
                <div className="mt-2 space-y-2">
                  <div className="rounded-lg bg-blue-950/40 border border-blue-800/30 px-4 py-3">
                    <p className="text-xs font-semibold text-blue-300 mb-1">Hai fino a 24 anni</p>
                    <p>Limite reddito: <strong className="text-gray-200">4.000€/anno</strong></p>
                    <p className="text-xs text-gray-500 mt-0.5">Consiglio: imposta il massimale a 4.000€ o meno</p>
                  </div>
                  <div className="rounded-lg bg-purple-950/40 border border-purple-800/30 px-4 py-3">
                    <p className="text-xs font-semibold text-purple-300 mb-1">Hai più di 24 anni</p>
                    <p>Limite reddito: <strong className="text-gray-200">2.840,51€/anno</strong></p>
                    <p className="text-xs text-gray-500 mt-0.5">Consiglio: imposta il massimale a 2.840€ o meno</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Attenzione: il reddito considerato è quello <strong className="text-gray-400">complessivo</strong> — includi anche altri eventuali guadagni.</p>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Come scegliere il massimale?</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2"><span className="text-blue-400 font-semibold">2.840€</span><span className="text-gray-400">— sei figlio a carico con più di 24 anni</span></div>
                  <div className="flex items-start gap-2"><span className="text-blue-400 font-semibold">4.000€</span><span className="text-gray-400">— sei figlio a carico con fino a 24 anni</span></div>
                  <div className="flex items-start gap-2"><span className="text-blue-400 font-semibold">5.000€</span><span className="text-gray-400">— nessun vincolo, vuoi massimizzare i guadagni</span></div>
                  <div className="flex items-start gap-2"><span className="text-yellow-400 font-semibold">Meno</span><span className="text-gray-400">— hai già altre collaborazioni o guadagni nell&apos;anno</span></div>
                </div>
              </section>

            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex-shrink-0">
              <button type="button" onClick={() => setShowGuida(false)}
                className="w-full rounded-lg bg-gray-800 hover:bg-gray-700 py-2 text-sm text-gray-300 transition">
                Ho capito
              </button>
            </div>
          </div>
        </div>
      )}

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
