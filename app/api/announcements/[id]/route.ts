import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const WRITE_ROLES = ['amministrazione', 'responsabile'];

async function authorizeWriter(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: 'Unauthorized', status: 401 };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return { user: null, error: 'Utente non attivo', status: 403 };
  if (!WRITE_ROLES.includes(profile.role)) return { user: null, error: 'Non autorizzato', status: 403 };

  return { user, error: null, status: 200 };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await authorizeWriter(supabase);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { titolo, contenuto, pinned, community_id } = body as {
    titolo?: string;
    contenuto?: string;
    pinned?: boolean;
    community_id?: string | null;
  };

  const update: Record<string, unknown> = {};
  if (titolo !== undefined) update.titolo = titolo.trim();
  if (contenuto !== undefined) update.contenuto = contenuto.trim();
  if (pinned !== undefined) update.pinned = pinned;
  if (community_id !== undefined) update.community_id = community_id;

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await serviceClient
    .from('announcements')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ announcement: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await authorizeWriter(supabase);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await serviceClient
    .from('announcements')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({}, { status: 204 });
}
