import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ExportSection from '@/components/export/ExportSection';
import type { ExportItem, ExportTab } from '@/lib/export-utils';

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
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
  if (!['amministrazione'].includes(profile.role)) redirect('/');

  const { tab: rawTab } = await searchParams;
  const tab: ExportTab =
    rawTab === 'rimborsi' ? 'rimborsi' : 'occasionali';

  let items: ExportItem[] = [];

  if (tab === 'rimborsi') {
    const { data } = await supabase
      .from('expense_reimbursements')
      .select('id, importo, categoria, data_spesa, collaborators(nome, cognome, codice_fiscale, iban)')
      .eq('stato', 'APPROVATO')
      .order('created_at', { ascending: true });

    items = (data ?? []).map((row) => {
      const col = Array.isArray(row.collaborators) ? row.collaborators[0] : row.collaborators;
      return {
        id: row.id,
        nome: col?.nome ?? '',
        cognome: col?.cognome ?? '',
        codice_fiscale: col?.codice_fiscale ?? null,
        iban: col?.iban ?? null,
        partita_iva: null,
        community_name: null,
        periodo_riferimento: null,
        categoria: row.categoria,
        data_spesa: row.data_spesa,
        importo: row.importo,
      };
    });
  } else {
    const { data } = await supabase
      .from('compensations')
      .select('id, importo_netto, periodo_riferimento, collaborators(nome, cognome, codice_fiscale, iban), communities(name)')
      .eq('stato', 'APPROVATO')
      .order('created_at', { ascending: true });

    items = (data ?? []).map((row) => {
      const col = Array.isArray(row.collaborators) ? row.collaborators[0] : row.collaborators;
      const com = Array.isArray(row.communities) ? row.communities[0] : row.communities;
      return {
        id: row.id,
        nome: col?.nome ?? '',
        cognome: col?.cognome ?? '',
        codice_fiscale: col?.codice_fiscale ?? null,
        iban: col?.iban ?? null,
        partita_iva: null,
        community_name: com?.name ?? null,
        periodo_riferimento: row.periodo_riferimento ?? null,
        categoria: null,
        data_spesa: null,
        importo: row.importo_netto ?? 0,
      };
    });
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Export</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Compensi e rimborsi approvati in attesa di liquidazione. Esporta in CSV/XLSX o segna come liquidati.
        </p>
      </div>

      <ExportSection tab={tab} items={items} />
    </div>
  );
}
