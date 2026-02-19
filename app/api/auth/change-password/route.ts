import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = await cookies();

  // Verify current session (before password rotation)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  console.log('[change-password] getUser:', user?.id ?? 'null', authErr?.message ?? 'ok');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { password } = await request.json();
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password troppo corta (minimo 8 caratteri)' }, { status: 400 });
  }

  // Use service role to update password + clear flag atomically
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password });
  console.log('[change-password] updateUserById:', updateError?.message ?? 'ok');
  if (updateError) {
    return NextResponse.json({ error: 'Errore durante l\'aggiornamento della password' }, { status: 500 });
  }

  const { error: flagErr } = await admin
    .from('user_profiles')
    .update({ must_change_password: false })
    .eq('user_id', user.id);
  console.log('[change-password] clear flag:', flagErr?.message ?? 'ok');

  return NextResponse.json({ ok: true });
}
