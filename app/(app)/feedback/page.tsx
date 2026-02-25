import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

interface FeedbackRow {
  id:              string;
  user_id:         string;
  role:            string;
  categoria:       string;
  pagina:          string;
  messaggio:       string;
  screenshot_path: string | null;
  created_at:      string;
  screenshot_url?: string | null;
}

const CATEGORIA_COLORS: Record<string, string> = {
  Bug:          'text-red-400 bg-red-900/20 border-red-800/30',
  Suggerimento: 'text-blue-400 bg-blue-900/20 border-blue-800/30',
  Domanda:      'text-yellow-400 bg-yellow-900/20 border-yellow-800/30',
  Altro:        'text-gray-400 bg-gray-800/40 border-gray-700/30',
};

const ROLE_LABELS: Record<string, string> = {
  collaboratore:  'Collaboratore',
  responsabile:   'Responsabile',
  amministrazione: 'Admin',
};

export default async function FeedbackPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!profile || profile.role !== 'amministrazione') redirect('/');

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: rows } = await svc
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false });

  const feedback: FeedbackRow[] = await Promise.all(
    (rows ?? []).map(async (r: FeedbackRow) => {
      if (!r.screenshot_path) return r;
      const { data: signedData } = await svc.storage
        .from('feedback')
        .createSignedUrl(r.screenshot_path, 3600);
      return { ...r, screenshot_url: signedData?.signedUrl ?? null };
    }),
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Feedback ricevuti</h1>
        <p className="text-sm text-gray-500 mt-0.5">{feedback.length} segnalazioni totali</p>
      </div>

      {feedback.length === 0 ? (
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-12 text-center text-gray-500 text-sm">
          Nessun feedback ricevuto.
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-gray-900 border border-gray-800 p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      CATEGORIA_COLORS[item.categoria] ?? CATEGORIA_COLORS.Altro
                    }`}
                  >
                    {item.categoria}
                  </span>
                  <span className="text-xs text-gray-500">
                    {ROLE_LABELS[item.role] ?? item.role}
                  </span>
                  {item.pagina && (
                    <span className="text-xs text-gray-600 font-mono">{item.pagina}</span>
                  )}
                </div>
                <span className="text-xs text-gray-600 shrink-0">
                  {new Date(item.created_at).toLocaleString('it-IT', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>

              <p className="text-sm text-gray-300 whitespace-pre-wrap">{item.messaggio}</p>

              {item.screenshot_url && (
                <a
                  href={item.screenshot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  🖼 Visualizza screenshot
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
