/**
 * Generate a URL-safe username from nome and cognome.
 * Usable both client-side (preview) and server-side (creation).
 */
export function generateUsername(nome: string, cognome: string): string {
  const clean = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // remove accents
      .replace(/[^a-z0-9]+/g, '_')       // non-alphanumeric → _
      .replace(/^_+|_+$/g, '');          // trim leading/trailing _

  const n = clean(nome);
  const c = clean(cognome);
  if (!n && !c) return '';
  if (!n) return c;
  if (!c) return n;
  return `${n}_${c}`;
}

/**
 * Find a unique username by appending a numeric suffix if needed.
 * Server-side only — requires a Supabase admin client.
 * If excludeId is provided, that record is excluded from the uniqueness check (for updates).
 */
export async function generateUniqueUsername(
  base: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: any,
  excludeId?: string,
): Promise<string> {
  if (!base) return '';
  let candidate = base;
  let i = 2;
  while (i < 1000) {
    let query = svc.from('collaborators').select('id').eq('username', candidate);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    candidate = `${base}_${i}`;
    i++;
  }
  return `${base}_${Date.now()}`;
}
