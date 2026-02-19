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

  const { data: compensation, error } = await supabase
    .from('compensations')
    .select('*, communities(name)')
    .eq('id', id)
    .single();

  if (error || !compensation) {
    return NextResponse.json({ error: 'Compenso non trovato' }, { status: 404 });
  }

  const { data: attachments } = await supabase
    .from('compensation_attachments')
    .select('*')
    .eq('compensation_id', id)
    .order('created_at', { ascending: true });

  const { data: history } = await supabase
    .from('compensation_history')
    .select('*')
    .eq('compensation_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    compensation,
    attachments: attachments ?? [],
    history: history ?? [],
  });
}
