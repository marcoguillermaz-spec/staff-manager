import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getNotificationSettings } from '@/lib/notification-helpers';
import { sendEmail } from '@/lib/email';
import { emailDocumentoDaFirmare } from '@/lib/email-templates';

export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return NextResponse.json({ error: 'Utente non attivo' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const tipoFilter = searchParams.get('tipo');
  const statoFilter = searchParams.get('stato_firma');
  const collaboratorFilter = searchParams.get('collaborator_id');

  let query = supabase
    .from('documents')
    .select('*, collaborators(nome, cognome)')
    .order('created_at', { ascending: false });

  if (tipoFilter) query = query.eq('tipo', tipoFilter);
  if (statoFilter) query = query.eq('stato_firma', statoFilter);
  if (collaboratorFilter && ['amministrazione', 'super_admin'].includes(profile.role)) {
    query = query.eq('collaborator_id', collaboratorFilter);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ documents: data ?? [] });
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
  if (!['amministrazione', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const collaborator_id = formData.get('collaborator_id') as string | null;
  const tipo = formData.get('tipo') as string | null;
  const titolo = formData.get('titolo') as string | null;
  const stato_firma = (formData.get('stato_firma') as string | null) ?? 'DA_FIRMARE';
  const annoStr = formData.get('anno') as string | null;
  const anno = annoStr ? parseInt(annoStr, 10) : null;

  if (!file || !collaborator_id || !tipo || !titolo?.trim()) {
    return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 });
  }

  const validTipi = ['CONTRATTO_OCCASIONALE', 'RICEVUTA_PAGAMENTO', 'CU'];
  const validStati = ['DA_FIRMARE', 'FIRMATO', 'NON_RICHIESTO'];
  if (!validTipi.includes(tipo)) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 });
  if (!validStati.includes(stato_firma)) return NextResponse.json({ error: 'Stato firma non valido' }, { status: 400 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get collaborator user_id for storage path
  const { data: collab } = await serviceClient
    .from('collaborators')
    .select('user_id, nome, cognome')
    .eq('id', collaborator_id)
    .single();

  if (!collab) return NextResponse.json({ error: 'Collaboratore non trovato' }, { status: 404 });

  // Upload file to storage (service role bypasses storage policies)
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const docId = crypto.randomUUID();
  const storagePath = `${collab.user_id ?? 'admin'}/${docId}/${file.name}`;

  const { error: uploadErr } = await serviceClient.storage
    .from('documents')
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    });

  if (uploadErr) return NextResponse.json({ error: `Errore upload: ${uploadErr.message}` }, { status: 500 });

  // Insert document record
  const { data: doc, error } = await serviceClient
    .from('documents')
    .insert({
      id: docId,
      collaborator_id,
      tipo,
      anno: anno && !isNaN(anno) ? anno : null,
      titolo: titolo.trim(),
      stato_firma,
      file_original_url: storagePath,
      file_original_name: file.name,
      community_id: null,
      requested_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify collaboratore if DA_FIRMARE (in-app + optional email)
  if (stato_firma === 'DA_FIRMARE' && collab.user_id) {
    const settings = await getNotificationSettings(serviceClient);
    const setting = settings.get('documento_da_firmare:collaboratore');

    if (!setting || setting.inapp_enabled) {
      await serviceClient.from('notifications').insert({
        user_id: collab.user_id,
        tipo: 'documento_da_firmare',
        titolo: 'Nuovo documento da firmare',
        messaggio: `È disponibile un documento da firmare: ${titolo.trim()}`,
        entity_type: 'document',
        entity_id: doc.id,
      });
    }

    if (setting?.email_enabled) {
      const { data: authUser } = await serviceClient.auth.admin.getUserById(collab.user_id);
      const email = authUser?.user?.email;
      if (email) {
        const { subject, html } = emailDocumentoDaFirmare({
          nome: collab.nome ?? '',
          titoloDocumento: titolo.trim(),
          data: new Date().toLocaleDateString('it-IT'),
        });
        sendEmail(email, subject, html).catch(() => {});
      }
    }
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}
