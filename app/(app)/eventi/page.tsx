import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EventList from '@/components/contenuti/EventList';
import type { ContentEvent } from '@/lib/types';

export default async function EventiPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active, member_status')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) redirect('/pending');
  if (profile.role !== 'collaboratore') redirect('/');
  if (profile.member_status === 'uscente_senza_compenso') redirect('/profilo?tab=documenti');

  const { data } = await supabase
    .from('events')
    .select('*')
    .order('start_datetime', { ascending: true, nullsFirst: false });

  const events: ContentEvent[] = (data ?? []) as ContentEvent[];

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Eventi</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Gli eventi in programma della community.
        </p>
      </div>

      <EventList events={events} canWrite={false} communities={[]} />
    </div>
  );
}
