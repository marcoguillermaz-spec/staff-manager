import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function PendingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const handleSignOut = async () => {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-900/30 border border-yellow-800/40 mb-5">
          <span className="text-2xl">⏳</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-100 mb-2">Account in attesa di attivazione</h1>
        <p className="text-sm text-gray-400 mb-6">
          Il tuo account è stato creato ma non è ancora stato attivato.
          Contatta il tuo responsabile o l&apos;amministrazione.
        </p>
        <p className="text-xs text-gray-600 mb-6">Accesso effettuato come: {user.email}</p>
        <form action={handleSignOut}>
          <button type="submit"
            className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-400
                       hover:text-gray-200 hover:border-gray-600 transition">
            Esci
          </button>
        </form>
      </div>
    </div>
  );
}
