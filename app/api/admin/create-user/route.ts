import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { emailInvito } from '@/lib/email-templates';
import { generateUsername, generateUniqueUsername } from '@/lib/username';

const schema = z.object({
  email: z.string().email(),
  role: z.enum(['collaboratore', 'responsabile_cittadino', 'responsabile_compensi', 'responsabile_servizi_individuali', 'amministrazione']),
  community_ids: z.array(z.string().uuid()).optional(),
  // Tipo rapporto: always OCCASIONALE
  tipo_contratto: z.literal('OCCASIONALE').optional(),
  // Anagrafica (opzionale — pre-fill per l'onboarding)
  username:            z.string().min(3).max(50).regex(/^[a-z0-9_]+$/, 'Solo lettere minuscole, numeri e _').optional(),
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

  if (!caller?.is_active || !['amministrazione'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }

  const {
    email, role, community_ids, tipo_contratto,
    username: usernameInput,
    nome, cognome, codice_fiscale, data_nascita,
    luogo_nascita, provincia_nascita,
    comune, provincia_residenza,
    indirizzo, civico_residenza, telefono,
  } = parsed.data;

  // tipo_contratto is required for collaboratore and responsabile_compensi
  if (['collaboratore', 'responsabile_compensi'].includes(role) && !tipo_contratto) {
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

  // 3. Assign communities for responsabile_compensi
  if (role === 'responsabile_compensi' && community_ids?.length) {
    await admin.from('user_community_access').insert(
      community_ids.map((cid) => ({ user_id: userId, community_id: cid })),
    );
  }

  // 4. Create collaborators record for collaboratore and responsabile_compensi
  //    (tipo_contratto is stored here; anagrafica fields are pre-fill — completed during onboarding)
  if (['collaboratore', 'responsabile_compensi'].includes(role) && tipo_contratto) {
    const nomeTrimmed    = nome?.trim() || null;
    const cognomeTrimmed = cognome?.trim() || null;

    // Resolve username: explicit (validate uniqueness) or auto-generate
    let resolvedUsername: string | null = null;
    if (usernameInput) {
      // Admin provided a specific username — strict uniqueness check
      const { data: existing } = await admin
        .from('collaborators')
        .select('id')
        .eq('username', usernameInput)
        .maybeSingle();
      if (existing) {
        await admin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: 'Username già in uso' }, { status: 409 });
      }
      resolvedUsername = usernameInput;
    } else if (nomeTrimmed && cognomeTrimmed) {
      // Auto-generate with uniqueness suffix
      const base = generateUsername(nomeTrimmed, cognomeTrimmed);
      resolvedUsername = base ? await generateUniqueUsername(base, admin) : null;
    }

    await admin.from('collaborators').insert({
      user_id:             userId,
      email,
      tipo_contratto,
      username:            resolvedUsername,
      nome:                nomeTrimmed,
      cognome:             cognomeTrimmed,
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
