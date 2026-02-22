import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const ADMIN_ROLES = ['amministrazione', 'super_admin'];

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null };
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();
  return { user, role: profile?.is_active ? profile.role : null };
}

// GET — active communities only (for selects across the app)
// Pass ?all=1 for the admin management view (includes inactive)
export async function GET(request: Request) {
  const { user, role } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const showAll = searchParams.get('all') === '1' && role && ADMIN_ROLES.includes(role);

  const supabase = await createClient();
  let query = supabase.from('communities').select('id, name, is_active').order('name');
  if (!showAll) query = query.eq('is_active', true);

  const { data } = await query;
  return NextResponse.json({ communities: data ?? [] });
}

// POST — create community (admin only)
export async function POST(request: Request) {
  const { user, role } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!role || !ADMIN_ROLES.includes(role)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Il nome è obbligatorio' }, { status: 400 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await serviceClient
    .from('communities')
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ community: data }, { status: 201 });
}
