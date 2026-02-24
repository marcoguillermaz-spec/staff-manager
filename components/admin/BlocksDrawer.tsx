'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminBlockItem } from './types';

const BLOCK_LABELS: Record<AdminBlockItem['blockType'], string> = {
  must_change_password:  'Cambio password non completato',
  onboarding_incomplete: 'Onboarding non completato',
  stalled_comp:          'Compenso in stallo',
  stalled_exp:           'Rimborso in stallo',
};

const BLOCK_ICONS: Record<AdminBlockItem['blockType'], string> = {
  must_change_password:  '🔑',
  onboarding_incomplete: '📋',
  stalled_comp:          '💼',
  stalled_exp:           '🧾',
};

const BLOCK_DESCRIPTIONS: Record<AdminBlockItem['blockType'], string> = {
  must_change_password:  'L\'utente non ha ancora cambiato la password temporanea.',
  onboarding_incomplete: 'L\'utente non ha completato il wizard di onboarding.',
  stalled_comp:          'Compenso in attesa di azione da oltre 3 giorni.',
  stalled_exp:           'Rimborso in attesa di azione da oltre 3 giorni.',
};

type Props = {
  items: AdminBlockItem[];
  open: boolean;
  onClose: () => void;
};

export default function BlocksDrawer({ items, open, onClose }: Props) {
  const [clearing, setClearing] = useState<string | null>(null);
  const [cleared, setCleared] = useState<Set<string>>(new Set());

  if (!open) return null;

  const visibleItems = items.filter(i => !cleared.has(i.key));

  async function handleClearFlag(item: AdminBlockItem) {
    setClearing(item.key);
    try {
      const res = await fetch('/api/admin/blocks/clear-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: item.userId }),
      });
      if (res.ok) {
        setCleared(prev => new Set([...prev, item.key]));
      }
    } finally {
      setClearing(null);
    }
  }

  const grouped = (
    ['must_change_password', 'onboarding_incomplete', 'stalled_comp', 'stalled_exp'] as const
  ).map(type => ({
    type,
    items: visibleItems.filter(i => i.blockType === type),
  })).filter(g => g.items.length > 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-gray-900 border-l border-gray-800 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-100">Situazioni di blocco</h2>
            <p className="text-xs text-gray-500 mt-0.5">{visibleItems.length} element{visibleItems.length === 1 ? 'o' : 'i'} da risolvere</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <span className="text-2xl mb-2">✅</span>
              <p className="text-sm text-gray-400">Nessuna situazione di blocco attiva.</p>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.type}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{BLOCK_ICONS[group.type]}</span>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {BLOCK_LABELS[group.type]} ({group.items.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {group.items.map(item => (
                    <div
                      key={item.key}
                      className="rounded-xl bg-gray-800/60 border border-gray-700/50 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-200 truncate">{item.collabName}</p>
                          <p className="text-xs text-gray-500 truncate">{item.collabEmail}</p>
                          <p className="text-xs text-gray-600 mt-1">{BLOCK_DESCRIPTIONS[item.blockType]}</p>
                          {item.daysWaiting !== undefined && (
                            <p className="text-xs text-amber-400 mt-0.5">
                              In attesa da {item.daysWaiting} giorni
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {item.blockType === 'must_change_password' && (
                            <button
                              onClick={() => handleClearFlag(item)}
                              disabled={clearing === item.key}
                              className="rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white transition"
                            >
                              {clearing === item.key ? '...' : 'Azzera flag'}
                            </button>
                          )}
                          {item.blockType === 'onboarding_incomplete' && (
                            <Link
                              href={item.href}
                              onClick={onClose}
                              className="rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-xs font-medium text-gray-200 transition inline-block"
                            >
                              Vai al profilo
                            </Link>
                          )}
                          {(item.blockType === 'stalled_comp' || item.blockType === 'stalled_exp') && (
                            <Link
                              href={item.href}
                              onClick={onClose}
                              className="rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-xs font-medium text-gray-200 transition inline-block"
                            >
                              Vai alla coda
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
