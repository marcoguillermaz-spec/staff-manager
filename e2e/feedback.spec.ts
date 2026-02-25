/**
 * UAT — Feedback tool + login credentials
 * S1: submit feedback senza screenshot → DB verify
 * S2: submit feedback con screenshot → screenshot_path NOT NULL in DB
 * S3: responsabile non può accedere a /feedback (redirect)
 * S4: admin vede lista feedback con badge categoria + link screenshot
 * S5: click card test credentials autofilla email
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  if (!page.url().includes('/login')) {
    await page.click('button:has-text("Esci")');
    await page.waitForURL((u) => u.toString().includes('/login'), { timeout: 10_000 });
  }
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

async function dbQuery(qs: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${qs}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: 'application/json',
    },
  });
  return res.json();
}

async function cleanupFeedback() {
  await fetch(`${SUPABASE_URL}/rest/v1/feedback?messaggio=like.*UAT-feedback*`, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=minimal',
    },
  });
}

// Minimal 1×1 PNG for screenshot upload test
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Feedback tool + login credentials', () => {
  let tmpPngPath: string;

  test.beforeAll(async () => {
    // Cleanup first — in case a previous run left orphan rows
    await cleanupFeedback();
    // Create temp PNG for S2
    tmpPngPath = path.join(os.tmpdir(), 'uat-feedback-screenshot.png');
    fs.writeFileSync(tmpPngPath, Buffer.from(TINY_PNG_B64, 'base64'));
  });

  test.afterAll(async () => {
    await cleanupFeedback();
    if (tmpPngPath && fs.existsSync(tmpPngPath)) fs.unlinkSync(tmpPngPath);
  });

  // ── S1 ──────────────────────────────────────────────────────────────────────
  test('S1 — submit feedback senza screenshot → DB verify', async ({ page }) => {
    await login(page, 'collaboratore@test.com', 'Testbusters123');
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20_000 });

    await page.goto('/compensi');
    await page.waitForLoadState('domcontentloaded');

    // Open modal
    const btn = page.locator('button[aria-label="Invia feedback"]');
    await expect(btn).toBeVisible({ timeout: 5_000 });
    await btn.click();

    // Scope all interactions to the modal overlay to avoid ambiguity with
    // "Inviato" filter chips in the compensation list behind the modal
    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Fill form (pagina is pre-filled by usePathname → /compensi)
    await modal.locator('select').selectOption('Bug');
    await modal.locator('textarea').fill('UAT-feedback-S1: test senza screenshot');

    // Submit + wait for API response
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/feedback') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.locator('button[type="submit"]').click(),
    ]);

    await expect(page.locator('text=Grazie per il feedback')).toBeVisible({ timeout: 5_000 });

    // DB verify
    const rows = await dbQuery(
      'feedback?messaggio=like.*UAT-feedback-S1*&select=screenshot_path,categoria,pagina',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].categoria).toBe('Bug');
    expect(rows[0].pagina).toBe('/compensi');
    expect(rows[0].screenshot_path).toBeNull();

    console.log('  ✅ S1 — feedback salvato, screenshot_path null, pagina=/compensi');
  });

  // ── S2 ──────────────────────────────────────────────────────────────────────
  test('S2 — submit feedback con screenshot → screenshot_path NOT NULL', async ({ page }) => {
    await login(page, 'collaboratore@test.com', 'Testbusters123');
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20_000 });

    await page.goto('/compensi');
    await page.waitForLoadState('domcontentloaded');

    const btn = page.locator('button[aria-label="Invia feedback"]');
    await expect(btn).toBeVisible({ timeout: 5_000 });
    await btn.click();

    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    await modal.locator('select').selectOption('Suggerimento');
    await modal.locator('textarea').fill('UAT-feedback-S2: test con screenshot');
    await modal.locator('input[type="file"]').setInputFiles(tmpPngPath);

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/feedback') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.locator('button[type="submit"]').click(),
    ]);

    await expect(page.locator('text=Grazie per il feedback')).toBeVisible({ timeout: 5_000 });

    // DB verify — screenshot_path must be set
    const rows = await dbQuery(
      'feedback?messaggio=like.*UAT-feedback-S2*&select=screenshot_path',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].screenshot_path).not.toBeNull();

    console.log('  ✅ S2 — screenshot_path:', rows[0].screenshot_path);
  });

  // ── S3 ──────────────────────────────────────────────────────────────────────
  test('S3 — responsabile redirect da /feedback', async ({ page }) => {
    await login(page, 'responsabile@test.com', 'Testbusters123');
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20_000 });

    await page.goto('/feedback');
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).not.toContain('/feedback');
    console.log('  ✅ S3 — responsabile redirectato a', page.url());
  });

  // ── S4 ──────────────────────────────────────────────────────────────────────
  test('S4 — admin vede lista con badge categoria e link screenshot', async ({ page }) => {
    await login(page, 'admin-test@example.com', 'Testbusters123');
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20_000 });

    await page.goto('/feedback');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Feedback ricevuti")')).toBeVisible({ timeout: 5_000 });

    // S1 message visible
    await expect(
      page.locator('p.whitespace-pre-wrap').filter({ hasText: 'UAT-feedback-S1' }),
    ).toBeVisible({ timeout: 5_000 });

    // Bug badge visible (from S1)
    await expect(page.locator('span:has-text("Bug")').first()).toBeVisible();

    // Screenshot link visible (from S2)
    await expect(page.locator('a:has-text("Visualizza screenshot")')).toBeVisible();

    console.log('  ✅ S4 — lista feedback OK con badge e link screenshot');
  });

  // ── S5 ──────────────────────────────────────────────────────────────────────
  test('S5 — click card Collaboratore autofilla email', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.click('button:has-text("Collaboratore")');

    const emailValue = await page.inputValue('input[type="email"]');
    expect(emailValue).toBe('collaboratore_test@test.com');

    console.log('  ✅ S5 — autofill email:', emailValue);
  });
});
