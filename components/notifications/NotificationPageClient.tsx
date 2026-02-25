'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Notification } from '@/lib/types';

function entityHref(n: Notification): string | null {
  if (!n.entity_type || !n.entity_id) return null;
  if (n.entity_type === 'compensation')  return `/compensi/${n.entity_id}`;
  if (n.entity_type === 'reimbursement') return `/rimborsi/${n.entity_id}`;
  if (n.entity_type === 'document')      return `/documenti/${n.entity_id}`;
  if (n.entity_type === 'ticket')        return `/ticket/${n.entity_id}`;
  return null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const LIMIT = 20;

export default function NotificationPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const unreadOnly = searchParams.get('unread_only') === 'true';

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal]                 = useState(0);
  const [unread, setUnread]               = useState(0);
  const [loading, setLoading]             = useState(true);
  const [fetchError, setFetchError]       = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams({
        page:         String(page),
        limit:        String(LIMIT),
        unread_only:  String(unreadOnly),
      });
      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setTotal(data.total ?? 0);
      setUnread(data.unread ?? 0);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const pushParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) params.set(k, v);
    router.push(`/notifiche?${params}`);
  };

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const notif = notifications.find((n) => n.id === id);
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
    if (notif && !notif.read) setUnread((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Notifiche</h1>
          {unread > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {unread} non {unread === 1 ? 'letta' : 'lette'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => pushParams({ unread_only: String(!unreadOnly), page: '1' })}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              unreadOnly
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
            }`}
          >
            Solo non lette
          </button>
          {unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-blue-400 hover:text-blue-300 transition"
            >
              Segna tutte come lette
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        {fetchError ? (
          <p className="text-sm text-red-400 text-center py-12">
            Errore nel caricamento delle notifiche
          </p>
        ) : loading ? (
          <p className="text-sm text-gray-500 text-center py-12">Caricamento…</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12">
            {unreadOnly ? 'Nessuna notifica non letta' : 'Nessuna notifica'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {notifications.map((n) => {
              const href = entityHref(n);
              const inner = (
                <li
                  className={`group flex items-start gap-3 px-4 py-3.5
                              hover:bg-gray-800/50 transition
                              ${!n.read ? 'bg-gray-800/30' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {!n.read && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-200 truncate">
                        {n.titolo}
                      </span>
                    </div>
                    {n.messaggio && (
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">{n.messaggio}</p>
                    )}
                    <p className="text-[10px] text-gray-600 mt-1">{formatDate(n.created_at)}</p>
                  </div>

                  {/* Actions (visible on hover) */}
                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition">
                    {!n.read && (
                      <button
                        onClick={(e) => { e.preventDefault(); handleMarkRead(n.id); }}
                        className="text-[10px] text-blue-400 hover:text-blue-300 whitespace-nowrap"
                      >
                        Segna letta
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDismiss(n.id, e)}
                      className="text-gray-600 hover:text-gray-300 text-base leading-none"
                      aria-label="Rimuovi notifica"
                    >
                      ×
                    </button>
                  </div>
                </li>
              );

              return href ? (
                <Link
                  key={n.id}
                  href={href}
                  className="block"
                  onClick={() => { if (!n.read) handleMarkRead(n.id); }}
                >
                  {inner}
                </Link>
              ) : (
                <div key={n.id} onClick={() => { if (!n.read) handleMarkRead(n.id); }}>
                  {inner}
                </div>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">{total} notifiche totali</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => pushParams({ page: String(page - 1) })}
              className="px-3 py-1.5 rounded text-xs text-gray-400 border border-gray-700
                         hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Precedente
            </button>
            <span className="text-xs text-gray-500">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => pushParams({ page: String(page + 1) })}
              className="px-3 py-1.5 rounded text-xs text-gray-400 border border-gray-700
                         hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Successiva →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
