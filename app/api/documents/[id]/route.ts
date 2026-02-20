import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
