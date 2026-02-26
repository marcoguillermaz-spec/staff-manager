import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AnnouncementBoard from '@/components/contenuti/AnnouncementBoard';
import ResourceList from '@/components/contenuti/ResourceList';
import type { Announcement, Resource } from '@/lib/types';

type Tab = 'comunicazioni' | 'risorse';

export default async function ComunicazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
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

  const { tab } = await searchParams;
  const activeTab: Tab = tab === 'risorse' ? 'risorse' : 'comunicazioni';

  const announcements: Announcement[] = activeTab === 'comunicazioni'
    ? ((await supabase
        .from('announcements')
        .select('*')
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .then((r) => r.data ?? [])) as Announcement[])
    : [];

  const resources: Resource[] = activeTab === 'risorse'
    ? ((await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false })
        .then((r) => r.data ?? [])) as Resource[])
    : [];

  const tabCls = (t: Tab) =>
    `whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
      activeTab === t
        ? 'bg-blue-600 text-white'
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Comunicazioni e Risorse</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Annunci della community e guide e risorse utili.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <Link href="?tab=comunicazioni" className={tabCls('comunicazioni')}>📌 Comunicazioni</Link>
        <Link href="?tab=risorse" className={tabCls('risorse')}>📚 Risorse</Link>
      </div>

      {activeTab === 'comunicazioni' && (
        <AnnouncementBoard
          announcements={announcements}
          canWrite={false}
          communities={[]}
        />
      )}

      {activeTab === 'risorse' && (
        <ResourceList
          resources={resources}
          canWrite={false}
          communities={[]}
        />
      )}
    </div>
  );
}
