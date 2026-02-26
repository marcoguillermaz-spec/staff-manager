/**
 * Unit test: Zod schema validation for POST /api/admin/create-user
 * Verifies that role values are correct after Blocco 1 rename.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror the schema from the route (without the server context)
const schema = z.object({
  email: z.string().email(),
  role: z.enum([
    'collaboratore',
    'responsabile_cittadino',
    'responsabile_compensi',
    'responsabile_servizi_individuali',
    'amministrazione',
  ]),
  tipo_contratto: z.enum(['OCCASIONALE', 'COCOCO', 'PIVA']).optional(),
});

describe('create-user role schema', () => {
  it('accepts collaboratore', () => {
    expect(schema.safeParse({ email: 'a@b.com', role: 'collaboratore' }).success).toBe(true);
  });

  it('accepts responsabile_compensi', () => {
    expect(schema.safeParse({ email: 'a@b.com', role: 'responsabile_compensi' }).success).toBe(true);
  });

  it('accepts responsabile_cittadino', () => {
    expect(schema.safeParse({ email: 'a@b.com', role: 'responsabile_cittadino' }).success).toBe(true);
  });

  it('accepts responsabile_servizi_individuali', () => {
    expect(schema.safeParse({ email: 'a@b.com', role: 'responsabile_servizi_individuali' }).success).toBe(true);
  });

  it('accepts amministrazione', () => {
    expect(schema.safeParse({ email: 'a@b.com', role: 'amministrazione' }).success).toBe(true);
  });

  it('rejects old role value "responsabile"', () => {
    expect(schema.safeParse({ email: 'a@b.com', role: 'responsabile' }).success).toBe(false);
  });

  it('rejects unknown role', () => {
    expect(schema.safeParse({ email: 'a@b.com', role: 'super_admin' }).success).toBe(false);
  });

  it('rejects missing email', () => {
    expect(schema.safeParse({ role: 'collaboratore' }).success).toBe(false);
  });

  it('rejects invalid email format', () => {
    expect(schema.safeParse({ email: 'not-an-email', role: 'collaboratore' }).success).toBe(false);
  });
});
