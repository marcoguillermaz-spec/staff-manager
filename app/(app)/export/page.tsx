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
  if (!['amministrazione', 'super_admin'].includes(profile.role)) redirect('/');

  const { tab: rawTab } = await searchParams;
  const tab: ExportTab =
    rawTab === 'piva' ? 'piva' :
    rawTab === 'rimborsi' ? 'rimborsi' :
    'occasionali';

  let items: ExportItem[] = [];

  if (tab === 'rimborsi') {
    const { data } = await supabase
      .from('expense_reimbursements')
      .select('id, importo, categoria, data_spesa, collaborators(nome, cognome, codice_fiscale, iban, partita_iva)')
      .eq('stato', 'APPROVATO_ADMIN')
      .order('created_at', { ascending: true });

    items = (data ?? []).map((row) => {
      const col = Array.isArray(row.collaborators) ? row.collaborators[0] : row.collaborators;
      return {
        id: row.id,
        nome: col?.nome ?? '',
        cognome: col?.cognome ?? '',
        codice_fiscale: col?.codice_fiscale ?? null,
        iban: col?.iban ?? null,
        partita_iva: col?.partita_iva ?? null,
        community_name: null,
        periodo_riferimento: null,
        categoria: row.categoria,
        data_spesa: row.data_spesa,
        importo: row.importo,
      };
    });
  } else {
    const tipo = tab === 'piva' ? 'PIVA' : 'OCCASIONALE';
    const { data } = await supabase
      .from('compensations')
      .select('id, tipo, importo_netto, totale_fattura, periodo_riferimento, collaborators(nome, cognome, codice_fiscale, iban, partita_iva), communities(name)')
      .eq('stato', 'APPROVATO_ADMIN')
      .eq('tipo', tipo)
      .order('created_at', { ascending: true });

    items = (data ?? []).map((row) => {
      const col = Array.isArray(row.collaborators) ? row.collaborators[0] : row.collaborators;
      const com = Array.isArray(row.communities) ? row.communities[0] : row.communities;
      const importo = tipo === 'OCCASIONALE'
        ? (row.importo_netto ?? 0)
        : (row.totale_fattura ?? 0);
      return {
        id: row.id,
        nome: col?.nome ?? '',
        cognome: col?.cognome ?? '',
        codice_fiscale: col?.codice_fiscale ?? null,
        iban: col?.iban ?? null,
        partita_iva: col?.partita_iva ?? null,
        community_name: com?.name ?? null,
        periodo_riferimento: row.periodo_riferimento ?? null,
        categoria: null,
        data_spesa: null,
        importo,
      };
    });
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Export</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Compensi e rimborsi approvati in attesa di pagamento. Esporta in CSV/XLSX o segna come pagati.
        </p>
      </div>

      <ExportSection tab={tab} items={items} />
    </div>
  );
}
