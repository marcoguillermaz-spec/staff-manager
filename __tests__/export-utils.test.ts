import { describe, it, expect } from 'vitest';
import { buildCSV } from '../lib/export-utils';
import type { ExportItem } from '../lib/export-utils';

const occasionaleItem: ExportItem = {
  id: '1',
  nome: 'Mario',
  cognome: 'Rossi',
  codice_fiscale: 'RSSMRA80A01H501Z',
  iban: 'IT60X0542811101000000123456',
  partita_iva: null,
  community_name: 'Community A',
  periodo_riferimento: '2026-01',
  categoria: null,
  data_spesa: null,
  importo: 1234.56,
};

const pivaItem: ExportItem = {
  id: '2',
  nome: 'Giulia',
  cognome: 'Bianchi',
  codice_fiscale: 'BNCGLI85B41H501A',
  iban: null,
  partita_iva: '12345678901',
  community_name: 'Community B',
  periodo_riferimento: '2026-02',
  categoria: null,
  data_spesa: null,
  importo: 2500.00,
};

const rimborsoItem: ExportItem = {
  id: '3',
  nome: 'Luca',
  cognome: 'Verdi',
  codice_fiscale: 'VRDLCU90C12H501B',
  iban: 'IT60X0542811101000000654321',
  partita_iva: null,
  community_name: null,
  periodo_riferimento: null,
  categoria: 'Trasporto',
  data_spesa: '2026-02-15',
  importo: 75.00,
};

describe('buildCSV', () => {
  it('0 items occasionali → solo header con BOM', () => {
    const csv = buildCSV([], 'occasionali');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Nome;Cognome;Codice Fiscale;IBAN;Community;Periodo;Importo Netto');
    // Only header line (BOM + header)
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(1);
  });

  it('1 item occasionale → header + 1 riga con colonne corrette', () => {
    const csv = buildCSV([occasionaleItem], 'occasionali');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    const row = lines[1];
    expect(row).toContain('Mario');
    expect(row).toContain('Rossi');
    expect(row).toContain('RSSMRA80A01H501Z');
    expect(row).toContain('IT60X0542811101000000123456');
    expect(row).toContain('Community A');
    expect(row).toContain('2026-01');
    expect(row).toContain('1234.56');
  });

  it('1 item piva → colonne P.IVA (partita_iva invece di IBAN)', () => {
    const csv = buildCSV([pivaItem], 'piva');
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toContain('Partita IVA');
    expect(lines[0]).not.toContain('IBAN');
    const row = lines[1];
    expect(row).toContain('12345678901');
    expect(row).toContain('2500.00');
  });

  it('1 item rimborso → colonne categoria + data spesa', () => {
    const csv = buildCSV([rimborsoItem], 'rimborsi');
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toContain('Categoria');
    expect(lines[0]).toContain('Data Spesa');
    const row = lines[1];
    expect(row).toContain('Trasporto');
    expect(row).toContain('2026-02-15');
    expect(row).toContain('75.00');
  });

  it('header occasionali vs piva vs rimborsi sono diversi', () => {
    const hOcc = buildCSV([], 'occasionali').split('\r\n')[0];
    const hPiva = buildCSV([], 'piva').split('\r\n')[0];
    const hRim = buildCSV([], 'rimborsi').split('\r\n')[0];
    expect(hOcc).not.toBe(hPiva);
    expect(hPiva).not.toBe(hRim);
    expect(hOcc).not.toBe(hRim);
  });

  it('importo formattato con punto decimale, nessun simbolo €', () => {
    const csv = buildCSV([occasionaleItem], 'occasionali');
    const row = csv.split('\r\n')[1];
    expect(row).toContain('1234.56');
    expect(row).not.toContain('€');
  });

  it('valori null rimpiazzati con stringa vuota', () => {
    const itemNulls: ExportItem = {
      ...occasionaleItem,
      codice_fiscale: null,
      iban: null,
      community_name: null,
      periodo_riferimento: null,
    };
    const csv = buildCSV([itemNulls], 'occasionali');
    const row = csv.split('\r\n')[1];
    // Should have empty fields (consecutive semicolons)
    expect(row).toContain(';;');
  });
});
