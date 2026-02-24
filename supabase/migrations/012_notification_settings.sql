-- Migration 012: notification_settings
-- Configurable per-event notification preferences (in-app + email)

CREATE TABLE notification_settings (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_key     text NOT NULL,
  recipient_role text NOT NULL,
  label         text NOT NULL,
  inapp_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  UNIQUE (event_key, recipient_role)
);

-- Pre-populate with defaults matching agreed matrix
INSERT INTO notification_settings (event_key, recipient_role, label, inapp_enabled, email_enabled) VALUES
  ('comp_inviato',          'responsabile',  'Compenso inviato / reinviato',              true,  true),
  ('comp_integrazioni',     'collaboratore', 'Compenso — integrazioni richieste',          true,  true),
  ('comp_approvato',        'collaboratore', 'Compenso approvato',                         true,  true),
  ('comp_rifiutato',        'collaboratore', 'Compenso rifiutato',                         true,  true),
  ('comp_pagato',           'collaboratore', 'Compenso pagato',                            true,  true),
  ('rimborso_inviato',      'responsabile',  'Rimborso inviato / reinviato',               true,  true),
  ('rimborso_integrazioni', 'collaboratore', 'Rimborso — integrazioni richieste',          true,  true),
  ('rimborso_approvato',    'collaboratore', 'Rimborso approvato',                         true,  true),
  ('rimborso_rifiutato',    'collaboratore', 'Rimborso rifiutato',                         true,  true),
  ('rimborso_pagato',       'collaboratore', 'Rimborso pagato',                            true,  true),
  ('documento_da_firmare',  'collaboratore', 'Documento da firmare',                       true,  true),
  ('ticket_creato',         'responsabile',  'Ticket creato',                              true,  true),
  ('ticket_risposta',       'collaboratore', 'Risposta al ticket (admin / responsabile)',  true,  false),
  ('ticket_risposta_collab','responsabile',  'Risposta al ticket (collaboratore)',         true,  false),
  ('ticket_stato',          'collaboratore', 'Cambio stato ticket',                        true,  false);

-- RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_settings_read"
  ON notification_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "notif_settings_admin_write"
  ON notification_settings FOR UPDATE
  USING (get_my_role() IN ('amministrazione', 'super_admin'));
