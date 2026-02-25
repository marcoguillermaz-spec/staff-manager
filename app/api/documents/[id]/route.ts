import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getDocumentUrls } from '@/lib/documents-storage';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return NextResponse.json({ error: 'Utente non attivo' }, { status: 403 });

  const { id } = await params;

  // RLS ensures only authorized users can read this document
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*, collaborators(nome, cognome, user_id)')
    .eq('id', id)
    .single();

  if (error || !doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });

  // Generate signed URLs server-side
  const { originalUrl, firmatoUrl } = await getDocumentUrls(
    doc.file_original_url,
    doc.file_firmato_url,
  );

  return NextResponse.json({ document: doc, originalUrl, firmatoUrl });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return NextResponse.json({ error: 'Utente non attivo' }, { status: 403 });
  if (!['amministrazione'].includes(profile.role)) {
    return NextResponse.json({ error: 'Solo gli amministratori possono eliminare documenti' }, { status: 403 });
  }

  const { id } = await params;

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: doc } = await serviceClient
    .from('documents')
    .select('id, tipo, file_original_url, file_firmato_url')
    .eq('id', id)
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });
  if (!doc.tipo.startsWith('CONTRATTO_')) {
    return NextResponse.json({ error: 'Solo i documenti di tipo CONTRATTO possono essere eliminati' }, { status: 400 });
  }

  // Hard-delete storage files
  const filesToDelete: string[] = [doc.file_original_url];
  if (doc.file_firmato_url) filesToDelete.push(doc.file_firmato_url);
  await serviceClient.storage.from('documents').remove(filesToDelete);

  // Hard-delete record
  const { error: deleteErr } = await serviceClient
    .from('documents')
    .delete()
    .eq('id', id);

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
