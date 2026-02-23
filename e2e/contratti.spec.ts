/**
 * UAT — Template contratti + Onboarding automatizzato + campi CoCoCo
 * Scenari S1–S10: tab contratti, upload template, crea utente + nuovi campi DB,
 * onboarding COCOCO → contratto generato, profilo editing con province e civico
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - Utenti test: collaboratore@test.com (collaboratore), admin-test@example.com (amministrazione)
 */

import { test, expect, type Page } from '@playwright/test';
import PizZip from 'pizzip';
import fs from 'fs';
import os from 'os';
import path from 'path';

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
    },
    body: JSON.stringify(body),
  });
}

async function deleteAuthUser(userId: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
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

// Create a test user directly via Supabase admin API (bypasses UI form)
async function createDbUser(
  email: string,
  password: string,
  tipoContratto: 'COCOCO' | 'OCCASIONALE' | 'PIVA',
): Promise<string | null> {
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const authData = await authRes.json();
  const userId = authData.id ?? authData.user?.id;
  if (!userId) return null;

  await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      role: 'collaboratore',
      is_active: true,
      must_change_password: false,
      onboarding_completed: false,
    }),
  });

  await fetch(`${SUPABASE_URL}/rest/v1/collaborators`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, email, tipo_contratto: tipoContratto }),
  });

  return userId;
}

