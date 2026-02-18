import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  role: z.enum(['collaboratore', 'responsabile', 'amministrazione', 'super_admin']),
  community_ids: z.array(z.string().uuid()).optional(),
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
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export async function POST(request: Request) {
  const cookieStore = await cookies();

  // Verify caller is authenticated and has admin role
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

  // Parse and validate body
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }
  const { email, role, community_ids } = parsed.data;

  // Use service role for all write operations
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const password = generatePassword();

  // Create auth user (email pre-confirmed, no invite email)
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

  // Create user_profiles row
  const { error: profileError } = await admin.from('user_profiles').insert({
    user_id: userId,
    role,
    is_active: true,
    must_change_password: true,
  });

  if (profileError) {
    // Roll back auth user to avoid orphaned accounts
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'Errore creazione profilo' }, { status: 500 });
  }

  // Assign communities for responsabile
  if (role === 'responsabile' && community_ids?.length) {
    await admin.from('user_community_access').insert(
      community_ids.map((cid) => ({ user_id: userId, community_id: cid })),
    );
  }

  return NextResponse.json({ email, password });
}
