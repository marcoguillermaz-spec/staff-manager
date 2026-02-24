/**
 * UAT — Dashboard Responsabile
 * Scenari S1–S10: struttura, card per community, pending contatori, cosa devo fare, feed, RBAC
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - responsabile@test.com — community Testbusters + Peer4Med
 *   - admin-test@example.com (amministrazione)
 *   - Collab canonico 3a55c2da (Collaboratore Test) in Testbusters + Peer4Med
 */

import { test, expect, type Page } from '@playwright/test';

// ── Supabase REST helpers ─────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function dbInsert(table: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
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
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function dbDelete(table: string, filter: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────
const COLLAB_ID    = '3a55c2da-4906-42d7-81e1-c7c7b399ab4b';
const COMMUNITY_ID = '6a5aeb11-d4bc-4575-84ad-9c343ea95bbf'; // Testbusters

const CREDS = {
  responsabile: { email: 'responsabile@test.com', password: 'Testbusters123' },
  admin:        { email: 'admin-test@example.com', password: 'Testbusters123' },
};

// ── Login helper ──────────────────────────────────────────────────────────────
async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });
}

// ── Locator helpers ───────────────────────────────────────────────────────────
function commCard(page: Page, name: string) {
  return page.locator('div.rounded-2xl').filter({ has: page.locator('h2', { hasText: name }) });
}

