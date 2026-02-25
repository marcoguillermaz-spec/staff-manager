import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const ADMIN_ROLES = ['amministrazione'];

// PUT — replace all community assignments for a responsabile
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
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

  const { community_ids } = await request.json() as { community_ids: string[] };
  if (!Array.isArray(community_ids)) {
    return NextResponse.json({ error: 'community_ids deve essere un array' }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Delete existing assignments
  await serviceClient
    .from('user_community_access')
    .delete()
    .eq('user_id', userId);

  // Insert new assignments
  if (community_ids.length > 0) {
    const rows = community_ids.map((community_id) => ({ user_id: userId, community_id }));
    const { error } = await serviceClient.from('user_community_access').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: community_ids.length });
}
