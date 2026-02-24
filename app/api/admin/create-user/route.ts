import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { emailInvito } from '@/lib/email-templates';

const schema = z.object({
  email: z.string().email(),
  role: z.enum(['collaboratore', 'responsabile', 'amministrazione', 'super_admin']),
  community_ids: z.array(z.string().uuid()).optional(),
  // Tipo rapporto (obbligatorio per collaboratore e responsabile)
  tipo_contratto: z.enum(['OCCASIONALE', 'COCOCO', 'PIVA']).optional(),
  // Anagrafica (opzionale — pre-fill per l'onboarding)
  nome:                z.string().min(1).max(100).optional(),
  cognome:             z.string().min(1).max(100).optional(),
  codice_fiscale:      z.string().max(16).nullable().optional(),
  data_nascita:        z.string().nullable().optional(),
  luogo_nascita:       z.string().max(100).nullable().optional(),
  provincia_nascita:   z.string().max(10).nullable().optional(),
  comune:              z.string().max(100).nullable().optional(),
  provincia_residenza: z.string().max(10).nullable().optional(),
  indirizzo:           z.string().max(200).nullable().optional(),
  civico_residenza:    z.string().max(20).nullable().optional(),
  telefono:            z.string().max(20).nullable().optional(),
});

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%';
  const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const chars = [
    rand(upper), rand(upper),
    rand(lower), rand(lower), rand(lower),
    rand(digits), rand(digits),
    rand(special),
    rand(upper), rand(lower),
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}


export async function POST(request: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!caller?.is_active || !['amministrazione', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }

  const {
    email, role, community_ids, tipo_contratto,
    nome, cognome, codice_fiscale, data_nascita,
    luogo_nascita, provincia_nascita,
    comune, provincia_residenza,
    indirizzo, civico_residenza, telefono,
  } = parsed.data;

  // tipo_contratto is required for collaboratore and responsabile
  if (['collaboratore', 'responsabile'].includes(role) && !tipo_contratto) {
    return NextResponse.json({ error: 'Tipo rapporto obbligatorio' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const password = generatePassword();

  // 1. Create auth user
  const { data: newAuthUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !newAuthUser.user) {
    const msg = createError?.message ?? 'Errore creazione utente';
    const alreadyExists = msg.toLowerCase().includes('already');
    return NextResponse.json(
      { error: alreadyExists ? 'Email già registrata' : msg },
      { status: 400 },
    );
  }

  const userId = newAuthUser.user.id;

  // 2. Create user_profiles row (onboarding_completed=false for new users)
  const { error: profileError } = await admin.from('user_profiles').insert({
    user_id: userId,
    role,
    is_active: true,
    must_change_password: true,
    onboarding_completed: false,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'Errore creazione profilo' }, { status: 500 });
  }

  // 3. Assign communities for responsabile
  if (role === 'responsabile' && community_ids?.length) {
    await admin.from('user_community_access').insert(
      community_ids.map((cid) => ({ user_id: userId, community_id: cid })),
    );
  }

  // 4. Create collaborators record for collaboratore and responsabile
  //    (tipo_contratto is stored here; anagrafica fields are pre-fill — completed during onboarding)
  if (['collaboratore', 'responsabile'].includes(role) && tipo_contratto) {
    await admin.from('collaborators').insert({
      user_id:             userId,
      email,
      tipo_contratto,
      nome:                nome?.trim() || null,
      cognome:             cognome?.trim() || null,
      codice_fiscale:      codice_fiscale ?? null,
      data_nascita:        data_nascita ?? null,
      luogo_nascita:       luogo_nascita ?? null,
      provincia_nascita:   provincia_nascita ?? null,
      comune:              comune ?? null,
      provincia_residenza: provincia_residenza ?? null,
      indirizzo:           indirizzo ?? null,
      civico_residenza:    civico_residenza ?? null,
      telefono:            telefono ?? null,
    });
  }

  // 5. Send invitation email (fire-and-forget — never blocks the response)
  const { subject, html } = emailInvito({ email, password, ruolo: role });
  sendEmail(email, subject, html).catch(() => {});

  return NextResponse.json({ email, password });
}
