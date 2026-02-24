'use client';

import { useState, useCallback } from 'react';

type Setting = {
  id: string;
  event_key: string;
  recipient_role: string;
  label: string;
  inapp_enabled: boolean;
  email_enabled: boolean;
};

const SECTIONS: { title: string; keys: string[] }[] = [
  {
    title: 'Compensi',
    keys: ['comp_inviato', 'comp_integrazioni', 'comp_approvato', 'comp_rifiutato', 'comp_pagato'],
  },
  {
    title: 'Rimborsi',
    keys: ['rimborso_inviato', 'rimborso_integrazioni', 'rimborso_approvato', 'rimborso_rifiutato', 'rimborso_pagato'],
  },
  {
    title: 'Documenti',
    keys: ['documento_da_firmare'],
  },
  {
    title: 'Ticket',
    keys: ['ticket_creato', 'ticket_risposta', 'ticket_risposta_collab', 'ticket_stato'],
  },
];

const ROLE_LABELS: Record<string, string> = {
  collaboratore: 'Collaboratore',
  responsabile:  'Responsabile',
};

function Toggle({
  checked, onChange, disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent ' +
        'transition-colors focus:outline-none ' +
        (disabled ? 'opacity-40 cursor-not-allowed ' : '') +
        (checked ? 'bg-blue-600' : 'bg-gray-600')
      }
    >
      <span
        className={
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ' +
          (checked ? 'translate-x-4' : 'translate-x-0')
        }
      />
    </button>
  );
}

export default function NotificationSettingsManager({
  initialSettings,
}: {
  initialSettings: Setting[];
}) {
  const [settings, setSettings] = useState<Setting[]>(initialSettings);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = useCallback(async (
    setting: Setting,
    field: 'inapp_enabled' | 'email_enabled',
    value: boolean,
  ) => {
    const key = `${setting.event_key}:${field}`;
    setSaving(key);
    setError(null);

    // Optimistic update
    setSettings(prev =>
      prev.map(s =>
        s.event_key === setting.event_key && s.recipient_role === setting.recipient_role
          ? { ...s, [field]: value }
          : s,
      ),
    );

    const res = await fetch('/api/admin/notification-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_key: setting.event_key,
        recipient_role: setting.recipient_role,
        field,
        value,
      }),
    });

    if (!res.ok) {
      // Revert on failure
      setSettings(prev =>
        prev.map(s =>
          s.event_key === setting.event_key && s.recipient_role === setting.recipient_role
            ? { ...s, [field]: !value }
            : s,
        ),
      );
      setError('Errore nel salvataggio. Riprova.');
    }
    setSaving(null);
  }, []);

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {SECTIONS.map(section => {
        const sectionSettings = settings.filter(s =>
          section.keys.includes(s.event_key),
        );
        if (sectionSettings.length === 0) return null;

        return (
          <div key={section.title}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {section.title}
            </h3>
            <div className="rounded-xl border border-gray-700/50 overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 bg-gray-800/40 border-b border-gray-700/50">
                <span className="text-xs text-gray-500">Evento</span>
                <span className="text-xs text-gray-500 w-24 text-center">Destinatario</span>
                <span className="text-xs text-gray-500 w-16 text-center">In-app</span>
                <span className="text-xs text-gray-500 w-16 text-center">Email</span>
              </div>

              {sectionSettings.map((s, i) => {
                const isLast = i === sectionSettings.length - 1;
                return (
                  <div
                    key={`${s.event_key}:${s.recipient_role}`}
                    className={
                      'grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 ' +
                      (!isLast ? 'border-b border-gray-700/30' : '')
                    }
                  >
                    <span className="text-sm text-gray-200">{s.label}</span>
                    <span className="w-24 text-center">
                      <span className="inline-block rounded-full bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300">
                        {ROLE_LABELS[s.recipient_role] ?? s.recipient_role}
                      </span>
                    </span>
                    <div className="w-16 flex justify-center">
                      <Toggle
                        checked={s.inapp_enabled}
                        onChange={v => handleToggle(s, 'inapp_enabled', v)}
                        disabled={saving === `${s.event_key}:inapp_enabled`}
                      />
                    </div>
                    <div className="w-16 flex justify-center">
                      <Toggle
                        checked={s.email_enabled}
                        onChange={v => handleToggle(s, 'email_enabled', v)}
                        disabled={saving === `${s.event_key}:email_enabled`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-gray-600">
        Le modifiche vengono salvate automaticamente. In-app = notifica nel campanello; Email = invio email transazionale.
      </p>
    </div>
  );
}
