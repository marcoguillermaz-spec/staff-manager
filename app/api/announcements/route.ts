import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const WRITE_ROLES = ['amministrazione', 'responsabile'];

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ announcements: data ?? [] });
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
  const { titolo, contenuto, pinned, community_id } = body as {
    titolo: string;
    contenuto: string;
    pinned?: boolean;
    community_id?: string | null;
  };

  if (!titolo?.trim() || !contenuto?.trim()) {
    return NextResponse.json({ error: 'Titolo e contenuto sono obbligatori' }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await serviceClient
    .from('announcements')
    .insert({
      titolo: titolo.trim(),
      contenuto: contenuto.trim(),
      pinned: pinned ?? false,
      community_id: community_id ?? null,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ announcement: data }, { status: 201 });
}
