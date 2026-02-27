import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const attachmentSchema = z.object({
  file_url: z.string().min(1),
  file_name: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: expense, error: fetchError } = await supabase
    .from('expense_reimbursements')
    .select('id, stato')
    .eq('id', id)
    .single();

  if (fetchError || !expense) {
    return NextResponse.json({ error: 'Rimborso non trovato' }, { status: 404 });
  }

  if (expense.stato !== 'IN_ATTESA') {
    return NextResponse.json({ error: 'Allegati consentiti solo in IN_ATTESA' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = attachmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }

  const { data: attachment, error } = await supabase
    .from('expense_attachments')
    .insert({
      reimbursement_id: id,
      file_url: parsed.data.file_url,
      file_name: parsed.data.file_name,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ attachment }, { status: 201 });
}
