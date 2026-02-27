/**
 * Unit tests for Block 4: username generation + validation schemas
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { generateUsername } from '@/lib/username';

// ── generateUsername ─────────────────────────────────────────────────────────
describe('generateUsername', () => {
  it('basic nome+cognome → lowercase underscore', () => {
    expect(generateUsername('Mario', 'Rossi')).toBe('mario_rossi');
  });

  it('strips accents', () => {
    expect(generateUsername('Léo', 'Müller')).toBe('leo_muller');
  });

  it('replaces non-alphanumeric with underscore and deduplicates', () => {
    expect(generateUsername('Maria José', 'De La Cruz')).toBe('maria_jose_de_la_cruz');
  });

  it('trims leading/trailing underscores', () => {
    expect(generateUsername('  Mario  ', '  Rossi  ')).toBe('mario_rossi');
  });

  it('handles empty nome', () => {
    expect(generateUsername('', 'Rossi')).toBe('rossi');
  });

  it('handles empty cognome', () => {
    expect(generateUsername('Mario', '')).toBe('mario');
  });

  it('returns empty string for both empty', () => {
    expect(generateUsername('', '')).toBe('');
  });

  it('handles Italian special chars', () => {
    expect(generateUsername('Giosuè', 'Carducci')).toBe('giosue_carducci');
  });
});

// ── Username Zod schema (mirrors PATCH /api/admin/collaboratori/[id]) ────────
const patchUsernameSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-z0-9_]+$/, 'Solo lettere minuscole, numeri e _'),
});

describe('patchUsernameSchema', () => {
  it('accepts valid username', () => {
    expect(patchUsernameSchema.safeParse({ username: 'mario_rossi' }).success).toBe(true);
  });

  it('rejects uppercase', () => {
    expect(patchUsernameSchema.safeParse({ username: 'Mario_Rossi' }).success).toBe(false);
  });

  it('rejects special chars', () => {
    expect(patchUsernameSchema.safeParse({ username: 'mario.rossi' }).success).toBe(false);
  });

  it('rejects too short (< 3)', () => {
    expect(patchUsernameSchema.safeParse({ username: 'ab' }).success).toBe(false);
  });

  it('rejects too long (> 50)', () => {
    expect(patchUsernameSchema.safeParse({ username: 'a'.repeat(51) }).success).toBe(false);
  });

  it('accepts alphanumeric with underscores', () => {
    expect(patchUsernameSchema.safeParse({ username: 'mario_rossi_2' }).success).toBe(true);
  });
});

// ── CF regex validation (mirrors profile + onboarding routes) ────────────────
const cfRegex = /^[A-Z0-9]{16}$/;

describe('codice_fiscale format validation', () => {
  it('accepts valid CF format', () => {
    expect(cfRegex.test('RSSMRA80A01H501U')).toBe(true);
  });

  it('rejects lowercase', () => {
    expect(cfRegex.test('rssmra80a01h501u')).toBe(false);
  });

  it('rejects special chars', () => {
    expect(cfRegex.test('RSSMRA80A01H501!')).toBe(false);
  });

  it('rejects partial CF (< 16 chars)', () => {
    expect(cfRegex.test('RSSMRA80A01H501')).toBe(false);
  });

  it('rejects too long (> 16 chars)', () => {
    expect(cfRegex.test('RSSMRA80A01H501UX')).toBe(false);
  });
});

// ── IBAN regex validation (mirrors onboarding route) ─────────────────────────
const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;

describe('IBAN format validation', () => {
  it('accepts valid Italian IBAN (no spaces)', () => {
    expect(ibanRegex.test('IT60X0542811101000000123456')).toBe(true);
  });

  it('rejects IBAN with spaces', () => {
    expect(ibanRegex.test('IT60 X054 2811')).toBe(false);
  });

  it('rejects lowercase', () => {
    expect(ibanRegex.test('it60x0542811101000000123456')).toBe(false);
  });

  it('rejects missing country code', () => {
    expect(ibanRegex.test('60X0542811101000000123456')).toBe(false);
  });
});
