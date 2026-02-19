import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: reimbursement, error } = await supabase
    .from('expense_reimbursements')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !reimbursement) {
    return NextResponse.json({ error: 'Rimborso non trovato' }, { status: 404 });
  }

  const { data: attachments } = await supabase
    .from('expense_attachments')
    .select('*')
    .eq('reimbursement_id', id)
    .order('created_at', { ascending: true });

  const { data: history } = await supabase
    .from('expense_history')
    .select('*')
    .eq('reimbursement_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    reimbursement,
    attachments: attachments ?? [],
    history: history ?? [],
  });
}
