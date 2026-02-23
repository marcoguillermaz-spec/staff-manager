import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { CONTRACT_TEMPLATE_DOCUMENT_TYPE, type ContractTemplateType } from '@/lib/types';

const schema = z.object({
  email: z.string().email(),
  role: z.enum(['collaboratore', 'responsabile', 'amministrazione', 'super_admin']),
  community_ids: z.array(z.string().uuid()).optional(),
  // Anagrafica collaboratore
  nome:           z.string().min(1).max(100).optional(),
  cognome:        z.string().min(1).max(100).optional(),
  codice_fiscale: z.string().max(16).nullable().optional(),
  data_nascita:   z.string().nullable().optional(),   // ISO date
  luogo_nascita:  z.string().max(100).nullable().optional(),
  comune:         z.string().max(100).nullable().optional(),
  indirizzo:      z.string().max(200).nullable().optional(),
  telefono:       z.string().max(20).nullable().optional(),
  // Contract generation (optional)
  contract_tipo:           z.enum(['OCCASIONALE', 'COCOCO', 'PIVA']).optional(),
  contract_community_id:   z.string().uuid().nullable().optional(),
  contract_compenso_lordo: z.number().positive().optional(),
  contract_data_inizio:    z.string().nullable().optional(),
  contract_data_fine:      z.string().nullable().optional(),
  contract_numero_rate:    z.number().int().positive().nullable().optional(),
  contract_importo_rata:   z.number().positive().nullable().optional(),
});

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%';
  const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const chars = [
    rand(upper), rand(upper),
    rand(lower), rand(lower), rand(lower),
    rand(digits), rand(digits),
    rand(special),
    rand(upper), rand(lower),
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  try {
    return new Date(isoDate).toLocaleDateString('it-IT');
  } catch {
    return isoDate;
  }
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '';
  return new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
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

  const { data: caller } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!caller?.is_active || !['amministrazione', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }

  const {
    email, role, community_ids,
    nome, cognome, codice_fiscale, data_nascita, luogo_nascita, comune, indirizzo, telefono,
    contract_tipo, contract_community_id,
    contract_compenso_lordo, contract_data_inizio, contract_data_fine,
    contract_numero_rate, contract_importo_rata,
  } = parsed.data;

  // Validate: collaboratore requires nome + cognome
  if (role === 'collaboratore' && (!nome || !cognome)) {
    return NextResponse.json({ error: 'Nome e cognome obbligatori per il ruolo collaboratore' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const password = generatePassword();

  // 1. Create auth user
  const { data: newAuthUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !newAuthUser.user) {
    const msg = createError?.message ?? 'Errore creazione utente';
    const alreadyExists = msg.toLowerCase().includes('already');
    return NextResponse.json(
      { error: alreadyExists ? 'Email già registrata' : msg },
      { status: 400 },
    );
  }

  const userId = newAuthUser.user.id;

  // 2. Create user_profiles row
  const { error: profileError } = await admin.from('user_profiles').insert({
    user_id: userId,
    role,
    is_active: true,
    must_change_password: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'Errore creazione profilo' }, { status: 500 });
  }

  // 3. Assign communities for responsabile
  if (role === 'responsabile' && community_ids?.length) {
    await admin.from('user_community_access').insert(
      community_ids.map((cid) => ({ user_id: userId, community_id: cid })),
    );
  }

  // 4. Create collaborators record (when role=collaboratore)
  let collaboratorId: string | null = null;
  if (role === 'collaboratore' && nome && cognome) {
    const { data: collabRow, error: collabError } = await admin
      .from('collaborators')
      .insert({
        user_id:        userId,
        nome,
        cognome,
        email,
        codice_fiscale: codice_fiscale ?? null,
        data_nascita:   data_nascita ?? null,
        luogo_nascita:  luogo_nascita ?? null,
        comune:         comune ?? null,
        indirizzo:      indirizzo ?? null,
        telefono:       telefono ?? null,
      })
      .select('id')
      .single();

    if (!collabError && collabRow) {
      collaboratorId = collabRow.id;
    }
  }

  // 5. Optional: generate contract from template
  if (
    role === 'collaboratore' &&
    collaboratorId &&
    contract_tipo &&
    contract_compenso_lordo
  ) {
    const tipo = contract_tipo as ContractTemplateType;

    // Fetch template record
    const { data: tplRow } = await admin
      .from('contract_templates')
      .select('file_url, file_name')
      .eq('tipo', tipo)
      .maybeSingle();

    if (tplRow) {
      const { data: templateBlob } = await admin.storage
        .from('contracts')
        .download(tplRow.file_url);

      const templateBuffer = templateBlob
        ? Buffer.from(await templateBlob.arrayBuffer())
        : null;

      const vars: Record<string, string> = {
        nome:            nome ?? '',
        cognome:         cognome ?? '',
        codice_fiscale:  codice_fiscale ?? '',
        partita_iva:     '',  // not collected at invite; collaborator fills later
        data_nascita:    formatDate(data_nascita),
        luogo_nascita:   luogo_nascita ?? '',
        comune:          comune ?? '',
        indirizzo:       indirizzo ?? '',
        compenso_lordo:  formatCurrency(contract_compenso_lordo),
        data_inizio:     formatDate(contract_data_inizio),
        data_fine:       formatDate(contract_data_fine),
        numero_rate:     contract_numero_rate?.toString() ?? '',
        importo_rata:    formatCurrency(contract_importo_rata),
      };

      const generated = templateBuffer
        ? await generateContract(templateBuffer, vars)
        : null;
      if (generated) {
        const docId = crypto.randomUUID();
        const anno = contract_data_inizio
          ? new Date(contract_data_inizio).getFullYear()
          : new Date().getFullYear();
        const fileName = `contratto_${tipo.toLowerCase()}_${anno}.docx`;
        const storagePath = `${userId}/${docId}/${fileName}`;

        const { error: uploadErr } = await admin.storage
          .from('documents')
          .upload(storagePath, generated, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            upsert: false,
          });

        if (!uploadErr) {
          const docTipo = CONTRACT_TEMPLATE_DOCUMENT_TYPE[tipo];
          await admin.from('documents').insert({
            id:                  docId,
            collaborator_id:     collaboratorId,
            community_id:        contract_community_id ?? null,
            tipo:                docTipo,
            titolo:              `Contratto ${anno}`,
            anno,
            file_original_url:   storagePath,
            file_original_name:  fileName,
            stato_firma:         'DA_FIRMARE',
          });

          await admin.from('notifications').insert({
            user_id:     userId,
            tipo:        'documento',
            titolo:      'Contratto da firmare',
            messaggio:   'È disponibile un contratto da firmare nella tua area Documenti.',
            entity_type: 'document',
            entity_id:   docId,
          });
        }
      }
    }
  }

  return NextResponse.json({ email, password });
}
