/**
 * Unit tests for Block 6:
 * - POST /api/expenses Zod schema (descrizione optional, new categories)
 * - EXPENSE_CATEGORIES updated list
 * - TICKET_CATEGORIES updated list
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { EXPENSE_CATEGORIES, TICKET_CATEGORIES } from '@/lib/types';

// Mirror the schema from the route
const createSchema = z.object({
  categoria: z.enum(EXPENSE_CATEGORIES),
  data_spesa: z.string().min(1),
  importo: z.number().positive(),
  descrizione: z.string().optional(),
});

describe('expenseCreateSchema', () => {
  it('accepts valid payload without descrizione', () => {
    const result = createSchema.safeParse({
      categoria: 'Trasporti',
      data_spesa: '2026-02-27',
      importo: 45.5,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid payload with descrizione', () => {
    const result = createSchema.safeParse({
      categoria: 'Vitto',
      data_spesa: '2026-02-01',
      importo: 12.0,
      descrizione: 'Pranzo di lavoro con il team',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing categoria', () => {
    expect(createSchema.safeParse({ data_spesa: '2026-02-01', importo: 10 }).success).toBe(false);
  });

  it('rejects invalid categoria (old value)', () => {
    expect(
      createSchema.safeParse({ categoria: 'Trasporto', data_spesa: '2026-02-01', importo: 10 }).success,
    ).toBe(false);
  });

  it('rejects negative importo', () => {
    expect(
      createSchema.safeParse({ categoria: 'Vitto', data_spesa: '2026-02-01', importo: -5 }).success,
    ).toBe(false);
  });

  it('rejects zero importo', () => {
    expect(
      createSchema.safeParse({ categoria: 'Alloggio', data_spesa: '2026-02-01', importo: 0 }).success,
    ).toBe(false);
  });

  it('rejects missing data_spesa', () => {
    expect(
      createSchema.safeParse({ categoria: 'Materiali', importo: 20 }).success,
    ).toBe(false);
  });

  it('accepts all new expense categories', () => {
    for (const cat of EXPENSE_CATEGORIES) {
      const result = createSchema.safeParse({ categoria: cat, data_spesa: '2026-02-01', importo: 1 });
      expect(result.success, `category ${cat} should be valid`).toBe(true);
    }
  });
});

describe('EXPENSE_CATEGORIES', () => {
  it('contains the 6 expected categories', () => {
    expect(EXPENSE_CATEGORIES).toEqual(['Trasporti', 'Vitto', 'Alloggio', 'Materiali', 'Cancelleria', 'Altro']);
  });

  it('does not contain old categories', () => {
    expect(EXPENSE_CATEGORIES).not.toContain('Trasporto');
    expect(EXPENSE_CATEGORIES).not.toContain('Materiale di consumo');
    expect(EXPENSE_CATEGORIES).not.toContain('Formazione');
    expect(EXPENSE_CATEGORIES).not.toContain('Telefonia');
  });
});

describe('TICKET_CATEGORIES', () => {
  it('contains the 5 expected categories', () => {
    expect(TICKET_CATEGORIES).toEqual(['Generale', 'Compensi', 'Documenti', 'Accesso', 'Altro']);
  });

  it('does not contain old categories', () => {
    expect(TICKET_CATEGORIES).not.toContain('Compensi e pagamenti');
    expect(TICKET_CATEGORIES).not.toContain('Rimborsi spese');
    expect(TICKET_CATEGORIES).not.toContain('Accesso e account');
    expect(TICKET_CATEGORIES).not.toContain('Problemi tecnici');
  });
});
