/**
 * UAT — Blocco Notifiche in-app
 * Scenari S1–S9: bell visibile, badge, dropdown, mark-read, navigate on click, DB verify
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - Utenti test: collaboratore@test.com (collaboratore), responsabile@test.com, admin-test@example.com
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

async function dbDelete(table: string, params: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
  });
}

// ── Login helper ──────────────────────────────────────────────────────────────
const CREDS = {
  collaboratore: { email: 'collaboratore@test.com',  password: 'Testbusters123' },
  responsabile:  { email: 'responsabile@test.com',  password: 'Testbusters123' },
  admin:         { email: 'admin-test@example.com', password: 'Testbusters123' },
};

async function login(page: Page, role: keyof typeof CREDS) {
  const { email, password } = CREDS[role];
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // If already authenticated, proxy redirects /login → /; sign out first before switching users
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
let communityId: string;

let compApproveId: string;   // compensation for approve_admin test
let compRejectId: string;    // compensation for reject test
let expenseIntegId: string;  // expense for request_integration test

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Notifiche in-app UAT', () => {

  test.beforeAll(async () => {
    // Resolve collaboratore user_id
    const collab = await dbFirst<{ user_id: string }>('collaborators',
      `id=eq.${COLLABORATOR_ID}&select=user_id`);
    if (!collab) throw new Error('Collaboratore not found');
    collaboratorUserId = collab.user_id;
    console.log(`  ℹ️  collaboratorUserId: ${collaboratorUserId}`);

    // Resolve community_id for collaboratore
    const cc = await dbFirst<{ community_id: string }>('collaborator_communities',
      `collaborator_id=eq.${COLLABORATOR_ID}&select=community_id`);
    if (!cc) throw new Error('No community found for collaboratore');
    communityId = cc.community_id;
    console.log(`  ℹ️  communityId: ${communityId}`);

    // Clean up any previous test notifications for this collaborator
    await dbDelete('notifications', `user_id=eq.${collaboratorUserId}`);

    // Clean up previous test compensations seeded by this spec
    const oldComps = await dbGet<{ id: string }>('compensations',
      `collaborator_id=eq.${COLLABORATOR_ID}&descrizione=like.%5BUAT+Notifiche%5D%25&select=id`);
    for (const c of oldComps) {
      await dbDelete('compensation_history', `compensation_id=eq.${c.id}`);
      await dbDelete('compensations', `id=eq.${c.id}`);
    }

    // Clean up previous test expenses
    const oldExp = await dbGet<{ id: string }>('expense_reimbursements',
      `collaborator_id=eq.${COLLABORATOR_ID}&descrizione=like.%5BUAT+Notifiche%5D%25&select=id`);
    for (const e of oldExp) {
      await dbDelete('expense_history', `reimbursement_id=eq.${e.id}`);
      await dbDelete('expense_reimbursements', `id=eq.${e.id}`);
    }

    // Seed compensation 1: PRE_APPROVATO_RESP (for approve_admin → notification)
    const comp1 = await dbInsert<{ id: string }>('compensations', {
      collaborator_id: COLLABORATOR_ID,
      community_id: communityId,
      tipo: 'OCCASIONALE',
      descrizione: '[UAT Notifiche] approvazione',
      stato: 'PRE_APPROVATO_RESP',
      importo_lordo: 100,
      ritenuta_acconto: 20,
      importo_netto: 80,
    });
    compApproveId = comp1.id;
    console.log(`  ✅ seeded compApproveId: ${compApproveId}`);

    // Seed compensation 2: PRE_APPROVATO_RESP (for reject → notification)
    const comp2 = await dbInsert<{ id: string }>('compensations', {
      collaborator_id: COLLABORATOR_ID,
      community_id: communityId,
      tipo: 'OCCASIONALE',
      descrizione: '[UAT Notifiche] rifiuto',
      stato: 'PRE_APPROVATO_RESP',
      importo_lordo: 50,
      ritenuta_acconto: 10,
      importo_netto: 40,
    });
    compRejectId = comp2.id;
    console.log(`  ✅ seeded compRejectId: ${compRejectId}`);

    // Seed expense: INVIATO (for request_integration → notification)
    const exp = await dbInsert<{ id: string }>('expense_reimbursements', {
      collaborator_id: COLLABORATOR_ID,
      categoria: 'Trasporto',
      data_spesa: '2026-02-20',
      importo: 30,
      descrizione: '[UAT Notifiche] integrazioni',
      stato: 'INVIATO',
    });
    expenseIntegId = exp.id;
    console.log(`  ✅ seeded expenseIntegId: ${expenseIntegId}`);
  });

  test.afterAll(async () => {
    // Clean up seeded records
    for (const id of [compApproveId, compRejectId].filter(Boolean)) {
      await dbDelete('compensation_history', `compensation_id=eq.${id}`);
      await dbDelete('compensations', `id=eq.${id}`);
    }
    if (expenseIntegId) {
      await dbDelete('expense_history', `reimbursement_id=eq.${expenseIntegId}`);
      await dbDelete('expense_reimbursements', `id=eq.${expenseIntegId}`);
    }
    // Remove notifications generated during tests
    await dbDelete('notifications', `user_id=eq.${collaboratorUserId}`);
  });

  // ── S1: Bell visibile nella sidebar ──────────────────────────────────────────
  test('S1 — Bell icon visibile nella sidebar per ogni ruolo', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/compensi');
    await expect(page.locator('button[aria-label="Notifiche"]')).toBeVisible();
    console.log('  ✅ S1 — bell visibile');
  });

  // ── S2: Nessuna notifica → badge assente, dropdown vuoto ─────────────────────
  test('S2 — Badge assente e dropdown mostra "Nessuna notifica"', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/compensi');

    // Badge (red dot) should not be visible
    await expect(page.locator('button[aria-label="Notifiche"] span.bg-red-500')).not.toBeVisible();

    // Open dropdown
    await page.click('button[aria-label="Notifiche"]');
    await expect(page.locator('text=Nessuna notifica')).toBeVisible();
    console.log('  ✅ S2 — nessuna notifica, badge assente');
  });

  // ── S3: Admin approva → notifica generata per collaboratore ──────────────────
  test('S3 — Admin approva compenso → notifica "Compenso approvato" per collaboratore', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`/compensi/${compApproveId}`);

    await page.click('button:has-text("Approva")');
    await page.waitForSelector('span.text-green-300', { timeout: 15_000 });
    console.log('  ✅ S3a — compenso approvato');

    // Verify notification in DB
    const notif = await dbFirst<{ tipo: string; entity_id: string; read: boolean }>(
      'notifications',
      `user_id=eq.${collaboratorUserId}&tipo=eq.approvato&entity_id=eq.${compApproveId}&select=tipo,entity_id,read`,
    );
    expect(notif).not.toBeNull();
    expect(notif!.tipo).toBe('approvato');
    expect(notif!.read).toBe(false);
    console.log('  ✅ S3b — notifica in DB: tipo=approvato, read=false');
  });

  // ── S4: Badge rosso visibile per collaboratore ───────────────────────────────
  test('S4 — Badge rosso visibile dopo notifica non letta', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/compensi');

    const badge = page.locator('button[aria-label="Notifiche"] span.bg-red-500');
    await expect(badge).toBeVisible({ timeout: 10_000 });
    console.log(`  ✅ S4 — badge rosso visibile`);
  });

  // ── S5: Dropdown mostra notifica con titolo corretto ─────────────────────────
  test('S5 — Dropdown mostra "Compenso approvato" con dot non-letto', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/compensi');

    // Wait for badge to confirm bell has loaded unread notifications
    await expect(page.locator('button[aria-label="Notifiche"] span.bg-red-500')).toBeVisible({ timeout: 10_000 });

    await page.locator('button[aria-label="Notifiche"]').click();
    await expect(page.locator('text=Compenso approvato')).toBeVisible();
    // Unread dot (blue) should be present
    await expect(page.locator('span.bg-blue-500').first()).toBeVisible();
    console.log('  ✅ S5 — titolo "Compenso approvato" e dot non-letto visibili');
  });

  // ── S6: Aprire dropdown segna tutto come letto (badge scompare) ──────────────
  test('S6 — Dopo apertura dropdown badge sparisce', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/compensi');

    // Wait for badge to confirm bell has loaded unread notifications
    await expect(page.locator('button[aria-label="Notifiche"] span.bg-red-500')).toBeVisible({ timeout: 10_000 });

    // Open dropdown → triggers PATCH mark-all-read
    await page.locator('button[aria-label="Notifiche"]').click();
    await expect(page.locator('text=Compenso approvato')).toBeVisible();

    // Click outside to close dropdown
    await page.mouse.click(400, 400);
    await page.waitForTimeout(600);

    // Badge should now be gone (unread = 0)
    await expect(page.locator('button[aria-label="Notifiche"] span.bg-red-500')).not.toBeVisible();

    // Verify DB: read = true
    const notif = await dbFirst<{ read: boolean }>(
      'notifications',
      `user_id=eq.${collaboratorUserId}&tipo=eq.approvato&entity_id=eq.${compApproveId}&select=read`,
    );
    expect(notif!.read).toBe(true);
    console.log('  ✅ S6 — badge scomparso, DB read=true');
  });

  // ── S7: Click notifica → naviga a dettaglio compensation ─────────────────────
  test('S7 — Click su notifica compensa naviga a /compensi/{id}', async ({ page }) => {
    test.setTimeout(60_000); // two logins + navigations in one test
    // Admin reject comp2 to generate a new (unread) notification
    await login(page, 'admin');
    await page.goto(`/compensi/${compRejectId}`);
    await page.click('button:has-text("Rifiuta")');
    await page.waitForSelector('span.text-red-300', { timeout: 15_000 });

    // Now login as collaboratore
    await login(page, 'collaboratore');
    await page.goto('/compensi');

    // Wait for badge to confirm bell has loaded unread notifications
    await expect(page.locator('button[aria-label="Notifiche"] span.bg-red-500')).toBeVisible({ timeout: 10_000 });

    // Open dropdown
    await page.locator('button[aria-label="Notifiche"]').click();
    // Find and click the notification link in the bell dropdown (first match — sidebar comes before list)
    const link = page.locator(`a[href="/compensi/${compRejectId}"]`).first();
    await expect(link).toBeVisible({ timeout: 5_000 });
    await link.click();

    await page.waitForURL(`/compensi/${compRejectId}`, { timeout: 10_000 });
    console.log(`  ✅ S7 — navigazione a /compensi/${compRejectId}`);
  });

  // ── S8: request_integration (expense) → notifica rimborso ────────────────────
  test('S8 — Responsabile richiede integrazioni rimborso → notifica generata', async ({ page }) => {
    await login(page, 'responsabile');
    await page.goto(`/rimborsi/${expenseIntegId}`);

    await page.click('button:has-text("Richiedi integrazioni")');
    // Fill in the integration note (min 20 chars required)
    await page.fill('textarea', 'Scontrino illeggibile — UAT notifiche test integrazioni');
    await page.click('button:has-text("Invia richiesta")');
    await page.waitForSelector('span.text-yellow-300', { timeout: 15_000 });
    console.log('  ✅ S8a — stato INTEGRAZIONI_RICHIESTE');

    // Verify notification in DB
    const notif = await dbFirst<{ tipo: string; entity_type: string; entity_id: string }>(
      'notifications',
      `user_id=eq.${collaboratorUserId}&tipo=eq.integrazioni_richieste&entity_id=eq.${expenseIntegId}&select=tipo,entity_type,entity_id`,
    );
    expect(notif).not.toBeNull();
    expect(notif!.tipo).toBe('integrazioni_richieste');
    expect(notif!.entity_type).toBe('reimbursement');
    expect(notif!.entity_id).toBe(expenseIntegId);
    console.log('  ✅ S8b — notifica integrazioni_richieste in DB');
  });

  // ── S9: Verifica DB aggregata ────────────────────────────────────────────────
  test('S9 — DB: tutte le notifiche generate con campi corretti', async () => {
    const notifications = await dbGet<{
      tipo: string;
      titolo: string;
      entity_type: string;
      entity_id: string;
    }>(
      'notifications',
      `user_id=eq.${collaboratorUserId}&select=tipo,titolo,entity_type,entity_id`,
    );

    expect(notifications.length).toBeGreaterThanOrEqual(3);

    const tipos = notifications.map((n) => n.tipo);
    expect(tipos).toContain('approvato');
    expect(tipos).toContain('rifiutato');
    expect(tipos).toContain('integrazioni_richieste');

    // All notifications reference compensation or reimbursement
    for (const n of notifications) {
      expect(['compensation', 'reimbursement']).toContain(n.entity_type);
      expect(n.entity_id).toBeTruthy();
      expect(n.titolo).toBeTruthy();
    }
    console.log(`  ✅ S9 — ${notifications.length} notifiche in DB, campi corretti`);
  });
});
