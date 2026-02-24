'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ContractTemplateType } from '@/lib/types';

type PrefillData = {
  nome: string | null;
  cognome: string | null;
  codice_fiscale: string | null;
  data_nascita: string | null;
  luogo_nascita: string | null;
  provincia_nascita: string | null;
  comune: string | null;
  provincia_residenza: string | null;
  indirizzo: string | null;
  civico_residenza: string | null;
  telefono: string | null;
  iban: string | null;
  tshirt_size: string | null;
  partita_iva: string | null;
  ha_figli_a_carico: boolean;
} | null;

interface Props {
  prefill: PrefillData;
  tipoContratto: ContractTemplateType | null;
  tipoLabel: string | null;
}

const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';

const selectCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';

const labelCls = 'block text-xs text-gray-500 mb-1.5';

const sectionTitle = 'text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-1';

export default function OnboardingWizard({ prefill, tipoContratto, tipoLabel }: Props) {
  const router = useRouter();

  // Step 1 — dati anagrafici
  const [nome, setNome]                       = useState(prefill?.nome ?? '');
  const [cognome, setCognome]                 = useState(prefill?.cognome ?? '');
  const [codiceFiscale, setCF]                = useState(prefill?.codice_fiscale ?? '');
  const [dataNascita, setDataNascita]         = useState(prefill?.data_nascita ?? '');
  const [luogoNascita, setLuogo]              = useState(prefill?.luogo_nascita ?? '');
  const [provinciaNascita, setProvinciaNascita] = useState(prefill?.provincia_nascita ?? '');
  const [comune, setComune]                   = useState(prefill?.comune ?? '');
  const [provinciaRes, setPrvinciaRes]        = useState(prefill?.provincia_residenza ?? '');
  const [indirizzo, setIndirizzo]             = useState(prefill?.indirizzo ?? '');
  const [civico, setCivico]                   = useState(prefill?.civico_residenza ?? '');
  const [telefono, setTelefono]               = useState(prefill?.telefono ?? '');
  const [iban, setIban]                       = useState(prefill?.iban ?? '');
  const [tshirt, setTshirt]                   = useState(prefill?.tshirt_size ?? '');
  const [partitaIva, setPartitaIva]           = useState(prefill?.partita_iva ?? '');
  const [haFigli, setHaFigli]                 = useState(prefill?.ha_figli_a_carico ?? false);

  // Step tracking
  const [step, setStep]           = useState<1 | 2>(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [contractGenerated, setContractGenerated] = useState(false);

  const isPiva = tipoContratto === 'PIVA';

  // Validate step 1
  const step1Valid =
    nome.trim() && cognome.trim() && codiceFiscale.trim() &&
    dataNascita && luogoNascita.trim() && provinciaNascita.trim() &&
    comune.trim() && provinciaRes.trim() && indirizzo.trim() && civico.trim() &&
    telefono.trim() && iban.trim() && tshirt &&
    (!isPiva || partitaIva.trim());

  const handleCompleteOnboarding = async () => {
    setLoading(true);
    setError(null);

    const res = await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome:                nome.trim(),
        cognome:             cognome.trim(),
        codice_fiscale:      codiceFiscale.trim().toUpperCase(),
        data_nascita:        dataNascita,
        luogo_nascita:       luogoNascita.trim(),
        provincia_nascita:   provinciaNascita.trim().toUpperCase(),
        comune:              comune.trim(),
        provincia_residenza: provinciaRes.trim().toUpperCase(),
        indirizzo:           indirizzo.trim(),
        civico_residenza:    civico.trim(),
        telefono:            telefono.trim(),
        iban:                iban.trim(),
        tshirt_size:         tshirt,
        partita_iva:         isPiva ? partitaIva.trim() || null : null,
        ha_figli_a_carico:   haFigli,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Errore durante il salvataggio');
      return;
    }

    if (data.download_url) {
      setDownloadUrl(data.download_url);
      setContractGenerated(true);
    } else {
      // No template available or generation failed — onboarding still completed
      router.push('/');
      router.refresh();
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `contratto_${tipoContratto?.toLowerCase() ?? 'contratto'}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFinish = () => {
    router.push('/');
    router.refresh();
  };

  // ── Step 2 — contratto ───────────────────────────────────────
  if (step === 2) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-6">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-xs text-gray-500">Dati personali</span>
          </div>
          <div className="flex-1 h-px bg-gray-700" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">2</div>
            <span className="text-xs text-gray-300 font-medium">Contratto</span>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-100 mb-1">Il tuo contratto</h2>
          <p className="text-sm text-gray-400">
            Tipologia:{' '}
            <span className="text-gray-200 font-medium">{tipoLabel ?? tipoContratto}</span>
          </p>
        </div>

        {contractGenerated && downloadUrl ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-900/20 border border-green-700/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-green-400">Contratto generato</span>
              </div>
              <p className="text-xs text-gray-400">
                Il contratto è stato generato con i tuoi dati. Scaricalo, firmalo e caricalo nella sezione <strong className="text-gray-300">Documenti</strong> quando sei pronto.
              </p>
            </div>

            <button
              onClick={handleDownload}
              className="w-full rounded-lg bg-gray-700 hover:bg-gray-600 py-2.5 text-sm font-medium text-gray-100 transition flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Scarica contratto
            </button>

            <button
              onClick={handleFinish}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium text-white transition">
              Ho scaricato il contratto — Accedi alla piattaforma
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {tipoContratto ? (
              <p className="text-sm text-gray-400">
                Clicca il pulsante per generare il tuo contratto precompilato con i dati inseriti.
              </p>
            ) : (
              <div className="rounded-lg bg-yellow-900/20 border border-yellow-700/40 p-3">
                <p className="text-xs text-yellow-400">
                  Nessun tipo di rapporto associato al tuo account. Contatta l&apos;amministrazione.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2.5 text-xs text-red-400">{error}</div>
            )}

            {tipoContratto ? (
              <button
                onClick={handleCompleteOnboarding}
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generazione in corso…
                  </>
                ) : 'Genera e scarica contratto'}
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium text-white transition">
                Accedi alla piattaforma
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Step 1 — dati anagrafici ─────────────────────────────────
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">1</div>
          <span className="text-xs text-gray-300 font-medium">Dati personali</span>
        </div>
        <div className="flex-1 h-px bg-gray-700" />
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500">2</div>
          <span className="text-xs text-gray-500">Contratto</span>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); setStep(2); }}
        className="space-y-5">

        <p className="text-sm text-gray-400 -mt-2 mb-4">
          Completa tutti i campi per procedere alla generazione del contratto.
        </p>

        {/* Identità */}
        <div>
          <p className={sectionTitle}>Identità</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nome <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Mario" value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cognome <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Rossi" value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                  required className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Codice fiscale <span className="text-red-500">*</span></label>
              <input type="text" placeholder="RSSMRA80A01H501U" value={codiceFiscale}
                onChange={(e) => setCF(e.target.value.toUpperCase())}
                required maxLength={16} className={inputCls + ' font-mono'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data di nascita <span className="text-red-500">*</span></label>
                <input type="date" value={dataNascita}
                  onChange={(e) => setDataNascita(e.target.value)}
                  required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Città di nascita <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Roma" value={luogoNascita}
                  onChange={(e) => setLuogo(e.target.value)}
                  required className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Provincia di nascita (sigla) <span className="text-red-500">*</span></label>
              <input type="text" placeholder="RM" value={provinciaNascita}
                onChange={(e) => setProvinciaNascita(e.target.value.toUpperCase())}
                required maxLength={2} className={inputCls + ' font-mono uppercase'} />
            </div>
            {isPiva && (
              <div>
                <label className={labelCls}>Partita IVA <span className="text-red-500">*</span></label>
                <input type="text" placeholder="12345678901" value={partitaIva}
                  onChange={(e) => setPartitaIva(e.target.value)}
                  required={isPiva} maxLength={11} className={inputCls + ' font-mono'} />
              </div>
            )}
          </div>
        </div>

        {/* Residenza */}
        <div>
          <p className={sectionTitle}>Residenza</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Comune <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Milano" value={comune}
                  onChange={(e) => setComune(e.target.value)}
                  required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Provincia (sigla) <span className="text-red-500">*</span></label>
                <input type="text" placeholder="MI" value={provinciaRes}
                  onChange={(e) => setPrvinciaRes(e.target.value.toUpperCase())}
                  required maxLength={2} className={inputCls + ' font-mono uppercase'} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Via/Piazza di residenza <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Via Roma" value={indirizzo}
                  onChange={(e) => setIndirizzo(e.target.value)}
                  required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Civico <span className="text-red-500">*</span></label>
                <input type="text" placeholder="1" value={civico}
                  onChange={(e) => setCivico(e.target.value)}
                  required maxLength={10} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Telefono di contatto <span className="text-red-500">*</span></label>
              <input type="tel" placeholder="+39 333 0000000" value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required className={inputCls} />
            </div>
          </div>
        </div>

        {/* Pagamento e preferenze */}
        <div>
          <p className={sectionTitle}>Pagamento e preferenze</p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>IBAN <span className="text-red-500">*</span></label>
              <input type="text" placeholder="IT60 X054 2811 1010 0000 0123 456" value={iban}
                onChange={(e) => setIban(e.target.value)}
                required maxLength={34} className={inputCls + ' font-mono'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Taglia t-shirt <span className="text-red-500">*</span></label>
                <select value={tshirt} onChange={(e) => setTshirt(e.target.value)}
                  required className={selectCls}>
                  <option value="">— Seleziona —</option>
                  {TSHIRT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={haFigli} onChange={(e) => setHaFigli(e.target.checked)}
                    className="accent-blue-600 w-4 h-4 rounded" />
                  <span className="text-sm text-gray-300">Sono fiscalmente a carico</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2.5 text-xs text-red-400">{error}</div>
        )}

        <button
          type="submit"
          disabled={!step1Valid}
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium text-white transition disabled:opacity-50">
          Avanti — Genera contratto
        </button>
      </form>
    </div>
  );
}
