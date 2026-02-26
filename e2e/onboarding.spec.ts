/**
 * UAT — Onboarding flow
 * Scenari S1–S10: admin invite, proxy redirect, wizard 2-step, contract generation,
 * responsabile flow, form validation, PIVA field
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - Utente admin: admin@test.com (amministrazione)
 *   - Template OCCASIONALE caricato (gestito in beforeAll)
 */

import { test, expect, type Browser, type Page } from '@playwright/test';
import PizZip from 'pizzip';

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

async function deleteAuthUser(userId: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}

async function createAuthUser(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const data = await res.json();
  return (data as Record<string, unknown>).id as string ?? null;
}

async function uploadToStorage(bucket: string, storagePath: string, buffer: Buffer, contentType: string) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${storagePath}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: new Uint8Array(buffer),
  });
}

// ── Login helpers ─────────────────────────────────────────────────────────────
const ADMIN_CREDS = { email: 'admin@test.com', password: 'Testbusters123' };

async function loginAdmin(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  if (!page.url().includes('/login')) {
    await page.click('button:has-text("Esci")');
    await page.waitForURL((u) => u.toString().includes('/login'), { timeout: 10_000 });
  }
  await page.fill('input[type="email"]', ADMIN_CREDS.email);
  await page.fill('input[type="password"]', ADMIN_CREDS.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });
}

async function loginAs(page: Page, email: string, password: string) {
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

// ── Minimal .docx factory ─────────────────────────────────────────────────────
function createMinimalDocx(): Buffer {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>',
  );
  zip.folder('_rels')!.file(
    '.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>',
  );
  zip.folder('word')!.file(
    'document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body>' +
    '<w:p><w:r><w:t>Contratto: {nome} {cognome}</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>CF: {codice_fiscale}</w:t></w:r></w:p>' +
    '</w:body>' +
    '</w:document>',
  );
  zip.folder('word/_rels')!.file(
    'document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '</Relationships>',
  );
  return zip.generate({ type: 'nodebuffer' });
}

// ── Test fixtures ─────────────────────────────────────────────────────────────
const FLOW_EMAIL        = 'uat-onboarding-flow@test.local';
const FLOW_INIT_PW      = 'FlowInit1!';
const FLOW_NEW_PW       = 'FlowNew2024!';
const PIVA_EMAIL        = 'uat-onboarding-piva@test.local';
const PIVA_PW           = 'PivaTest1!';
const ADMIN_S1_EMAIL    = 'uat-onboarding-s1@test.local';
const ADMIN_S8_EMAIL    = 'uat-onboarding-s8@test.local';

let flowUserId  = '';
let pivaUserId  = '';
let adminS1UserId = '';
let adminS8UserId = '';

