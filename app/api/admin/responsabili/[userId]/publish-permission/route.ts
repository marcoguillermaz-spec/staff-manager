import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const ADMIN_ROLES = ['amministrazione'];

export async function PATCH(
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

  const body = await request.json() as { can_publish_announcements: boolean };
  if (typeof body.can_publish_announcements !== 'boolean') {
    return NextResponse.json({ error: 'can_publish_announcements deve essere boolean' }, { status: 400 });
  }

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Verify target user is a responsabile
  const { data: target } = await svc
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (!target || target.role !== 'responsabile') {
    return NextResponse.json({ error: 'Utente non è un responsabile' }, { status: 400 });
  }

  const { error } = await svc
    .from('user_profiles')
    .update({ can_publish_announcements: body.can_publish_announcements })
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: true });
}
