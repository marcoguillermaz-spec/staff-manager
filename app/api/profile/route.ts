import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

// All fields a collaborator can update on their own record
// data_ingresso is admin-only; email is handled separately via auth.admin
const SELF_EDIT_FIELDS = [
  'nome', 'cognome', 'codice_fiscale', 'data_nascita', 'luogo_nascita', 'provincia_nascita',
  'comune', 'provincia_residenza', 'telefono', 'indirizzo', 'civico_residenza',
  'iban', 'tshirt_size', 'sono_un_figlio_a_carico', 'importo_lordo_massimale',
] as const;

const patchSchema = z.object({
  email:               z.string().email().optional(),
  nome:                z.string().min(1).max(100).optional(),
  cognome:             z.string().min(1).max(100).optional(),
  codice_fiscale:      z.string().max(16).nullable().optional(),
  data_nascita:        z.string().nullable().optional(),
  luogo_nascita:       z.string().max(100).nullable().optional(),
  provincia_nascita:   z.string().max(10).nullable().optional(),
  comune:              z.string().max(100).nullable().optional(),
  provincia_residenza: z.string().max(10).nullable().optional(),
  telefono:            z.string().max(20).nullable().optional(),
  indirizzo:           z.string().max(200).nullable().optional(),
  civico_residenza:    z.string().max(20).nullable().optional(),
  iban:                z.string().max(34).regex(/^[A-Z]{2}\d{2}[A-Z0-9]+$/, 'IBAN non valido').or(z.literal('')).optional(),
  tshirt_size:         z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).nullable().optional(),
  // sono_un_figlio_a_carico: il collaboratore dichiara se È fiscalmente a carico di un familiare
  sono_un_figlio_a_carico:   z.boolean().optional(),
  importo_lordo_massimale:   z.number().min(1).max(5000).nullable().optional(),
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

  const newEmail = parsed.data.email?.trim().toLowerCase();
  const emailChanged = !!newEmail && newEmail !== user.email?.toLowerCase();

  if (Object.keys(update).length === 0 && !emailChanged) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase
      .from('collaborators')
      .update(update)
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (emailChanged) {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { error: emailError } = await svc.auth.admin.updateUserById(user.id, {
      email: newEmail,
      email_confirm: true,
    });
    if (emailError) return NextResponse.json({ error: 'Errore aggiornamento email: ' + emailError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, emailChanged });
}