// ── Login helpers ─────────────────────────────────────────────────────────────
const CREDS = {
  collaboratore: { email: 'collaboratore@test.com',   password: 'Testbusters123' },
  admin:         { email: 'admin-test@example.com',   password: 'Testbusters123' },
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
function createMinimalDocx(tipo = 'occasionale'): Buffer {
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
    '<w:p><w:r><w:t>Contratto ' + tipo + ': {nome} {cognome}</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>CF: {codice_fiscale} - Luogo: {luogo_nascita}, {comune}</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Compenso: {compenso_lordo} - Dal {data_inizio} al {data_fine}</w:t></w:r></w:p>' +
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

function createMinimalDocxCococo(): Buffer {
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
    '<w:p><w:r><w:t>Contratto CoCoCo: {nome} {cognome}</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Nato a: {citta_nascita} ({provincia_nascita}) il {data_di_nascita}</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>CF: {codice_fiscale}</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Residente: {indirizzo_residenza} {civico_residenza}, {citta_residenza} ({provincia_residenza})</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Importo: {importo_euro}</w:t></w:r></w:p>' +
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

// ── Fixtures ──────────────────────────────────────────────────────────────────
const COLLAB_ID = '3a55c2da-4906-42d7-81e1-c7c7b399ab4b'; // collaboratore@test.com

const TEST_EMAILS = {
  s5:  'uat-contratti-s5@test.local',
  s6:  'uat-contratti-s6@test.local',
  s7:  'uat-contratti-s7@test.local',
};

// S7 onboarding test user uses a known password
const TEST_CREDS_S7 = { email: TEST_EMAILS.s7, password: 'TestPwd456@' };

let tmpDocxPath    = '';
let tmpPdfPath     = '';
let createdUserIds: string[] = [];

let collabOriginalProfile: {
  nome: string;
  cognome: string;
  luogo_nascita: string | null;
  provincia_nascita: string | null;
  comune: string | null;
  provincia_residenza: string | null;
  indirizzo: string | null;
  civico_residenza: string | null;
} | null = null;

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Template contratti + Onboarding UAT', () => {

  test.beforeAll(async () => {
    // Create temp test files
    const docxBuf = createMinimalDocx('occasionale');
    tmpDocxPath = path.join(os.tmpdir(), 'uat_template_occasionale.docx');
    fs.writeFileSync(tmpDocxPath, docxBuf);

    // Minimal "pdf" (just a text file with .pdf extension — tests API rejection)
    tmpPdfPath = path.join(os.tmpdir(), 'uat_test.pdf');
    fs.writeFileSync(tmpPdfPath, Buffer.from('%PDF-1.4 test file'));

    const docxContentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Pre-upload OCCASIONALE template
    await uploadToStorage('contracts', 'templates/occasionale.docx', docxBuf, docxContentType);

    // Pre-upload COCOCO template (minimal test version)
    const cococoBuf = createMinimalDocxCococo();
    await uploadToStorage('contracts', 'templates/cococo.docx', cococoBuf, docxContentType);

    // Upsert OCCASIONALE contract_templates record
    await fetch(`${SUPABASE_URL}/rest/v1/contract_templates`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ tipo: 'OCCASIONALE', file_url: 'templates/occasionale.docx', file_name: 'template_occasionale.docx' }),
    });

    // Upsert COCOCO contract_templates record
    await fetch(`${SUPABASE_URL}/rest/v1/contract_templates`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ tipo: 'COCOCO', file_url: 'templates/cococo.docx', file_name: 'template_cococo.docx' }),
    });

    // Delete any leftover test users from previous runs
    for (const email of Object.values(TEST_EMAILS)) {
      const row = await dbFirst<{ user_id: string }>('collaborators', `email=eq.${encodeURIComponent(email)}&select=user_id`);
      if (row?.user_id) await deleteAuthUser(row.user_id);
    }

    // Create S7 test user (COCOCO, onboarding not yet completed) programmatically
    const s7UserId = await createDbUser(TEST_CREDS_S7.email, TEST_CREDS_S7.password, 'COCOCO');
    if (s7UserId) createdUserIds.push(s7UserId);

    // Backup collaboratore's current profile (restored in afterAll)
    collabOriginalProfile = await dbFirst<{
      nome: string;
      cognome: string;
      luogo_nascita: string | null;
      provincia_nascita: string | null;
      comune: string | null;
      provincia_residenza: string | null;
      indirizzo: string | null;
      civico_residenza: string | null;
    }>(
      'collaborators',
      `id=eq.${COLLAB_ID}&select=nome,cognome,luogo_nascita,provincia_nascita,comune,provincia_residenza,indirizzo,civico_residenza`,
    );
  });

  test.afterAll(async () => {
    // Delete created test users
    for (const userId of createdUserIds) {
      await deleteAuthUser(userId);
    }

    // Restore collaboratore's profile
    if (collabOriginalProfile) {
      await dbPatch('collaborators', `id=eq.${COLLAB_ID}`, {
        nome:                collabOriginalProfile.nome,
        cognome:             collabOriginalProfile.cognome,
        luogo_nascita:       collabOriginalProfile.luogo_nascita,
        provincia_nascita:   collabOriginalProfile.provincia_nascita,
        comune:              collabOriginalProfile.comune,
        provincia_residenza: collabOriginalProfile.provincia_residenza,
        indirizzo:           collabOriginalProfile.indirizzo,
        civico_residenza:    collabOriginalProfile.civico_residenza,
      });
    }

    // Cleanup temp files
    if (fs.existsSync(tmpDocxPath)) fs.unlinkSync(tmpDocxPath);
    if (fs.existsSync(tmpPdfPath)) fs.unlinkSync(tmpPdfPath);
  });

  // S1 — Tab Contratti visibile
  test('S1 — admin accede al tab Contratti, 3 tipologie visibili', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=contratti');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('a[href="?tab=contratti"].bg-blue-600')).toBeVisible();

    // 3 tipologie
    await expect(page.locator('p.text-sm.font-medium').filter({ hasText: 'Prestazione occasionale' })).toBeVisible();
    await expect(page.locator('p.text-sm.font-medium').filter({ hasText: 'Collaborazione coordinata' })).toBeVisible();
    await expect(page.locator('p.text-sm.font-medium').filter({ hasText: 'Prestazione P.IVA' })).toBeVisible();
  });

  // S2 — Upload template .docx
  test('S2 — admin carica template .docx per OCCASIONALE', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=contratti');
    await page.waitForLoadState('networkidle');

    const ocasionaleCard = page.locator('div.rounded-xl').filter({
      has: page.locator('p.font-medium:has-text("Prestazione occasionale")'),
    });

    const fileInput = ocasionaleCard.locator('input[type="file"]');
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/contract-templates') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      fileInput.setInputFiles(tmpDocxPath),
    ]);

    expect(response.status()).toBe(200);
    await page.waitForLoadState('networkidle');

    await expect(ocasionaleCard.locator('p.text-gray-500.text-xs')).toBeVisible({ timeout: 5_000 });
    await expect(ocasionaleCard.locator('label', { hasText: 'Sostituisci' })).toBeVisible();
  });

  // S3 — Upload tipo non valido (.pdf → errore)
  test('S3 — upload .pdf mostra messaggio di errore', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=contratti');
    await page.waitForLoadState('networkidle');

    const pivaCard = page.locator('div.rounded-xl').filter({
      has: page.locator('p.font-medium:has-text("Prestazione P.IVA")'),
    });

    const fileInput = pivaCard.locator('input[type="file"]');
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/contract-templates') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      fileInput.setInputFiles(tmpPdfPath),
    ]);

    expect(response.status()).toBe(400);
    await expect(page.locator('div.text-red-400')).toBeVisible({ timeout: 5_000 });
  });

  // S4 — Segnaposto: verifica variabili OCCASIONALE e CoCoCo
  test('S4 — sezione segnaposto mostra variabili OCCASIONALE e CoCoCo', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=contratti');
    await page.waitForLoadState('networkidle');

    await page.locator('button').filter({ hasText: 'Segnaposto disponibili' }).click();
    await page.waitForTimeout(300);

    // Occasionale vars
    await expect(page.locator('code').filter({ hasText: '{nome}' }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('code').filter({ hasText: '{cognome}' }).first()).toBeVisible();
    await expect(page.locator('code').filter({ hasText: '{compenso_lordo}' }).first()).toBeVisible();
    // CoCoCo vars (added in this session)
    await expect(page.locator('code').filter({ hasText: '{citta_nascita}' }).first()).toBeVisible();
    await expect(page.locator('code').filter({ hasText: '{provincia_nascita}' }).first()).toBeVisible();
    await expect(page.locator('code').filter({ hasText: '{civico_residenza}' }).first()).toBeVisible();
  });

  // S5 — Crea collaboratore PIVA, nuovi campi provincia_nascita/residenza/civico in DB
  test('S5 — admin crea collaboratore PIVA, nuovi campi anagrafica salvati in DB', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=utenti');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', TEST_EMAILS.s5);
    // Select PIVA (tipo_contratto required for collaboratore)
    await page.locator('select').nth(1).selectOption('PIVA');

    // Fill anagrafica with new split fields
    await page.fill('input[placeholder="Mario"]',            'Uat');
    await page.fill('input[placeholder="Rossi"]',            'S5Test');
    await page.fill('input[placeholder="Roma"]',             'Roma');
    await page.fill('input[placeholder="RM"]',               'RM');
    await page.fill('input[placeholder="Milano"]',           'Roma');
    await page.fill('input[placeholder="MI"]',               'RM');
    await page.fill('input[placeholder="Via Roma"]',         'Via Test');
    await page.fill('input[placeholder="1"]',                '10');
    await page.fill('input[placeholder="+39 333 0000000"]',  '+39 333 0000001');

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/create-user') && res.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      page.click('button[type="submit"]'),
    ]);

    expect(response.status()).toBe(200);
    await expect(page.locator('span.text-green-400:has-text("Utente creato con successo")')).toBeVisible({ timeout: 8_000 });

    // DB verify: new fields stored correctly
    const collab = await dbFirst<{
      id: string;
      user_id: string;
      nome: string;
      cognome: string;
      provincia_nascita: string | null;
      provincia_residenza: string | null;
      civico_residenza: string | null;
    }>(
      'collaborators',
      `email=eq.${encodeURIComponent(TEST_EMAILS.s5)}&select=id,user_id,nome,cognome,provincia_nascita,provincia_residenza,civico_residenza`,
    );
    expect(collab).not.toBeNull();
    expect(collab!.nome).toBe('Uat');
    expect(collab!.cognome).toBe('S5Test');
    expect(collab!.provincia_nascita).toBe('RM');
    expect(collab!.provincia_residenza).toBe('RM');
    expect(collab!.civico_residenza).toBe('10');

    if (collab?.user_id) createdUserIds.push(collab.user_id);
  });

  // S6 — Crea collaboratore OCCASIONALE, nuovi campi in DB
  test('S6 — admin crea collaboratore OCCASIONALE, nuovi campi in DB', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=utenti');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', TEST_EMAILS.s6);
    await page.locator('select').nth(1).selectOption('OCCASIONALE');

    await page.fill('input[placeholder="Mario"]',            'Lucia');
    await page.fill('input[placeholder="Rossi"]',            'S6Test');
    await page.fill('input[placeholder="Roma"]',             'Torino');
    await page.fill('input[placeholder="RM"]',               'TO');
    await page.fill('input[placeholder="Milano"]',           'Torino');
    await page.fill('input[placeholder="MI"]',               'TO');
    await page.fill('input[placeholder="Via Roma"]',         'Via S6');
    await page.fill('input[placeholder="1"]',                '20');

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/create-user') && res.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      page.click('button[type="submit"]'),
    ]);

    expect(response.status()).toBe(200);
    await expect(page.locator('span.text-green-400:has-text("Utente creato con successo")')).toBeVisible({ timeout: 8_000 });

    const collab = await dbFirst<{
      id: string;
      user_id: string;
      nome: string;
      luogo_nascita: string | null;
      provincia_nascita: string | null;
      provincia_residenza: string | null;
      civico_residenza: string | null;
    }>(
      'collaborators',
      `email=eq.${encodeURIComponent(TEST_EMAILS.s6)}&select=id,user_id,nome,luogo_nascita,provincia_nascita,provincia_residenza,civico_residenza`,
    );
    expect(collab).not.toBeNull();
    expect(collab!.nome).toBe('Lucia');
    expect(collab!.luogo_nascita).toBe('Torino');
    expect(collab!.provincia_nascita).toBe('TO');
    expect(collab!.provincia_residenza).toBe('TO');
    expect(collab!.civico_residenza).toBe('20');

    if (collab?.user_id) createdUserIds.push(collab.user_id);
  });

  // S7 — Onboarding CoCoCo: wizard completo → CONTRATTO_COCOCO DA_FIRMARE in DB
  test('S7 — Onboarding CoCoCo: wizard step 1+2, documento CONTRATTO_COCOCO generato', async ({ page }) => {
    // Login as S7 user (created in beforeAll, must_change_password=false, onboarding_completed=false)
    await loginAs(page, TEST_CREDS_S7.email, TEST_CREDS_S7.password);

    // Proxy redirects to /onboarding (onboarding_completed=false)
    await page.waitForURL((u) => u.toString().includes('/onboarding'), { timeout: 20_000 });

    // ── Step 1: fill all required fields ─────────────────────────────────────
    // Identità
    await page.fill('input[placeholder="Mario"]',             'Pietro');
    await page.fill('input[placeholder="Rossi"]',             'S7Cococo');
    await page.fill('input[placeholder="RSSMRA80A01H501U"]',  'PTRS7T80A01H501U');
    await page.locator('input[type="date"]').first().fill('1980-01-01');
    await page.fill('input[placeholder="Roma"]',              'Roma');
    await page.fill('input[placeholder="RM"]',                'RM');

    // Residenza
    await page.fill('input[placeholder="Milano"]',            'Milano');
    await page.fill('input[placeholder="MI"]',                'MI');
    await page.fill('input[placeholder="Via Roma"]',          'Via Test');
    await page.fill('input[placeholder="1"]',                 '5');
    await page.fill('input[placeholder="+39 333 0000000"]',   '+39 333 1234567');

    // Pagamento e preferenze
    await page.fill('input[placeholder="IT60 X054 2811 1010 0000 0123 456"]', 'IT60X0542811101000000123456');
    await page.locator('select').selectOption('M');

    // Submit step 1
    const nextBtn = page.locator('button[type="submit"]').filter({ hasText: 'Avanti' });
    await expect(nextBtn).not.toBeDisabled({ timeout: 3_000 });
    await nextBtn.click();

    // ── Step 2: contratto ────────────────────────────────────────────────────
    await expect(page.locator('button').filter({ hasText: 'Genera e scarica contratto' })).toBeVisible({ timeout: 8_000 });

    const [genResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/onboarding/complete') && res.request().method() === 'POST',
        { timeout: 30_000 },
      ),
      page.locator('button').filter({ hasText: 'Genera e scarica contratto' }).click(),
    ]);

    expect(genResponse.status()).toBe(200);
    const genData = await genResponse.json();
    expect(genData.success).toBe(true);

    // "Contratto generato" success panel visible
    await expect(page.locator('span.text-green-400').filter({ hasText: 'Contratto generato' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button').filter({ hasText: 'Scarica contratto' })).toBeVisible();

    // DB check: CONTRATTO_COCOCO with DA_FIRMARE
    const s7Collab = await dbFirst<{ id: string }>(
      'collaborators',
      `email=eq.${encodeURIComponent(TEST_CREDS_S7.email)}&select=id`,
    );
    expect(s7Collab).not.toBeNull();

    await page.waitForTimeout(500);
    const docs = await dbGet<{ id: string; stato_firma: string; tipo: string }>(
      'documents',
      `collaborator_id=eq.${s7Collab!.id}&tipo=eq.CONTRATTO_COCOCO&select=id,stato_firma,tipo`,
    );
    expect(docs.length).toBe(1);
    expect(docs[0].stato_firma).toBe('DA_FIRMARE');
  });

  // S8 — Profilo: nuovi campi provincia_nascita, provincia_residenza, civico editabili
  test('S8 — collaboratore modifica luogo, province e civico nel profilo', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/profilo');
    await page.waitForLoadState('networkidle');

    await page.fill('input[placeholder="Mario"]',   'Mario Uat');
    await page.fill('input[placeholder="Rossi"]',   'Rossi Uat');
    await page.fill('input[placeholder="Roma"]',    'Torino');       // città di nascita
    await page.fill('input[placeholder="RM"]',      'TO');           // provincia di nascita
    await page.fill('input[placeholder="Milano"]',  'Torino');       // comune
    await page.fill('input[placeholder="MI"]',      'TO');           // provincia residenza
    await page.fill('input[placeholder="Via Roma"]','Via UAT 99');   // indirizzo
    await page.fill('input[placeholder="1"]',       '99');           // civico

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/profile') && res.request().method() === 'PATCH',
        { timeout: 10_000 },
      ),
      page.click('button[type="submit"]'),
    ]);

    expect(response.status()).toBe(200);
    await expect(page.locator('button:has-text("✓ Salvato")')).toBeVisible({ timeout: 5_000 });

    // DB verify: all new fields stored correctly
    const collab = await dbFirst<{
      nome: string;
      cognome: string;
      luogo_nascita: string | null;
      provincia_nascita: string | null;
      comune: string | null;
      provincia_residenza: string | null;
      indirizzo: string | null;
      civico_residenza: string | null;
    }>(
      'collaborators',
      `id=eq.${COLLAB_ID}&select=nome,cognome,luogo_nascita,provincia_nascita,comune,provincia_residenza,indirizzo,civico_residenza`,
    );
    expect(collab?.nome).toBe('Mario Uat');
    expect(collab?.cognome).toBe('Rossi Uat');
    expect(collab?.luogo_nascita).toBe('Torino');
    expect(collab?.provincia_nascita).toBe('TO');
    expect(collab?.comune).toBe('Torino');
    expect(collab?.provincia_residenza).toBe('TO');
    expect(collab?.indirizzo).toBe('Via UAT 99');
    expect(collab?.civico_residenza).toBe('99');
  });

  // S9 — Profilo: data_ingresso è read-only (no input)
  test('S9 — data_ingresso non è un campo editabile nel profilo', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/profilo');
    await page.waitForLoadState('networkidle');

    const infoSection = page.locator('div.rounded-2xl').filter({
      has: page.locator('h2:has-text("Informazioni personali")'),
    });

    // Should have exactly 1 input[type="date"] (data_nascita only)
    await expect(infoSection.locator('input[type="date"]')).toHaveCount(1);
  });

  // S10 — Profilo: valori nuovi campi visibili dopo S8
  test('S10 — profilo mostra provincia_nascita, comune, provincia_residenza, civico aggiornati', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/profilo');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('input[placeholder="Roma"]')).toHaveValue('Torino');     // luogo_nascita
    await expect(page.locator('input[placeholder="RM"]')).toHaveValue('TO');           // provincia_nascita
    await expect(page.locator('input[placeholder="Milano"]')).toHaveValue('Torino');   // comune
    await expect(page.locator('input[placeholder="MI"]')).toHaveValue('TO');           // provincia_residenza
    await expect(page.locator('input[placeholder="Via Roma"]')).toHaveValue('Via UAT 99'); // indirizzo
    await expect(page.locator('input[placeholder="1"]')).toHaveValue('99');            // civico_residenza
  });

});
