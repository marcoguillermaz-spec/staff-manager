import * as XLSX from 'xlsx';

export type ExportTab = 'occasionali' | 'rimborsi';

export interface ExportItem {
  id: string;
  nome: string;
  cognome: string;
  codice_fiscale: string | null;
  iban: string | null;
  partita_iva: string | null;
  community_name: string | null;
  periodo_riferimento: string | null;
  categoria: string | null;
  data_spesa: string | null;
  importo: number;
}

// ── Headers ─────────────────────────────────────────────────────────────────

const HEADERS: Record<ExportTab, string[]> = {
  occasionali: ['Nome', 'Cognome', 'Codice Fiscale', 'IBAN', 'Community', 'Periodo', 'Importo Netto'],
  rimborsi:    ['Nome', 'Cognome', 'Codice Fiscale', 'IBAN', 'Categoria', 'Data Spesa', 'Importo'],
};

// ── Row builders ─────────────────────────────────────────────────────────────

function toRow(item: ExportItem, tab: ExportTab): string[] {
  const importoStr = item.importo.toFixed(2);
  if (tab === 'occasionali') {
    return [
      item.nome,
      item.cognome,
      item.codice_fiscale ?? '',
      item.iban ?? '',
      item.community_name ?? '',
      item.periodo_riferimento ?? '',
      importoStr,
    ];
  }
  // rimborsi
  return [
    item.nome,
    item.cognome,
    item.codice_fiscale ?? '',
    item.iban ?? '',
    item.categoria ?? '',
    item.data_spesa ?? '',
    importoStr,
  ];
}

// ── CSV ─────────────────────────────────────────────────────────────────────

function escapeCSV(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCSV(items: ExportItem[], tab: ExportTab): string {
  const header = HEADERS[tab].map(escapeCSV).join(';');
  const rows = items.map((item) => toRow(item, tab).map(escapeCSV).join(';'));
  // BOM for Excel Italian compatibility
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

// ── XLSX ─────────────────────────────────────────────────────────────────────

export function buildXLSXWorkbook(items: ExportItem[], tab: ExportTab): XLSX.WorkBook {
  const header = HEADERS[tab];
  const rows = items.map((item) => toRow(item, tab));
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tab.charAt(0).toUpperCase() + tab.slice(1));
  return wb;
}
