'use client';

import { useState, useEffect } from 'react';
import { CONTRACT_TEMPLATE_LABELS, type ContractTemplateType } from '@/lib/types';

type Role = 'collaboratore' | 'responsabile_cittadino' | 'responsabile_compensi' | 'responsabile_servizi_individuali' | 'amministrazione';
type Credentials = { email: string; password: string };
type Community = { id: string; name: string; is_active: boolean };
type TemplateStatus = { tipo: ContractTemplateType; file_name: string } | null;

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'collaboratore',                    label: 'Collaboratore' },
  { value: 'responsabile_cittadino',           label: 'Responsabile Cittadino' },
  { value: 'responsabile_compensi',            label: 'Responsabile Compensi' },
  { value: 'responsabile_servizi_individuali', label: 'Responsabile Servizi Individuali' },
  { value: 'amministrazione',                  label: 'Amministrazione' },
];

const CONTRACT_TIPOS: ContractTemplateType[] = ['OCCASIONALE', 'COCOCO', 'PIVA'];

// Roles that require tipo_contratto and have anagrafica pre-fill
const ROLES_WITH_CONTRACT: Role[] = ['collaboratore', 'responsabile_compensi'];

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';

const selectCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';

const labelCls = 'block text-xs text-gray-500 mb-1.5';

const sectionTitle = 'text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-1';

