import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { CONTRACT_TEMPLATE_LABELS, type ContractTemplateType } from '@/lib/types';

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single();

  if (profile?.onboarding_completed) redirect('/');

  // Fetch collaborators record for pre-fill data (service role to bypass RLS edge cases)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: collab } = await admin
    .from('collaborators')
    .select('nome, cognome, username, codice_fiscale, data_nascita, luogo_nascita, provincia_nascita, comune, provincia_residenza, indirizzo, civico_residenza, telefono, iban, tshirt_size, sono_un_figlio_a_carico, tipo_contratto')
    .eq('user_id', user.id)
    .maybeSingle();

  const tipoContratto = (collab?.tipo_contratto ?? null) as ContractTemplateType | null;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Benvenuto</h1>
          <p className="text-sm text-gray-400">Completa il tuo profilo per accedere alla piattaforma</p>
        </div>
        <OnboardingWizard
          prefill={collab ?? null}
          tipoContratto={tipoContratto}
          tipoLabel={tipoContratto ? CONTRACT_TEMPLATE_LABELS[tipoContratto] : null}
        />
      </div>
    </div>
  );
}
