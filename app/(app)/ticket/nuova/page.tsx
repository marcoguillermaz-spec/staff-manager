import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import TicketForm from '@/components/ticket/TicketForm';

export default async function NuovoTicketPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) redirect('/pending');

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/ticket" className="text-sm text-gray-500 hover:text-gray-300 transition">
          ← Ticket
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-semibold text-gray-100">Nuovo ticket</h1>
      </div>

      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
        <TicketForm />
      </div>
    </div>
  );
}
