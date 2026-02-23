/**
 * UAT — Blocco Ticket
 * Scenari S1–S9: creazione ticket, thread messaggi, cambio stato, notifiche, verifica DB
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - Utenti test: collaboratore@test.com (collaboratore), admin-test@example.com
 *   - Bucket `tickets` creato in Supabase Storage (migration 006)
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

async function dbDelete(table: string, params: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
  });
}

// ── Login helper ──────────────────────────────────────────────────────────────
const CREDS = {
  collaboratore: { email: 'collaboratore@test.com',   password: 'Testbusters123' },
  admin:         { email: 'admin-test@example.com',  password: 'Testbusters123' },
};

async function login(page: Page, role: keyof typeof CREDS) {
  const { email, password } = CREDS[role];
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // If already authenticated, proxy redirects /login → /; sign out first
  if (!page.url().includes('/login')) {
    await page.click('button:has-text("Esci")');
    await page.waitForURL((u) => u.toString().includes('/login'), { timeout: 10_000 });
  }

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const COLLABORATOR_ID = '3a55c2da-4906-42d7-81e1-c7c7b399ab4b'; // collaboratore@test.com

let collaboratorUserId: string;
let ticketId: string;

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Ticket UAT', () => {

  test.beforeAll(async () => {
    // Resolve collaboratore user_id for notification checks
    const collab = await dbFirst<{ user_id: string }>(
      'collaborators',
      `id=eq.${COLLABORATOR_ID}&select=user_id`,
    );
    if (!collab) throw new Error('Collaboratore collaboratore@test.com not found');
    collaboratorUserId = collab.user_id;
    console.log(`  ℹ️  collaboratorUserId: ${collaboratorUserId}`);

    // Clean up previous test tickets from this spec
    const oldTickets = await dbGet<{ id: string }>(
      'tickets',
      `creator_user_id=eq.${collaboratorUserId}&oggetto=like.%5BUAT+Ticket%5D%25&select=id`,
    );
    for (const t of oldTickets) {
      await dbDelete('ticket_messages', `ticket_id=eq.${t.id}`);
      await dbDelete('tickets', `id=eq.${t.id}`);
    }

    // Clean up previous ticket reply notifications for this user
    await dbDelete('notifications', `user_id=eq.${collaboratorUserId}&tipo=eq.risposta_ticket`);
    console.log('  ℹ️  cleanup done');
  });

  test.afterAll(async () => {
    if (ticketId) {
      await dbDelete('ticket_messages', `ticket_id=eq.${ticketId}`);
      await dbDelete('tickets', `id=eq.${ticketId}`);
    }
    await dbDelete('notifications', `user_id=eq.${collaboratorUserId}&tipo=eq.risposta_ticket`);
  });

  // ── S1: Collaboratore accede a /ticket ────────────────────────────────────
  test('S1 — Collaboratore accede a /ticket e vede la pagina con bottone "Nuovo ticket"', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/ticket');

    await expect(page.locator('h1:has-text("Ticket")')).toBeVisible();
    await expect(page.locator('a[href="/ticket/nuova"]').first()).toBeVisible();
    console.log('  ✅ S1 — pagina ticket visibile, bottone "Nuovo ticket" presente');
  });

  // ── S2: Collaboratore crea ticket con messaggio iniziale ──────────────────
  test('S2 — Collaboratore crea un ticket, thread mostra primo messaggio con label "Tu"', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/ticket/nuova');

    await page.selectOption('select#categoria', 'Accesso e account');
    await page.fill('input#oggetto', '[UAT Ticket] Test ticket E2E');
    await page.fill('textarea#messaggio', 'Primo messaggio di prova per il ticket E2E.');

    await page.click('button[type="submit"]');
    await page.waitForURL(/\/ticket\/[a-f0-9-]+$/, { timeout: 15_000 });

    // Capture ticket ID from URL
    ticketId = page.url().split('/ticket/')[1];
    console.log(`  ℹ️  ticketId: ${ticketId}`);

    // Thread shows "Tu" label for the initial message
    await expect(page.locator('text=Tu').first()).toBeVisible();
    await expect(page.locator('text=Primo messaggio di prova per il ticket E2E.')).toBeVisible();
    // Status badge: APERTO (text-green-300)
    await expect(page.locator('span.text-green-300')).toBeVisible();
    console.log('  ✅ S2 — ticket creato, thread e badge APERTO visibili');
  });

  // ── S3: Collaboratore invia risposta ─────────────────────────────────────
  test('S3 — Collaboratore invia risposta, messaggio appare nel thread', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto(`/ticket/${ticketId}`);

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/tickets/') && res.url().includes('/messages') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      (async () => {
        await page.fill('textarea', 'Aggiornamento test: secondo messaggio collaboratore.');
        await page.click('button:has-text("Invia risposta")');
      })(),
    ]);

    await expect(
      page.locator('text=Aggiornamento test: secondo messaggio collaboratore.'),
    ).toBeVisible({ timeout: 10_000 });
    console.log('  ✅ S3 — risposta inviata e visibile nel thread');
  });

  // ── S4: Admin vede il ticket nella lista con nome collaboratore ───────────
  test('S4 — Admin accede a /ticket e vede il ticket con colonna Collaboratore', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/ticket');

    await expect(page.locator('h1:has-text("Ticket")')).toBeVisible();
    // Column header visible for admin
    await expect(page.locator('th:has-text("Collaboratore")')).toBeVisible();
    // Link to the test ticket exists
    await expect(page.locator(`a[href="/ticket/${ticketId}"]`)).toBeVisible({ timeout: 10_000 });
    console.log('  ✅ S4 — admin vede ticket + colonna Collaboratore');
  });

  // ── S5: Admin risponde → notifica al collaboratore ────────────────────────
  test('S5 — Admin risponde al ticket, notifica risposta_ticket in DB per collaboratore', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`/ticket/${ticketId}`);

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/tickets/') && res.url().includes('/messages') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      (async () => {
        await page.fill('textarea', 'Risposta dal supporto: stiamo verificando il problema.');
        await page.click('button:has-text("Invia risposta")');
      })(),
    ]);

    await expect(
      page.locator('text=Risposta dal supporto: stiamo verificando il problema.'),
    ).toBeVisible({ timeout: 10_000 });
    console.log('  ✅ S5a — messaggio admin visibile nel thread');

    // Verify notification in DB
    const notif = await dbFirst<{ tipo: string; entity_id: string; entity_type: string }>(
      'notifications',
      `user_id=eq.${collaboratorUserId}&tipo=eq.risposta_ticket&entity_id=eq.${ticketId}&select=tipo,entity_id,entity_type`,
    );
    expect(notif).not.toBeNull();
    expect(notif!.tipo).toBe('risposta_ticket');
    expect(notif!.entity_type).toBe('ticket');
    expect(notif!.entity_id).toBe(ticketId);
    console.log('  ✅ S5b — notifica risposta_ticket in DB, entity_type=ticket');
  });

  // ── S6: Admin → IN_LAVORAZIONE ────────────────────────────────────────────
  test('S6 — Admin cambia stato a IN_LAVORAZIONE, badge aggiornato', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`/ticket/${ticketId}`);

    await page.click('button:has-text("→ In lavorazione")');

    // Badge should now show IN_LAVORAZIONE (text-yellow-300)
    await expect(page.locator('span.text-yellow-300')).toBeVisible({ timeout: 10_000 });
    // "→ In lavorazione" button is no longer in STATUS_TRANSITIONS.IN_LAVORAZIONE
    await expect(page.locator('button:has-text("→ In lavorazione")')).not.toBeVisible();
    console.log('  ✅ S6 — stato IN_LAVORAZIONE, badge giallo visibile');
  });

  // ── S7: Admin → CHIUSO, form risposta scompare ────────────────────────────
  test('S7 — Admin chiude il ticket, form risposta scompare e banner chiuso visibile', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`/ticket/${ticketId}`);

    await page.click('button:has-text("→ Chiuso")');

    // Closed banner from TicketThread
    await expect(
      page.locator('text=Non è possibile aggiungere nuovi messaggi'),
    ).toBeVisible({ timeout: 10_000 });
    // Reply form is gone
    await expect(page.locator('button:has-text("Invia risposta")')).not.toBeVisible();
    // No more status change buttons
    await expect(page.locator('button:has-text("→ Aperto")')).not.toBeVisible();
    console.log('  ✅ S7 — ticket chiuso, banner visibile, form reply nascosto');
  });

  // ── S8: Collaboratore vede notifica risposta nel bell ─────────────────────
  test('S8 — Collaboratore vede notifica "Nuova risposta al tuo ticket" nel bell', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/ticket');

    // Bell badge should appear (admin replied in S5)
    const badge = page.locator('button[aria-label="Notifiche"] span.bg-red-500');
    await expect(badge).toBeVisible({ timeout: 10_000 });

    // Open notification dropdown
    await page.locator('button[aria-label="Notifiche"]').click();
    await expect(page.locator('text=Nuova risposta al tuo ticket')).toBeVisible({ timeout: 5_000 });
    console.log('  ✅ S8 — notifica "Nuova risposta al tuo ticket" visibile nel bell');
  });

  // ── S9: Verifica DB aggregata ─────────────────────────────────────────────
  test('S9 — DB: stato CHIUSO, 3 messaggi, notifica risposta con oggetto corretto', async () => {
    // Ticket stato = CHIUSO
    const ticket = await dbFirst<{ stato: string }>(
      'tickets',
      `id=eq.${ticketId}&select=stato`,
    );
    expect(ticket!.stato).toBe('CHIUSO');

    // 3 messages: initial (S2) + collab reply (S3) + admin reply (S5)
    const msgs = await dbGet<{ id: string }>(
      'ticket_messages',
      `ticket_id=eq.${ticketId}&select=id`,
    );
    expect(msgs.length).toBe(3);

    // Notification with ticketId and correct message
    const notif = await dbFirst<{ tipo: string; messaggio: string; entity_type: string }>(
      'notifications',
      `user_id=eq.${collaboratorUserId}&tipo=eq.risposta_ticket&entity_id=eq.${ticketId}&select=tipo,messaggio,entity_type`,
    );
    expect(notif).not.toBeNull();
    expect(notif!.entity_type).toBe('ticket');
    expect(notif!.messaggio).toContain('[UAT Ticket] Test ticket E2E');

    console.log(`  ✅ S9 — DB: stato=CHIUSO, ${msgs.length} messaggi, notifica corretta`);
  });
});
