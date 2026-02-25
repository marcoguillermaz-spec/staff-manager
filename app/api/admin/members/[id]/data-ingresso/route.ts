import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const ADMIN_ROLES = ['amministrazione'];

// PATCH — update data_ingresso for a collaborator (by collaborator.id)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const body = await request.json() as { data_ingresso: string | null };
  const { data_ingresso } = body;

  // Validate date format if provided
  if (data_ingresso !== null && data_ingresso !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_ingresso)) {
      return NextResponse.json({ error: 'Formato data non valido (atteso: YYYY-MM-DD)' }, { status: 400 });
    }
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await serviceClient
    .from('collaborators')
    .update({ data_ingresso: data_ingresso ?? null })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: true });
}
