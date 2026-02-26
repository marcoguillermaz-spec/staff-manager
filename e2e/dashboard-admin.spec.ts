/**
 * UAT — Dashboard Admin
 * Scenari S1–S10: KPI cards, community cards, urgenti, feed, period metrics, blocks drawer
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - Utente test: admin@test.com (amministrazione)
 *   - Utente test: collaboratore@test.com (collaboratore, collaborator.id = COLLAB_ID)
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

async function dbPost<T = unknown>(table: string, body: Record<string, unknown>): Promise<T> {
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
  return (Array.isArray(data) ? data[0] : data) as T;
}

async function dbDelete(table: string, params: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
  });
}

// ── Login helper ──────────────────────────────────────────────────────────────
const CREDS = {
  admin: { email: 'admin@test.com', password: 'Testbusters123' },
};

async function login(page: Page) {
  const { email, password } = CREDS.admin;
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

// ── Fixtures ──────────────────────────────────────────────────────────────────
const COLLAB_ID = '3a55c2da-4906-42d7-81e1-c7c7b399ab4b'; // collaboratore@test.com

let collabCommunityId = '';
let collabCommunityName = '';
let collabCognome = '';
let createdCompId = '';
let createdExpId  = '';

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Dashboard Admin UAT', () => {

  test.beforeAll(async () => {
    // Clean up any lingering UAT items
    const oldComps = await dbGet<{ id: string }>(
      'compensations',
      `descrizione=like.*%5BUAT+Admin+Dashboard%5D*&select=id`,
    );
    for (const c of oldComps) {
      await dbDelete('compensation_history', `compensation_id=eq.${c.id}`);
      await dbDelete('compensations', `id=eq.${c.id}`);
    }
    const oldExps = await dbGet<{ id: string }>(
      'expense_reimbursements',
      `descrizione=like.*%5BUAT+Admin+Dashboard%5D*&select=id`,
    );
    for (const e of oldExps) {
      await dbDelete('expense_history', `expense_id=eq.${e.id}`);
      await dbDelete('expense_reimbursements', `id=eq.${e.id}`);
    }

    // Resolve collaboratore cognome (for S9 feed filter)
    const collabRow = await dbFirst<{ cognome: string | null }>(
      'collaborators',
      `id=eq.${COLLAB_ID}&select=cognome`,
    );
    collabCognome = collabRow?.cognome ?? 'Bianchi';

    // Resolve community for COLLAB_ID
    const ccRow = await dbFirst<{ community_id: string }>(
      'collaborator_communities',
      `collaborator_id=eq.${COLLAB_ID}&select=community_id`,
    );
    if (ccRow?.community_id) {
      collabCommunityId = ccRow.community_id;
      const commRow = await dbFirst<{ name: string }>(
        'communities',
        `id=eq.${collabCommunityId}&select=name`,
      );
      collabCommunityName = commRow?.name ?? '';
    } else {
      // Fallback: any active community
      const anyComm = await dbFirst<{ id: string; name: string }>(
        'communities',
        'is_active=eq.true&select=id,name',
      );
      collabCommunityId = anyComm?.id ?? '';
      collabCommunityName = anyComm?.name ?? '';
    }

    // Create UAT compensation (INVIATO → appears in feed + urgenti threshold test)
    if (collabCommunityId) {
      const comp = await dbPost<{ id: string }>('compensations', {
        collaborator_id:  COLLAB_ID,
        community_id:     collabCommunityId,
        tipo:             'OCCASIONALE',
        stato:            'INVIATO',
        descrizione:      '[UAT Admin Dashboard] Compenso di test feed',
        importo_lordo:    300,
        ritenuta_acconto: 60,
        importo_netto:    240,
      });
      createdCompId = comp?.id ?? '';

      const exp = await dbPost<{ id: string }>('expense_reimbursements', {
        collaborator_id: COLLAB_ID,
        community_id:    collabCommunityId,
        stato:           'INVIATO',
        categoria:       'trasporto',
        descrizione:     '[UAT Admin Dashboard] Rimborso di test feed',
        importo:         50,
        data_spesa:      new Date().toISOString().slice(0, 10),
      });
      createdExpId = exp?.id ?? '';
    }
  });

  test.afterAll(async () => {
    if (createdCompId) {
      await dbDelete('compensation_history', `compensation_id=eq.${createdCompId}`);
      await dbDelete('compensations', `id=eq.${createdCompId}`);
    }
    if (createdExpId) {
      await dbDelete('expense_history', `expense_id=eq.${createdExpId}`);
      await dbDelete('expense_reimbursements', `id=eq.${createdExpId}`);
    }
  });

  // S1 — Struttura dashboard admin base
  test('S1 — dashboard admin mostra titolo e sottotitolo', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('p.text-gray-500').filter({ hasText: 'Panoramica operativa' })).toBeVisible();
  });

  // S2 — KPI cards
  test('S2 — sei KPI card visibili', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const labels = [
      'Compensi in coda',
      'Rimborsi in coda',
      'In approvazione',
      'Da pagare',
      'Doc. da firmare',
      'Collaboratori attivi',
    ];
    for (const label of labels) {
      await expect(page.locator('p.text-xs.text-gray-500').filter({ hasText: label })).toBeVisible();
    }
  });

  // S3 — Quick actions
  test('S3 — quattro azioni rapide visibili', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('a', { hasText: 'Vai alla coda' })).toBeVisible();
    await expect(page.locator('a', { hasText: 'Export pagamenti' })).toBeVisible();
    await expect(page.locator('a', { hasText: 'Carica documento' })).toBeVisible();
    await expect(page.locator('a', { hasText: 'Crea utente' })).toBeVisible();
  });

  // S4 — Community cards grid
  test('S4 — sezione Community visibile con almeno una card', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Section heading
    await expect(page.locator('h2').filter({ hasText: 'Community' })).toBeVisible();

    // At least one community card — each card has 3 counter blocks with labels
    const commCards = page.locator('h3.text-sm.font-semibold.text-gray-100');
    const count = await commCards.count();
    expect(count).toBeGreaterThan(0);

    // First card has the 3 sub-labels
    const firstCard = commCards.first().locator('../..');
    await expect(firstCard.locator('p.text-\\[10px\\]').filter({ hasText: 'Compensi' })).toBeVisible();
    await expect(firstCard.locator('p.text-\\[10px\\]').filter({ hasText: 'Rimborsi' })).toBeVisible();
    await expect(firstCard.locator('p.text-\\[10px\\]').filter({ hasText: 'Da firmare' })).toBeVisible();
  });

  // S5 — Collab breakdown
  test('S5 — sezione Collaboratori mostra breakdown per stato e contratto', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h2').filter({ hasText: 'Collaboratori' })).toBeVisible();
    await expect(page.locator('p').filter({ hasText: 'Per stato' })).toBeVisible();
    await expect(page.locator('span.text-xs.text-gray-300').filter({ hasText: 'Attivo' })).toBeVisible();
    await expect(page.locator('p').filter({ hasText: 'Per contratto' })).toBeVisible();
    await expect(page.locator('span.text-xs.text-gray-300').filter({ hasText: 'Occasionale' })).toBeVisible();
  });

  // S6 — Period metrics + YTD strip
  test('S6 — sezione Metriche periodo visibile con grafici e strip YTD', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h2').filter({ hasText: 'Metriche periodo' })).toBeVisible();

    // Recharts containers
    const charts = page.locator('.recharts-responsive-container');
    const chartCount = await charts.count();
    expect(chartCount).toBeGreaterThanOrEqual(2);

    // YTD strip labels
    await expect(page.locator('p').filter({ hasText: 'YTD pagato' })).toBeVisible();
    await expect(page.locator('p').filter({ hasText: 'YTD compensi approvati' })).toBeVisible();
    await expect(page.locator('p').filter({ hasText: 'YTD nuovi collab.' })).toBeVisible();
  });

  // S7 — Blocks drawer apertura
  test('S7 — drawer Situazioni di blocco si apre', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const blocksBtn = page.locator('button', { hasText: 'Situazioni di blocco' });
    await expect(blocksBtn).toBeVisible();
    await blocksBtn.click();

    // Drawer panel visible
    const drawer = page.locator('div.fixed.right-0.top-0');
    await expect(drawer).toBeVisible();

    // Drawer header
    await expect(drawer.locator('h2').filter({ hasText: 'Situazioni di blocco' })).toBeVisible();

    // Either shows items or empty state
    const hasEmpty = await drawer.locator('p').filter({ hasText: 'Nessuna situazione di blocco' }).isVisible();
    const hasGroups = await drawer.locator('h3.text-xs.font-semibold.text-gray-400').count();
    expect(hasEmpty || hasGroups > 0).toBeTruthy();
  });

  // S8 — Blocks drawer chiusura
  test('S8 — drawer si chiude con il pulsante X', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open drawer
    await page.locator('button', { hasText: 'Situazioni di blocco' }).click();
    const drawer = page.locator('div.fixed.right-0.top-0');
    await expect(drawer).toBeVisible();

    // Close with X button
    await drawer.locator('button', { hasText: '✕' }).click();
    await expect(drawer).not.toBeVisible();
  });

  // S9 — Feed: filtro per cognome
  test('S9 — feed si filtra per cognome collaboratore', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Scroll to feed section
    await page.locator('h2').filter({ hasText: 'Attività recenti' }).scrollIntoViewIfNeeded();

    const searchInput = page.locator('input[placeholder="Cerca cognome…"]');
    await expect(searchInput).toBeVisible();

    // Filter by known cognome — feed should show the UAT item
    await searchInput.fill(collabCognome);
    // Give client-side filter time to re-render
    await page.waitForTimeout(300);

    // All visible feed rows should contain the cognome
    const feedLinks = page.locator('a.rounded-xl.bg-gray-800\\/40');
    const count = await feedLinks.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const text = await feedLinks.nth(i).textContent();
        expect(text?.toLowerCase()).toContain(collabCognome.toLowerCase());
      }
    }

    // Filter by something that doesn't exist → empty state
    await searchInput.fill('xXxNonEsisteXxX');
    await page.waitForTimeout(300);
    await expect(page.locator('p').filter({ hasText: 'Nessuna attività trovata' })).toBeVisible();
  });

  // S10 — Feed: filtro per community
  test('S10 — feed si filtra per community', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('h2').filter({ hasText: 'Attività recenti' }).scrollIntoViewIfNeeded();

    const communitySelect = page.locator('select').filter({ hasText: 'Tutte le community' });
    await expect(communitySelect).toBeVisible();

    // The select has community options — verify at least one exists
    const options = await communitySelect.locator('option').count();
    expect(options).toBeGreaterThan(1); // at least "Tutte le community" + 1 community

    // If we have a known community name, select it and verify filter applies
    if (collabCommunityName) {
      await communitySelect.selectOption({ label: collabCommunityName });
      await page.waitForTimeout(300);

      // All visible feed rows should be from this community
      const feedLinks = page.locator('a.rounded-xl.bg-gray-800\\/40');
      const count = await feedLinks.count();
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 5); i++) {
          const text = await feedLinks.nth(i).textContent();
          expect(text).toContain(collabCommunityName);
        }
      }
    }

    // Reset to all communities
    await communitySelect.selectOption({ label: 'Tutte le community' });
    await page.waitForTimeout(300);
    // Feed should have items again (or empty state if DB is empty)
    const feedContainer = page.locator('h2').filter({ hasText: 'Attività recenti' });
    await expect(feedContainer).toBeVisible();
  });

});
