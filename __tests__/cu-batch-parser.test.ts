import { describe, it, expect } from 'vitest';

// ── Pure CSV parser extracted for testing ─────────────────────────────────────
interface CsvRow {
  nome_file: string;
  nome: string;
  cognome: string;
}

function parseCSV(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  return lines.slice(1).map((line) => {
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
    return {
      nome_file: parts[0] ?? '',
      nome: parts[1] ?? '',
      cognome: parts[2] ?? '',
    };
  }).filter((r) => r.nome_file && r.nome && r.cognome);
}

// ── Dedup check logic ──────────────────────────────────────────────────────────
function isDuplicate(
  existing: Array<{ collaborator_id: string; anno: number; tipo: string }>,
  collaboratorId: string,
  anno: number,
): boolean {
  return existing.some(
    (e) => e.collaborator_id === collaboratorId && e.anno === anno && e.tipo === 'CU',
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('parseCSV', () => {
  it('CSV vuoto → array vuoto', () => {
    expect(parseCSV('')).toEqual([]);
  });

  it('solo header → array vuoto', () => {
    expect(parseCSV('nome_file,nome,cognome')).toEqual([]);
  });

  it('1 riga valida → 1 elemento', () => {
    const csv = 'nome_file,nome,cognome\nmario_rossi_CU_2025.pdf,Mario,Rossi';
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      nome_file: 'mario_rossi_CU_2025.pdf',
      nome: 'Mario',
      cognome: 'Rossi',
    });
  });

  it('più righe → array completo', () => {
    const csv = [
      'nome_file,nome,cognome',
      'mario_rossi_CU_2025.pdf,Mario,Rossi',
      'giulia_bianchi_CU_2025.pdf,Giulia,Bianchi',
      'luca_verdi_CU_2025.pdf,Luca,Verdi',
    ].join('\n');
    expect(parseCSV(csv)).toHaveLength(3);
  });

  it('righe con valori tra virgolette → strippate correttamente', () => {
    const csv = 'nome_file,nome,cognome\n"mario_rossi.pdf","Mario","Rossi"';
    const result = parseCSV(csv);
    expect(result[0].nome_file).toBe('mario_rossi.pdf');
    expect(result[0].nome).toBe('Mario');
  });

  it('righe con campi vuoti → filtrate', () => {
    const csv = 'nome_file,nome,cognome\n,Mario,Rossi\ngood.pdf,Luca,Verdi';
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe('Luca');
  });

  it('fine riga CRLF → gestita correttamente', () => {
    const csv = 'nome_file,nome,cognome\r\nmario.pdf,Mario,Rossi\r\n';
    expect(parseCSV(csv)).toHaveLength(1);
  });
});

describe('isDuplicate', () => {
  const existing = [
    { collaborator_id: 'abc', anno: 2025, tipo: 'CU' },
    { collaborator_id: 'xyz', anno: 2024, tipo: 'CU' },
  ];

  it('duplicato esatto → true', () => {
    expect(isDuplicate(existing, 'abc', 2025)).toBe(true);
  });

  it('stesso collaboratore anno diverso → false', () => {
    expect(isDuplicate(existing, 'abc', 2024)).toBe(false);
  });

  it('collaboratore diverso stesso anno → false', () => {
    expect(isDuplicate(existing, 'zzz', 2025)).toBe(false);
  });

  it('lista vuota → sempre false', () => {
    expect(isDuplicate([], 'abc', 2025)).toBe(false);
  });
});
