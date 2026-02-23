'use client';

import { useState } from 'react';
import { CONTRACT_TEMPLATE_LABELS, type ContractTemplateType } from '@/lib/types';

type Template = {
  id: string;
  tipo: ContractTemplateType;
  file_name: string;
  uploaded_at: string;
};

type Props = { templates: Template[] };

const TIPOS: ContractTemplateType[] = ['OCCASIONALE', 'COCOCO', 'PIVA'];

const PLACEHOLDERS = [
  // ── Occasionale / P.IVA ──────────────────────────────────────────────────
  { key: '{nome}',           desc: 'Nome collaboratore' },
  { key: '{cognome}',        desc: 'Cognome collaboratore' },
  { key: '{codice_fiscale}', desc: 'Codice fiscale' },
  { key: '{partita_iva}',    desc: 'Partita IVA (solo P.IVA)' },
  { key: '{data_nascita}',   desc: 'Data di nascita' },
  { key: '{luogo_nascita}',  desc: 'Luogo di nascita' },
  { key: '{comune}',         desc: 'Comune di residenza' },
  { key: '{indirizzo}',      desc: 'Via e numero civico' },
  { key: '{compenso_lordo}', desc: 'Compenso lordo (€)' },
  { key: '{data_inizio}',    desc: 'Data inizio contratto' },
  { key: '{data_fine}',      desc: 'Data fine contratto' },
  { key: '{numero_rate}',    desc: 'Numero di rate (CoCoCo/P.IVA)' },
  { key: '{importo_rata}',   desc: 'Importo rata (€, CoCoCo/P.IVA)' },
  // ── CoCoCo ───────────────────────────────────────────────────────────────
  { key: '{citta_nascita}',                desc: 'Città di nascita (CoCoCo)' },
  { key: '{provincia_nascita}',            desc: 'Provincia di nascita — sigla (CoCoCo)' },
  { key: '{data_di_nascita}',              desc: 'Data di nascita formattata (CoCoCo)' },
  { key: '{citta_residenza}',              desc: 'Comune di residenza (CoCoCo)' },
  { key: '{provincia_residenza}',          desc: 'Provincia di residenza — sigla (CoCoCo)' },
  { key: '{indirizzo_residenza}',          desc: 'Via/Piazza di residenza (CoCoCo)' },
  { key: '{civico_residenza}',             desc: 'Numero civico (CoCoCo)' },
  { key: '{importo_euro}',                 desc: 'Compenso totale in €  (CoCoCo)' },
  { key: '{importo_in_lettere}',           desc: 'Compenso in lettere (CoCoCo)' },
  { key: '{numero_soluzioni}',             desc: 'Numero rate (CoCoCo)' },
  { key: '{importo_singole_soluzioni}',    desc: 'Importo singola rata (CoCoCo)' },
  { key: '{data_inizio_collaborazione}',   desc: 'Data inizio collaborazione (CoCoCo)' },
  { key: '{data_fine_collaborazione}',     desc: 'Data fine collaborazione (CoCoCo)' },
];

const sectionCls = 'rounded-2xl bg-gray-900 border border-gray-800';
const sectionHeader = 'px-5 py-4 border-b border-gray-800';

export default function ContractTemplateManager({ templates: initial }: Props) {
  const [templates, setTemplates] = useState<Template[]>(initial);
  const [uploading, setUploading] = useState<ContractTemplateType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  const templateMap = Object.fromEntries(templates.map((t) => [t.tipo, t]));

  const handleUpload = async (tipo: ContractTemplateType, file: File) => {
    setUploading(tipo);
    setError(null);
    const formData = new FormData();
    formData.append('tipo', tipo);
    formData.append('file', file);

    const res = await fetch('/api/admin/contract-templates', { method: 'POST', body: formData });
    const data = await res.json();
    setUploading(null);

    if (!res.ok) {
      setError(data.error ?? 'Errore durante il caricamento');
      return;
    }

    // Refresh template list
    const refreshRes = await fetch('/api/admin/contract-templates');
    const refreshData = await refreshRes.json();
    setTemplates(refreshData.templates ?? []);
  };

  return (
    <div className="space-y-4">
      {/* Templates */}
      <div className={sectionCls}>
        <div className={sectionHeader}>
          <h2 className="text-sm font-medium text-gray-200">Template contratti</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Carica un file .docx per ogni tipologia. Il template viene sostituito ad ogni caricamento.
          </p>
        </div>
        <div className="p-5 space-y-3">
          {TIPOS.map((tipo) => {
            const tpl = templateMap[tipo];
            const isUploading = uploading === tipo;
            return (
              <div key={tipo}
                className="flex items-center justify-between rounded-xl bg-gray-800 border border-gray-700 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200">{CONTRACT_TEMPLATE_LABELS[tipo]}</p>
                  {tpl ? (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {tpl.file_name} · {new Date(tpl.uploaded_at).toLocaleDateString('it-IT')}
                    </p>
                  ) : (
                    <p className="text-xs text-yellow-600 mt-0.5">Nessun template caricato</p>
                  )}
                </div>
                <label className={`ml-4 flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer
                  ${isUploading
                    ? 'bg-gray-700 text-gray-500 pointer-events-none'
                    : tpl
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {isUploading ? 'Caricamento…' : tpl ? 'Sostituisci' : 'Carica'}
                  <input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(tipo, file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            );
          })}
          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Placeholders reference */}
      <div className={sectionCls}>
        <button
          type="button"
          onClick={() => setShowPlaceholders((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <h2 className="text-sm font-medium text-gray-200">Segnaposto disponibili</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Inserisci questi segnaposto nel .docx — verranno sostituiti automaticamente.
            </p>
          </div>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ml-4 ${showPlaceholders ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showPlaceholders && (
          <div className="border-t border-gray-800 px-5 pb-5">
            <div className="mt-4 grid grid-cols-1 gap-1.5">
              {PLACEHOLDERS.map(({ key, desc }) => (
                <div key={key} className="flex items-center gap-3 text-xs">
                  <code className="rounded bg-gray-800 border border-gray-700 px-2 py-0.5 text-blue-300 font-mono flex-shrink-0">
                    {key}
                  </code>
                  <span className="text-gray-400">{desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-4">
              Sintassi: segnaposto tra singole graffe. Es.: <code className="text-gray-400">&#123;nome&#125;</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
