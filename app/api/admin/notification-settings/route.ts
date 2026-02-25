import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const ADMIN_ROLES = ['amministrazione'];

// GET — list all notification settings
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active || !ADMIN_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await svc
    .from('notification_settings')
    .select('*')
    .order('event_key');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data ?? [] });
}

// PATCH — toggle a single setting
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active || !ADMIN_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const body = await request.json() as {
    event_key: string;
    recipient_role: string;
    field: 'inapp_enabled' | 'email_enabled';
    value: boolean;
  };

  if (!body.event_key || !body.recipient_role || !body.field || typeof body.value !== 'boolean') {
    return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 });
  }
  if (!['inapp_enabled', 'email_enabled'].includes(body.field)) {
    return NextResponse.json({ error: 'Campo non valido' }, { status: 400 });
  }

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await svc
    .from('notification_settings')
    .update({ [body.field]: body.value })
    .eq('event_key', body.event_key)
    .eq('recipient_role', body.recipient_role);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
