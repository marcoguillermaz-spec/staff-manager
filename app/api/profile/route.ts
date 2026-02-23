import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Fields a collaborator can update on their own record
const SELF_EDIT_FIELDS = [
  'telefono', 'indirizzo', 'iban', 'tshirt_size',
  'partita_iva', 'ha_figli_a_carico',
] as const;

const patchSchema = z.object({
  telefono:          z.string().max(20).optional(),
  indirizzo:         z.string().max(200).optional(),
  iban:              z.string().max(34).regex(/^[A-Z]{2}\d{2}[A-Z0-9]+$/, 'IBAN non valido').or(z.literal('')).optional(),
  tshirt_size:       z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).nullable().optional(),
  partita_iva:       z.string().max(16).nullable().optional(),
  // ha_figli_a_carico: il collaboratore dichiara se È fiscalmente a carico di un familiare
  ha_figli_a_carico: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }

  // Strip to only allowed self-edit fields
  const update: Record<string, unknown> = {};
  for (const field of SELF_EDIT_FIELDS) {
    if (field in parsed.data) update[field] = parsed.data[field as keyof typeof parsed.data];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
  }

  const { error } = await supabase
    .from('collaborators')
    .update(update)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