function section(page: Page, title: string) {
  return page.locator('div.rounded-2xl').filter({ has: page.locator('h2', { hasText: title }) });
}

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Dashboard Responsabile UAT', () => {
  let testCompId = '';
  let testExpId  = '';
  let testDocId  = '';

  // ── Setup ─────────────────────────────────────────────────────────────────
  test.beforeAll(async () => {
    const comp = await dbInsert('compensations', {
      collaborator_id:     COLLAB_ID,
      community_id:        COMMUNITY_ID,
      tipo:                'OCCASIONALE',
      descrizione:         'Test UAT Dashboard Responsabile',
      periodo_riferimento: 'Test UAT Dashboard Responsabile',
      importo_lordo:       55,
      importo_netto:       55,
      stato:               'INVIATO',
    });
    testCompId = comp.id as string;

    const exp = await dbInsert('expense_reimbursements', {
      collaborator_id: COLLAB_ID,
      categoria:       'Formazione',
      data_spesa:      '2026-01-31',
      importo:         44.50,
      descrizione:     'Test UAT Dashboard Responsabile',
      stato:           'INVIATO',
    });
    testExpId = exp.id as string;

    const doc = await dbInsert('documents', {
      collaborator_id:    COLLAB_ID,
      community_id:       COMMUNITY_ID,
      tipo:               'RICEVUTA_PAGAMENTO',
      titolo:             'Test UAT Doc Dashboard Responsabile',
      file_original_url:  'test/uat-placeholder.pdf',
      file_original_name: 'uat-placeholder.pdf',
      stato_firma:        'DA_FIRMARE',
      requested_at:       new Date().toISOString(),
    });
    testDocId = doc.id as string;
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    if (testCompId) {
      await dbDelete('compensation_history', `compensation_id=eq.${testCompId}`);
      await dbDelete('compensations', `id=eq.${testCompId}`);
    }
    if (testExpId) {
      await dbDelete('expense_history', `reimbursement_id=eq.${testExpId}`);
      await dbDelete('expense_reimbursements', `id=eq.${testExpId}`);
    }
    if (testDocId) {
      await dbDelete('documents', `id=eq.${testDocId}`);
    }
  });

  // ── S1 — Dashboard mostra h1 e card community ──────────────────────────────
  test('S1 — dashboard mostra h1 Dashboard e almeno una CommCard', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible({ timeout: 8_000 });
    await expect(commCard(page, 'Testbusters')).toBeVisible();
    // Nessun "Benvenuto" (fallback per admin)
    await expect(page.locator('h1', { hasText: 'Benvenuto' })).not.toBeVisible();
  });

  // ── S2 — Entrambe le community visibili con struttura corretta ─────────────
  test('S2 — CommCard Testbusters e Peer4Med visibili con 3 mini-sezioni', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(commCard(page, 'Testbusters')).toBeVisible({ timeout: 8_000 });
    await expect(commCard(page, 'Peer4Med')).toBeVisible();

    // Ogni card ha i 3 link mini-sezione
    const tbCard = commCard(page, 'Testbusters');
    await expect(tbCard.locator('a[href="/approvazioni?tab=compensi"]')).toBeVisible();
    await expect(tbCard.locator('a[href="/approvazioni?tab=rimborsi"]')).toBeVisible();
    await expect(tbCard.locator('a[href="/collaboratori?filter=documenti"]')).toBeVisible();
  });

  // ── S3 — Compenso INVIATO: contatore ambra ────────────────────────────────
  test('S3 — compenso INVIATO: mini-card "Compensi" Testbusters mostra stile ambra', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const tbCard = commCard(page, 'Testbusters');
    await expect(
      tbCard.locator('a[href="/approvazioni?tab=compensi"] span.text-amber-300')
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── S4 — Rimborso INVIATO: contatore ambra ────────────────────────────────
  test('S4 — rimborso INVIATO: mini-card "Rimborsi" mostra stile ambra', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // COLLAB_ID è in Testbusters → exp compare in Testbusters
    const tbCard = commCard(page, 'Testbusters');
    await expect(
      tbCard.locator('a[href="/approvazioni?tab=rimborsi"] span.text-amber-300')
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── S5 — Documento DA_FIRMARE: contatore blu ──────────────────────────────
  test('S5 — documento DA_FIRMARE: mini-card "Da firmare" mostra stile blu', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const tbCard = commCard(page, 'Testbusters');
    await expect(
      tbCard.locator('a[href="/collaboratori?filter=documenti"] span.text-blue-300')
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── S6 — "Cosa devo fare" mostra alert per compensi, rimborsi, documenti ──
  test('S6 — "Cosa devo fare" mostra alert con link a compensi, rimborsi e documenti', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // La sezione è visibile (ci sono dati pending da beforeAll)
    const cdf = section(page, 'Cosa devo fare');
    await expect(cdf).toBeVisible({ timeout: 8_000 });
    await expect(cdf.locator('a[href="/approvazioni?tab=compensi"]')).toBeVisible();
    await expect(cdf.locator('a[href="/approvazioni?tab=rimborsi"]')).toBeVisible();
    await expect(cdf.locator('a[href="/collaboratori?filter=documenti"]')).toBeVisible();
  });

  // ── S7 — Click mini-card Compensi naviga ad approvazioni ──────────────────
  test('S7 — click mini-card "Compensi" naviga a /approvazioni?tab=compensi', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const tbCard = commCard(page, 'Testbusters');
    await tbCard.locator('a[href="/approvazioni?tab=compensi"]').click();
    await page.waitForURL((u) => u.toString().includes('/approvazioni'), { timeout: 10_000 });
    expect(page.url()).toContain('tab=compensi');
  });

  // ── S8 — Feed mostra compenso inviato con link al collaboratore ───────────
  test('S8 — feed mostra voce "Compenso inviato da" con link a /collaboratori/[id]', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const feed = section(page, 'Ultimi aggiornamenti');
    await expect(
      feed.locator(`a[href="/collaboratori/${COLLAB_ID}"]`).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── S9 — Azioni rapide: link Approvazioni funziona ────────────────────────
  test('S9 — azioni rapide: click "Approvazioni" naviga a /approvazioni', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const ar = section(page, 'Azioni rapide');
    await ar.locator('a.bg-blue-700').click();
    await page.waitForURL((u) => u.toString().includes('/approvazioni'), { timeout: 10_000 });
  });

  // ── S10 — Admin vede "Benvenuto", non la dashboard responsabile ───────────
  test('S10 — admin vede "Benvenuto" e non le CommCard community', async ({ page }) => {
    await loginAs(page, CREDS.admin.email, CREDS.admin.password);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1', { hasText: 'Benvenuto' })).toBeVisible({ timeout: 8_000 });
    await expect(commCard(page, 'Testbusters')).not.toBeVisible();
  });
});