export default function CreateUserForm() {
  // Auth fields
  const [email, setEmail]     = useState('');
  const [role, setRole]       = useState<Role>('collaboratore');

  // Communities (responsabile assignment + contract community)
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);

  // Anagrafica (optional pre-fill for collaboratore and responsabile)
  const [nome, setNome]               = useState('');
  const [cognome, setCognome]         = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [dataNascita, setDataNascita] = useState('');
  const [luogoNascita, setLuogoNascita] = useState('');
  const [provinciaNascita, setProvinciaNascita] = useState('');
  const [comuneRes, setComuneRes]     = useState('');
  const [provinciaRes, setPrvinciaRes] = useState('');
  const [indirizzo, setIndirizzo]     = useState('');
  const [civico, setCivico]           = useState('');
  const [telefono, setTelefono]       = useState('');

  // Tipo rapporto (required for collaboratore and responsabile)
  const [tipoContratto, setTipoContratto] = useState<ContractTemplateType | ''>('');

  // Template status (which tipos have templates uploaded)
  const [templateStatus, setTemplateStatus]   = useState<TemplateStatus[]>([]);

  // Invite mode
  const [mode, setMode] = useState<'quick' | 'full'>('quick');

  // UI state
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied]           = useState<'email' | 'password' | null>(null);

  useEffect(() => {
    fetch('/api/admin/communities')
      .then((r) => r.json())
      .then((data) => setCommunities(data.communities ?? []))
      .catch(() => {});
    fetch('/api/admin/contract-templates')
      .then((r) => r.json())
      .then((data) => setTemplateStatus(data.templates ?? []))
      .catch(() => {});
  }, []);

  const toggleCommunity = (id: string) =>
    setSelectedCommunities((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );

  const copyToClipboard = async (text: string, field: 'email' | 'password') => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const hasTemplate = (tipo: ContractTemplateType) =>
    templateStatus.some((t) => t?.tipo === tipo);

  const needsContract = ROLES_WITH_CONTRACT.includes(role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCredentials(null);

    const body: Record<string, unknown> = {
      email,
      role,
      community_ids: role === 'responsabile_compensi' ? selectedCommunities : [],
    };

    if (needsContract) {
      Object.assign(body, {
        tipo_contratto:      tipoContratto || undefined,
        nome:                nome.trim() || undefined,
        cognome:             cognome.trim() || undefined,
        codice_fiscale:      codiceFiscale.trim().toUpperCase() || null,
        data_nascita:        dataNascita || null,
        luogo_nascita:       luogoNascita.trim() || null,
        provincia_nascita:   provinciaNascita.trim().toUpperCase() || null,
        comune:              comuneRes.trim() || null,
        provincia_residenza: provinciaRes.trim().toUpperCase() || null,
        indirizzo:           indirizzo.trim() || null,
        civico_residenza:    civico.trim() || null,
        telefono:            telefono.trim() || null,
      });
    }

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Errore durante la creazione'); return; }
    setCredentials({ email: data.email, password: data.password });

    // Reset
    setEmail('');
    setRole('collaboratore');
    setSelectedCommunities([]);
    setNome(''); setCognome(''); setCodiceFiscale(''); setDataNascita('');
    setLuogoNascita(''); setProvinciaNascita(''); setComuneRes(''); setPrvinciaRes('');
    setIndirizzo(''); setCivico(''); setTelefono('');
    setTipoContratto('');
  };

  if (credentials) {
    return (
      <div className="space-y-4">
        {/* Invite sent confirmation */}
        <div className="rounded-xl bg-green-900/20 border border-green-700/40 px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-gray-300">
            Invito inviato a <span className="font-medium text-gray-100">{credentials.email}</span>.
          </p>
        </div>

        {/* Credentials backup */}
        <div className="rounded-xl bg-gray-800/60 border border-gray-700 p-4 space-y-3">
          <p className="text-xs text-gray-500">
            Credenziali di accesso — da condividere manualmente in caso di mancato recapito dell&apos;email.
          </p>
          <div>
            <p className="text-xs text-gray-500 mb-1">Email</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-sm text-gray-100 font-mono">{credentials.email}</code>
              <button onClick={() => copyToClipboard(credentials.email, 'email')}
                className="rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-2 text-xs text-gray-300 transition whitespace-nowrap">
                {copied === 'email' ? 'Copiato!' : 'Copia'}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Password temporanea</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-sm text-gray-100 font-mono tracking-wider">{credentials.password}</code>
              <button onClick={() => copyToClipboard(credentials.password, 'password')}
                className="rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-2 text-xs text-gray-300 transition whitespace-nowrap">
                {copied === 'password' ? 'Copiata!' : 'Copia'}
              </button>
            </div>
          </div>
        </div>

        <button onClick={() => setCredentials(null)}
          className="w-full rounded-lg border border-gray-700 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition">
          Crea un altro utente
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button type="button"
          onClick={() => setMode('quick')}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            mode === 'quick'
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
          }`}>
          Invito rapido
        </button>
        <button type="button"
          onClick={() => setMode('full')}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            mode === 'full'
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
          }`}>
          Invito completo
        </button>
      </div>

      {/* Auth */}
      <div>
        <p className={sectionTitle}>Accesso</p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" placeholder="nome@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              required disabled={loading} autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Ruolo</label>
            <select value={role}
              onChange={(e) => { setRole(e.target.value as Role); setSelectedCommunities([]); setTipoContratto(''); }}
              disabled={loading} className={selectCls}>
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Responsabile → community assignment */}
      {role === 'responsabile_compensi' && communities.length > 0 && (
        <div>
          <p className={sectionTitle}>Comunità gestite</p>
          <div className="space-y-2">
            {communities.map((c) => (
              <label key={c.id}
                className="flex items-center gap-3 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 cursor-pointer hover:border-gray-600 transition">
                <input type="checkbox" checked={selectedCommunities.includes(c.id)}
                  onChange={() => toggleCommunity(c.id)} disabled={loading}
                  className="accent-blue-600 w-4 h-4" />
                <span className="text-sm text-gray-200">{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Tipo rapporto (required for collaboratore and responsabile) */}
      {needsContract && (
        <div>
          <p className={sectionTitle}>Tipo rapporto</p>
          <div>
            <label className={labelCls}>Tipologia contratto <span className="text-red-500">*</span></label>
            <select value={tipoContratto}
              onChange={(e) => setTipoContratto(e.target.value as ContractTemplateType | '')}
              required disabled={loading} className={selectCls}>
              <option value="">— Seleziona tipologia —</option>
              {CONTRACT_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {CONTRACT_TEMPLATE_LABELS[t]}{!hasTemplate(t) ? ' (template mancante)' : ''}
                </option>
              ))}
            </select>
            {tipoContratto && !hasTemplate(tipoContratto) && (
              <p className="text-xs text-yellow-600 mt-1.5">
                Nessun template caricato per questa tipologia. L&apos;utente potrà comunque completare l&apos;onboarding, ma il contratto non verrà generato automaticamente.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Invito rapido: nome + cognome required */}
      {needsContract && mode === 'quick' && (
        <div>
          <p className={sectionTitle}>Dati personali</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nome <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Mario" value={nome}
                onChange={(e) => setNome(e.target.value)}
                required disabled={loading} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cognome <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Rossi" value={cognome}
                onChange={(e) => setCognome(e.target.value)}
                required disabled={loading} className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {/* Invito completo: anagrafica opzionale (pre-fill per l'onboarding) */}
      {needsContract && mode === 'full' && (
        <div>
          <p className={sectionTitle}>Dati personali <span className="font-normal text-gray-600 normal-case">(opzionale — pre-compilazione onboarding)</span></p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
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
              <label className={labelCls}>Codice fiscale</label>
              <input type="text" placeholder="RSSMRA80A01H501U" value={codiceFiscale}
                onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
                disabled={loading} maxLength={16} className={inputCls + ' font-mono'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Via/Piazza</label>
                <input type="text" placeholder="Via Roma" value={indirizzo}
                  onChange={(e) => setIndirizzo(e.target.value)}
                  disabled={loading} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Civico</label>
                <input type="text" placeholder="1" value={civico}
                  onChange={(e) => setCivico(e.target.value)}
                  disabled={loading} maxLength={10} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Telefono</label>
              <input type="tel" placeholder="+39 333 0000000" value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                disabled={loading} className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2.5 text-xs text-red-400">{error}</div>
      )}

      <button type="submit"
        disabled={loading || !email || (needsContract && (!tipoContratto || (mode === 'quick' && (!nome.trim() || !cognome.trim()))))}
        className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Creazione in corso…
          </>
        ) : 'Conferma'}
      </button>
    </form>
  );
}
