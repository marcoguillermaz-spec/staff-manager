/**
 * UAT — Blocco Profilo collaboratore esteso
 * Scenari S1–S11: foto profilo, dati fiscali, data_ingresso, panoramica pagamenti
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - Migration 008_avatars_bucket.sql applicata
 *   - Utenti test: collaboratore@test.com (collaboratore), admin-test@example.com
 *   - Collaboratore ID noto: 3a55c2da-4906-42d7-81e1-c7c7b399ab4b
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';

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
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
}

// Minimal 1×1 pixel JPEG
const JPEG_1PX = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
  'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC' +
  'AABAAEDASIA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/' +
  'xAAUAQEAAAAAAAAAAAAAAAAAAAAA/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEA' +
  'PwCwABmX/9k=',
  'base64',
);

// ── Login helper ──────────────────────────────────────────────────────────────
const CREDS = {
  collaboratore: { email: 'collaboratore@test.com',  password: 'Testbusters123' },
  admin:         { email: 'admin-test@example.com', password: 'Testbusters123' },
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
const COLLAB_ID = '3a55c2da-4906-42d7-81e1-c7c7b399ab4b'; // collaboratore@test.com

let originalAvatarUrl: string | null     = null;
let originalPartitaIva: string | null    = null;
let originalHaFigli: boolean             = false;
let originalDataIngresso: string | null  = null;
// Personal info fields modified by S8 (restored in afterAll)
let originalNome: string                 = '';
let originalCognome: string             = '';
let originalLuogoNascita: string | null = null;
let originalProvinciaNascita: string | null = null;
let originalComune: string | null       = null;
let originalProvinciaRes: string | null = null;
let originalIndirizzo: string | null    = null;
let originalCivico: string | null       = null;
let testCompensationId: string | null   = null;
let originalCompensationStato: string   = 'BOZZA';

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Profilo collaboratore esteso UAT', () => {

  test.beforeAll(async () => {
    const collab = await dbFirst<{
      foto_profilo_url: string | null;
      partita_iva: string | null;
      ha_figli_a_carico: boolean;
      data_ingresso: string | null;
      nome: string;
      cognome: string;
      luogo_nascita: string | null;
      provincia_nascita: string | null;
      comune: string | null;
      provincia_residenza: string | null;
      indirizzo: string | null;
      civico_residenza: string | null;
    }>('collaborators', `id=eq.${COLLAB_ID}&select=foto_profilo_url,partita_iva,ha_figli_a_carico,data_ingresso,nome,cognome,luogo_nascita,provincia_nascita,comune,provincia_residenza,indirizzo,civico_residenza`);

    if (collab) {
      originalAvatarUrl       = collab.foto_profilo_url;
      originalPartitaIva      = collab.partita_iva;
      originalHaFigli         = collab.ha_figli_a_carico;
      originalDataIngresso    = collab.data_ingresso;
      originalNome            = collab.nome;
      originalCognome         = collab.cognome;
      originalLuogoNascita    = collab.luogo_nascita;
      originalProvinciaNascita = collab.provincia_nascita;
      originalComune          = collab.comune;
      originalProvinciaRes    = collab.provincia_residenza;
      originalIndirizzo       = collab.indirizzo;
      originalCivico          = collab.civico_residenza;
    }

    // Find a compensation for collaboratore@test.com to use in S8 (panoramica pagamenti)
    const comp = await dbFirst<{ id: string; stato: string }>(
      'compensations',
      `collaborator_id=eq.${COLLAB_ID}&select=id,stato`,
    );
    if (comp) {
      testCompensationId     = comp.id;
      originalCompensationStato = comp.stato;
    }

    console.log(`  ℹ️  collab snapshot: avatar=${originalAvatarUrl}, piva=${originalPartitaIva}, figli=${originalHaFigli}, ingresso=${originalDataIngresso}`);
    console.log(`  ℹ️  test compensation: ${testCompensationId ?? 'none'} stato=${originalCompensationStato}`);
  });

  test.afterAll(async () => {
    // Restore collaborator fields
    await dbPatch('collaborators', `id=eq.${COLLAB_ID}`, {
      foto_profilo_url:    originalAvatarUrl,
      partita_iva:         originalPartitaIva,
      ha_figli_a_carico:   originalHaFigli,
      data_ingresso:       originalDataIngresso,
      nome:                originalNome,
      cognome:             originalCognome,
      luogo_nascita:       originalLuogoNascita,
      provincia_nascita:   originalProvinciaNascita,
      comune:              originalComune,
      provincia_residenza: originalProvinciaRes,
      indirizzo:           originalIndirizzo,
      civico_residenza:    originalCivico,
    });

    // Restore compensation stato
    if (testCompensationId) {
      await dbPatch('compensations', `id=eq.${testCompensationId}`, {
        stato:   originalCompensationStato,
        paid_at: null,
      });
    }
    console.log('  ℹ️  afterAll restore done');
  });

  // ── S1: Pagina profilo — struttura sezioni ────────────────────────────────
  test('S1 — Collaboratore apre /profilo, tutte le sezioni visibili', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/profilo');

    await expect(page.locator('h2:has-text("Foto profilo")')).toBeVisible();
    await expect(page.locator('h2:has-text("Informazioni personali")')).toBeVisible();
    await expect(page.locator('h2:has-text("Contatti")')).toBeVisible();
    await expect(page.locator('h2:has-text("Dati pagamento")')).toBeVisible();
    await expect(page.locator('h2:has-text("Dati fiscali")')).toBeVisible();
    await expect(page.locator('h2:has-text("Preferenze")')).toBeVisible();
    console.log('  ✅ S1 — tutte le sezioni profilo visibili');
  });

  // ── S2: Upload foto profilo valida ────────────────────────────────────────
  test('S2 — Collaboratore carica foto profilo valida, avatar aggiornato', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/profilo');

    await expect(page.locator('h2:has-text("Foto profilo")')).toBeVisible();

    const fileInput = page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/profile/avatar') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      fileInput.setInputFiles({
        name: 'avatar.jpg',
        mimeType: 'image/jpeg',
        buffer: JPEG_1PX,
      }),
    ]);

    // Avatar img should now be visible
    await expect(page.locator('img[alt="Foto profilo"]')).toBeVisible({ timeout: 10_000 });
    // Button label changes to "Cambia foto"
    await expect(page.locator('button:has-text("Cambia foto")')).toBeVisible();
    console.log('  ✅ S2 — avatar aggiornato, img visibile, bottone "Cambia foto"');
  });

  // ── S3: Upload file troppo grande ─────────────────────────────────────────
  test('S3 — Upload avatar > 2 MB, messaggio errore visibile', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/profilo');

    await expect(page.locator('h2:has-text("Foto profilo")')).toBeVisible();

    const fileInput = page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]');
    const largeBuffer = Buffer.alloc(3 * 1024 * 1024, 0xff); // 3 MB of dummy data

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/profile/avatar') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      fileInput.setInputFiles({
        name: 'too-large.jpg',
        mimeType: 'image/jpeg',
        buffer: largeBuffer,
      }),
    ]);

    await expect(page.locator('text=supera il limite di 2 MB')).toBeVisible({ timeout: 5_000 });
    console.log('  ✅ S3 — errore "supera il limite di 2 MB" mostrato per file > 2 MB');
  });

  // ── S4: Inserimento e salvataggio Partita IVA ─────────────────────────────
  test('S4 — Collaboratore salva Partita IVA, persiste al reload e DB aggiornato', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/profilo');

    await expect(page.locator('h2:has-text("Dati fiscali")')).toBeVisible();
    const pivaInput = page.locator('input[placeholder="01234567890"]');
    await pivaInput.fill('01234567890');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/profile') && res.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      page.locator('button[type="submit"]').click(),
    ]);

    await expect(page.locator('text=✓ Salvato')).toBeVisible({ timeout: 5_000 });

    // Reload and verify persistence
    await page.reload();
    await expect(page.locator('input[placeholder="01234567890"]')).toHaveValue('01234567890');

    // DB verify
    const collab = await dbFirst<{ partita_iva: string }>('collaborators', `id=eq.${COLLAB_ID}&select=partita_iva`);
    expect(collab?.partita_iva).toBe('01234567890');
    console.log('  ✅ S4 — partita IVA salvata, persiste al reload, DB aggiornato');
  });

  // ── S5: Attiva "Sono fiscalmente a carico" ────────────────────────────────
  test('S5 — Collaboratore attiva "Sono fiscalmente a carico", DB aggiornato', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/profilo');

    await expect(page.locator('h2:has-text("Dati fiscali")')).toBeVisible();

    // Ensure unchecked first (reset if needed)
    const checkbox = page.locator('input[type="checkbox"]').filter({ has: page.locator('..') }).first();
    // Use the label text to locate the checkbox precisely
    const fiscaleLabel = page.locator('label').filter({ hasText: 'Sono fiscalmente a carico' });
    const fiscaleCheck = fiscaleLabel.locator('input[type="checkbox"]');

    if (await fiscaleCheck.isChecked()) {
      await fiscaleCheck.uncheck();
      await Promise.all([
        page.waitForResponse((res) => res.url().includes('/api/profile') && res.request().method() === 'PATCH', { timeout: 10_000 }),
        page.locator('button[type="submit"]').click(),
      ]);
      await page.reload();
    }

    await fiscaleCheck.check();
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/profile') && res.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      page.locator('button[type="submit"]').click(),
    ]);

    await expect(page.locator('text=✓ Salvato')).toBeVisible({ timeout: 5_000 });

    const collab = await dbFirst<{ ha_figli_a_carico: boolean }>('collaborators', `id=eq.${COLLAB_ID}&select=ha_figli_a_carico`);
    expect(collab?.ha_figli_a_carico).toBe(true);
    console.log('  ✅ S5 — ha_figli_a_carico=true salvato, DB aggiornato');
  });

  // ── S6: Disattiva "Sono fiscalmente a carico" ─────────────────────────────
  test('S6 — Collaboratore disattiva "Sono fiscalmente a carico", DB aggiornato', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/profilo');

    await expect(page.locator('h2:has-text("Dati fiscali")')).toBeVisible();

    const fiscaleLabel = page.locator('label').filter({ hasText: 'Sono fiscalmente a carico' });
    const fiscaleCheck = fiscaleLabel.locator('input[type="checkbox"]');
    await expect(fiscaleCheck).toBeChecked(); // should be true from S5

    await fiscaleCheck.uncheck();
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/profile') && res.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      page.locator('button[type="submit"]').click(),
    ]);

    await expect(page.locator('text=✓ Salvato')).toBeVisible({ timeout: 5_000 });

    const collab = await dbFirst<{ ha_figli_a_carico: boolean }>('collaborators', `id=eq.${COLLAB_ID}&select=ha_figli_a_carico`);
    expect(collab?.ha_figli_a_carico).toBe(false);
    console.log('  ✅ S6 — ha_figli_a_carico=false salvato, DB aggiornato');
  });

  // ── S7: Admin imposta data_ingresso in Impostazioni > Collaboratori ───────
  test('S7 — Admin imposta data_ingresso, comparazione read-only nel profilo collab', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=collaboratori');

    await expect(page.locator('h2:has-text("Stato collaboratori")')).toBeVisible();

    const memberRow = page.locator('div.px-5.py-3.space-y-2').filter({ hasText: 'Collaboratore' });
    await expect(memberRow).toBeVisible({ timeout: 10_000 });

    const dateInput = memberRow.locator('input[type="date"]');
    await dateInput.fill('2024-03-15');
    // Trigger blur to save
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/members/') && res.url().includes('/data-ingresso') && res.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      dateInput.blur(),
    ]);

    // DB verify
    const collab = await dbFirst<{ data_ingresso: string }>('collaborators', `id=eq.${COLLAB_ID}&select=data_ingresso`);
    expect(collab?.data_ingresso).toBe('2024-03-15');

    // Now check it appears read-only on collaboratore's profile
    await login(page, 'collaboratore');
    await page.goto('/profilo');
    await expect(page.locator('text=15/03/2024')).toBeVisible({ timeout: 10_000 });
    console.log('  ✅ S7 — data_ingresso impostata da admin, visibile nel profilo collaboratore');
  });

  // ── S8: Panoramica pagamenti — dati presenti ──────────────────────────────
  test('S8 — Panoramica pagamenti visibile quando esiste almeno 1 compenso PAGATO', async ({ page }) => {
    if (!testCompensationId) {
      console.log('  ⚠️  S8 skipped: nessun compenso per collaboratore@test.com');
      return;
    }

    // Force one compensation to PAGATO with paid_at set
    await dbPatch('compensations', `id=eq.${testCompensationId}`, {
      stato:   'PAGATO',
      paid_at: new Date().toISOString(),
    });

    await login(page, 'collaboratore');
    await page.goto('/compensi');

    await expect(page.locator('h2:has-text("I miei pagamenti")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h2:has-text("Compensi liquidati")')).toBeVisible();
    await expect(page.locator('h2:has-text("Rimborsi liquidati")')).toBeVisible();
    console.log('  ✅ S8 — panoramica pagamenti visibile con compenso PAGATO');
  });

  // ── S9: Panoramica pagamenti — nessun dato ────────────────────────────────
  test('S9 — Panoramica pagamenti assente quando nessun compenso/rimborso PAGATO', async ({ page }) => {
    if (!testCompensationId) {
      console.log('  ⚠️  S9 skipped: nessun compenso per collaboratore@test.com');
      return;
    }

    // Restore to non-PAGATO stato
    await dbPatch('compensations', `id=eq.${testCompensationId}`, {
      stato:   originalCompensationStato,
      paid_at: null,
    });

    // Check there are no PAGATO compensations for collaboratore@test.com
    const pagati = await dbGet('compensations', `collaborator_id=eq.${COLLAB_ID}&stato=eq.PAGATO&select=id`);
    if (pagati.length > 0) {
      console.log('  ⚠️  S9 skipped: collaboratore@test.com ha già compensi PAGATO da test precedenti');
      return;
    }

    await login(page, 'collaboratore');
    await page.goto('/compensi');

    // PaymentOverview should NOT be rendered
    await expect(page.locator('h2:has-text("I miei pagamenti")')).not.toBeVisible({ timeout: 5_000 });
    console.log('  ✅ S9 — panoramica pagamenti assente senza compensi/rimborsi PAGATO');
  });

  // ── S10: DB verify — avatar ───────────────────────────────────────────────
  test('S10 — DB: foto_profilo_url valorizzata dopo upload S2', async () => {
    const collab = await dbFirst<{ foto_profilo_url: string | null }>('collaborators', `id=eq.${COLLAB_ID}&select=foto_profilo_url`);
    expect(collab?.foto_profilo_url).not.toBeNull();
    expect(collab?.foto_profilo_url).toContain('/storage/v1/object/public/avatars/');
    console.log(`  ✅ S10 — foto_profilo_url: ${collab?.foto_profilo_url}`);
  });

  // ── S11: DB verify — dati fiscali ─────────────────────────────────────────
  test('S11 — DB: ha_figli_a_carico=false, partita_iva valorizzata dopo S4/S6', async () => {
    const collab = await dbFirst<{
      ha_figli_a_carico: boolean;
      partita_iva: string | null;
    }>('collaborators', `id=eq.${COLLAB_ID}&select=ha_figli_a_carico,partita_iva`);

    expect(collab?.ha_figli_a_carico).toBe(false);
    expect(collab?.partita_iva).toBe('01234567890');
    console.log(`  ✅ S11 — ha_figli_a_carico=${collab?.ha_figli_a_carico}, partita_iva=${collab?.partita_iva}`);
  });

});
