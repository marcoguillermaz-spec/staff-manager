import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { uploadBuffer } from '@/lib/documents-storage';

interface CsvRow {
  nome_file: string;
  nome: string;
  cognome: string;
}

interface BatchResult {
  success: string[];
  duplicates: string[];
  errors: string[];
}

function parseCSV(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  // Skip header row
  return lines.slice(1).map((line) => {
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
    return {
      nome_file: parts[0] ?? '',
      nome: parts[1] ?? '',
      cognome: parts[2] ?? '',
    };
  }).filter((r) => r.nome_file && r.nome && r.cognome);
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
  if (!['amministrazione'].includes(profile.role)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 });
  }

  const formData = await request.formData();
  const zipFile = formData.get('zip') as File | null;
  const csvFile = formData.get('csv') as File | null;
  const annoRaw = formData.get('anno') as string | null;

  if (!zipFile || !csvFile || !annoRaw) {
    return NextResponse.json({ error: 'Campi obbligatori: zip, csv, anno' }, { status: 400 });
  }

  const anno = parseInt(annoRaw, 10);
  if (isNaN(anno) || anno < 2000 || anno > 2100) {
    return NextResponse.json({ error: 'Anno non valido' }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Parse CSV
  const csvText = await csvFile.text();
  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV vuoto o formato non valido' }, { status: 400 });
  }

  // Load ZIP
  const zipBuffer = await zipFile.arrayBuffer();
  const zip = await JSZip.loadAsync(zipBuffer);

  const result: BatchResult = { success: [], duplicates: [], errors: [] };

  for (const row of rows) {
    const { nome_file, nome, cognome } = row;

    // Find PDF in ZIP (case-insensitive)
    const zipEntry = Object.values(zip.files).find(
      (f) => !f.dir && f.name.toLowerCase() === nome_file.toLowerCase(),
    );

    if (!zipEntry) {
      result.errors.push(`${nome_file}: file non trovato nel ZIP`);
      continue;
    }

    // Match collaborator (case-insensitive on nome + cognome)
    const { data: collabs } = await serviceClient
      .from('collaborators')
      .select('id, user_id')
      .ilike('nome', nome)
      .ilike('cognome', cognome);

    if (!collabs || collabs.length === 0) {
      result.errors.push(`${nome_file}: collaboratore "${nome} ${cognome}" non trovato`);
      continue;
    }
    if (collabs.length > 1) {
      result.errors.push(`${nome_file}: più collaboratori corrispondono a "${nome} ${cognome}" — dedup manuale necessario`);
      continue;
    }

    const collab = collabs[0];

    // Check duplicate: same collaborator + anno + tipo CU
    const { data: existing } = await serviceClient
      .from('documents')
      .select('id')
      .eq('collaborator_id', collab.id)
      .eq('tipo', 'CU')
      .eq('anno', anno)
      .limit(1)
      .single();

    if (existing) {
      result.duplicates.push(`${nome_file}: CU ${anno} per ${nome} ${cognome} già presente (id: ${existing.id})`);
      continue;
    }

    // Extract PDF content
    const pdfBuffer = await zipEntry.async('uint8array');

    // Create a placeholder document record to get the ID for the storage path
    const { data: docPlaceholder, error: insertErr } = await serviceClient
      .from('documents')
      .insert({
        collaborator_id: collab.id,
        tipo: 'CU',
        anno,
        titolo: `CU ${anno} — ${nome} ${cognome}`,
        stato_firma: 'NON_RICHIESTO',
        file_original_url: 'pending',
        file_original_name: nome_file,
        requested_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr || !docPlaceholder) {
      result.errors.push(`${nome_file}: errore creazione record — ${insertErr?.message}`);
      continue;
    }

    // Upload PDF to Supabase Storage
    const storagePath = `${collab.user_id}/${docPlaceholder.id}/${nome_file}`;
    const { error: uploadErr } = await uploadBuffer(storagePath, pdfBuffer);

    if (uploadErr) {
      // Rollback document record
      await serviceClient.from('documents').delete().eq('id', docPlaceholder.id);
      result.errors.push(`${nome_file}: errore upload storage — ${uploadErr}`);
      continue;
    }

    // Update storage path in document record
    await serviceClient
      .from('documents')
      .update({ file_original_url: storagePath })
      .eq('id', docPlaceholder.id);

    // Notify collaboratore
    await serviceClient.from('notifications').insert({
      user_id: collab.user_id,
      tipo: 'cu_disponibile',
      titolo: `CU ${anno} disponibile`,
      messaggio: `La tua Certificazione Unica ${anno} è disponibile nella sezione Documenti.`,
      entity_type: 'document',
      entity_id: docPlaceholder.id,
    });

    result.success.push(`${nome_file}: ${nome} ${cognome} — caricato (id: ${docPlaceholder.id})`);
  }

  return NextResponse.json({
    processed: rows.length,
    success: result.success.length,
    duplicates: result.duplicates.length,
    errors: result.errors.length,
    detail: result,
  });
}
