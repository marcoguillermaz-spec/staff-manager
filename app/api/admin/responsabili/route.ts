import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const ADMIN_ROLES = ['amministrazione', 'super_admin'];

// GET — list responsabili with their community assignments
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

  // Fetch all responsabili profiles
  const { data: profiles, error: pErr } = await serviceClient
    .from('user_profiles')
    .select('user_id')
    .eq('role', 'responsabile')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!profiles || profiles.length === 0) return NextResponse.json({ responsabili: [] });

  const userIds = profiles.map((p) => p.user_id);

  // Fetch collaborator names for those user_ids
  const { data: collabs } = await serviceClient
    .from('collaborators')
    .select('user_id, nome, cognome')
    .in('user_id', userIds);

  const collabMap = Object.fromEntries(
    (collabs ?? []).map((c) => [c.user_id, `${c.nome} ${c.cognome}`]),
  );

  // Fetch emails from auth.users
  const { data: authUsers } = await serviceClient.auth.admin.listUsers();
  const emailMap = Object.fromEntries(
    (authUsers?.users ?? []).map((u) => [u.id, u.email ?? '']),
  );

  // Fetch community assignments
  const { data: assignments } = await serviceClient
    .from('user_community_access')
    .select('user_id, community_id, communities(id, name)')
    .in('user_id', userIds);

  // Group assignments by user_id
  const assignMap: Record<string, { id: string; name: string }[]> = {};
  for (const a of assignments ?? []) {
    if (!assignMap[a.user_id]) assignMap[a.user_id] = [];
    const comm = Array.isArray(a.communities) ? a.communities[0] : a.communities;
    if (comm) assignMap[a.user_id].push({ id: comm.id, name: comm.name });
  }

  const responsabili = profiles.map((p) => ({
    user_id: p.user_id,
    display_name: collabMap[p.user_id] ?? emailMap[p.user_id] ?? p.user_id,
    email: emailMap[p.user_id] ?? '',
    communities: assignMap[p.user_id] ?? [],
  }));

  return NextResponse.json({ responsabili });
}