// Shared page for sequential S2–S7 flow (persistent browser context)
let flowPage: Page;

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Onboarding flow UAT', () => {

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    const docxContentType =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const docxBuf = createMinimalDocx();

    // Upload OCCASIONALE template (shared with contratti.spec.ts — idempotent)
    await uploadToStorage('contracts', 'templates/occasionale.docx', docxBuf, docxContentType);
    await fetch(`${SUPABASE_URL}/rest/v1/contract_templates`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        tipo: 'OCCASIONALE',
        file_url: 'templates/occasionale.docx',
        file_name: 'template_occasionale.docx',
      }),
    });

    // Clean up any leftover test users from previous runs
    for (const email of [FLOW_EMAIL, PIVA_EMAIL, ADMIN_S1_EMAIL, ADMIN_S8_EMAIL]) {
      const row = await dbFirst<{ user_id: string }>(
        'collaborators',
        `email=eq.${encodeURIComponent(email)}&select=user_id`,
      );
      if (row?.user_id) await deleteAuthUser(row.user_id);
      // Also clean via user_profiles if collaborators record missing
      const profile = await dbFirst<{ user_id: string }>(
        'user_profiles',
        `select=user_id`,
      );
      void profile; // lookup is best-effort via collaborators
    }

    // Create FLOW user (collaboratore, tipo=OCCASIONALE, must change password)
    flowUserId = (await createAuthUser(FLOW_EMAIL, FLOW_INIT_PW)) ?? '';
    if (flowUserId) {
      await dbInsert('user_profiles', {
        user_id: flowUserId,
        role: 'collaboratore',
        is_active: true,
        must_change_password: true,
        onboarding_completed: false,
      });
      await dbInsert('collaborators', {
        user_id: flowUserId,
        email: FLOW_EMAIL,
        tipo_contratto: 'OCCASIONALE',
      });
    }

    // Create PIVA user (collaboratore, tipo=PIVA, no must_change_password)
    pivaUserId = (await createAuthUser(PIVA_EMAIL, PIVA_PW)) ?? '';
    if (pivaUserId) {
      await dbInsert('user_profiles', {
        user_id: pivaUserId,
        role: 'collaboratore',
        is_active: true,
        must_change_password: false,
        onboarding_completed: false,
      });
      await dbInsert('collaborators', {
        user_id: pivaUserId,
        email: PIVA_EMAIL,
        tipo_contratto: 'PIVA',
      });
    }

    // Shared page for S2–S7 flow
    flowPage = await browser.newPage();
  });

  test.afterAll(async () => {
    await flowPage.close().catch(() => {});
    for (const uid of [flowUserId, pivaUserId, adminS1UserId, adminS8UserId]) {
      if (uid) await deleteAuthUser(uid);
    }
  });

  // ── S1 — Admin crea collaboratore via UI, onboarding_completed=false ──────
  test('S1 — admin crea collaboratore con tipo OCCASIONALE, record DB corretto', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/impostazioni?tab=utenti');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', ADMIN_S1_EMAIL);
    // Role is collaboratore by default — select tipo OCCASIONALE
    await page.locator('select').nth(1).selectOption('OCCASIONALE');

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/admin/create-user') && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      page.click('button[type="submit"]'),
    ]);
    expect(res.status()).toBe(200);
    await expect(page.locator('span.text-green-400')).toBeVisible({ timeout: 8_000 });

    // DB: onboarding_completed=false, tipo_contratto=OCCASIONALE
    const collab = await dbFirst<{ user_id: string; tipo_contratto: string }>(
      'collaborators',
      `email=eq.${encodeURIComponent(ADMIN_S1_EMAIL)}&select=user_id,tipo_contratto`,
    );
    expect(collab).not.toBeNull();
    expect(collab!.tipo_contratto).toBe('OCCASIONALE');

    adminS1UserId = collab!.user_id;
    const profile = await dbFirst<{ onboarding_completed: boolean }>(
      'user_profiles',
      `user_id=eq.${adminS1UserId}&select=onboarding_completed`,
    );
    expect(profile?.onboarding_completed).toBe(false);
  });

  // ── S2 — Primo login: cambio password → redirect /onboarding ─────────────
  test('S2 — primo login: cambio password → redirect a /onboarding', async () => {
    await loginAs(flowPage, FLOW_EMAIL, FLOW_INIT_PW);
    // Proxy redirects to /change-password (must_change_password=true)
    await flowPage.waitForURL((u) => u.toString().includes('/change-password'), { timeout: 15_000 });

    await flowPage.fill('input[placeholder="Minimo 8 caratteri"]', FLOW_NEW_PW);
    await flowPage.fill('input[placeholder="Ripeti la nuova password"]', FLOW_NEW_PW);

    const [resp] = await Promise.all([
      flowPage.waitForResponse(
        (r) => r.url().includes('/api/auth/change-password') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      flowPage.click('button[type="submit"]'),
    ]);
    expect(resp.status()).toBe(200);

    // After re-sign-in and router.push('/'), proxy redirects to /onboarding
    await flowPage.waitForURL((u) => u.toString().includes('/onboarding'), { timeout: 15_000 });
    await expect(flowPage.locator('h1').filter({ hasText: 'Benvenuto' })).toBeVisible();
  });

  // ── S3 — Proxy blocca accesso a / durante onboarding ─────────────────────
  test('S3 — navigazione a / redirige a /onboarding', async () => {
    await flowPage.goto('/');
    await flowPage.waitForURL((u) => u.toString().includes('/onboarding'), { timeout: 10_000 });
    await expect(flowPage.locator('h1').filter({ hasText: 'Benvenuto' })).toBeVisible();
  });

  // ── S4 — Compila step 1 → avanza a step 2 ────────────────────────────────
  test('S4 — compila dati anagrafici e avanza a step 2', async () => {
    // Ensure we're on /onboarding
    if (!flowPage.url().includes('/onboarding')) {
      await flowPage.goto('/onboarding');
      await flowPage.waitForLoadState('networkidle');
    }

    // Step 1 form
    await flowPage.fill('input[placeholder="Mario"]', 'Onboarding');
    await flowPage.fill('input[placeholder="Rossi"]', 'TestUser');
    await flowPage.fill('input[placeholder="RSSMRA80A01H501U"]', 'TSTBRD90A01H501X');
    await flowPage.fill('input[type="date"]', '1990-01-01');
    await flowPage.fill('input[placeholder="Roma (RM)"]', 'Torino (TO)');
    await flowPage.fill('input[placeholder="Milano"]', 'Torino');
    await flowPage.fill('input[placeholder="Via Roma 1, Milano"]', 'Via Po 1, Torino');
    await flowPage.fill('input[placeholder="+39 333 0000000"]', '+39 333 1234567');
    await flowPage.fill('input[placeholder="IT60 X054 2811 1010 0000 0123 456"]', 'IT60X0542811101000000123456');
    await flowPage.locator('select').selectOption('M');

    await flowPage.click('button[type="submit"]');
    await flowPage.waitForTimeout(400);

    // Step 2 should be visible — tipo contratto shown
    await expect(flowPage.locator('p', { hasText: 'Prestazione occasionale' })).toBeVisible({ timeout: 5_000 });
    await expect(flowPage.locator('button', { hasText: 'Genera e scarica contratto' })).toBeVisible();
  });

  // ── S5 — Genera contratto → documento in DB, onboarding_completed=true ───
  test('S5 — genera contratto: documento DA_FIRMARE in DB, onboarding completato', async () => {
    const [resp] = await Promise.all([
      flowPage.waitForResponse(
        (r) => r.url().includes('/api/onboarding/complete') && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      flowPage.click('button:has-text("Genera e scarica contratto")'),
    ]);
    expect(resp.status()).toBe(200);

    // Success state visible
    await expect(flowPage.locator('span.text-green-400', { hasText: 'Contratto generato' })).toBeVisible({ timeout: 8_000 });
    await expect(flowPage.locator('button', { hasText: 'Scarica contratto' })).toBeVisible();
    await expect(flowPage.locator('button', { hasText: 'Ho scaricato il contratto' })).toBeVisible();

    // DB: document created with DA_FIRMARE
    await flowPage.waitForTimeout(300);
    const collab = await dbFirst<{ id: string }>(
      'collaborators',
      `user_id=eq.${flowUserId}&select=id`,
    );
    expect(collab).not.toBeNull();

    const docs = await dbGet<{ stato_firma: string; tipo: string }>(
      'documents',
      `collaborator_id=eq.${collab!.id}&tipo=eq.CONTRATTO_OCCASIONALE&select=stato_firma,tipo`,
    );
    expect(docs.length).toBe(1);
    expect(docs[0].stato_firma).toBe('DA_FIRMARE');

    // DB: onboarding_completed=true
    const profile = await dbFirst<{ onboarding_completed: boolean }>(
      'user_profiles',
      `user_id=eq.${flowUserId}&select=onboarding_completed`,
    );
    expect(profile?.onboarding_completed).toBe(true);
  });

  // ── S6 — Clicca "Ho scaricato" → redirect a Dashboard ────────────────────
  test('S6 — click "Ho scaricato il contratto" → accede alla dashboard', async () => {
    await flowPage.click('button:has-text("Ho scaricato il contratto")');
    await flowPage.waitForURL((u) => !u.toString().includes('/onboarding'), { timeout: 10_000 });
    // Should be at / (dashboard)
    expect(flowPage.url()).toMatch(/\/$/);
  });

  // ── S7 — /onboarding non accessibile dopo completamento ──────────────────
  test('S7 — /onboarding dopo completamento redirige a /', async () => {
    await flowPage.goto('/onboarding');
    await flowPage.waitForURL((u) => !u.toString().includes('/onboarding'), { timeout: 10_000 });
    expect(flowPage.url()).toMatch(/\/$/);
  });

  // ── S8 — Admin crea responsabile con tipo COCOCO ──────────────────────────
  test('S8 — admin crea responsabile con tipo COCOCO, DB corretto', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/impostazioni?tab=utenti');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', ADMIN_S8_EMAIL);
    // Change role to responsabile
    await page.locator('select').nth(0).selectOption('responsabile_compensi');
    await page.waitForTimeout(300);
    // Select tipo COCOCO
    await page.locator('select').nth(1).selectOption('COCOCO');

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/admin/create-user') && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      page.click('button[type="submit"]'),
    ]);
    expect(res.status()).toBe(200);
    await expect(page.locator('span.text-green-400')).toBeVisible({ timeout: 8_000 });

    const collab = await dbFirst<{ user_id: string; tipo_contratto: string }>(
      'collaborators',
      `email=eq.${encodeURIComponent(ADMIN_S8_EMAIL)}&select=user_id,tipo_contratto`,
    );
    expect(collab).not.toBeNull();
    expect(collab!.tipo_contratto).toBe('COCOCO');
    adminS8UserId = collab!.user_id;

    const profile = await dbFirst<{ onboarding_completed: boolean; role: string }>(
      'user_profiles',
      `user_id=eq.${adminS8UserId}&select=onboarding_completed,role`,
    );
    expect(profile?.role).toBe('responsabile_compensi');
    expect(profile?.onboarding_completed).toBe(false);
  });

  // ── S9 — Form: submit disabilitato senza tipo rapporto ───────────────────
  test('S9 — submit disabilitato se tipo rapporto non selezionato', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/impostazioni?tab=utenti');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', 'no-tipo@test.local');
    // Role = collaboratore (default) — tipo is empty → button disabled
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();

    // Select tipo → button becomes enabled
    await page.locator('select').nth(1).selectOption('PIVA');
    await expect(submitBtn).not.toBeDisabled();
  });

  // ── S10 — Onboarding PIVA: campo Partita IVA visibile e obbligatorio ──────
  test('S10 — wizard onboarding tipo PIVA mostra campo Partita IVA obbligatorio', async ({ page }) => {
    // pivaUser has must_change_password=false and onboarding_completed=false
    // → proxy sends directly to /onboarding
    await loginAs(page, PIVA_EMAIL, PIVA_PW);
    await page.waitForURL((u) => u.toString().includes('/onboarding'), { timeout: 15_000 });

    // P.IVA field should be visible
    await expect(page.locator('input[placeholder="12345678901"]')).toBeVisible({ timeout: 5_000 });

    // Verify that without P.IVA, the form button is disabled even with all other fields filled
    await page.fill('input[placeholder="Mario"]', 'PivaUser');
    await page.fill('input[placeholder="Rossi"]', 'Test');
    await page.fill('input[placeholder="RSSMRA80A01H501U"]', 'PVTST90A01H501X');
    await page.fill('input[type="date"]', '1990-01-01');
    await page.fill('input[placeholder="Roma (RM)"]', 'Roma (RM)');
    await page.fill('input[placeholder="Milano"]', 'Roma');
    await page.fill('input[placeholder="Via Roma 1, Milano"]', 'Via Appia 1');
    await page.fill('input[placeholder="+39 333 0000000"]', '+39 333 9999999');
    await page.fill('input[placeholder="IT60 X054 2811 1010 0000 0123 456"]', 'IT60X0542811101000000999999');
    await page.locator('select').selectOption('L');
    // P.IVA still empty → button should be disabled
    await expect(page.locator('button[type="submit"]')).toBeDisabled();

    // Fill P.IVA → button enabled
    await page.fill('input[placeholder="12345678901"]', '12345678901');
    await expect(page.locator('button[type="submit"]')).not.toBeDisabled();
  });

});
