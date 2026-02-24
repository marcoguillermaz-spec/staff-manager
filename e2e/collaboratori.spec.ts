/**
 * UAT — Collaboratori (responsabile)
 * Scenari S1–S10: lista paginata, filtri, dettaglio, azioni inline, RBAC
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - responsabile@test.com (responsabile) — community Testbusters + Peer4Med
 *   - admin-test@example.com (amministrazione)
 *   - collaboratore@test.com (collaboratore)
 *   - Collab canonico 3a55c2da (Collaboratore Test) in Testbusters + Peer4Med
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
// Collab canonico (Collaboratore Test) nelle community del responsabile
const COLLAB_ID     = '3a55c2da-4906-42d7-81e1-c7c7b399ab4b';
const COMMUNITY_ID  = '6a5aeb11-d4bc-4575-84ad-9c343ea95bbf'; // Testbusters
// Record collaborator del responsabile stesso (non è in collaborator_communities → fuori perimetro)
const RESP_COLLAB_ID = '95ebbfdd-c38f-4686-a731-b19afde6bca3';

const CREDS = {
  responsabile: { email: 'responsabile@test.com', password: 'Testbusters123' },
  admin:        { email: 'admin-test@example.com', password: 'Testbusters123' },
  collaboratore:{ email: 'collaboratore@test.com', password: 'Testbusters123' },
};

// ── Login helper ──────────────────────────────────────────────────────────────
// Usa { page } fixture → contesto fresco per ogni test, nessun sign-out necessario
async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });
}

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Collaboratori UAT', () => {
  let testCompId  = '';
  let testExpId   = '';
  let testDocId   = '';

  // ── Setup ─────────────────────────────────────────────────────────────────
  test.beforeAll(async () => {
    // Compensation in INVIATO: periodo unico "Test UAT Collaboratori"
    const comp = await dbInsert('compensations', {
      collaborator_id:    COLLAB_ID,
      community_id:       COMMUNITY_ID,
      tipo:               'OCCASIONALE',
      descrizione:        'Test UAT Collaboratori',
      periodo_riferimento:'Test UAT Collaboratori',
      importo_lordo:      77,
      importo_netto:      77,
      stato:              'INVIATO',
    });
    testCompId = comp.id as string;

    // Expense in INVIATO: importo unico 99.87
    const exp = await dbInsert('expense_reimbursements', {
      collaborator_id: COLLAB_ID,
      categoria:       'Formazione',
      data_spesa:      '2026-01-31',
      importo:         99.87,
      descrizione:     'Test UAT Collaboratori',
      stato:           'INVIATO',
    });
    testExpId = exp.id as string;

    // Document in DA_FIRMARE
    const doc = await dbInsert('documents', {
      collaborator_id:    COLLAB_ID,
      community_id:       COMMUNITY_ID,
      tipo:               'RICEVUTA_PAGAMENTO',
      titolo:             'Test UAT Documento Collaboratori',
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

  // ── S1 — Lista collaboratori nelle community del responsabile ──────────────
  test('S1 — responsabile vede solo i collaboratori nelle proprie community', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto('/collaboratori');
    await page.waitForLoadState('networkidle');

    // Collab canonico visibile
    await expect(page.locator(`a[href="/collaboratori/${COLLAB_ID}"]`)).toBeVisible({ timeout: 8_000 });

    // Il filtro attivo è "Tutti"
    await expect(page.locator('a.bg-blue-600').filter({ hasText: 'Tutti' })).toBeVisible();

    // Titolo e sottotitolo corretti
    await expect(page.locator('h1', { hasText: 'Collaboratori' })).toBeVisible();
    await expect(page.locator('text=community a te assegnate')).toBeVisible();
  });

  // ── S2 — Filtro "Doc da firmare" ───────────────────────────────────────────
  test('S2 — filtro "Doc da firmare" mostra il collaboratore con documento DA_FIRMARE', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto('/collaboratori?filter=documenti&page=1');
    await page.waitForLoadState('networkidle');

    // Chip filtro attivo
    await expect(page.locator('a.bg-blue-600').filter({ hasText: 'Doc da firmare' })).toBeVisible({ timeout: 8_000 });

    // Collab canonico presente (ha il documento DA_FIRMARE creato in beforeAll)
    await expect(page.locator(`a[href="/collaboratori/${COLLAB_ID}"]`)).toBeVisible();
  });

  // ── S3 — Filtro "Pagamenti in sospeso" ────────────────────────────────────
  test('S3 — filtro "Pagamenti in sospeso" mostra il collaboratore con compenso INVIATO', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto('/collaboratori?filter=stallo&page=1');
    await page.waitForLoadState('networkidle');

    // Chip filtro attivo
    await expect(page.locator('a.bg-blue-600').filter({ hasText: 'Pagamenti in sospeso' })).toBeVisible({ timeout: 8_000 });

    // Collab canonico presente (ha compenso INVIATO)
    await expect(page.locator(`a[href="/collaboratori/${COLLAB_ID}"]`)).toBeVisible();
  });

  // ── S4 — Accesso al dettaglio collaboratore ────────────────────────────────
  test('S4 — dettaglio collaboratore mostra anagrafica e sezioni', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto(`/collaboratori/${COLLAB_ID}`);
    await page.waitForLoadState('networkidle');

    // Nome nel header
    await expect(page.locator('h1').filter({ hasText: 'Test' })).toBeVisible({ timeout: 8_000 });

    // Back link (← Torna alla lista)
    await expect(page.locator('a[href="/collaboratori"]').first()).toBeVisible();

    // Sezioni presenti
    await expect(page.locator('h2', { hasText: 'Compensi' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Rimborsi' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Documenti' })).toBeVisible();
  });

  // ── S5 — Bottoni azione visibili su compenso INVIATO ──────────────────────
  test('S5 — dettaglio: bottoni Pre-approva e Integrazioni su riga compenso INVIATO', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto(`/collaboratori/${COLLAB_ID}`);
    await page.waitForLoadState('networkidle');

    // Riga del test compensation (periodo = "Test UAT Collaboratori")
    const testRow = page.locator('tr').filter({ hasText: 'Test UAT Collaboratori' }).first();
    await expect(testRow).toBeVisible({ timeout: 8_000 });
    await expect(testRow.locator('button.bg-green-700')).toBeVisible();
    await expect(testRow.locator('button.bg-yellow-700')).toBeVisible();
  });

  // ── S6 — Pre-approva compenso, verifica DB ────────────────────────────────
  test('S6 — pre-approva compenso: stato DB diventa PRE_APPROVATO_RESP', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto(`/collaboratori/${COLLAB_ID}`);
    await page.waitForLoadState('networkidle');

    const testRow = page.locator('tr').filter({ hasText: 'Test UAT Collaboratori' }).first();
    await expect(testRow.locator('button.bg-green-700')).toBeVisible({ timeout: 8_000 });

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/compensations/${testCompId}/transition`) &&
          r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      testRow.locator('button.bg-green-700').click(),
    ]);
    expect(res.status()).toBe(200);

    // Verifica DB
    const comp = await dbFirst<{ stato: string }>('compensations', `id=eq.${testCompId}&select=stato`);
    expect(comp?.stato).toBe('PRE_APPROVATO_RESP');
  });

  // ── S7 — Richiedi integrazioni su rimborso (validazione + submit) ──────────
  test('S7 — integrazioni rimborso: validazione nota corta, poi submit OK', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto(`/collaboratori/${COLLAB_ID}`);
    await page.waitForLoadState('networkidle');

    // Riga test expense (importo 99,87)
    const testRow = page.locator('tr').filter({ hasText: '99,87' }).first();
    await expect(testRow).toBeVisible({ timeout: 8_000 });
    await expect(testRow.locator('button.bg-yellow-700')).toBeVisible();

    await testRow.locator('button.bg-yellow-700').click();

    // Modale visibile
    await expect(page.locator('h3', { hasText: 'Richiedi integrazioni' })).toBeVisible({ timeout: 5_000 });

    // Nota troppo corta → bottone Richiedi disabilitato
    await page.fill('textarea', 'troppo corto');
    await expect(page.locator('button.bg-yellow-600')).toBeDisabled();

    // Nota valida (≥20 char) → bottone abilitato
    await page.fill('textarea', 'Nota sufficientemente lunga per validazione UAT rimborso');

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/expenses/${testExpId}/transition`) &&
          r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.locator('button.bg-yellow-600').click(),
    ]);
    expect(res.status()).toBe(200);

    // Verifica DB
    const exp = await dbFirst<{ stato: string }>('expense_reimbursements', `id=eq.${testExpId}&select=stato`);
    expect(exp?.stato).toBe('INTEGRAZIONI_RICHIESTE');
  });

  // ── S8 — Accesso a collaboratore fuori community → redirect ───────────────
  test('S8 — responsabile su collab fuori community viene rediretto a /collaboratori', async ({ page }) => {
    await loginAs(page, CREDS.responsabile.email, CREDS.responsabile.password);
    await page.goto(`/collaboratori/${RESP_COLLAB_ID}`);
    await page.waitForURL((u) => u.toString().endsWith('/collaboratori'), { timeout: 10_000 });
    await expect(page.locator('h1', { hasText: 'Collaboratori' })).toBeVisible();
  });

  // ── S9 — Admin vede tutti i collaboratori (nessun filtro community) ─────────
  test('S9 — admin vede tutti i collaboratori senza filtro community', async ({ page }) => {
    await loginAs(page, CREDS.admin.email, CREDS.admin.password);
    await page.goto('/collaboratori');
    await page.waitForLoadState('networkidle');

    // Sottotitolo per admin
    await expect(page.locator('text=Tutti i collaboratori')).toBeVisible({ timeout: 8_000 });

    // Il collab canonico è visibile
    await expect(page.locator(`a[href="/collaboratori/${COLLAB_ID}"]`)).toBeVisible();
  });

  // ── S10 — Collaboratore reindirizzato a / ─────────────────────────────────
  test('S10 — collaboratore che accede a /collaboratori viene reindirizzato a /', async ({ page }) => {
    await loginAs(page, CREDS.collaboratore.email, CREDS.collaboratore.password);
    await page.goto('/collaboratori');
    await page.waitForURL((u) => u.toString().endsWith('/'), { timeout: 10_000 });
    // Non mostra la pagina collaboratori
    await expect(page.locator('h1', { hasText: 'Collaboratori' })).not.toBeVisible();
  });

});
