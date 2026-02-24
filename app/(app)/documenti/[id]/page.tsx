import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DocumentSignFlow from '@/components/documents/DocumentSignFlow';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_SIGN_STATUS_LABELS } from '@/lib/types';
import type { Role, Document } from '@/lib/types';
import { getDocumentUrls } from '@/lib/documents-storage';

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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
  const canSign = profile.member_status !== 'uscente_senza_compenso';
  const { id } = await params;

  // RLS ensures only authorized users can read this document
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*, collaborators(nome, cognome)')
    .eq('id', id)
    .single();

  if (error || !doc) notFound();

  // Generate signed URLs
  const { originalUrl, firmatoUrl } = await getDocumentUrls(
    doc.file_original_url,
    doc.file_firmato_url,
  );

  const collab = doc.collaborators as { nome: string; cognome: string } | null;

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/documenti" className="text-sm text-gray-500 hover:text-gray-300 transition">
          ← Documenti
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-semibold text-gray-100">Dettaglio documento</h1>
      </div>

      <div className="space-y-6">
        {/* Info card */}
        <div className="rounded-xl bg-gray-900 border border-gray-800 px-4 py-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-medium text-gray-100">{doc.titolo}</p>
              {isAdmin && collab && (
                <p className="text-sm text-gray-500 mt-0.5">{collab.nome} {collab.cognome}</p>
              )}
            </div>
            <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              doc.stato_firma === 'DA_FIRMARE'
                ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40'
                : doc.stato_firma === 'FIRMATO'
                ? 'bg-green-900/40 text-green-300 border-green-700/40'
                : 'bg-gray-800 text-gray-400 border-gray-700'
            }`}>
              {DOCUMENT_SIGN_STATUS_LABELS[doc.stato_firma as keyof typeof DOCUMENT_SIGN_STATUS_LABELS]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-gray-800 pt-3">
            <div>
              <span className="text-xs text-gray-500">Tipo</span>
              <p className="text-gray-300 mt-0.5">
                {DOCUMENT_TYPE_LABELS[doc.tipo as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.tipo}
              </p>
            </div>
            {doc.anno && (
              <div>
                <span className="text-xs text-gray-500">Anno</span>
                <p className="text-gray-300 mt-0.5">{doc.anno}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-gray-500">Richiesto il</span>
              <p className="text-gray-300 mt-0.5">
                {new Date(doc.requested_at).toLocaleDateString('it-IT')}
              </p>
            </div>
            {doc.signed_at && (
              <div>
                <span className="text-xs text-gray-500">Firmato il</span>
                <p className="text-gray-300 mt-0.5">
                  {new Date(doc.signed_at).toLocaleDateString('it-IT')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sign flow — for collaboratore with DA_FIRMARE, or read-only for others */}
        <DocumentSignFlow
          document={doc as Document}
          originalUrl={originalUrl}
          firmatoUrl={firmatoUrl}
          canSign={canSign}
        />
      </div>
    </div>
  );
}
