/**
 * UAT — Dual-mode invite form
 * Scenari S1, S4, S6, S7
 *
 * Copertura:
 *   S1 — Toggle default "Invito rapido", nome/cognome visibili, CF/indirizzo assenti
 *   S4 — "Conferma" disabled senza nome in quick mode
 *   S6 — Invito rapido collaboratore → credenziali + DB nome/cognome valorizzati, CF NULL
 *   S7 — Invito completo responsabile con CF + community → DB CF valorizzato + user_community_access
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

async function deleteAuthUser(userId: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}

// ── Login helper ──────────────────────────────────────────────────────────────
async function loginAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin-test@example.com');
  await page.fill('input[type="password"]', 'Testbusters123');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });
}

// ── Test emails (UAT-only, cleaned up in afterAll) ────────────────────────────
const EMAIL_QUICK = 'uat-invite-quick@test.local';
const EMAIL_FULL  = 'uat-invite-full@test.local';

const COMMUNITY_ID = '6a5aeb11-d4bc-4575-84ad-9c343ea95bbf'; // Testbusters

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Invite form dual-mode UAT', () => {

  test.beforeAll(async () => {
    // Cleanup first — delete any residual users from previous runs
    for (const email of [EMAIL_QUICK, EMAIL_FULL]) {
      const profile = await dbFirst<{ user_id: string }>('user_profiles',
        `select=user_id`);
      // Find by looking up auth users via collaborators email column
      const collab = await dbFirst<{ user_id: string }>('collaborators',
        `email=eq.${email}&select=user_id`);
      if (collab?.user_id) {
        await dbDelete('user_community_access', `user_id=eq.${collab.user_id}`);
        await dbDelete('collaborators', `user_id=eq.${collab.user_id}`);
        await dbDelete('user_profiles', `user_id=eq.${collab.user_id}`);
        await deleteAuthUser(collab.user_id);
      }
      void profile; // suppress unused warning
    }
  });

  test.afterAll(async () => {
    for (const email of [EMAIL_QUICK, EMAIL_FULL]) {
      const collab = await dbFirst<{ user_id: string }>('collaborators',
        `email=eq.${email}&select=user_id`);
      if (collab?.user_id) {
        await dbDelete('user_community_access', `user_id=eq.${collab.user_id}`);
        await dbDelete('collaborators', `user_id=eq.${collab.user_id}`);
        await dbDelete('user_profiles', `user_id=eq.${collab.user_id}`);
        await deleteAuthUser(collab.user_id);
      }
    }
    console.log('  🧹 Cleaned up UAT invite users');
  });

  // ── S1 — Toggle default + campi quick mode ────────────────────────────────
  test('S1 — Quick mode default: nome/cognome visibili, CF/indirizzo assenti', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/impostazioni');

    // Tab "Utenti" visibile e attivo di default
    const utentiTab = page.locator('button:has-text("Utenti"), a:has-text("Utenti")').first();
    await expect(utentiTab).toBeVisible({ timeout: 10_000 });

    // Pulsante "Invito rapido" attivo (bg-blue-600)
    const quickBtn = page.locator('button:has-text("Invito rapido")');
    await expect(quickBtn).toBeVisible();
    await expect(quickBtn).toHaveClass(/bg-blue-600/);

    // Pulsante "Invito completo" non attivo
    const fullBtn = page.locator('button:has-text("Invito completo")');
    await expect(fullBtn).toBeVisible();
    await expect(fullBtn).not.toHaveClass(/bg-blue-600/);

    // In quick mode: nome + cognome visibili
    await expect(page.locator('input[placeholder="Mario"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Rossi"]')).toBeVisible();

    // In quick mode: CF e indirizzo NON presenti
    await expect(page.locator('input[placeholder="RSSMRA80A01H501U"]')).not.toBeVisible();
    await expect(page.locator('input[placeholder="Via Roma"]')).not.toBeVisible();

    console.log('  ✅ S1 — Toggle quick default, campi attesi visibili/assenti');
  });

  // ── S4 — Conferma disabled senza nome in quick mode ──────────────────────
  test('S4 — Quick mode: "Conferma" disabled senza nome', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/impostazioni');

    const confirmBtn = page.locator('button[type="submit"]:has-text("Conferma")');
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 });

    // Con solo email e tipo_contratto compilati (nome/cognome vuoti)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.locator('select').first().selectOption('collaboratore');
    // tipo_contratto è il secondo select (dopo ruolo)
    await page.locator('select').nth(1).selectOption('OCCASIONALE');

    // Pulsante ancora disabled (nome vuoto)
    await expect(confirmBtn).toBeDisabled();

    // Compila solo nome, lascia cognome vuoto
    await page.fill('input[placeholder="Mario"]', 'Mario');
    await expect(confirmBtn).toBeDisabled();

    // Compila anche cognome → pulsante abilitato
    await page.fill('input[placeholder="Rossi"]', 'Rossi');
    await expect(confirmBtn).toBeEnabled();

    console.log('  ✅ S4 — Conferma disabled senza nome/cognome, enabled con entrambi');
  });

  // ── S6 — Invito rapido collaboratore → DB verify ─────────────────────────
  test('S6 — Invito rapido collaboratore: credenziali + DB nome/cognome valorizzati, CF NULL', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/impostazioni');

    await expect(page.locator('button:has-text("Invito rapido")')).toBeVisible({ timeout: 10_000 });

    // Quick mode attivo di default — compila il form
    await page.fill('input[type="email"]', EMAIL_QUICK);
    await page.locator('select').first().selectOption('collaboratore');
    await page.locator('select').nth(1).selectOption('OCCASIONALE');
    await page.fill('input[placeholder="Mario"]', 'Test');
    await page.fill('input[placeholder="Rossi"]', 'Rapido');

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/admin/create-user') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.click('button[type="submit"]:has-text("Conferma")'),
    ]);

    // Pannello credenziali visibile con l'email
    await expect(page.locator(`text=${EMAIL_QUICK}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Password temporanea')).toBeVisible();

    // DB verify: nome/cognome valorizzati, codice_fiscale NULL
    const collab = await dbFirst<{ nome: string; cognome: string; codice_fiscale: string | null }>(
      'collaborators',
      `email=eq.${EMAIL_QUICK}&select=nome,cognome,codice_fiscale`,
    );
    expect(collab).not.toBeNull();
    expect(collab!.nome).toBe('Test');
    expect(collab!.cognome).toBe('Rapido');
    expect(collab!.codice_fiscale).toBeNull();

    console.log('  ✅ S6 — Invito rapido: credenziali mostrate, DB nome/cognome OK, CF NULL');
  });

  // ── S7 — Invito completo responsabile con CF + community ─────────────────
  test('S7 — Invito completo responsabile: DB CF valorizzato + user_community_access', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/impostazioni');

    await expect(page.locator('button:has-text("Invito completo")')).toBeVisible({ timeout: 10_000 });

    // Passa a modalità completa
    await page.click('button:has-text("Invito completo")');

    // Seleziona ruolo responsabile
    await page.locator('select').first().selectOption('responsabile');

    // Assegna community (prima checkbox disponibile)
    const communityCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(communityCheckbox).toBeVisible({ timeout: 5_000 });
    await communityCheckbox.check();

    // Tipo contratto
    await page.locator('select').nth(1).selectOption('COCOCO');

    // Compila email
    await page.fill('input[type="email"]', EMAIL_FULL);

    // Compila CF (campo visibile solo in full mode)
    await page.fill('input[placeholder="RSSMRA80A01H501U"]', 'TSTCMP80A01H501U');

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/admin/create-user') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.click('button[type="submit"]:has-text("Conferma")'),
    ]);

    // Pannello credenziali
    await expect(page.locator(`text=${EMAIL_FULL}`).first()).toBeVisible({ timeout: 10_000 });

    // DB verify: CF valorizzato
    const collab = await dbFirst<{ user_id: string; codice_fiscale: string | null }>(
      'collaborators',
      `email=eq.${EMAIL_FULL}&select=user_id,codice_fiscale`,
    );
    expect(collab).not.toBeNull();
    expect(collab!.codice_fiscale).toBe('TSTCMP80A01H501U');

    // DB verify: user_community_access ha almeno una riga per questo utente
    const access = await dbFirst<{ community_id: string }>(
      'user_community_access',
      `user_id=eq.${collab!.user_id}&select=community_id`,
    );
    expect(access).not.toBeNull();

    console.log('  ✅ S7 — Invito completo: DB CF valorizzato, community assegnata');
  });

});
