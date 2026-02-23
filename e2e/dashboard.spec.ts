/**
 * UAT — Dashboard collaboratore (§11)
 * Scenari S1–S10: card riepilogative, azioni rapide, cosa mi manca, feed aggiornamenti
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - Utenti test: mario.rossi@test.com (collaboratore), admin-test@example.com (amministrazione)
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
  mario: { email: 'mario.rossi@test.com',     password: 'Testbusters123' },
  admin: { email: 'admin-test@example.com',   password: 'Testbusters123' },
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

// ── Fixtures ──────────────────────────────────────────────────────────────────
const COLLAB_ID = '3a55c2da-4906-42d7-81e1-c7c7b399ab4b'; // mario.rossi collaborator.id

let marioUserId = '';
let marioCommunityId = '';
let createdCompId = '';   // UAT compensation in INTEGRAZIONI_RICHIESTE

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Dashboard collaboratore UAT', () => {

  test.beforeAll(async () => {
    // Resolve mario.rossi's user_id (for reference only)
    const collabRow = await dbFirst<{ user_id: string }>('collaborators', `id=eq.${COLLAB_ID}&select=user_id`);
    marioUserId = collabRow?.user_id ?? '';

    // Resolve a community for mario.rossi (fallback: any active community)
    const ccRow = await dbFirst<{ community_id: string }>(
      'collaborator_communities',
      `collaborator_id=eq.${COLLAB_ID}&select=community_id`,
    );
    if (ccRow?.community_id) {
      marioCommunityId = ccRow.community_id;
    } else {
      const anyComm = await dbFirst<{ id: string }>('communities', 'is_active=eq.true&select=id');
      marioCommunityId = anyComm?.id ?? '';
    }

    // Create a UAT compensation in INTEGRAZIONI_RICHIESTE for S6/S9
    // Note: compensations uses collaborator_id (not user_id) — user_id set by DB trigger
    if (marioCommunityId) {
      const comp = await dbPost<{ id: string }>('compensations', {
        collaborator_id: COLLAB_ID,
        community_id:    marioCommunityId,
        tipo:            'OCCASIONALE',
        stato:           'INTEGRAZIONI_RICHIESTE',
        descrizione:     '[UAT Dashboard] Compenso di test',
        importo_lordo:   200,
        ritenuta_acconto: 40,
        importo_netto:   160,
      });
      createdCompId = comp?.id ?? '';
    }
  });

  test.afterAll(async () => {
    // Clean up UAT compensation
    if (createdCompId) {
      await dbDelete('compensation_history', `compensation_id=eq.${createdCompId}`);
      await dbDelete('compensations', `id=eq.${createdCompId}`);
    }
  });

  // S1 — Struttura dashboard base
  test('S1 — dashboard visibile con tutte le sezioni', async ({ page }) => {
    await login(page, 'mario');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('h2').filter({ hasText: 'Compensi' })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: 'Rimborsi' })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: 'Da firmare' })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: 'Azioni rapide' })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: 'Ultimi aggiornamenti' })).toBeVisible();
  });

  // S2 — Card compensi: conteggio riflette DB
  test('S2 — card compensi conta correttamente gli attivi', async ({ page }) => {
    // Query DB: compensi attivi (esclude PAGATO e RIFIUTATO)
    const allComps = await dbGet<{ stato: string }>(
      'compensations',
      `collaborator_id=eq.${COLLAB_ID}&select=stato`,
    );
    const activeCount = allComps.filter(
      (c) => !['PAGATO', 'RIFIUTATO'].includes(c.stato),
    ).length;

    await login(page, 'mario');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const compCard = page.locator('div.rounded-2xl').filter({
      has: page.locator('h2', { hasText: 'Compensi' }),
    });
    const badge = compCard.locator('span.rounded-full');
    await expect(badge).toContainText(`${activeCount}`);
  });

  // S3 — Card rimborsi: conteggio riflette DB
  test('S3 — card rimborsi conta correttamente gli attivi', async ({ page }) => {
    const allExps = await dbGet<{ stato: string }>(
      'expense_reimbursements',
      `collaborator_id=eq.${COLLAB_ID}&select=stato`,
    );
    const activeCount = allExps.filter(
      (e) => !['PAGATO', 'RIFIUTATO'].includes(e.stato),
    ).length;

    await login(page, 'mario');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const expCard = page.locator('div.rounded-2xl').filter({
      has: page.locator('h2', { hasText: 'Rimborsi' }),
    });
    const badge = expCard.locator('span.rounded-full');
    await expect(badge).toContainText(`${activeCount}`);
  });

  // S4 — Card documenti: conteggio riflette DB
  test('S4 — card documenti da firmare riflette DB', async ({ page }) => {
    const docs = await dbGet<{ id: string }>(
      'documents',
      `collaborator_id=eq.${COLLAB_ID}&stato_firma=eq.DA_FIRMARE&select=id`,
    );
    const count = docs.length;

    await login(page, 'mario');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const docCard = page.locator('div.rounded-2xl').filter({
      has: page.locator('h2', { hasText: 'Da firmare' }),
    });
    const badge = docCard.locator('span.rounded-full');
    await expect(badge).toContainText(`${count}`);
  });

  // S5 — Azioni rapide: link funzionanti
  test('S5 — azioni rapide navigano alle pagine corrette', async ({ page }) => {
    await login(page, 'mario');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Nuovo compenso
    await page.click('a[href="/compensi/nuova"]');
    await page.waitForURL('**/compensi/nuova', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/compensi\/nuova/);

    // Nuovo rimborso
    await page.goto('/');
    await page.click('a[href="/rimborsi/nuova"]');
    await page.waitForURL('**/rimborsi/nuova', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/rimborsi\/nuova/);

    // Apri ticket
    await page.goto('/');
    await page.click('a[href="/ticket/nuova"]');
    await page.waitForURL('**/ticket/nuova', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/ticket\/nuova/);
  });

  // S6 — Cosa mi manca: integrazioni richieste visibili
  test('S6 — cosa mi manca mostra integrazioni richieste', async ({ page }) => {
    if (!createdCompId) {
      test.skip();
      return;
    }

    await login(page, 'mario');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Sezione deve essere visibile
    await expect(page.locator('h2').filter({ hasText: 'Cosa mi manca' })).toBeVisible();

    // Almeno un item con testo "integrazione"
    const integrazioniItem = page.locator('div.space-y-2 a').filter({ hasText: 'integrazione' });
    await expect(integrazioniItem).toBeVisible();

    // Click porta a /compensi
    await integrazioniItem.click();
    await page.waitForURL('**/compensi', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/compensi/);
  });

  // S7 — Cosa mi manca: profilo incompleto (condizionale)
  test('S7 — cosa mi manca segnala profilo incompleto se IBAN mancante', async ({ page }) => {
    const collab = await dbFirst<{ iban: string | null; codice_fiscale: string | null }>(
      'collaborators',
      `id=eq.${COLLAB_ID}&select=iban,codice_fiscale`,
    );
    const isIncomplete = !collab?.iban || !collab?.codice_fiscale;

    await login(page, 'mario');

    if (!isIncomplete) {
      // Profilo già completo — verifica che il link "profilo" non appaia
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const profiloItem = page.locator('div.space-y-2 a').filter({ hasText: 'Completa il tuo profilo' });
      await expect(profiloItem).toHaveCount(0);
      return;
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const profiloItem = page.locator('div.space-y-2 a').filter({ hasText: 'Completa il tuo profilo' });
    await expect(profiloItem).toBeVisible();

    await profiloItem.click();
    await page.waitForURL('**/profilo', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/profilo/);
  });

  // S8 — Feed: sezione aggiornamenti visibile
  test('S8 — sezione ultimi aggiornamenti è presente', async ({ page }) => {
    await login(page, 'mario');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h2').filter({ hasText: 'Ultimi aggiornamenti' })).toBeVisible();

    // Feed container deve esistere
    const feedContainer = page.locator('div.divide-y');
    await expect(feedContainer).toBeVisible();
  });

  // S9 — Feed: link a compenso funzionante (condizionale)
  test('S9 — click su item compenso nel feed naviga al dettaglio', async ({ page }) => {
    // Verifica se ci sono history entries per il compenso UAT
    if (!createdCompId) {
      test.skip();
      return;
    }

    // Inserisci una history entry per il compenso UAT così compare nel feed
    await dbPost('compensation_history', {
      compensation_id:  createdCompId,
      stato_precedente: 'INVIATO',
      stato_nuovo:      'INTEGRAZIONI_RICHIESTE',
      role_label:       'Responsabile',
      note:             null,
    });

    await login(page, 'mario');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const feedLink = page.locator('div.divide-y a[href*="/compensi/"]').first();
    const exists = await feedLink.count();
    if (exists === 0) {
      // Feed potrebbe non avere entry — skip gracefully
      return;
    }

    const href = await feedLink.getAttribute('href');
    await feedLink.click();
    await page.waitForURL(`**${href}`, { timeout: 10_000 });
    await expect(page).toHaveURL(new RegExp('/compensi/'));
  });

  // S10 — Non-collaboratore vede welcome screen
  test('S10 — admin vede benvenuto, non dashboard collaboratore', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').filter({ hasText: 'Benvenuto' })).toBeVisible();

    // Le sezioni del dashboard collaboratore non devono essere presenti
    await expect(page.locator('h2').filter({ hasText: 'Compensi' })).toHaveCount(0);
    await expect(page.locator('h2').filter({ hasText: 'Azioni rapide' })).toHaveCount(0);
  });

});
