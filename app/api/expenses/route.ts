import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { EXPENSE_CATEGORIES, ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/types';

const createSchema = z.object({
  categoria: z.enum(EXPENSE_CATEGORIES),
  data_spesa: z.string().min(1, 'Data spesa obbligatoria'),
  importo: z.number().positive('Importo deve essere positivo'),
  descrizione: z.string().min(1, 'Descrizione obbligatoria'),
});

export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const statoFilter = searchParams.get('stato');

  let query = supabase
    .from('expense_reimbursements')
    .select('*')
    .order('created_at', { ascending: false });

  if (statoFilter) {
    const stati = statoFilter.split(',').map((s) => s.trim());
    query = query.in('stato', stati);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expenses: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active, member_status')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) return NextResponse.json({ error: 'Utente non attivo' }, { status: 403 });
  if (profile.role !== 'collaboratore') return NextResponse.json({ error: 'Solo i collaboratori possono creare rimborsi' }, { status: 403 });
  if (profile.member_status === 'uscente_senza_compenso') return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });

  const { data: col } = await supabase
    .from('collaborators')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!col) return NextResponse.json({ error: 'Collaboratore non trovato' }, { status: 403 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', issues: parsed.error.issues }, { status: 400 });
  }

  const { data: reimbursement, error } = await supabase
    .from('expense_reimbursements')
    .insert({
      collaborator_id: col.id,
      ...parsed.data,
      stato: 'INVIATO',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert initial history entry
  await supabase.from('expense_history').insert({
    reimbursement_id: reimbursement.id,
    stato_precedente: null,
    stato_nuovo: 'INVIATO',
    changed_by: user.id,
    role_label: ROLE_LABELS[profile.role as Role],
    note: null,
  });

  return NextResponse.json({ reimbursement }, { status: 201 });
}
