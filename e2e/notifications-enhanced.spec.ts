/**
 * UAT — Notifiche bell — funzionalità avanzate
 * S1: Badge persiste dopo apertura dropdown (no auto-mark-all-read)
 * S2: Mark-read singola al click notifica
 * S3: "Segna tutte come lette" esplicito
 * S4: Dismiss singola (×) — rimuove da DOM e DB
 * S5: Link ticket navigabile (entity_type=ticket → /ticket/:id)
 * S6: Pagina /notifiche — toggle "Solo non lette"
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

async function dbInsert<T = unknown>(table: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  const rows: T[] = await res.json();
  return rows[0];
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

async function dbDelete(table: string, params: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
  });
}

// ── Login helper ──────────────────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  if (!page.url().includes('/login')) {
    await page.click('button:has-text("Esci")');
    await page.waitForURL((u) => u.toString().includes('/login'), { timeout: 10_000 });
  }
  await page.fill('input[type="email"]', 'collaboratore@test.com');
  await page.fill('input[type="password"]', 'Testbusters123');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20_000 });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const COLLABORATOR_ID = '3a55c2da-4906-42d7-81e1-c7c7b399ab4b';

let collaboratorUserId: string;
let compensationId: string;
let ticketId: string;
let notif1Id: string; // compensation notif — used in S1–S4
let notif2Id: string; // ticket notif — used in S5

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Notifiche bell — funzionalità avanzate', () => {

  test.beforeAll(async () => {
    // Cleanup first
    const collab = await dbFirst<{ user_id: string; }>('collaborators', `id=eq.${COLLABORATOR_ID}&select=user_id`);
    if (!collab) throw new Error('Collaboratore not found');
    collaboratorUserId = collab.user_id;
    await dbDelete('notifications', `user_id=eq.${collaboratorUserId}&titolo=like.%5BUAT+Bell%5D%25`);

    // Resolve community_id
    const cc = await dbFirst<{ community_id: string }>('collaborator_communities', `collaborator_id=eq.${COLLABORATOR_ID}&select=community_id`);
    const communityId = cc?.community_id ?? null;

    // Seed temp compensation for entity_id reference
    const comp = await dbInsert<{ id: string }>('compensations', {
      collaborator_id: COLLABORATOR_ID,
      community_id: communityId,
      tipo: 'OCCASIONALE',
      descrizione: '[UAT Bell] ref comp',
      stato: 'INVIATO',
      importo_lordo: 10,
      ritenuta_acconto: 2,
      importo_netto: 8,
    });
    compensationId = comp.id;

    // Seed temp ticket for S5
    const ticket = await dbInsert<{ id: string }>('tickets', {
      creator_user_id: collaboratorUserId,
      community_id: communityId,
      categoria: 'Altro',
      oggetto: '[UAT Bell] ticket test',
      stato: 'APERTO',
      priority: 'NORMALE',
    });
    ticketId = ticket.id;

    // Seed notification 1: compensation (unread) — for S1–S4
    const n1 = await dbInsert<{ id: string }>('notifications', {
      user_id: collaboratorUserId,
      tipo: 'approvato',
      titolo: '[UAT Bell] compenso approvato',
      messaggio: 'Il tuo compenso è stato approvato.',
      entity_type: 'compensation',
      entity_id: compensationId,
      read: false,
    });
    notif1Id = n1.id;

    // Seed notification 2: ticket (unread) — for S5
    const n2 = await dbInsert<{ id: string }>('notifications', {
      user_id: collaboratorUserId,
      tipo: 'ticket_reply',
      titolo: '[UAT Bell] risposta ticket',
      messaggio: 'Hai una nuova risposta al ticket.',
      entity_type: 'ticket',
      entity_id: ticketId,
      read: false,
    });
    notif2Id = n2.id;
  });

  test.afterAll(async () => {
    await dbDelete('notifications', `user_id=eq.${collaboratorUserId}&titolo=like.%5BUAT+Bell%5D%25`);
    if (ticketId) {
      await dbDelete('ticket_messages', `ticket_id=eq.${ticketId}`);
      await dbDelete('tickets', `id=eq.${ticketId}`);
    }
    if (compensationId) {
      await dbDelete('compensation_history', `compensation_id=eq.${compensationId}`);
      await dbDelete('compensations', `id=eq.${compensationId}`);
    }
  });

  // ── S1 ────────────────────────────────────────────────────────────────────────
  test('S1 — Badge unread visibile; apertura dropdown NON azzera il badge', async ({ page }) => {
    await login(page);
    await page.goto('/');

    const badge = page.locator('button[aria-label="Notifiche"] span.bg-red-500');
    await expect(badge).toBeVisible({ timeout: 10_000 });

    // Open dropdown — old behavior would mark-all-read; new behavior must NOT
    await page.locator('button[aria-label="Notifiche"]').click();
    await expect(page.locator('text=[UAT Bell] compenso approvato')).toBeVisible();

    // Badge must still be visible (no auto-mark-all-read on open)
    await expect(badge).toBeVisible();
    console.log('  ✅ S1 — badge persiste dopo apertura dropdown');
  });

  // ── S2 ────────────────────────────────────────────────────────────────────────
  test('S2 — Click notifica → mark-read singola, read=true in DB', async ({ page }) => {
    await login(page);
    await page.goto('/');

    await expect(page.locator('button[aria-label="Notifiche"] span.bg-red-500')).toBeVisible({ timeout: 10_000 });
    await page.locator('button[aria-label="Notifiche"]').click();
    await expect(page.locator('text=[UAT Bell] compenso approvato')).toBeVisible();

    // Click the compensation link — triggers mark-read PATCH
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(`/api/notifications/${notif1Id}`) && res.request().method() === 'PATCH',
        { timeout: 10_000 },
      ),
      page.locator(`a[href="/compensi/${compensationId}"]`).first().click(),
    ]);

    const notif = await dbFirst<{ read: boolean }>('notifications', `id=eq.${notif1Id}&select=read`);
    expect(notif!.read).toBe(true);
    console.log('  ✅ S2 — mark-read singola: DB read=true');
  });

  // ── S3 ────────────────────────────────────────────────────────────────────────
  test('S3 — "Segna tutte come lette" azzera badge e marca tutto in DB', async ({ page }) => {
    // Reset notif1 to unread
    await dbPatch('notifications', `id=eq.${notif1Id}`, { read: false });

    await login(page);
    await page.goto('/');

    await expect(page.locator('button[aria-label="Notifiche"] span.bg-red-500')).toBeVisible({ timeout: 10_000 });
    await page.locator('button[aria-label="Notifiche"]').click();
    await expect(page.locator('text=[UAT Bell] compenso approvato')).toBeVisible();

    // Click "Segna tutte come lette"
    await Promise.all([
      page.waitForResponse(
        (res) => {
          const url = res.url();
          return url.endsWith('/api/notifications') && res.request().method() === 'PATCH';
        },
        { timeout: 10_000 },
      ),
      page.locator('button:has-text("Segna tutte come lette")').click(),
    ]);

    // Badge should disappear
    await expect(page.locator('button[aria-label="Notifiche"] span.bg-red-500')).not.toBeVisible();

    // DB: no unread UAT notifications
    const unread = await dbGet<{ id: string }>('notifications',
      `user_id=eq.${collaboratorUserId}&read=eq.false&titolo=like.%5BUAT+Bell%5D%25&select=id`);
    expect(unread.length).toBe(0);
    console.log('  ✅ S3 — badge sparito, tutte le notifiche read=true in DB');
  });

  // ── S4 ────────────────────────────────────────────────────────────────────────
  test('S4 — Click × rimuove notifica da DOM e da DB', async ({ page }) => {
    await login(page);
    await page.goto('/');

    await page.locator('button[aria-label="Notifiche"]').click();
    await expect(page.locator('text=[UAT Bell] compenso approvato')).toBeVisible({ timeout: 5_000 });

    // Target dismiss button inside the specific notification container
    const notifContainer = page.locator('div.group').filter({ hasText: '[UAT Bell] compenso approvato' }).first();
    const dismissBtn = notifContainer.locator('button[aria-label="Rimuovi notifica"]');

    // force: true bypasses opacity-0 (CSS group-hover) check
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(`/api/notifications/${notif1Id}`) && res.request().method() === 'DELETE',
        { timeout: 10_000 },
      ),
      dismissBtn.click({ force: true }),
    ]);

    // Notification gone from DOM
    await expect(page.locator('text=[UAT Bell] compenso approvato')).not.toBeVisible();

    // DB: notification deleted
    const notif = await dbFirst<{ id: string }>('notifications', `id=eq.${notif1Id}&select=id`);
    expect(notif).toBeNull();
    console.log('  ✅ S4 — notifica rimossa da DOM e DB');
  });

  // ── S5 ────────────────────────────────────────────────────────────────────────
  test('S5 — Notifica ticket → link naviga a /ticket/:id', async ({ page }) => {
    await login(page);
    await page.goto('/');

    await page.locator('button[aria-label="Notifiche"]').click();
    await expect(page.locator('text=[UAT Bell] risposta ticket')).toBeVisible({ timeout: 5_000 });

    // The notification link must point to /ticket/:id
    const link = page.locator(`a[href="/ticket/${ticketId}"]`).first();
    await expect(link).toBeVisible();
    await link.click();

    await page.waitForURL(`/ticket/${ticketId}`, { timeout: 10_000 });
    console.log(`  ✅ S5 — navigazione a /ticket/${ticketId}`);
  });

  // ── S6 ────────────────────────────────────────────────────────────────────────
  test('S6 — Pagina /notifiche: toggle "Solo non lette" filtra correttamente', async ({ page }) => {
    test.setTimeout(60_000);
    // Seed a read and an unread notification for filter test
    await dbInsert('notifications', {
      user_id: collaboratorUserId,
      tipo: 'approvato',
      titolo: '[UAT Bell] filtro letta',
      entity_type: 'compensation',
      entity_id: compensationId,
      read: true,
    });
    await dbInsert('notifications', {
      user_id: collaboratorUserId,
      tipo: 'approvato',
      titolo: '[UAT Bell] filtro non letta',
      entity_type: 'compensation',
      entity_id: compensationId,
      read: false,
    });

    await login(page);
    await page.goto('/notifiche');

    // Both visible initially
    await expect(page.locator('text=[UAT Bell] filtro letta')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=[UAT Bell] filtro non letta')).toBeVisible();

    // Activate filter
    await page.locator('button:has-text("Solo non lette")').click();
    await page.waitForURL(/unread_only=true/, { timeout: 5_000 });

    // Only unread visible
    await expect(page.locator('text=[UAT Bell] filtro non letta')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=[UAT Bell] filtro letta')).not.toBeVisible();
    console.log('  ✅ S6 — filtro "Solo non lette" funzionante');
  });
});
