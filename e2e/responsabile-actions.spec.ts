/**
 * UAT — Responsabile: reject_manager + can_publish_announcements
 * Scenari S1–S10
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - responsabile_compensi@test.com (responsabile, community Testbusters + Peer4Med)
 *   - admin@test.com (amministrazione)
 *   - collaboratore@test.com (collaboratore, collab_id canonico)
 *   - Migration 011_responsabile_publish_permission.sql applicata
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
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
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

async function dbPatch(table: string, filter: string, body: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
}

// ── Login helper ──────────────────────────────────────────────────────────────
const CREDS = {
  responsabile:  { email: 'responsabile_compensi@test.com',  password: 'Testbusters123' },
  admin:         { email: 'admin@test.com', password: 'Testbusters123' },
  collaboratore: { email: 'collaboratore@test.com', password: 'Testbusters123' },
};

async function loginAs(page: Page, role: keyof typeof CREDS): Promise<void> {
  const { email, password } = CREDS[role];
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });
}

// ── Constants ─────────────────────────────────────────────────────────────────
const COLLAB_ID    = '3a55c2da-4906-42d7-81e1-c7c7b399ab4b';
const COMMUNITY_ID = '6a5aeb11-d4bc-4575-84ad-9c343ea95bbf'; // Testbusters

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Responsabile actions UAT', () => {
  // IDs creati nel beforeAll
  let compInviatoId          = '';
  let compIntegrazioniId     = '';
  let compPreApprovatoId     = '';
  let expInviatoId           = '';
  let expPreApprovatoId      = '';
  let compCollabInviatoId    = '';
  let respUserId             = '';
  let origCanPublish: boolean | null = null;

  // ── Setup ────────────────────────────────────────────────────────────────
  test.beforeAll(async () => {
    // Resolve responsabile user_id
    const respProfile = await dbFirst<{ user_id: string }>(
      'user_profiles',
      'role=eq.responsabile_compensi&is_active=eq.true&select=user_id',
    );
    respUserId = respProfile?.user_id ?? '';

    // Save original can_publish_announcements
    if (respUserId) {
      const up = await dbFirst<{ can_publish_announcements: boolean }>(
        'user_profiles',
        `user_id=eq.${respUserId}&select=can_publish_announcements`,
      );
      origCanPublish = up?.can_publish_announcements ?? true;
    }

    // Compensation in INVIATO (S1: reject from INVIATO)
    const c1 = await dbInsert('compensations', {
      collaborator_id:     COLLAB_ID,
      community_id:        COMMUNITY_ID,
      tipo:                'OCCASIONALE',
      descrizione:         '[UAT] reject INVIATO',
      periodo_riferimento: '[UAT] reject INVIATO',
      importo_lordo:       11,
      importo_netto:       11,
      stato:               'INVIATO',
    });
    compInviatoId = c1.id as string;

    // Compensation in INTEGRAZIONI_RICHIESTE (S2: reject from INTEGRAZIONI)
    const c2 = await dbInsert('compensations', {
      collaborator_id:     COLLAB_ID,
      community_id:        COMMUNITY_ID,
      tipo:                'OCCASIONALE',
      descrizione:         '[UAT] reject INTEGRAZIONI',
      periodo_riferimento: '[UAT] reject INTEGRAZIONI',
      importo_lordo:       12,
      importo_netto:       12,
      stato:               'INTEGRAZIONI_RICHIESTE',
    });
    compIntegrazioniId = c2.id as string;

    // Compensation in PRE_APPROVATO_RESP (S3: no Rifiuta button)
    const c3 = await dbInsert('compensations', {
      collaborator_id:     COLLAB_ID,
      community_id:        COMMUNITY_ID,
      tipo:                'OCCASIONALE',
      descrizione:         '[UAT] PRE_APPROVATO no rifiuta',
      periodo_riferimento: '[UAT] PRE_APPROVATO no rifiuta',
      importo_lordo:       13,
      importo_netto:       13,
      stato:               'PRE_APPROVATO_RESP',
    });
    compPreApprovatoId = c3.id as string;

    // Expense in INVIATO (S4: reject expense from INVIATO)
    const e1 = await dbInsert('expense_reimbursements', {
      collaborator_id: COLLAB_ID,
      categoria:       'Formazione',
      data_spesa:      '2026-01-31',
      importo:         11.11,
      descrizione:     '[UAT] reject rimborso INVIATO',
      stato:           'INVIATO',
    });
    expInviatoId = e1.id as string;

    // Expense in PRE_APPROVATO_RESP (S5: no Rifiuta button)
    const e2 = await dbInsert('expense_reimbursements', {
      collaborator_id: COLLAB_ID,
      categoria:       'Formazione',
      data_spesa:      '2026-01-31',
      importo:         13.13,
      descrizione:     '[UAT] PRE_APPROVATO rimborso no rifiuta',
      stato:           'PRE_APPROVATO_RESP',
    });
    expPreApprovatoId = e2.id as string;

    // Compensation in INVIATO for collaboratore RBAC check (S10)
    const c4 = await dbInsert('compensations', {
      collaborator_id:     COLLAB_ID,
      community_id:        COMMUNITY_ID,
      tipo:                'OCCASIONALE',
      descrizione:         '[UAT] collab no rifiuta',
      periodo_riferimento: '[UAT] collab no rifiuta',
      importo_lordo:       14,
      importo_netto:       14,
      stato:               'INVIATO',
    });
    compCollabInviatoId = c4.id as string;

    console.log(`  ℹ️  respUserId: ${respUserId}`);
    console.log(`  ℹ️  origCanPublish: ${origCanPublish}`);
    console.log(`  ℹ️  compInviatoId: ${compInviatoId}`);
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    const compIds = [compInviatoId, compIntegrazioniId, compPreApprovatoId, compCollabInviatoId];
    for (const id of compIds.filter(Boolean)) {
      await dbDelete('compensation_history', `compensation_id=eq.${id}`);
      await dbDelete('compensations', `id=eq.${id}`);
    }
    const expIds = [expInviatoId, expPreApprovatoId];
    for (const id of expIds.filter(Boolean)) {
      await dbDelete('expense_history', `reimbursement_id=eq.${id}`);
      await dbDelete('expense_reimbursements', `id=eq.${id}`);
    }
    // Restore can_publish_announcements
    if (respUserId && origCanPublish !== null) {
      await dbPatch('user_profiles', `user_id=eq.${respUserId}`, {
        can_publish_announcements: origCanPublish,
      });
    }
    console.log('  ℹ️  afterAll cleanup done');
  });

  // ── S1: responsabile rifiuta compenso da INVIATO ──────────────────────────
  test('S1 — responsabile rifiuta compenso da INVIATO → RIFIUTATO', async ({ page }) => {
    await loginAs(page, 'responsabile');
    await page.goto(`/compensi/${compInviatoId}`);
    await page.waitForLoadState('networkidle');

    // Bottone "Rifiuta" visibile (variant danger = bg-red-700)
    const rejectBtn = page.locator('button.bg-red-700', { hasText: 'Rifiuta' });
    await expect(rejectBtn).toBeVisible({ timeout: 10_000 });

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(`/api/compensations/${compInviatoId}/transition`) && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      rejectBtn.click(),
    ]);

    // Verifica DB
    const comp = await dbFirst<{ stato: string }>('compensations', `id=eq.${compInviatoId}&select=stato`);
    expect(comp!.stato).toBe('RIFIUTATO');
    console.log('  ✅ S1 — compenso INVIATO rifiutato dal responsabile → RIFIUTATO');
  });

  // ── S2: responsabile rifiuta compenso da INTEGRAZIONI_RICHIESTE ───────────
  test('S2 — responsabile rifiuta compenso da INTEGRAZIONI_RICHIESTE → RIFIUTATO', async ({ page }) => {
    await loginAs(page, 'responsabile');
    await page.goto(`/compensi/${compIntegrazioniId}`);
    await page.waitForLoadState('networkidle');

    const rejectBtn = page.locator('button.bg-red-700', { hasText: 'Rifiuta' });
    await expect(rejectBtn).toBeVisible({ timeout: 10_000 });

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(`/api/compensations/${compIntegrazioniId}/transition`) && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      rejectBtn.click(),
    ]);

    const comp = await dbFirst<{ stato: string }>('compensations', `id=eq.${compIntegrazioniId}&select=stato`);
    expect(comp!.stato).toBe('RIFIUTATO');
    console.log('  ✅ S2 — compenso INTEGRAZIONI_RICHIESTE rifiutato → RIFIUTATO');
  });

  // ── S3: responsabile NON vede Rifiuta da PRE_APPROVATO_RESP ───────────────
  test('S3 — responsabile non vede "Rifiuta" su compenso in PRE_APPROVATO_RESP', async ({ page }) => {
    await loginAs(page, 'responsabile');
    await page.goto(`/compensi/${compPreApprovatoId}`);
    await page.waitForLoadState('networkidle');

    // L'ActionPanel mostra solo le azioni consentite; Rifiuta non deve esserci
    const rejectBtn = page.locator('button.bg-red-700', { hasText: 'Rifiuta' });
    await expect(rejectBtn).not.toBeVisible({ timeout: 8_000 });
    console.log('  ✅ S3 — nessun bottone Rifiuta su PRE_APPROVATO_RESP');
  });

  // ── S4: responsabile rifiuta rimborso da INVIATO ──────────────────────────
  test('S4 — responsabile rifiuta rimborso da INVIATO → RIFIUTATO', async ({ page }) => {
    await loginAs(page, 'responsabile');
    await page.goto(`/rimborsi/${expInviatoId}`);
    await page.waitForLoadState('networkidle');

    const rejectBtn = page.locator('button.bg-red-700', { hasText: 'Rifiuta' });
    await expect(rejectBtn).toBeVisible({ timeout: 10_000 });

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(`/api/expenses/${expInviatoId}/transition`) && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      rejectBtn.click(),
    ]);

    const exp = await dbFirst<{ stato: string }>('expense_reimbursements', `id=eq.${expInviatoId}&select=stato`);
    expect(exp!.stato).toBe('RIFIUTATO');
    console.log('  ✅ S4 — rimborso INVIATO rifiutato dal responsabile → RIFIUTATO');
  });

  // ── S5: responsabile NON vede Rifiuta su rimborso PRE_APPROVATO_RESP ──────
  test('S5 — responsabile non vede "Rifiuta" su rimborso in PRE_APPROVATO_RESP', async ({ page }) => {
    await loginAs(page, 'responsabile');
    await page.goto(`/rimborsi/${expPreApprovatoId}`);
    await page.waitForLoadState('networkidle');

    const rejectBtn = page.locator('button.bg-red-700', { hasText: 'Rifiuta' });
    await expect(rejectBtn).not.toBeVisible({ timeout: 8_000 });
    console.log('  ✅ S5 — nessun bottone Rifiuta su rimborso PRE_APPROVATO_RESP');
  });

  // ── S6: admin disabilita can_publish_announcements per responsabile ────────
  test('S6 — admin disabilita pubblicazione annunci per responsabile, DB aggiornato', async ({ page }) => {
    if (!respUserId) {
      console.log('  ⚠️  S6 skipped: nessun responsabile attivo');
      return;
    }

    await loginAs(page, 'admin');
    await page.goto('/impostazioni?tab=community');
    await page.waitForLoadState('networkidle');

    const respSection = page.locator('div.rounded-2xl').filter({
      has: page.locator('h2:has-text("Community per responsabile")'),
    });
    await expect(respSection).toBeVisible({ timeout: 10_000 });

    // Prima riga responsabile (space-y-2)
    const firstRespRow = respSection.locator('div.space-y-2').first();
    await expect(firstRespRow).toBeVisible({ timeout: 8_000 });

    // Toggle attualmente ON (bg-blue-600): clicca per disabilitare
    const toggleBtn = firstRespRow.locator('button.rounded-full');
    await expect(toggleBtn).toBeVisible({ timeout: 8_000 });

    // Assicura che sia in stato ON prima di disabilitare
    const isOn = await toggleBtn.evaluate((el) => el.classList.contains('bg-blue-600'));
    if (!isOn) {
      // Già disabilitato — rimetti ON, poi disabilita, per assicurare stato coerente
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes('/publish-permission') && res.request().method() === 'PATCH',
          { timeout: 15_000 },
        ),
        toggleBtn.click(),
      ]);
      await page.waitForLoadState('networkidle');
    }

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/publish-permission') && res.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      firstRespRow.locator('button.rounded-full').click(),
    ]);

    await page.waitForLoadState('networkidle');

    const up = await dbFirst<{ can_publish_announcements: boolean }>(
      'user_profiles',
      `user_id=eq.${respUserId}&select=can_publish_announcements`,
    );
    expect(up!.can_publish_announcements).toBe(false);
    console.log('  ✅ S6 — can_publish_announcements impostato a false');
  });

  // ── S7: responsabile non vede form annunci quando disabilitato ─────────────
  test('S7 — responsabile non vede "+ Nuovo annuncio" quando disabilitato', async ({ page }) => {
    if (!respUserId) {
      console.log('  ⚠️  S7 skipped: nessun responsabile attivo');
      return;
    }

    // Verifica stato DB prima del test
    const up = await dbFirst<{ can_publish_announcements: boolean }>(
      'user_profiles',
      `user_id=eq.${respUserId}&select=can_publish_announcements`,
    );
    if (up!.can_publish_announcements !== false) {
      console.log('  ⚠️  S7 skipped: can_publish_announcements non è false (S6 non passato)');
      return;
    }

    await loginAs(page, 'responsabile');
    await page.goto('/contenuti?tab=bacheca');
    await page.waitForLoadState('networkidle');

    // Il bottone "+ Nuovo annuncio" non deve essere visibile
    const newBtn = page.locator('button', { hasText: '+ Nuovo annuncio' });
    await expect(newBtn).not.toBeVisible({ timeout: 8_000 });
    console.log('  ✅ S7 — "+ Nuovo annuncio" assente per responsabile disabilitato');
  });

  // ── S8: admin riabilita can_publish_announcements ─────────────────────────
  test('S8 — admin riabilita pubblicazione annunci, DB aggiornato', async ({ page }) => {
    if (!respUserId) {
      console.log('  ⚠️  S8 skipped: nessun responsabile attivo');
      return;
    }

    await loginAs(page, 'admin');
    await page.goto('/impostazioni?tab=community');
    await page.waitForLoadState('networkidle');

    const respSection = page.locator('div.rounded-2xl').filter({
      has: page.locator('h2:has-text("Community per responsabile")'),
    });
    const firstRespRow = respSection.locator('div.space-y-2').first();
    await expect(firstRespRow).toBeVisible({ timeout: 8_000 });

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/publish-permission') && res.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      firstRespRow.locator('button.rounded-full').click(),
    ]);

    await page.waitForLoadState('networkidle');

    const up = await dbFirst<{ can_publish_announcements: boolean }>(
      'user_profiles',
      `user_id=eq.${respUserId}&select=can_publish_announcements`,
    );
    expect(up!.can_publish_announcements).toBe(true);
    console.log('  ✅ S8 — can_publish_announcements ripristinato a true');
  });

  // ── S9: responsabile vede il form annunci quando riabilitato ──────────────
  test('S9 — responsabile vede "+ Nuovo annuncio" dopo riabilitazione', async ({ page }) => {
    if (!respUserId) {
      console.log('  ⚠️  S9 skipped: nessun responsabile attivo');
      return;
    }

    await loginAs(page, 'responsabile');
    await page.goto('/contenuti?tab=bacheca');
    await page.waitForLoadState('networkidle');

    const newBtn = page.locator('button', { hasText: '+ Nuovo annuncio' });
    await expect(newBtn).toBeVisible({ timeout: 8_000 });
    console.log('  ✅ S9 — "+ Nuovo annuncio" visibile per responsabile riabilitato');
  });

  // ── S10: collaboratore non vede "Rifiuta" su proprio compenso ─────────────
  test('S10 — collaboratore non vede "Rifiuta" su proprio compenso in INVIATO', async ({ page }) => {
    await loginAs(page, 'collaboratore');
    await page.goto(`/compensi/${compCollabInviatoId}`);
    await page.waitForLoadState('networkidle');

    // L'ActionPanel per collaboratore in INVIATO mostra solo "Ritira in bozza"
    const rejectBtn = page.locator('button.bg-red-700', { hasText: 'Rifiuta' });
    await expect(rejectBtn).not.toBeVisible({ timeout: 8_000 });
    console.log('  ✅ S10 — collaboratore non vede "Rifiuta" (RBAC corretto)');
  });
});
