import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import CompensationDetail from '@/components/compensation/CompensationDetail';
import Timeline from '@/components/compensation/Timeline';
import ActionPanel from '@/components/compensation/ActionPanel';
import type { Role, CompensationStatus } from '@/lib/types';

export default async function CompensationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) redirect('/pending');

  const { id } = await params;

  // Fetch compensation (RLS ensures only authorized users can read it)
  const { data: compensation, error } = await supabase
    .from('compensations')
    .select('*, communities(name)')
    .eq('id', id)
    .single();

  if (error || !compensation) notFound();

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

  const role = profile.role as Role;
  const backHref = role === 'collaboratore' ? '/compensi' : role === 'responsabile_compensi' ? '/approvazioni' : '/coda';

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href={backHref} className="text-sm text-gray-500 hover:text-gray-300 transition">
          ← Indietro
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-semibold text-gray-100">Dettaglio compenso</h1>
      </div>

      <div className="space-y-6">
        <CompensationDetail
          compensation={compensation}
          attachments={attachments ?? []}
        />

        <ActionPanel
          compensationId={id}
          stato={compensation.stato as CompensationStatus}
          role={role}
        />

        {(history ?? []).length > 0 && (
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
              Cronologia
            </p>
            <Timeline events={history ?? []} />
          </div>
        )}
      </div>
    </div>
  );
}
