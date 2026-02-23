'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Notification } from '@/lib/types';

function entityHref(n: Notification): string | null {
  if (!n.entity_type || !n.entity_id) return null;
  if (n.entity_type === 'compensation') return `/compensi/${n.entity_id}`;
  if (n.entity_type === 'reimbursement') return `/rimborsi/${n.entity_id}`;
  if (n.entity_type === 'document') return `/documenti/${n.entity_id}`;
  return null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications');
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnread(data.unread ?? 0);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    // Mark all as read when opening the dropdown
    if (next && unread > 0) {
      await fetch('/api/notifications', { method: 'PATCH' });
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg
                   text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition"
        aria-label="Notifiche"
      >
        <span className="text-base leading-none">🔔</span>
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
          <div className="px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-gray-200">Notifiche</span>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Nessuna notifica</p>
            ) : (
              notifications.map((n) => {
                const href = entityHref(n);
                const inner = (
                  <div
                    className={`px-4 py-3 border-b border-gray-800 last:border-0
                                hover:bg-gray-800/50 transition cursor-pointer
                                ${!n.read ? 'bg-gray-800/30' : ''}`}
                  >
                    {!n.read && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 mb-0.5 align-middle" />
                    )}
                    <span className="text-xs font-medium text-gray-200 leading-snug">{n.titolo}</span>
                    {n.messaggio && (
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">{n.messaggio}</p>
                    )}
                    <p className="text-[10px] text-gray-600 mt-1">{formatDate(n.created_at)}</p>
                  </div>
                );

                return href ? (
                  <Link key={n.id} href={href} onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
