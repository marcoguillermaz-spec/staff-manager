import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DocumentList from '@/components/documents/DocumentList';
import DocumentUploadForm from '@/components/documents/DocumentUploadForm';
import CUBatchUpload from '@/components/documents/CUBatchUpload';
import type { Role } from '@/lib/types';

export default async function DocumentiPage({
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

  const role = profile.role as Role;
  const isAdmin = ['amministrazione', 'super_admin'].includes(role);

  const { tab: rawTab } = await searchParams;
  const tab = isAdmin
    ? (rawTab === 'carica' ? 'carica' : rawTab === 'cu-batch' ? 'cu-batch' : 'lista')
    : 'lista';

  // Fetch documents (RLS filters by role automatically)
  const { data: documents } = await supabase
    .from('documents')
    .select('*, collaborators(nome, cognome)')
    .order('created_at', { ascending: false });

  // Fetch collaborators list for admin upload form
  const collaborators = isAdmin
    ? await supabase
        .from('collaborators')
        .select('id, nome, cognome, user_id')
        .order('cognome', { ascending: true })
        .then((r) => r.data ?? [])
    : [];

  const tabCls = (t: string) =>
    `whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
      tab === t
        ? 'bg-blue-600 text-white'
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Documenti</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isAdmin
            ? 'Gestione documenti collaboratori, upload CU batch e contratti.'
            : 'I tuoi documenti. Scarica, firma e ricarica i documenti richiesti.'}
        </p>
      </div>

      {isAdmin && (
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <Link href="?tab=lista" className={tabCls('lista')}>Lista documenti</Link>
          <Link href="?tab=carica" className={tabCls('carica')}>Carica documento</Link>
          <Link href="?tab=cu-batch" className={tabCls('cu-batch')}>Import CU batch</Link>
        </div>
      )}

      {tab === 'lista' && (
        <DocumentList documents={documents ?? []} isAdmin={isAdmin} />
      )}
      {isAdmin && tab === 'carica' && (
        <DocumentUploadForm collaborators={collaborators} />
      )}
      {isAdmin && tab === 'cu-batch' && (
        <CUBatchUpload />
      )}
    </div>
  );
}
