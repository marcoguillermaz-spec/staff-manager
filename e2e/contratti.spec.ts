/**
 * UAT — Template contratti + Onboarding automatizzato
 * Scenari S1–S10: tab contratti, upload template, crea utente + genera contratto,
 * profilo editing espanso (nome/cognome/luogo_nascita/comune)
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

// ── Login helper ──────────────────────────────────────────────────────────────
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

// ── Fixtures ──────────────────────────────────────────────────────────────────
const COLLAB_ID = '3a55c2da-4906-42d7-81e1-c7c7b399ab4b'; // collaboratore@test.com

const TEST_EMAILS = {
  s5: 'uat-contratti-s5@test.local',
  s6: 'uat-contratti-s6@test.local',
  s7: 'uat-contratti-s7@test.local',
};

let tmpDocxPath    = '';
let tmpPdfPath     = '';
let createdUserIds: string[] = [];

let collabOriginalProfile: { nome: string; cognome: string; luogo_nascita: string | null; comune: string | null } | null = null;

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

    // Pre-upload OCCASIONALE template directly to storage (so S6 doesn't depend on S2)
    const docxContentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    await uploadToStorage('contracts', 'templates/occasionale.docx', docxBuf, docxContentType);

    // Upsert contract_templates record
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

    // Delete any leftover test users from previous runs
    for (const email of Object.values(TEST_EMAILS)) {
      const rows = await dbGet<{ id: string }>('collaborators', `email=eq.${email}&select=user_id`);
      // rows might have user_id field directly
      const row = await dbFirst<{ user_id: string }>('collaborators', `email=eq.${encodeURIComponent(email)}&select=user_id`);
      if (row?.user_id) await deleteAuthUser(row.user_id);
    }

    // Record collaboratore's original profile for afterAll restoration
    collabOriginalProfile = await dbFirst<{ nome: string; cognome: string; luogo_nascita: string | null; comune: string | null }>(
      'collaborators',
      `id=eq.${COLLAB_ID}&select=nome,cognome,luogo_nascita,comune`,
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
        nome:          collabOriginalProfile.nome,
        cognome:       collabOriginalProfile.cognome,
        luogo_nascita: collabOriginalProfile.luogo_nascita,
        comune:        collabOriginalProfile.comune,
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

    // Upload via hidden file input
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

    // Card should show filename + "Sostituisci" button
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

    // Error message visible
    await expect(page.locator('div.text-red-400')).toBeVisible({ timeout: 5_000 });
  });

  // S4 — Segnaposto collassabili
  test('S4 — sezione segnaposto si apre e mostra lista variabili', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=contratti');
    await page.waitForLoadState('networkidle');

    // Section collapsed by default — click to open
    await page.locator('button').filter({ hasText: 'Segnaposto disponibili' }).click();
    await page.waitForTimeout(300);

    // Use .filter({ hasText }) which handles { } characters reliably
    await expect(page.locator('code').filter({ hasText: '{nome}' }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('code').filter({ hasText: '{cognome}' }).first()).toBeVisible();
    await expect(page.locator('code').filter({ hasText: '{compenso_lordo}' }).first()).toBeVisible();
    await expect(page.locator('code').filter({ hasText: '{luogo_nascita}' }).first()).toBeVisible();
  });

  // S5 — Crea collaboratore con anagrafica (nessun contratto)
  test('S5 — admin crea collaboratore con anagrafica completa, nessun contratto', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=utenti');
    await page.waitForLoadState('networkidle');

    // role is already collaboratore by default
    await page.fill('input[type="email"]', TEST_EMAILS.s5);
    await page.fill('input[placeholder="Mario"]', 'Uat');
    await page.fill('input[placeholder="Rossi"]', 'S5Test');
    await page.fill('input[placeholder="RSSMRA80A01H501U"]', 'RSSMRA80A01H501U');
    await page.fill('input[placeholder="Roma (RM)"]', 'Roma (RM)');
    await page.fill('input[placeholder="Milano"]', 'Roma');
    // Leave contract tipo as "— Nessun contratto —"

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/create-user') && res.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      page.click('button[type="submit"]'),
    ]);

    expect(response.status()).toBe(200);
    await expect(page.locator('span.text-green-400:has-text("Utente creato con successo")')).toBeVisible({ timeout: 8_000 });

    // Verify collaborators record in DB
    const collab = await dbFirst<{ user_id: string; nome: string; cognome: string; codice_fiscale: string | null }>(
      'collaborators',
      `email=eq.${encodeURIComponent(TEST_EMAILS.s5)}&select=user_id,nome,cognome,codice_fiscale`,
    );
    expect(collab).not.toBeNull();
    expect(collab!.nome).toBe('Uat');
    expect(collab!.cognome).toBe('S5Test');

    // Verify no document created (no contract tipo selected)
    if (collab?.user_id) {
      createdUserIds.push(collab.user_id);
      const docs = await dbGet<{ id: string }>(
        'documents',
        `collaborator_id=eq.${collab.user_id}&tipo=like.CONTRATTO*&select=id`,
      );
      expect(docs.length).toBe(0);
    }
  });

  // S6 — Crea collaboratore + genera contratto
  test('S6 — admin crea collaboratore con tipo OCCASIONALE, documento DA_FIRMARE generato', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=utenti');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', TEST_EMAILS.s6);
    await page.fill('input[placeholder="Mario"]', 'Lucia');
    await page.fill('input[placeholder="Rossi"]', 'S6Test');
    await page.fill('input[placeholder="Roma (RM)"]', 'Torino (TO)');
    await page.fill('input[placeholder="Milano"]', 'Torino');

    // Select contract tipo OCCASIONALE (second select on page: nth(1) after role select)
    await page.locator('select').nth(1).selectOption('OCCASIONALE');
    await page.waitForTimeout(400); // let contract fields render

    // Fill contract fields
    await page.fill('input[placeholder="9800"]', '5000');
    // data_fine is the 3rd date input (0=data_nascita, 1=data_inizio, 2=data_fine)
    await page.locator('input[type="date"]').nth(2).fill('2025-12-31');

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/create-user') && res.request().method() === 'POST',
        { timeout: 30_000 },
      ),
      page.click('button[type="submit"]'),
    ]);

    expect(response.status()).toBe(200);
    await expect(page.locator('span.text-green-400:has-text("Utente creato con successo")')).toBeVisible({ timeout: 10_000 });

    // Verify document created in DB
    const collab = await dbFirst<{ id: string; user_id: string }>(
      'collaborators',
      `email=eq.${encodeURIComponent(TEST_EMAILS.s6)}&select=id,user_id`,
    );
    expect(collab).not.toBeNull();
    if (collab?.user_id) createdUserIds.push(collab.user_id);

    // Wait briefly for async document creation then check
    await page.waitForTimeout(500);
    const docs = await dbGet<{ id: string; stato_firma: string; tipo: string }>(
      'documents',
      `collaborator_id=eq.${collab!.id}&tipo=eq.CONTRATTO_OCCASIONALE&select=id,stato_firma,tipo`,
    );
    expect(docs.length).toBe(1);
    expect(docs[0].stato_firma).toBe('DA_FIRMARE');

    // Verify notification created
    const notifs = await dbGet<{ id: string }>(
      'notifications',
      `user_id=eq.${collab!.user_id}&tipo=eq.documento&select=id`,
    );
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  // S7 — Contratto skip se template mancante (COCOCO)
  test('S7 — utente creato anche senza template per COCOCO, nessun documento', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=utenti');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', TEST_EMAILS.s7);
    await page.fill('input[placeholder="Mario"]', 'Pietro');
    await page.fill('input[placeholder="Rossi"]', 'S7Test');

    // Select COCOCO (no template) — second select on page
    await page.locator('select').nth(1).selectOption('COCOCO');
    await page.waitForTimeout(400);

    // Warning visible for missing template
    await expect(page.locator('p.text-yellow-600')).toBeVisible();

    await page.fill('input[placeholder="9800"]', '7000');

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/create-user') && res.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      page.click('button[type="submit"]'),
    ]);

    expect(response.status()).toBe(200);
    await expect(page.locator('span.text-green-400:has-text("Utente creato con successo")')).toBeVisible({ timeout: 8_000 });

    const collab = await dbFirst<{ id: string; user_id: string }>(
      'collaborators',
      `email=eq.${encodeURIComponent(TEST_EMAILS.s7)}&select=id,user_id`,
    );
    expect(collab).not.toBeNull();
    if (collab?.user_id) createdUserIds.push(collab.user_id);

    // No contract document created
    const docs = await dbGet<{ id: string }>(
      'documents',
      `collaborator_id=eq.${collab!.id}&tipo=like.CONTRATTO*&select=id`,
    );
    expect(docs.length).toBe(0);
  });

  // S8 — Profilo: campi nuovi editabili
  test('S8 — collaboratore modifica nome, cognome, luogo_nascita, comune', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/profilo');
    await page.waitForLoadState('networkidle');

    // Clear and fill editable personal fields
    const nomeInput = page.locator('input[placeholder="Mario"]');
    const cognomeInput = page.locator('input[placeholder="Rossi"]');
    const luogoInput = page.locator('input[placeholder="Roma (RM)"]');
    const comuneInput = page.locator('input[placeholder="Milano"]');

    await nomeInput.fill('Mario Uat');
    await cognomeInput.fill('Rossi Uat');
    await luogoInput.fill('Torino (TO)');
    await comuneInput.fill('Torino');

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/profile') && res.request().method() === 'PATCH',
        { timeout: 10_000 },
      ),
      page.click('button[type="submit"]'),
    ]);

    expect(response.status()).toBe(200);
    await expect(page.locator('button:has-text("✓ Salvato")')).toBeVisible({ timeout: 5_000 });

    // Verify DB
    const collab = await dbFirst<{ nome: string; cognome: string; luogo_nascita: string | null; comune: string | null }>(
      'collaborators',
      `id=eq.${COLLAB_ID}&select=nome,cognome,luogo_nascita,comune`,
    );
    expect(collab?.nome).toBe('Mario Uat');
    expect(collab?.cognome).toBe('Rossi Uat');
    expect(collab?.luogo_nascita).toBe('Torino (TO)');
    expect(collab?.comune).toBe('Torino');
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
    // data_ingresso is rendered as a read-only Field div, not an input
    await expect(infoSection.locator('input[type="date"]')).toHaveCount(1);
  });

  // S10 — Profilo: luogo_nascita e comune mostrano valori salvati (da S8)
  test('S10 — profilo mostra luogo_nascita e comune aggiornati', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/profilo');
    await page.waitForLoadState('networkidle');

    const luogoInput = page.locator('input[placeholder="Roma (RM)"]');
    const comuneInput = page.locator('input[placeholder="Milano"]');

    await expect(luogoInput).toHaveValue('Torino (TO)');
    await expect(comuneInput).toHaveValue('Torino');
  });

});
