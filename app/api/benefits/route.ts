import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const WRITE_ROLES = ['amministrazione'];

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('benefits')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ benefits: data ?? [] });
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
  const { titolo, descrizione, codice_sconto, link, valid_from, valid_to, community_id } = body as {
    titolo: string;
    descrizione?: string;
    codice_sconto?: string;
    link?: string;
    valid_from?: string;
    valid_to?: string;
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
    .from('benefits')
    .insert({
      titolo: titolo.trim(),
      descrizione: descrizione?.trim() || null,
      codice_sconto: codice_sconto?.trim() || null,
      link: link?.trim() || null,
      valid_from: valid_from || null,
      valid_to: valid_to || null,
      community_id: community_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ benefit: data }, { status: 201 });
}
