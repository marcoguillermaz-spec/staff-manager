import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const ADMIN_ROLES = ['amministrazione', 'super_admin'];

// GET — list collaborators with member_status (admin only)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return NextResponse.json({ error: 'Utente non attivo' }, { status: 403 });
  if (!ADMIN_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Join user_profiles (for member_status) and collaborators (for name)
  const { data, error } = await serviceClient
    .from('collaborators')
    .select('id, user_id, nome, cognome, user_profiles!inner(member_status, is_active)')
    .order('cognome', { ascending: true })
    .order('nome', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const members = (data ?? []).map((c) => {
    const up = Array.isArray(c.user_profiles) ? c.user_profiles[0] : c.user_profiles;
    return {
      id: c.id,
      user_id: c.user_id,
      nome: c.nome,
      cognome: c.cognome,
      member_status: up?.member_status ?? 'attivo',
      is_active: up?.is_active ?? true,
    };
  });

  return NextResponse.json({ members });
}
