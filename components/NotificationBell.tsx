'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread]               = useState(0);
  const [open, setOpen]                   = useState(false);
  const [loading, setLoading]             = useState(true);
  const [fetchError, setFetchError]       = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) { setFetchError(true); return; }
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnread(data.unread ?? 0);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
    if (notif && !notif.read) setUnread((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg
                   text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition"
        aria-label="Notifiche"
      >
        <span className={`text-base leading-none ${fetchError ? 'text-red-400' : loading ? 'opacity-50' : ''}`}>
          🔔
        </span>
        {unread > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 flex items-center justify-center
                       rounded-full bg-red-500 text-[9px] font-bold text-white px-0.5"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 mt-2 w-80 bg-gray-900 border border-gray-700
                     rounded-xl shadow-xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-200">Notifiche</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                Segna tutte come lette
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {fetchError ? (
              <p className="text-sm text-red-400 text-center py-8">Errore nel caricamento</p>
            ) : loading ? (
              <p className="text-sm text-gray-500 text-center py-8">Caricamento…</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Nessuna notifica</p>
            ) : (
              notifications.map((n) => {
                const href = entityHref(n);
                const inner = (
                  <div
                    className={`group px-4 py-3 border-b border-gray-800 last:border-0
                                hover:bg-gray-800/50 transition cursor-pointer relative
                                ${!n.read ? 'bg-gray-800/30' : ''}`}
                  >
                    {/* Dismiss button */}
                    <button
                      onClick={(e) => handleDismiss(n.id, e)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100
                                 text-gray-600 hover:text-gray-300 transition text-base leading-none"
                      aria-label="Rimuovi notifica"
                    >
                      ×
                    </button>

                    {!n.read && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 mb-0.5 align-middle" />
                    )}
                    <span className="text-xs font-medium text-gray-200 leading-snug pr-4">
                      {n.titolo}
                    </span>
                    {n.messaggio && (
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">{n.messaggio}</p>
                    )}
                    <p className="text-[10px] text-gray-600 mt-1">{formatDate(n.created_at)}</p>
                  </div>
                );

                const handleClick = () => {
                  if (!n.read) handleMarkRead(n.id);
                  setOpen(false);
                };

                return href ? (
                  <Link key={n.id} href={href} onClick={handleClick}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} onClick={() => { if (!n.read) handleMarkRead(n.id); }}>
                    {inner}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-800 flex items-center gap-2">
            {notifications.length >= 50 && (
              <span className="text-[10px] text-gray-600 flex-1">
                Potrebbero esserci notifiche più vecchie
              </span>
            )}
            <Link
              href="/notifiche"
              onClick={() => setOpen(false)}
              className="text-xs text-blue-400 hover:text-blue-300 ml-auto"
            >
              Vedi tutte →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
