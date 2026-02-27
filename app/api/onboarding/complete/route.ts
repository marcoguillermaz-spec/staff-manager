import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { CONTRACT_TEMPLATE_DOCUMENT_TYPE, type ContractTemplateType } from '@/lib/types';

const schema = z.object({
  nome:                z.string().min(1).max(100),
  cognome:             z.string().min(1).max(100),
  codice_fiscale:      z.string().regex(/^[A-Z0-9]{16}$/, 'Codice fiscale non valido (16 caratteri alfanumerici)'),
  data_nascita:        z.string().min(1),          // ISO date
  luogo_nascita:       z.string().min(1).max(100),
  provincia_nascita:   z.string().min(1).max(10),
  comune:              z.string().min(1).max(100),
  provincia_residenza: z.string().min(1).max(10),
  indirizzo:           z.string().min(1).max(200),
  civico_residenza:    z.string().min(1).max(20),
  telefono:            z.string().min(1).max(20),
  iban:                z.string().regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/, 'IBAN non valido'),
  tshirt_size:         z.string().min(1),
  sono_un_figlio_a_carico:   z.boolean(),
});

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  try { return new Date(isoDate).toLocaleDateString('it-IT'); } catch { return isoDate ?? ''; }
}

async function generateContract(
  templateBuffer: Buffer,
  vars: Record<string, string>,
): Promise<Buffer | null> {
  try {
    const [PizZip, { default: Docxtemplater }] = await Promise.all([
      import('pizzip').then((m) => m.default),
      import('docxtemplater'),
    ]);
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
    doc.render(vars);
    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 });
  if (profile.onboarding_completed) {
    return NextResponse.json({ error: 'Onboarding già completato' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const d = parsed.data;

  // Fetch existing collaborators record (created at invite time with tipo_contratto)
  const { data: existingCollab } = await admin
    .from('collaborators')
    .select('id, tipo_contratto')
    .eq('user_id', user.id)
    .maybeSingle();

  let collaboratorId: string;
  let tipoContratto: string | null;

  const anagraficaFields = {
    nome:                d.nome,
    cognome:             d.cognome,
    email:               user.email ?? '',
    codice_fiscale:      d.codice_fiscale.toUpperCase(),
    data_nascita:        d.data_nascita,
    luogo_nascita:       d.luogo_nascita,
    provincia_nascita:   d.provincia_nascita,
    comune:              d.comune,
    provincia_residenza: d.provincia_residenza,
    indirizzo:           d.indirizzo,
    civico_residenza:    d.civico_residenza,
    telefono:            d.telefono,
    iban:                d.iban,
    tshirt_size:               d.tshirt_size,
    sono_un_figlio_a_carico:   d.sono_un_figlio_a_carico,
  };

  if (existingCollab) {
    const { error: updateErr } = await admin
      .from('collaborators')
      .update(anagraficaFields)
      .eq('id', existingCollab.id);
    if (updateErr) return NextResponse.json({ error: 'Errore salvataggio dati' }, { status: 500 });
    collaboratorId = existingCollab.id;
    tipoContratto = existingCollab.tipo_contratto;
  } else {
    // Fallback: create record if missing (shouldn't happen with new invite flow)
    const { data: newCollab, error: insertErr } = await admin
      .from('collaborators')
      .insert({ user_id: user.id, ...anagraficaFields })
      .select('id, tipo_contratto')
      .single();
    if (insertErr || !newCollab) {
      return NextResponse.json({ error: 'Errore creazione profilo' }, { status: 500 });
    }
    collaboratorId = newCollab.id;
    tipoContratto = newCollab.tipo_contratto;
  }

  // Generate contract (best-effort — failure does not block onboarding completion)
  let documentId: string | null = null;
  let downloadUrl: string | null = null;

  if (tipoContratto) {
    const tipo = tipoContratto as ContractTemplateType;

    const { data: tplRow } = await admin
      .from('contract_templates')
      .select('file_url')
      .eq('tipo', tipo)
      .maybeSingle();

    if (tplRow) {
      const { data: templateBlob } = await admin.storage
        .from('contracts')
        .download(tplRow.file_url);

      const templateBuffer = templateBlob
        ? Buffer.from(await templateBlob.arrayBuffer())
        : null;

      if (templateBuffer) {
        const BLANK = '_______________';
        const vars: Record<string, string> = {
          nome:            d.nome,
          cognome:         d.cognome,
          codice_fiscale:  d.codice_fiscale.toUpperCase(),
          data_nascita:    formatDate(d.data_nascita),
          luogo_nascita:   d.luogo_nascita,
          comune:          d.comune,
          indirizzo:       d.indirizzo,
          email:           user.email ?? '',
          telefono:        d.telefono,
          iban:            d.iban,
          compenso_lordo:  BLANK,
          data_inizio:     BLANK,
          data_fine:       BLANK,
          numero_rate:     BLANK,
          importo_rata:    BLANK,
        };

        const generated = await generateContract(templateBuffer, vars);
        if (generated) {
          const docId = crypto.randomUUID();
          const anno = new Date().getFullYear();
          const fileName = `contratto_${tipo.toLowerCase()}_${anno}.docx`;
          const storagePath = `${user.id}/${docId}/${fileName}`;

          const { error: uploadErr } = await admin.storage
            .from('documents')
            .upload(storagePath, generated, {
              contentType:
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              upsert: false,
            });

          if (!uploadErr) {
            const docTipo = CONTRACT_TEMPLATE_DOCUMENT_TYPE[tipo];
            await admin.from('documents').insert({
              id:                 docId,
              collaborator_id:    collaboratorId,
              community_id:       null,
              tipo:               docTipo,
              titolo:             `Contratto ${anno}`,
              anno,
              file_original_url:  storagePath,
              file_original_name: fileName,
              stato_firma:        'DA_FIRMARE',
            });
            documentId = docId;

            const { data: signedData } = await admin.storage
              .from('documents')
              .createSignedUrl(storagePath, 3600);
            downloadUrl = signedData?.signedUrl ?? null;
          }
        }
      }
    }
  }

  // Mark onboarding complete
  await admin
    .from('user_profiles')
    .update({ onboarding_completed: true })
    .eq('user_id', user.id);

  return NextResponse.json({ success: true, document_id: documentId, download_url: downloadUrl });
}
