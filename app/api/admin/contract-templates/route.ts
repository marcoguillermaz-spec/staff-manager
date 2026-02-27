import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function getCallerRole(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null };
  const { data } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();
  return { user, role: data?.is_active ? data.role : null };
}

// GET /api/admin/contract-templates — list all templates
export async function GET() {
  const cookieStore = await cookies();
  const { role } = await getCallerRole(cookieStore);
  if (!role || !['amministrazione'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await admin
    .from('contract_templates')
    .select('id, tipo, file_name, uploaded_at')
    .order('tipo');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

// POST /api/admin/contract-templates — upload or replace a template
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const { user, role } = await getCallerRole(cookieStore);
  if (!user || !role || !['amministrazione'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const tipo = formData.get('tipo') as string;
  const file = formData.get('file') as File | null;

  if (!tipo || tipo !== 'OCCASIONALE') {
    return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: 'File mancante' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'docx') {
    return NextResponse.json({ error: 'Solo file .docx supportati' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const storagePath = `templates/${tipo.toLowerCase()}.docx`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from('contracts')
    .upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: upsertError } = await admin
    .from('contract_templates')
    .upsert(
      { tipo, file_url: storagePath, file_name: file.name, uploaded_by: user.id, uploaded_at: new Date().toISOString() },
      { onConflict: 'tipo' },
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
