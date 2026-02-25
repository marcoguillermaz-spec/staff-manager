'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

const CATEGORIE = ['Bug', 'Suggerimento', 'Domanda', 'Altro'] as const;
type Categoria = typeof CATEGORIE[number];

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 ' +
  'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50';

export default function FeedbackButton() {
  const pathname = usePathname();

  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [categoria, setCategoria] = useState<Categoria>('Bug');
  const [pagina, setPagina]     = useState(pathname);
  const [messaggio, setMessaggio] = useState('');
  const [file, setFile]         = useState<File | null>(null);

  const openModal = () => {
    setPagina(pathname);
    setSuccess(false);
    setError(null);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setCategoria('Bug');
    setMessaggio('');
    setFile(null);
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append('categoria', categoria);
    fd.append('pagina', pagina);
    fd.append('messaggio', messaggio);
    if (file) fd.append('screenshot', file);

    const res = await fetch('/api/feedback', { method: 'POST', body: fd });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Errore durante l\'invio');
      return;
    }

    setSuccess(true);
    setTimeout(() => closeModal(), 2000);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={openModal}
        aria-label="Invia feedback"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition"
      >
        <span>💬</span>
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6 shadow-2xl">

            {success ? (
              <div className="py-8 text-center space-y-3">
                <div className="text-4xl">✅</div>
                <p className="font-medium text-gray-100">Grazie per il feedback!</p>
                <p className="text-sm text-gray-500">Il messaggio è stato inviato.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-100">Invia feedback</h3>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-gray-500 hover:text-gray-300 transition text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>

                {/* Categoria */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Categoria</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as Categoria)}
                    disabled={loading}
                    className={inputCls}
                  >
                    {CATEGORIE.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Pagina */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Pagina</label>
                  <input
                    type="text"
                    value={pagina}
                    onChange={(e) => setPagina(e.target.value)}
                    disabled={loading}
                    placeholder="/compensi"
                    className={inputCls}
                  />
                </div>

                {/* Messaggio */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    Messaggio <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={messaggio}
                    onChange={(e) => setMessaggio(e.target.value)}
                    disabled={loading}
                    rows={4}
                    required
                    placeholder="Descrivi il problema o il suggerimento…"
                    className={inputCls}
                  />
                </div>

                {/* Screenshot */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    Screenshot <span className="text-gray-600">(opzionale, max 5 MB)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={loading}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-700 file:px-3 file:py-1.5 file:text-xs file:text-gray-200 file:cursor-pointer hover:file:bg-gray-600 transition"
                  />
                  {file && (
                    <p className="text-xs text-gray-500 mt-1">
                      {file.name} ({(file.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                </div>

                {error && (
                  <div className="rounded-lg bg-red-900/30 border border-red-800/40 px-3 py-2 text-xs text-red-400">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={loading}
                    className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition disabled:opacity-50"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !messaggio.trim()}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
                  >
                    {loading ? 'Invio…' : 'Invia'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
