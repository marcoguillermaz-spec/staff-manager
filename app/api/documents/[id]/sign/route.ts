import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(
  request: Request,
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
  if (!['collaboratore', 'responsabile'].includes(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato a caricare il documento firmato' }, { status: 403 });
  }

  const { id } = await params;

  // Verify document exists, belongs to caller, and is DA_FIRMARE (RLS enforced)
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('id, stato_firma, collaborator_id')
    .eq('id', id)
    .single();

  if (fetchError || !doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });
  if (doc.stato_firma !== 'DA_FIRMARE') {
    return NextResponse.json({ error: 'Il documento non è in stato DA_FIRMARE' }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const confirmed = formData.get('confirmed') as string | null;

  if (!file) return NextResponse.json({ error: 'File mancante' }, { status: 400 });
  if (confirmed !== 'true') {
    return NextResponse.json({ error: 'Conferma firma mancante' }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Upload signed file to storage (service role bypasses storage policies)
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `${user.id}/${id}/firmato_${file.name}`;

  const { error: uploadErr } = await serviceClient.storage
    .from('documents')
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/pdf',
      upsert: true,
    });

  if (uploadErr) return NextResponse.json({ error: `Errore upload: ${uploadErr.message}` }, { status: 500 });

  const now = new Date().toISOString();

  const { error: updateError } = await serviceClient
    .from('documents')
    .update({
      stato_firma: 'FIRMATO',
      file_firmato_url: storagePath,
      file_firmato_name: file.name,
      signed_at: now,
    })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Notify all admins
  const { data: admins } = await serviceClient
    .from('user_profiles')
    .select('user_id')
    .in('role', ['amministrazione'])
    .eq('is_active', true);

  if (admins && admins.length > 0) {
    const { data: collab } = await serviceClient
      .from('collaborators')
      .select('nome, cognome')
      .eq('id', doc.collaborator_id)
      .single();

    const nome = collab ? `${collab.nome} ${collab.cognome}` : 'Un collaboratore';

    const notifications = admins.map((a: { user_id: string }) => ({
      user_id: a.user_id,
      tipo: 'documento_firmato',
      titolo: 'Documento firmato ricevuto',
      messaggio: `${nome} ha caricato il documento firmato.`,
      entity_type: 'document',
      entity_id: id,
    }));

    await serviceClient.from('notifications').insert(notifications);
  }

  return NextResponse.json({ stato_firma: 'FIRMATO', signed_at: now });
}
