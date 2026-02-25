import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const WRITE_ROLES = ['amministrazione'];

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('start_datetime', { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return NextResponse.json({ error: 'Utente non attivo' }, { status: 403 });
  if (!WRITE_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });

  const body = await request.json();
  const {
    titolo, descrizione, start_datetime, end_datetime,
    location, luma_url, luma_embed_url, community_id,
  } = body as {
    titolo: string;
    descrizione?: string;
    start_datetime?: string;
    end_datetime?: string;
    location?: string;
    luma_url?: string;
    luma_embed_url?: string;
    community_id?: string | null;
  };

  if (!titolo?.trim()) {
    return NextResponse.json({ error: 'Il titolo è obbligatorio' }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await serviceClient
    .from('events')
    .insert({
      titolo: titolo.trim(),
      descrizione: descrizione?.trim() || null,
      start_datetime: start_datetime || null,
      end_datetime: end_datetime || null,
      location: location?.trim() || null,
      luma_url: luma_url?.trim() || null,
      luma_embed_url: luma_embed_url?.trim() || null,
      community_id: community_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ event: data }, { status: 201 });
}
