import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AnnouncementBoard from '@/components/contenuti/AnnouncementBoard';
import BenefitList from '@/components/contenuti/BenefitList';
import ResourceList from '@/components/contenuti/ResourceList';
import EventList from '@/components/contenuti/EventList';
import type { Role, Announcement, Benefit, Resource, ContentEvent, Community } from '@/lib/types';

type Tab = 'bacheca' | 'agevolazioni' | 'guide' | 'eventi';

const WRITE_ROLES_ANNOUNCEMENTS: Role[] = ['amministrazione', 'responsabile'];
const WRITE_ROLES_CONTENT: Role[] = ['amministrazione'];

export default async function ContenutiPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active, member_status, can_publish_announcements')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_active) redirect('/pending');

  const role = profile.role as Role;
  if (role === 'collaboratore' && profile.member_status === 'uscente_senza_compenso') redirect('/documenti');

  const { tab } = await searchParams;
  const activeTab: Tab = tab === 'agevolazioni' ? 'agevolazioni'
    : tab === 'guide' ? 'guide'
    : tab === 'eventi' ? 'eventi'
    : 'bacheca';

  // Always fetch communities (needed by forms)
  const { data: communities } = await supabase
    .from('communities')
    .select('id, name')
    .order('name', { ascending: true });

  const comms: Community[] = (communities ?? []) as Community[];

  // Fetch data for active tab only
  const announcements: Announcement[] = activeTab === 'bacheca'
    ? ((await supabase
        .from('announcements')
        .select('*')
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .then((r) => r.data ?? [])) as Announcement[])
    : [];

  const benefits: Benefit[] = activeTab === 'agevolazioni'
    ? ((await supabase
        .from('benefits')
        .select('*')
        .order('created_at', { ascending: false })
        .then((r) => r.data ?? [])) as Benefit[])
    : [];

  const resources: Resource[] = activeTab === 'guide'
    ? ((await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false })
        .then((r) => r.data ?? [])) as Resource[])
    : [];

  const events: ContentEvent[] = activeTab === 'eventi'
    ? ((await supabase
        .from('events')
        .select('*')
        .order('start_datetime', { ascending: true, nullsFirst: false })
        .then((r) => r.data ?? [])) as ContentEvent[])
    : [];

  const canWriteAnnouncements = WRITE_ROLES_ANNOUNCEMENTS.includes(role)
    && (role !== 'responsabile' || profile.can_publish_announcements === true);
  const canWriteContent = WRITE_ROLES_CONTENT.includes(role);

  const tabCls = (t: Tab) =>
    `whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
      activeTab === t
        ? 'bg-blue-600 text-white'
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Contenuti</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Bacheca annunci, agevolazioni, guide e risorse, eventi della community.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        <Link href="?tab=bacheca" className={tabCls('bacheca')}>📌 Bacheca</Link>
        <Link href="?tab=agevolazioni" className={tabCls('agevolazioni')}>🎁 Agevolazioni</Link>
        <Link href="?tab=guide" className={tabCls('guide')}>📚 Guide & risorse</Link>
        <Link href="?tab=eventi" className={tabCls('eventi')}>🗓 Eventi</Link>
      </div>

      {activeTab === 'bacheca' && (
        <AnnouncementBoard
          announcements={announcements}
          canWrite={canWriteAnnouncements}
          communities={comms}
        />
      )}
      {activeTab === 'agevolazioni' && (
        <BenefitList
          benefits={benefits}
          canWrite={canWriteContent}
          communities={comms}
        />
      )}
      {activeTab === 'guide' && (
        <ResourceList
          resources={resources}
          canWrite={canWriteContent}
          communities={comms}
        />
      )}
      {activeTab === 'eventi' && (
        <EventList
          events={events}
          canWrite={canWriteContent}
          communities={comms}
        />
      )}
    </div>
  );
}
