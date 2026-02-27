/**
 * Unit tests for Block 5:
 * - PATCH /api/admin/collaboratori/[id]/profile — Zod schema
 * - Province regex validation
 * - Field permission: IBAN absent from schema
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror the schema from the route
const patchSchema = z.object({
  username:            z.string().min(3).max(50).regex(/^[a-z0-9_]+$/).optional(),
  nome:                z.string().min(1).max(100).optional(),
  cognome:             z.string().min(1).max(100).optional(),
  codice_fiscale:      z.string().regex(/^[A-Z0-9]{16}$/).nullable().optional(),
  data_nascita:        z.string().nullable().optional(),
  luogo_nascita:       z.string().max(100).nullable().optional(),
  provincia_nascita:   z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  comune:              z.string().max(100).nullable().optional(),
  provincia_residenza: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  telefono:            z.string().max(20).nullable().optional(),
  indirizzo:           z.string().max(200).nullable().optional(),
  civico_residenza:    z.string().max(20).nullable().optional(),
  tshirt_size:         z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).nullable().optional(),
  sono_un_figlio_a_carico: z.boolean().optional(),
  importo_lordo_massimale: z.number().min(1).max(5000).nullable().optional(),
});

describe('patchProfileSchema', () => {
  it('accepts a valid partial update', () => {
    const result = patchSchema.safeParse({ nome: 'Mario', cognome: 'Rossi' });
    expect(result.success).toBe(true);
  });

  it('accepts full valid payload', () => {
    const result = patchSchema.safeParse({
      username: 'mario_rossi',
      nome: 'Mario',
      cognome: 'Rossi',
      codice_fiscale: 'RSSMRA80A01H501U',
      data_nascita: '1980-01-01',
      luogo_nascita: 'Roma',
      provincia_nascita: 'RM',
      comune: 'Milano',
      provincia_residenza: 'MI',
      telefono: '+39 333 0000000',
      indirizzo: 'Via Roma',
      civico_residenza: '1',
      tshirt_size: 'M',
      sono_un_figlio_a_carico: false,
      importo_lordo_massimale: 5000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid CF (lowercase)', () => {
    expect(patchSchema.safeParse({ codice_fiscale: 'rssmra80a01h501u' }).success).toBe(false);
  });

  it('rejects invalid CF (15 chars)', () => {
    expect(patchSchema.safeParse({ codice_fiscale: 'RSSMRA80A01H501' }).success).toBe(false);
  });

  it('accepts null CF (clearing)', () => {
    expect(patchSchema.safeParse({ codice_fiscale: null }).success).toBe(true);
  });

  it('rejects invalid provincia (3 chars)', () => {
    expect(patchSchema.safeParse({ provincia_nascita: 'ROM' }).success).toBe(false);
  });

  it('rejects invalid provincia (lowercase)', () => {
    expect(patchSchema.safeParse({ provincia_residenza: 'mi' }).success).toBe(false);
  });

  it('accepts valid provincia', () => {
    expect(patchSchema.safeParse({ provincia_nascita: 'RM' }).success).toBe(true);
  });

  it('rejects massimale > 5000', () => {
    expect(patchSchema.safeParse({ importo_lordo_massimale: 6000 }).success).toBe(false);
  });

  it('accepts null massimale (clearing)', () => {
    expect(patchSchema.safeParse({ importo_lordo_massimale: null }).success).toBe(true);
  });

  it('rejects invalid tshirt_size', () => {
    expect(patchSchema.safeParse({ tshirt_size: 'MEGA' }).success).toBe(false);
  });

  it('IBAN is NOT part of the schema (excluded field)', () => {
    // The schema ignores unknown keys by default in Zod (passthrough not set),
    // but IBAN is intentionally absent — verify it's not in the schema keys
    const schemaKeys = Object.keys(patchSchema.shape);
    expect(schemaKeys).not.toContain('iban');
  });
});
