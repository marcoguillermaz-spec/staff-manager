import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

const patchSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-z0-9_]+$/, 'Solo lettere minuscole, numeri e _'),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  if (!caller?.is_active || !['amministrazione', 'responsabile_compensi'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Uniqueness check — exclude the target record itself
  const { data: existing } = await admin
    .from('collaborators')
    .select('id')
    .eq('username', parsed.data.username)
    .neq('id', id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Username già in uso' }, { status: 409 });
  }

  const { error } = await admin
    .from('collaborators')
    .update({ username: parsed.data.username })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, username: parsed.data.username });
}
