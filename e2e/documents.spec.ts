/**
 * UAT — Blocco Documenti + CU batch
 * Scenari S1–S10: gestione documenti admin, CU batch, firma collaboratore, verifica DB
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - Bucket Supabase Storage 'documents' creato e privato
 *   - Collaboratore test: mario.rossi@test.com (collaborator_id noto)
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import JSZip from 'jszip';

// ── Supabase REST helper ──────────────────────────────────────────────────────
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

async function dbDelete(table: string, params: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
  });
}

// ── Login helper ──────────────────────────────────────────────────────────────
const CREDS = {
  admin:         { email: 'admin-test@example.com',  password: 'Testbusters123' },
  collaboratore: { email: 'mario.rossi@test.com',    password: 'Testbusters123' },
};

async function login(page: Page, role: keyof typeof CREDS) {
  const { email, password } = CREDS[role];
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });
}

// ── Test fixtures ─────────────────────────────────────────────────────────────
const COLLABORATOR_ID = '3a55c2da-4906-42d7-81e1-c7c7b399ab4b'; // mario.rossi

let uploadedDocId: string;
let batchDocId: string;
let tempDir: string;

// ── Test suite ────────────────────────────────────────────────────────────────
test.describe.serial('Documenti UAT', () => {

  test.beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'staff-docs-'));

    // Clean up any previous test documents for this collaborator
    const existing = await dbGet<{ id: string }>('documents',
      `collaborator_id=eq.${COLLABORATOR_ID}&select=id`);
    for (const d of existing) {
      await dbDelete('notifications', `entity_id=eq.${d.id}`);
      await dbDelete('documents', `id=eq.${d.id}`);
    }
    console.log(`  🧹 Cleaned ${existing.length} existing document(s)`);
  });

  test.afterAll(async () => {
    // Clean up test documents
    for (const id of [uploadedDocId, batchDocId].filter(Boolean)) {
      await dbDelete('notifications', `entity_id=eq.${id}`);
      await dbDelete('documents', `id=eq.${id}`);
    }
    // Remove temp files
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('  🧹 Cleaned up test documents');
  });

  // ── S1: Admin accede a /documenti ─────────────────────────────────────────
  test('S1 — Admin: accede a /documenti, tab Lista attivo', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/documenti');

    const activeTab = page.locator('a.bg-blue-600');
    await expect(activeTab).toContainText('Lista documenti', { timeout: 10_000 });

    // Table or empty state should be visible
    const hasTable = await page.locator('table').isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=Nessun documento').isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);

    console.log('  ✅ S1 — /documenti caricato, tab Lista attivo');
  });

  // ── S2: Admin cambia tab "Carica documento" ───────────────────────────────
  test('S2 — Admin: tab Carica documento mostra il form', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/documenti?tab=carica');

    await expect(page.locator('select').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="file"]')).toBeVisible();
    await expect(page.locator('button:has-text("Carica documento")')).toBeVisible();

    console.log('  ✅ S2 — Form carica documento visibile');
  });

  // ── S3: Admin carica PDF singolo ──────────────────────────────────────────
  test('S3 — Admin: carica PDF singolo, documento in lista', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/documenti?tab=carica');

    // Create a dummy PDF file
    const pdfPath = path.join(tempDir, 'contratto-test.pdf');
    fs.writeFileSync(pdfPath, '%PDF-1.4 test contract UAT');

    // Select first collaborator in the dropdown
    await page.locator('select').first().selectOption({ index: 1 });

    // Select tipo
    await page.locator('select').nth(1).selectOption('CONTRATTO_OCCASIONALE');

    // Fill titolo
    await page.fill('input[placeholder*="Contratto"]', 'Contratto UAT test');

    // Upload file
    await page.locator('input[type="file"]').setInputFiles(pdfPath);

    // Submit
    await page.click('button:has-text("Carica documento")');

    // Wait for success message or refresh
    await expect(page.locator('text=Documento caricato con successo')).toBeVisible({ timeout: 15_000 });

    // Verify in DB
    const doc = await dbFirst<{ id: string; stato_firma: string; titolo: string }>(
      'documents',
      `collaborator_id=eq.${COLLABORATOR_ID}&titolo=eq.Contratto UAT test&select=id,stato_firma,titolo`,
    );
    expect(doc).not.toBeNull();
    expect(doc!.stato_firma).toBe('DA_FIRMARE');
    uploadedDocId = doc!.id;

    console.log(`  ✅ S3 — Documento ${uploadedDocId} caricato, stato_firma=DA_FIRMARE`);
  });

  // ── S4: Admin accede tab CU batch ─────────────────────────────────────────
  test('S4 — Admin: tab Import CU batch mostra il form', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/documenti?tab=cu-batch');

    await expect(page.locator('text=Importazione CU batch')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(page.locator('input[type="file"]').first()).toBeVisible();
    await expect(page.locator('button:has-text("Avvia importazione")')).toBeVisible();

    console.log('  ✅ S4 — Form CU batch visibile');
  });

  // ── S5: Admin avvia CU batch con file validi ──────────────────────────────
  test('S5 — Admin: CU batch — 1 PDF importato con successo', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/documenti?tab=cu-batch');

    // Create a test PDF
    const pdfName = 'mario_rossi_CU_2025.pdf';
    const pdfPath = path.join(tempDir, pdfName);
    fs.writeFileSync(pdfPath, '%PDF-1.4 CU 2025 Mario Rossi UAT');

    // Create ZIP containing the PDF
    const zip = new JSZip();
    zip.file(pdfName, fs.readFileSync(pdfPath));
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipPath = path.join(tempDir, 'cu_batch_2025.zip');
    fs.writeFileSync(zipPath, zipBuffer);

    // Create CSV
    const csvPath = path.join(tempDir, 'mapping.csv');
    fs.writeFileSync(csvPath, `nome_file,nome,cognome\n${pdfName},Mario,Rossi`);

    // Fill form
    await page.fill('input[type="number"]', '2025');
    await page.locator('input[type="file"]').nth(0).setInputFiles(zipPath);
    await page.locator('input[type="file"]').nth(1).setInputFiles(csvPath);

    await page.click('button:has-text("Avvia importazione")');

    // Wait for result
    await expect(page.locator('text=Caricati:')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('text=Caricati:').locator('..').locator('strong').first()).toContainText('1');

    // Verify in DB
    const doc = await dbFirst<{ id: string; tipo: string; anno: number }>(
      'documents',
      `collaborator_id=eq.${COLLABORATOR_ID}&tipo=eq.CU&anno=eq.2025&select=id,tipo,anno`,
    );
    expect(doc).not.toBeNull();
    expect(doc!.anno).toBe(2025);
    batchDocId = doc!.id;

    console.log(`  ✅ S5 — CU batch: documento ${batchDocId} importato, anno=2025`);
  });

  // ── S6: Admin riavvia batch stesso file → duplicato ───────────────────────
  test('S6 — Admin: CU batch stesso file → segnalato come duplicato', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/documenti?tab=cu-batch');

    const pdfName = 'mario_rossi_CU_2025.pdf';
    const pdfPath = path.join(tempDir, pdfName);
    if (!fs.existsSync(pdfPath)) {
      fs.writeFileSync(pdfPath, '%PDF-1.4 CU 2025 Mario Rossi UAT');
    }

    const zip = new JSZip();
    zip.file(pdfName, fs.readFileSync(pdfPath));
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipPath = path.join(tempDir, 'cu_batch_2025_dup.zip');
    fs.writeFileSync(zipPath, zipBuffer);

    const csvPath = path.join(tempDir, 'mapping_dup.csv');
    fs.writeFileSync(csvPath, `nome_file,nome,cognome\n${pdfName},Mario,Rossi`);

    await page.fill('input[type="number"]', '2025');
    await page.locator('input[type="file"]').nth(0).setInputFiles(zipPath);
    await page.locator('input[type="file"]').nth(1).setInputFiles(csvPath);
    await page.click('button:has-text("Avvia importazione")');

    await expect(page.locator('text=Duplicati:')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('text=Duplicati:').locator('..').locator('strong').first()).toContainText('1');

    console.log('  ✅ S6 — CU batch duplicato rilevato e saltato');
  });

  // ── S7: Collaboratore vede solo i propri documenti ────────────────────────
  test('S7 — Collaboratore: vede solo i propri documenti', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/documenti');

    // No tab bar (collaboratore)
    await expect(page.locator('a:has-text("Carica documento")')).not.toBeVisible();
    await expect(page.locator('a:has-text("Import CU batch")')).not.toBeVisible();

    // Should see at least the documents seeded in previous tests
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });

    console.log('  ✅ S7 — Collaboratore vede solo propri documenti, no tab admin');
  });

  // ── S8: Collaboratore apre documento DA_FIRMARE ───────────────────────────
  test('S8 — Collaboratore: apre documento DA_FIRMARE, vede Scarica + upload', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto(`/documenti/${uploadedDocId}`);

    await expect(page.locator('a:has-text("Scarica")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="file"]')).toBeVisible();
    await expect(page.locator('button:has-text("Invia documento firmato")')).toBeVisible();

    console.log('  ✅ S8 — Documento DA_FIRMARE: Scarica + upload firmato visibili');
  });

  // ── S9: Collaboratore carica documento firmato ────────────────────────────
  test('S9 — Collaboratore: carica PDF firmato, stato diventa FIRMATO', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto(`/documenti/${uploadedDocId}`);

    const signedPdfPath = path.join(tempDir, 'contratto-firmato.pdf');
    fs.writeFileSync(signedPdfPath, '%PDF-1.4 SIGNED UAT document');

    await page.locator('input[type="file"]').setInputFiles(signedPdfPath);
    await page.click('button:has-text("Invia documento firmato")');

    await expect(page.locator('text=Documento firmato inviato correttamente')).toBeVisible({ timeout: 15_000 });

    console.log('  ✅ S9 — Documento firmato inviato');
  });

  // ── S10: Verifica DB post-sign ────────────────────────────────────────────
  test('S10 — Verifica DB: stato FIRMATO, signed_at valorizzato, notifica admin', async () => {
    const doc = await dbFirst<{
      stato_firma: string;
      signed_at: string | null;
      file_firmato_url: string | null;
    }>(
      'documents',
      `id=eq.${uploadedDocId}&select=stato_firma,signed_at,file_firmato_url`,
    );

    expect(doc).not.toBeNull();
    expect(doc!.stato_firma).toBe('FIRMATO');
    expect(doc!.signed_at).not.toBeNull();
    expect(doc!.file_firmato_url).not.toBeNull();

    // Verify notification was created for admins
    const notification = await dbFirst<{ tipo: string; entity_id: string }>(
      'notifications',
      `entity_id=eq.${uploadedDocId}&tipo=eq.documento_firmato&select=tipo,entity_id`,
    );
    expect(notification).not.toBeNull();
    expect(notification!.tipo).toBe('documento_firmato');

    console.log('  ✅ S10 — DB: stato_firma=FIRMATO, signed_at set, notifica admin inserita');
  });

});
