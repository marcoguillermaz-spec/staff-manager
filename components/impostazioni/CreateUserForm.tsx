'use client';

import { useState, useEffect } from 'react';
import { CONTRACT_TEMPLATE_LABELS, type ContractTemplateType } from '@/lib/types';

type Role = 'collaboratore' | 'responsabile' | 'amministrazione' | 'super_admin';
type Community = { id: string; name: string; is_active: boolean };
type Credentials = { email: string; password: string };
type TemplateStatus = { tipo: ContractTemplateType; file_name: string } | null;

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'collaboratore',   label: 'Collaboratore' },
  { value: 'responsabile',    label: 'Responsabile' },
  { value: 'amministrazione', label: 'Amministrazione' },
  { value: 'super_admin',     label: 'Super Admin' },
];

const CONTRACT_TIPOS: ContractTemplateType[] = ['OCCASIONALE', 'COCOCO', 'PIVA'];

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

  // Anagrafica (collaboratore only)
  const [nome, setNome]               = useState('');
  const [cognome, setCognome]         = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [dataNascita, setDataNascita] = useState('');
  const [luogoNascita, setLuogoNascita] = useState('');
  const [comuneRes, setComuneRes]     = useState('');
  const [indirizzo, setIndirizzo]     = useState('');
  const [telefono, setTelefono]       = useState('');

  // Contract (collaboratore only, optional)
  const [contractTipo, setContractTipo]       = useState<ContractTemplateType | ''>('');
  const [contractCommunityId, setContractCommunityId] = useState('');
  const [compensoLordo, setCompensoLordo]     = useState('');
  const [dataInizio, setDataInizio]           = useState('');
  const [dataFine, setDataFine]               = useState('');
  const [numeroRate, setNumeroRate]           = useState('');
  const [importoRata, setImportoRata]         = useState('');

  // Template status (which tipos have templates uploaded)
  const [templateStatus, setTemplateStatus]   = useState<TemplateStatus[]>([]);

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

  const isCollaboratore = role === 'collaboratore';
  const showRateFields = contractTipo === 'COCOCO' || contractTipo === 'PIVA';
  const showInizioField = contractTipo === 'OCCASIONALE' || contractTipo === 'COCOCO';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCredentials(null);

    const body: Record<string, unknown> = {
      email,
      role,
      community_ids: role === 'responsabile' ? selectedCommunities : [],
    };

    if (isCollaboratore) {
      Object.assign(body, {
        nome:           nome.trim() || undefined,
        cognome:        cognome.trim() || undefined,
        codice_fiscale: codiceFiscale.trim().toUpperCase() || null,
        data_nascita:   dataNascita || null,
        luogo_nascita:  luogoNascita.trim() || null,
        comune:         comuneRes.trim() || null,
        indirizzo:      indirizzo.trim() || null,
        telefono:       telefono.trim() || null,
      });

      if (contractTipo) {
        Object.assign(body, {
          contract_tipo:           contractTipo,
          contract_community_id:   contractCommunityId || null,
          contract_compenso_lordo: compensoLordo ? parseFloat(compensoLordo.replace(',', '.')) : undefined,
          contract_data_inizio:    dataInizio || null,
          contract_data_fine:      dataFine || null,
          contract_numero_rate:    numeroRate ? parseInt(numeroRate) : null,
          contract_importo_rata:   importoRata ? parseFloat(importoRata.replace(',', '.')) : null,
        });
      }
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
    setLuogoNascita(''); setComuneRes(''); setIndirizzo(''); setTelefono('');
    setContractTipo(''); setContractCommunityId(''); setCompensoLordo('');
    setDataInizio(''); setDataFine(''); setNumeroRate(''); setImportoRata('');
  };

  if (credentials) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-green-900/20 border border-green-700/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-green-400">Utente creato con successo</span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Condividi queste credenziali con il nuovo utente. Al primo accesso dovrà impostare una nuova password.
          </p>
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">Email</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-100 font-mono">{credentials.email}</code>
              <button onClick={() => copyToClipboard(credentials.email, 'email')}
                className="rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-2 text-xs text-gray-300 transition whitespace-nowrap">
                {copied === 'email' ? 'Copiato!' : 'Copia'}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Password temporanea</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-100 font-mono tracking-wider">{credentials.password}</code>
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
              onChange={(e) => { setRole(e.target.value as Role); setSelectedCommunities([]); setContractTipo(''); }}
              disabled={loading} className={selectCls}>
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Responsabile → community assignment */}
      {role === 'responsabile' && communities.length > 0 && (
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

      {/* Anagrafica collaboratore */}
      {isCollaboratore && (
        <>
          <div>
            <p className={sectionTitle}>Dati personali</p>
            <div className="space-y-3">
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
                  <label className={labelCls}>Luogo di nascita</label>
                  <input type="text" placeholder="Roma (RM)" value={luogoNascita}
                    onChange={(e) => setLuogoNascita(e.target.value)}
                    disabled={loading} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Comune di residenza</label>
                  <input type="text" placeholder="Milano" value={comuneRes}
                    onChange={(e) => setComuneRes(e.target.value)}
                    disabled={loading} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Telefono</label>
                  <input type="tel" placeholder="+39 333 0000000" value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    disabled={loading} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Indirizzo (via e numero civico)</label>
                <input type="text" placeholder="Via Roma 1" value={indirizzo}
                  onChange={(e) => setIndirizzo(e.target.value)}
                  disabled={loading} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Contract generation */}
          <div>
            <p className={sectionTitle}>Contratto</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Tipologia contratto</label>
                <select value={contractTipo}
                  onChange={(e) => setContractTipo(e.target.value as ContractTemplateType | '')}
                  disabled={loading} className={selectCls}>
                  <option value="">— Nessun contratto —</option>
                  {CONTRACT_TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {CONTRACT_TEMPLATE_LABELS[t]}{!hasTemplate(t) ? ' (template mancante)' : ''}
                    </option>
                  ))}
                </select>
                {contractTipo && !hasTemplate(contractTipo) && (
                  <p className="text-xs text-yellow-600 mt-1.5">
                    Nessun template caricato per questa tipologia. Caricane uno nel tab «Contratti».
                  </p>
                )}
              </div>

              {contractTipo && (
                <>
                  <div>
                    <label className={labelCls}>Community di riferimento</label>
                    <select value={contractCommunityId}
                      onChange={(e) => setContractCommunityId(e.target.value)}
                      disabled={loading} className={selectCls}>
                      <option value="">— Nessuna —</option>
                      {communities.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={showInizioField ? 'grid grid-cols-2 gap-3' : ''}>
                    {showInizioField && (
                      <div>
                        <label className={labelCls}>Data inizio</label>
                        <input type="date" value={dataInizio}
                          onChange={(e) => setDataInizio(e.target.value)}
                          disabled={loading} className={inputCls} />
                      </div>
                    )}
                    <div>
                      <label className={labelCls}>Data fine</label>
                      <input type="date" value={dataFine}
                        onChange={(e) => setDataFine(e.target.value)}
                        disabled={loading} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Compenso lordo (€) <span className="text-red-500">*</span></label>
                    <input type="number" placeholder="9800" value={compensoLordo}
                      onChange={(e) => setCompensoLordo(e.target.value)}
                      disabled={loading} min="0" step="0.01" className={inputCls} />
                  </div>
                  {showRateFields && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>N° rate</label>
                        <input type="number" placeholder="14" value={numeroRate}
                          onChange={(e) => setNumeroRate(e.target.value)}
                          disabled={loading} min="1" step="1" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Importo rata (€)</label>
                        <input type="number" placeholder="700" value={importoRata}
                          onChange={(e) => setImportoRata(e.target.value)}
                          disabled={loading} min="0" step="0.01" className={inputCls} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2.5 text-xs text-red-400">{error}</div>
      )}

      <button type="submit"
        disabled={loading || !email || (isCollaboratore && (!nome || !cognome)) || (!!contractTipo && !compensoLordo)}
        className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Creazione in corso…
          </>
        ) : 'Crea utente'}
      </button>
    </form>
  );
}
