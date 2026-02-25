import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const WRITE_ROLES = ['amministrazione'];

async function authorizeWriter(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return { error: 'Utente non attivo', status: 403 };
  if (!WRITE_ROLES.includes(profile.role)) return { error: 'Non autorizzato', status: 403 };

  return { error: null, status: 200 };
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
  const update: Record<string, unknown> = {};
  if (body.titolo !== undefined) update.titolo = body.titolo.trim();
  if (body.descrizione !== undefined) update.descrizione = body.descrizione?.trim() || null;
  if (body.link !== undefined) update.link = body.link?.trim() || null;
  if (body.file_url !== undefined) update.file_url = body.file_url?.trim() || null;
  if (body.tag !== undefined) update.tag = body.tag?.length ? body.tag : null;
  if (body.community_id !== undefined) update.community_id = body.community_id;

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await serviceClient
    .from('resources')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ resource: data });
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

  const { error } = await serviceClient.from('resources').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({}, { status: 204 });
}
