/**
 * UAT — Notification Settings
 * Scenari S1–S10: tab Notifiche, toggle in-app/email, verifica DB
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - Migration 012_notification_settings.sql applicata (15 righe)
 *   - Utente test: admin-test@example.com / Testbusters123
 */

import { test, expect, type Page } from '@playwright/test';

// ── Supabase REST helpers ─────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function dbGet<T = unknown>(table: string, params = ''): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  return res.json();
}

async function dbFirst<T = unknown>(table: string, params = ''): Promise<T | null> {
  const rows = await dbGet<T>(table, params + '&limit=1');
  return rows[0] ?? null;
}

async function dbPatch(table: string, params: string, body: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
}

// ── Login helper ──────────────────────────────────────────────────────────────
const CREDS = {
  admin: { email: 'admin-test@example.com', password: 'Testbusters123' },
};

async function login(page: Page, role: keyof typeof CREDS) {
  const { email, password } = CREDS[role];
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  if (!page.url().includes('/login')) {
    await page.click('button:has-text("Esci")');
    await page.waitForURL((u) => u.toString().includes('/login'), { timeout: 10_000 });
  }
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });
}

// Saved originals for afterAll restore
type ToggleState = { inapp_enabled: boolean; email_enabled: boolean };
let origCompPagato:       ToggleState | null = null;
let origTicketStato:      ToggleState | null = null;
let origRimborsoInviato:  ToggleState | null = null;
let origDocumentoDaFirm:  ToggleState | null = null;

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Notification Settings UAT', () => {

  test.beforeAll(async () => {
    origCompPagato = await dbFirst<ToggleState>(
      'notification_settings',
      'event_key=eq.comp_pagato&recipient_role=eq.collaboratore&select=inapp_enabled,email_enabled',
    );
    origTicketStato = await dbFirst<ToggleState>(
      'notification_settings',
      'event_key=eq.ticket_stato&recipient_role=eq.collaboratore&select=inapp_enabled,email_enabled',
    );
    origRimborsoInviato = await dbFirst<ToggleState>(
      'notification_settings',
      'event_key=eq.rimborso_inviato&recipient_role=eq.responsabile&select=inapp_enabled,email_enabled',
    );
    origDocumentoDaFirm = await dbFirst<ToggleState>(
      'notification_settings',
      'event_key=eq.documento_da_firmare&recipient_role=eq.collaboratore&select=inapp_enabled,email_enabled',
    );
    console.log('  ℹ️  Originals saved:', { origCompPagato, origTicketStato, origRimborsoInviato, origDocumentoDaFirm });
  });

  test.afterAll(async () => {
    if (origCompPagato)
      await dbPatch('notification_settings', 'event_key=eq.comp_pagato&recipient_role=eq.collaboratore', origCompPagato);
    if (origTicketStato)
      await dbPatch('notification_settings', 'event_key=eq.ticket_stato&recipient_role=eq.collaboratore', origTicketStato);
    if (origRimborsoInviato)
      await dbPatch('notification_settings', 'event_key=eq.rimborso_inviato&recipient_role=eq.responsabile', origRimborsoInviato);
    if (origDocumentoDaFirm)
      await dbPatch('notification_settings', 'event_key=eq.documento_da_firmare&recipient_role=eq.collaboratore', origDocumentoDaFirm);
    console.log('  ℹ️  afterAll restore done');
  });

  // ── S1: Tab Notifiche — 4 sezioni visibili ────────────────────────────────
  test('S1 — Admin accede a /impostazioni?tab=notifiche, 4 sezioni visibili', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=notifiche');

    await expect(page.locator('a[href="?tab=notifiche"].bg-blue-600')).toBeVisible();
    await expect(page.locator('h2:has-text("Impostazioni notifiche")')).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Compensi' })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Rimborsi' })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Documenti' })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Ticket' })).toBeVisible();
    console.log('  ✅ S1 — tab Notifiche attivo, 4 sezioni visibili');
  });

  // ── S2: 30 toggle (15 righe × 2) ─────────────────────────────────────────
  test('S2 — Griglia ha 30 toggle (15 righe × in-app + email)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=notifiche');

    // Column headers
    await expect(page.locator('span.text-xs.text-gray-500:has-text("In-app")').first()).toBeVisible();
    await expect(page.locator('span.text-xs.text-gray-500:has-text("Email")').first()).toBeVisible();

    // 15 settings × 2 toggles each = 30
    const toggles = page.locator('button[role="switch"]');
    await expect(toggles).toHaveCount(30);
    console.log('  ✅ S2 — 30 toggle presenti (15 righe × in-app + email)');
  });

  // ── S3: Disabilita email comp_pagato:collaboratore ────────────────────────
  test('S3 — Admin disabilita email "Compenso pagato", DB aggiornato', async ({ page }) => {
    // Ensure known initial state
    await dbPatch('notification_settings', 'event_key=eq.comp_pagato&recipient_role=eq.collaboratore', { email_enabled: true });

    await login(page, 'admin');
    await page.goto('/impostazioni?tab=notifiche');

    const row = page.locator('div.grid')
      .filter({ hasText: 'Compenso pagato' })
      .filter({ has: page.locator('button[role="switch"]') })
      .first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    const emailToggle = row.locator('button[role="switch"]').nth(1);
    await expect(emailToggle).toHaveAttribute('aria-checked', 'true');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/notification-settings') && res.request().method() === 'PATCH',
        { timeout: 10_000 },
      ),
      emailToggle.click(),
    ]);

    await expect(emailToggle).toHaveAttribute('aria-checked', 'false', { timeout: 5_000 });

    const row_db = await dbFirst<{ email_enabled: boolean }>(
      'notification_settings',
      'event_key=eq.comp_pagato&recipient_role=eq.collaboratore&select=email_enabled',
    );
    expect(row_db!.email_enabled).toBe(false);
    console.log('  ✅ S3 — email comp_pagato:collaboratore disabilitata, DB aggiornato');
  });

  // ── S4: Riabilita email comp_pagato:collaboratore ─────────────────────────
  test('S4 — Admin riabilita email "Compenso pagato", DB aggiornato', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=notifiche');

    const row = page.locator('div.grid')
      .filter({ hasText: 'Compenso pagato' })
      .filter({ has: page.locator('button[role="switch"]') })
      .first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    const emailToggle = row.locator('button[role="switch"]').nth(1);
    await expect(emailToggle).toHaveAttribute('aria-checked', 'false', { timeout: 5_000 });

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/notification-settings') && res.request().method() === 'PATCH',
        { timeout: 10_000 },
      ),
      emailToggle.click(),
    ]);

    await expect(emailToggle).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 });

    const row_db = await dbFirst<{ email_enabled: boolean }>(
      'notification_settings',
      'event_key=eq.comp_pagato&recipient_role=eq.collaboratore&select=email_enabled',
    );
    expect(row_db!.email_enabled).toBe(true);
    console.log('  ✅ S4 — email comp_pagato:collaboratore riabilitata, DB aggiornato');
  });

  // ── S5: Disabilita in-app ticket_stato:collaboratore ─────────────────────
  test('S5 — Admin disabilita in-app "Cambio stato ticket", DB aggiornato', async ({ page }) => {
    await dbPatch('notification_settings', 'event_key=eq.ticket_stato&recipient_role=eq.collaboratore', { inapp_enabled: true });

    await login(page, 'admin');
    await page.goto('/impostazioni?tab=notifiche');

    const row = page.locator('div.grid')
      .filter({ hasText: 'Cambio stato ticket' })
      .filter({ has: page.locator('button[role="switch"]') })
      .first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    const inappToggle = row.locator('button[role="switch"]').nth(0);
    await expect(inappToggle).toHaveAttribute('aria-checked', 'true');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/notification-settings') && res.request().method() === 'PATCH',
        { timeout: 10_000 },
      ),
      inappToggle.click(),
    ]);

    await expect(inappToggle).toHaveAttribute('aria-checked', 'false', { timeout: 5_000 });

    const row_db = await dbFirst<{ inapp_enabled: boolean }>(
      'notification_settings',
      'event_key=eq.ticket_stato&recipient_role=eq.collaboratore&select=inapp_enabled',
    );
    expect(row_db!.inapp_enabled).toBe(false);
    console.log('  ✅ S5 — in-app ticket_stato:collaboratore disabilitato, DB aggiornato');
  });

  // ── S6: Navigazione diretta URL riflette stato DB ─────────────────────────
  test('S6 — Navigazione diretta /impostazioni?tab=notifiche carica valori correnti', async ({ page }) => {
    // ticket_stato inapp is still false from S5
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=notifiche');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h2:has-text("Impostazioni notifiche")')).toBeVisible();

    // Verify the value set in S5 persists (server-rendered from DB)
    const row = page.locator('div.grid')
      .filter({ hasText: 'Cambio stato ticket' })
      .filter({ has: page.locator('button[role="switch"]') })
      .first();
    const inappToggle = row.locator('button[role="switch"]').nth(0);
    await expect(inappToggle).toHaveAttribute('aria-checked', 'false');
    console.log('  ✅ S6 — navigazione diretta carica valori aggiornati dal DB');
  });

  // ── S7: Sezione Ticket — 4 righe (8 toggle) ──────────────────────────────
  test('S7 — Sezione Ticket ha 4 righe e label corrette', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=notifiche');

    // The h3 "Ticket" is immediately followed by the rounded-xl table div (following-sibling)
    const ticketTable = page.locator('h3').filter({ hasText: 'Ticket' })
      .locator('xpath=following-sibling::div[1]');
    await expect(ticketTable).toBeVisible({ timeout: 10_000 });

    // 4 rows × 2 toggles = 8 toggle inside the table (header row has no toggles)
    await expect(ticketTable.locator('button[role="switch"]')).toHaveCount(8);

    // Verify specific labels
    await expect(ticketTable.locator('span:has-text("Ticket creato")')).toBeVisible();
    await expect(ticketTable.locator('span:has-text("Cambio stato ticket")')).toBeVisible();
    await expect(ticketTable.locator('span:has-text("Risposta al ticket (admin / responsabile)")')).toBeVisible();
    await expect(ticketTable.locator('span:has-text("Risposta al ticket (collaboratore)")')).toBeVisible();
    console.log('  ✅ S7 — Sezione Ticket: 4 righe, 8 toggle, label corrette');
  });

  // ── S8: Disabilita in-app rimborso_inviato:responsabile ──────────────────
  test('S8 — Admin disabilita in-app "Rimborso inviato / reinviato", DB aggiornato', async ({ page }) => {
    await dbPatch('notification_settings', 'event_key=eq.rimborso_inviato&recipient_role=eq.responsabile', { inapp_enabled: true });

    await login(page, 'admin');
    await page.goto('/impostazioni?tab=notifiche');

    const row = page.locator('div.grid')
      .filter({ hasText: 'Rimborso inviato / reinviato' })
      .filter({ has: page.locator('button[role="switch"]') })
      .first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    const inappToggle = row.locator('button[role="switch"]').nth(0);
    await expect(inappToggle).toHaveAttribute('aria-checked', 'true');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/notification-settings') && res.request().method() === 'PATCH',
        { timeout: 10_000 },
      ),
      inappToggle.click(),
    ]);

    await expect(inappToggle).toHaveAttribute('aria-checked', 'false', { timeout: 5_000 });

    const row_db = await dbFirst<{ inapp_enabled: boolean }>(
      'notification_settings',
      'event_key=eq.rimborso_inviato&recipient_role=eq.responsabile&select=inapp_enabled',
    );
    expect(row_db!.inapp_enabled).toBe(false);
    console.log('  ✅ S8 — in-app rimborso_inviato:responsabile disabilitato, DB aggiornato');
  });

  // ── S9: Pill destinatario ─────────────────────────────────────────────────
  test('S9 — Pill "Collaboratore" e "Responsabile" visibili e numericamente coerenti', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=notifiche');

    const collaboratorePills = page.locator('span.rounded-full.bg-gray-700:has-text("Collaboratore")');
    const responsabilePills  = page.locator('span.rounded-full.bg-gray-700:has-text("Responsabile")');

    // 11 collaboratore rows, 4 responsabile rows (from migration)
    await expect(collaboratorePills).toHaveCount(11);
    await expect(responsabilePills).toHaveCount(4);
    console.log('  ✅ S9 — 11 pill Collaboratore, 4 pill Responsabile');
  });

  // ── S10: Doppio toggle email documento_da_firmare:collaboratore ───────────
  test('S10 — Toggle email documento_da_firmare: off→on, DB coerente in entrambi i passaggi', async ({ page }) => {
    await dbPatch('notification_settings', 'event_key=eq.documento_da_firmare&recipient_role=eq.collaboratore', { email_enabled: true });

    await login(page, 'admin');
    await page.goto('/impostazioni?tab=notifiche');

    const row = page.locator('div.grid')
      .filter({ hasText: 'Documento da firmare' })
      .filter({ has: page.locator('button[role="switch"]') })
      .first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    const emailToggle = row.locator('button[role="switch"]').nth(1);

    // ── OFF ──
    await expect(emailToggle).toHaveAttribute('aria-checked', 'true');
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/notification-settings') && res.request().method() === 'PATCH',
        { timeout: 10_000 },
      ),
      emailToggle.click(),
    ]);
    await expect(emailToggle).toHaveAttribute('aria-checked', 'false', { timeout: 5_000 });

    let row_db = await dbFirst<{ email_enabled: boolean }>(
      'notification_settings',
      'event_key=eq.documento_da_firmare&recipient_role=eq.collaboratore&select=email_enabled',
    );
    expect(row_db!.email_enabled).toBe(false);

    // ── ON ──
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/notification-settings') && res.request().method() === 'PATCH',
        { timeout: 10_000 },
      ),
      emailToggle.click(),
    ]);
    await expect(emailToggle).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 });

    row_db = await dbFirst<{ email_enabled: boolean }>(
      'notification_settings',
      'event_key=eq.documento_da_firmare&recipient_role=eq.collaboratore&select=email_enabled',
    );
    expect(row_db!.email_enabled).toBe(true);
    console.log('  ✅ S10 — email documento_da_firmare toggled off→on, DB coerente in entrambi i passaggi');
  });
});
