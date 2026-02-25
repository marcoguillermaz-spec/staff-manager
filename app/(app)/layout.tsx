import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import FeedbackButton from '@/components/FeedbackButton';
import { NAV_BY_ROLE } from '@/lib/nav';
import type { Role } from '@/lib/types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active, member_status')
    .eq('user_id', user.id)
    .single();

  if (!profile || !profile.is_active) redirect('/pending');

  const { data: collaborator } = await supabase
    .from('collaborators')
    .select('nome, cognome, foto_profilo_url')
    .eq('user_id', user.id)
    .single();

  const role = profile.role as Role;
  const navItems = NAV_BY_ROLE[role];
  const userName = (collaborator?.nome && collaborator?.cognome)
    ? `${collaborator.nome} ${collaborator.cognome}`
    : user.email ?? 'Utente';

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar
        navItems={navItems}
        userEmail={user.email ?? ''}
        userName={userName}
        avatarUrl={collaborator?.foto_profilo_url ?? null}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <FeedbackButton />
    </div>
  );
}
