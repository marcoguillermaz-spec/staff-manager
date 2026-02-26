/**
 * UAT — Blocco Contenuti
 * Scenari S1–S12: navigazione tab, CRUD bacheca/agevolazioni/guide/eventi, visibilità per ruolo
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - Utenti test: collaboratore@test.com (collaboratore), admin@test.com,
 *     responsabile_compensi@test.com
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

async function dbDelete(table: string, params: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
  });
}

// ── Login helper ──────────────────────────────────────────────────────────────
const CREDS = {
  collaboratore: { email: 'collaboratore@test.com',   password: 'Testbusters123' },
  admin:         { email: 'admin@test.com',  password: 'Testbusters123' },
  responsabile:  { email: 'responsabile_compensi@test.com',   password: 'Testbusters123' },
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

// ── Shared state ──────────────────────────────────────────────────────────────
let announcementId = '';
let benefitId = '';
let resourceId  = '';
let eventId     = '';

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Contenuti UAT', () => {

  test.beforeAll(async () => {
    // Clean up residual UAT data from previous runs
    for (const table of ['announcements', 'benefits', 'resources', 'events'] as const) {
      const rows = await dbGet<{ id: string }>(table, 'titolo=like.%5BUAT+Contenuti%5D%25&select=id');
      for (const r of rows) await dbDelete(table, `id=eq.${r.id}`);
    }
    console.log('  ℹ️  cleanup done');
  });

  test.afterAll(async () => {
    if (announcementId) await dbDelete('announcements', `id=eq.${announcementId}`);
    if (benefitId)      await dbDelete('benefits',      `id=eq.${benefitId}`);
    if (resourceId)     await dbDelete('resources',     `id=eq.${resourceId}`);
    if (eventId)        await dbDelete('events',        `id=eq.${eventId}`);
  });

  // ── S1: Tab Bacheca attivo di default ─────────────────────────────────────
  test('S1 — Collaboratore accede a /contenuti, tab Bacheca attivo di default', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/contenuti');

    await expect(page.locator('h1:has-text("Contenuti")')).toBeVisible();
    // Active tab has bg-blue-600
    await expect(page.locator('a[href="?tab=bacheca"].bg-blue-600')).toBeVisible();
    console.log('  ✅ S1 — pagina contenuti, tab Bacheca attivo');
  });

  // ── S2: Navigazione tab Agevolazioni ─────────────────────────────────────
  test('S2 — Collaboratore naviga su Agevolazioni, URL e tab attivo aggiornati', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/contenuti');

    await page.click('a[href="?tab=agevolazioni"]');
    await page.waitForURL((u) => u.toString().includes('tab=agevolazioni'), { timeout: 10_000 });
    await expect(page.locator('a[href="?tab=agevolazioni"].bg-blue-600')).toBeVisible();
    console.log('  ✅ S2 — tab Agevolazioni attivo, URL contiene ?tab=agevolazioni');
  });

  // ── S3: Navigazione tab Guide ─────────────────────────────────────────────
  test('S3 — Collaboratore naviga su Guide & risorse', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/contenuti?tab=guide');

    await expect(page.locator('a[href="?tab=guide"].bg-blue-600')).toBeVisible();
    console.log('  ✅ S3 — tab Guide attivo');
  });

  // ── S4: Navigazione tab Eventi ────────────────────────────────────────────
  test('S4 — Collaboratore naviga su Eventi', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/contenuti?tab=eventi');

    await expect(page.locator('a[href="?tab=eventi"].bg-blue-600')).toBeVisible();
    console.log('  ✅ S4 — tab Eventi attivo');
  });

  // ── S5: Admin crea annuncio ───────────────────────────────────────────────
  test('S5 — Admin crea annuncio in Bacheca, appare nella lista', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contenuti');

    await page.click('button:has-text("+ Nuovo annuncio")');
    await page.fill('input[placeholder="Titolo *"]', '[UAT Contenuti] Annuncio test E2E');
    await page.fill('textarea[placeholder="Contenuto *"]', 'Contenuto annuncio di prova per i test E2E.');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/announcements') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.click('button[type="submit"]:has-text("Salva")'),
    ]);

    await expect(
      page.locator('h3:has-text("[UAT Contenuti] Annuncio test E2E")'),
    ).toBeVisible({ timeout: 10_000 });

    const ann = await dbFirst<{ id: string }>(
      'announcements',
      'titolo=eq.%5BUAT+Contenuti%5D+Annuncio+test+E2E&select=id',
    );
    expect(ann).not.toBeNull();
    announcementId = ann!.id;
    console.log(`  ✅ S5 — annuncio creato: ${announcementId}`);
  });

  // ── S6: Admin crea benefit con data scadenza futura → badge Attivo ────────
  test('S6 — Admin crea benefit con scadenza futura, badge "Attivo" visibile', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contenuti?tab=agevolazioni');

    await page.click('button:has-text("+ Nuovo benefit")');
    await page.fill('input[placeholder="Titolo *"]', '[UAT Contenuti] Benefit test E2E');

    // Fill valid_to (second date input) with a date 3 months from now
    const future = new Date();
    future.setMonth(future.getMonth() + 3);
    const futureStr = future.toISOString().slice(0, 10);
    await page.locator('input[type="date"]').nth(1).fill(futureStr);

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/benefits') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.click('button[type="submit"]:has-text("Salva")'),
    ]);

    await expect(
      page.locator('h3:has-text("[UAT Contenuti] Benefit test E2E")'),
    ).toBeVisible({ timeout: 10_000 });
    // Badge "Attivo" (green-400)
    await expect(page.locator('span.text-green-400:has-text("Attivo")')).toBeVisible();

    const ben = await dbFirst<{ id: string }>(
      'benefits',
      'titolo=eq.%5BUAT+Contenuti%5D+Benefit+test+E2E&select=id',
    );
    expect(ben).not.toBeNull();
    benefitId = ben!.id;
    console.log(`  ✅ S6 — benefit creato con badge Attivo: ${benefitId}`);
  });

  // ── S7: Admin crea risorsa con tag ────────────────────────────────────────
  test('S7 — Admin crea risorsa con tag, chip tag visibili', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contenuti?tab=guide');

    await page.click('button:has-text("+ Nuova risorsa")');
    await page.fill('input[placeholder="Titolo *"]', '[UAT Contenuti] Risorsa test E2E');
    await page.fill('input[placeholder*="Tag"]', 'onboarding, test, e2e');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/resources') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.click('button[type="submit"]:has-text("Salva")'),
    ]);

    await expect(
      page.locator('h3:has-text("[UAT Contenuti] Risorsa test E2E")'),
    ).toBeVisible({ timeout: 10_000 });
    // Tag chips
    await expect(page.locator('span:has-text("onboarding")')).toBeVisible();
    await expect(page.locator('span:has-text("test")')).toBeVisible();
    await expect(page.locator('span:has-text("e2e")')).toBeVisible();

    const res = await dbFirst<{ id: string; tag: string[] }>(
      'resources',
      'titolo=eq.%5BUAT+Contenuti%5D+Risorsa+test+E2E&select=id,tag',
    );
    expect(res).not.toBeNull();
    expect(res!.tag).toContain('onboarding');
    resourceId = res!.id;
    console.log(`  ✅ S7 — risorsa creata con tag [onboarding, test, e2e]: ${resourceId}`);
  });

  // ── S8: Admin crea evento con luma_embed_url → iframe visibile ────────────
  test('S8 — Admin crea evento con luma_embed_url, iframe embed visibile', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contenuti?tab=eventi');

    await page.click('button:has-text("+ Nuovo evento")');
    await page.fill('input[placeholder="Titolo *"]', '[UAT Contenuti] Evento test E2E');
    await page.fill('input[placeholder*="embed"]', 'https://lu.ma/embed/event/example-e2e');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/events') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.click('button[type="submit"]:has-text("Salva")'),
    ]);

    await expect(
      page.locator('h3:has-text("[UAT Contenuti] Evento test E2E")'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('iframe[title="[UAT Contenuti] Evento test E2E"]'),
    ).toBeVisible();

    const ev = await dbFirst<{ id: string; luma_embed_url: string }>(
      'events',
      'titolo=eq.%5BUAT+Contenuti%5D+Evento+test+E2E&select=id,luma_embed_url',
    );
    expect(ev).not.toBeNull();
    expect(ev!.luma_embed_url).toBe('https://lu.ma/embed/event/example-e2e');
    eventId = ev!.id;
    console.log(`  ✅ S8 — evento creato con iframe embed: ${eventId}`);
  });

  // ── S9: Admin modifica titolo annuncio ────────────────────────────────────
  test('S9 — Admin modifica titolo annuncio, aggiornamento visibile in lista e DB', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contenuti');

    // Click Modifica on the specific card — after click the card replaces h3 with form
    await page.locator(
      'div.rounded-xl:has(h3:has-text("[UAT Contenuti] Annuncio test E2E")) button:has-text("Modifica")',
    ).click();

    // Form is now open — use page-level locator (only one edit form open at a time)
    const titleInput = page.locator('input[placeholder="Titolo *"]');
    await expect(titleInput).toBeVisible({ timeout: 5_000 });
    await titleInput.fill('[UAT Contenuti] Annuncio test E2E — MODIFICATO');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/announcements/') && res.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      page.locator('button[type="submit"]:has-text("Salva")').click(),
    ]);

    await expect(
      page.locator('h3:has-text("[UAT Contenuti] Annuncio test E2E — MODIFICATO")'),
    ).toBeVisible({ timeout: 10_000 });

    const ann = await dbFirst<{ titolo: string }>('announcements', `id=eq.${announcementId}&select=titolo`);
    expect(ann!.titolo).toBe('[UAT Contenuti] Annuncio test E2E — MODIFICATO');
    console.log('  ✅ S9 — annuncio modificato, titolo aggiornato in lista e DB');
  });

  // ── S10: Admin elimina benefit ────────────────────────────────────────────
  test('S10 — Admin elimina benefit, scompare da lista e da DB', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/contenuti?tab=agevolazioni');

    const card = page.locator('div.rounded-xl:has(h3:has-text("[UAT Contenuti] Benefit test E2E"))');
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Accept the window.confirm dialog
    page.once('dialog', (d) => d.accept());

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/benefits/') && res.request().method() === 'DELETE',
        { timeout: 15_000 },
      ),
      card.locator('button:has-text("Elimina")').click(),
    ]);

    await expect(
      page.locator('h3:has-text("[UAT Contenuti] Benefit test E2E")'),
    ).not.toBeVisible({ timeout: 10_000 });

    const ben = await dbFirst('benefits', `id=eq.${benefitId}&select=id`);
    expect(ben).toBeNull();
    benefitId = ''; // already deleted, skip afterAll cleanup
    console.log('  ✅ S10 — benefit eliminato, scomparso da lista e DB');
  });

  // ── S11: Collaboratore non vede bottone creazione ─────────────────────────
  test('S11 — Collaboratore su Bacheca: bottone "+ Nuovo annuncio" non visibile', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/contenuti');

    await expect(page.locator('h1:has-text("Contenuti")')).toBeVisible();
    await expect(page.locator('button:has-text("+ Nuovo annuncio")')).not.toBeVisible();
    console.log('  ✅ S11 — bottone creazione assente per collaboratore (read-only)');
  });

  // ── S12: Responsabile vede bottone creazione in Bacheca ───────────────────
  test('S12 — Responsabile su Bacheca: bottone "+ Nuovo annuncio" visibile', async ({ page }) => {
    await login(page, 'responsabile');
    await page.goto('/contenuti');

    await expect(page.locator('h1:has-text("Contenuti")')).toBeVisible();
    await expect(
      page.locator('button:has-text("+ Nuovo annuncio")'),
    ).toBeVisible({ timeout: 10_000 });
    console.log('  ✅ S12 — bottone creazione visibile per responsabile');
  });
});
