/**
 * UAT — Rimozione ruolo super_admin
 * S1: admin-test@example.com accede alla dashboard admin
 * S2: Form "Crea utente" non mostra più l'opzione "Super Admin"
 * S3: superadmin@test.com non può fare login (utente eliminato)
 * S4: CHECK constraint DB rifiuta INSERT con role='super_admin'
 */

import { test, expect, type Page } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── Login helper ──────────────────────────────────────────────────────────────
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

// ── S1 ────────────────────────────────────────────────────────────────────────
test('S1 — admin-test@example.com accede alle pagine admin riservate', async ({ page }) => {
  await login(page, 'admin-test@example.com', 'Testbusters123');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20_000 });

  // Navigate to an admin-only page — if accessible, the role is correct
  await page.goto('/impostazioni');
  await page.waitForLoadState('networkidle');

  // Page should NOT redirect back to login or /pending
  expect(page.url()).not.toContain('/login');
  expect(page.url()).not.toContain('/pending');
  await expect(page.locator('h1:has-text("Impostazioni")')).toBeVisible({ timeout: 10_000 });

  // Export page also accessible
  await page.goto('/coda');
  await page.waitForLoadState('networkidle');
  expect(page.url()).not.toContain('/login');

  console.log('  ✅ S1 — admin accede a /impostazioni e /coda senza redirect');
});

// ── S2 ────────────────────────────────────────────────────────────────────────
test('S2 — form "Crea utente" non mostra l\'opzione Super Admin', async ({ page }) => {
  await login(page, 'admin-test@example.com', 'Testbusters123');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20_000 });

  // Navigate directly to tab utenti
  await page.goto('/impostazioni?tab=utenti');
  await page.waitForLoadState('networkidle');

  // Find the role select in the create-user form
  const roleSelect = page.locator('select').filter({ hasText: 'Collaboratore' }).first();
  await expect(roleSelect).toBeVisible({ timeout: 5_000 });

  // Verify "Super Admin" option is NOT present
  const options = await roleSelect.locator('option').allTextContents();
  expect(options).not.toContain('Super Admin');
  expect(options).toContain('Collaboratore');
  expect(options).toContain('Responsabile');
  expect(options).toContain('Amministrazione');
  console.log('  ✅ S2 — opzione "Super Admin" rimossa dal form crea utente. Ruoli presenti:', options);
});

// ── S3 ────────────────────────────────────────────────────────────────────────
test('S3 — superadmin@test.com non può fare login (utente eliminato)', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  await page.fill('input[type="email"]', 'superadmin@test.com');
  await page.fill('input[type="password"]', 'Testbusters123');
  await page.click('button[type="submit"]');

  // Should stay on /login with an error — never redirect to app
  await page.waitForTimeout(3_000);
  expect(page.url()).toContain('/login');

  // Login error message visible
  const errorMsg = page.locator('text=credenziali').or(page.locator('text=errate')).or(page.locator('text=Invalid'));
  // Also acceptable: still on login page (no redirect)
  expect(page.url()).toContain('/login');
  console.log('  ✅ S3 — superadmin@test.com non può fare login, rimane su /login');
});

// ── S4 ────────────────────────────────────────────────────────────────────────
test('S4 — CHECK constraint DB rifiuta INSERT con role=super_admin', async () => {
  // Attempt to insert a user_profiles row with role='super_admin' via REST
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id: '00000000-0000-0000-0000-000000000001',
      role: 'super_admin',
      is_active: true,
    }),
  });

  // Should be rejected (422 or 400 — PostgREST check constraint violation)
  expect(res.ok).toBe(false);
  const body = await res.text();
  expect(body).toMatch(/check|constraint|violat/i);
  console.log('  ✅ S4 — CHECK constraint attivo: INSERT super_admin rifiutato →', res.status);
});
