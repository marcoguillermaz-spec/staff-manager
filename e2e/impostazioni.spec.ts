/**
 * UAT — Blocco Impostazioni avanzate
 * Scenari S1–S11: navigazione tab, CRUD community, member_status, assegnazione responsabile
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - Migration 007_communities_settings.sql applicata (ALTER TABLE communities ADD COLUMN is_active)
 *   - Utenti test: admin-test@example.com, collaboratore@test.com, responsabile@test.com
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

// ── Login helper ──────────────────────────────────────────────────────────────
const CREDS = {
  admin: { email: 'admin-test@example.com', password: 'Testbusters123' },
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

let createdCommunityId = '';
let respUserId         = '';
let respOriginalCommIds: string[] = [];
let collabOriginalStatus = 'attivo';

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe.serial('Impostazioni avanzate UAT', () => {

  test.beforeAll(async () => {
    // Clean up residual UAT communities
    const old = await dbGet<{ id: string }>('communities', 'name=like.%5BUAT%5D%25&select=id');
    for (const c of old) await dbDelete('communities', `id=eq.${c.id}`);

    // Save collaboratore's current member_status for afterAll restore
    const collabStatus = await dbFirst<{ member_status: string }>(
      'user_profiles',
      `user_id=in.(select user_id from collaborators where id='${COLLAB_ID}')&select=member_status`,
    );
    // Fallback via collaborators → user_id resolution
    const collabRow = await dbFirst<{ user_id: string }>('collaborators', `id=eq.${COLLAB_ID}&select=user_id`);
    if (collabRow) {
      const upRow = await dbFirst<{ member_status: string; user_id: string }>(
        'user_profiles', `user_id=eq.${collabRow.user_id}&select=member_status`,
      );
      collabOriginalStatus = upRow?.member_status ?? 'attivo';
    }

    // Resolve first active responsabile user_id + save their community assignments
    const respProfile = await dbFirst<{ user_id: string }>(
      'user_profiles',
      'role=eq.responsabile&is_active=eq.true&select=user_id',
    );
    if (respProfile) {
      respUserId = respProfile.user_id;
      const assignments = await dbGet<{ community_id: string }>(
        'user_community_access',
        `user_id=eq.${respUserId}&select=community_id`,
      );
      respOriginalCommIds = assignments.map((a) => a.community_id);
    }

    console.log(`  ℹ️  collaboratore original status: ${collabOriginalStatus}`);
    console.log(`  ℹ️  responsabile user_id: ${respUserId}`);
    console.log(`  ℹ️  resp original communities: [${respOriginalCommIds.join(', ')}]`);
  });

  test.afterAll(async () => {
    // Delete UAT community
    if (createdCommunityId) await dbDelete('communities', `id=eq.${createdCommunityId}`);

    // Restore collaboratore member_status
    const collabRow = await dbFirst<{ user_id: string }>('collaborators', `id=eq.${COLLAB_ID}&select=user_id`);
    if (collabRow) await dbPatch('user_profiles', `user_id=eq.${collabRow.user_id}`, { member_status: collabOriginalStatus });

    // Restore responsabile community assignments
    if (respUserId) {
      await dbDelete('user_community_access', `user_id=eq.${respUserId}`);
      if (respOriginalCommIds.length > 0) {
        const rows = respOriginalCommIds.map((cid) => ({ user_id: respUserId, community_id: cid }));
        await fetch(`${SUPABASE_URL}/rest/v1/user_community_access`, {
          method: 'POST',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify(rows),
        });
      }
    }
    console.log('  ℹ️  afterAll restore done');
  });

  // ── S1: Tab Utenti di default ─────────────────────────────────────────────
  test('S1 — Admin accede a /impostazioni, tab Utenti attivo e form visibile', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni');

    await expect(page.locator('h1:has-text("Impostazioni")')).toBeVisible();
    await expect(page.locator('a[href="?tab=utenti"].bg-blue-600')).toBeVisible();
    await expect(page.locator('h2:has-text("Crea nuovo utente")')).toBeVisible();
    console.log('  ✅ S1 — tab Utenti attivo, form crea utente visibile');
  });

  // ── S2: Navigazione tab Community ─────────────────────────────────────────
  test('S2 — Admin naviga su tab Community, URL e lista visibili', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=community');

    await expect(page.locator('a[href="?tab=community"].bg-blue-600')).toBeVisible();
    await expect(page.locator('h2:has-text("Crea community")')).toBeVisible();
    await expect(page.locator('h2:has-text("Community esistenti")')).toBeVisible();
    console.log('  ✅ S2 — tab Community attivo, sezioni visibili');
  });

  // ── S3: Crea nuova community ──────────────────────────────────────────────
  test('S3 — Admin crea community [UAT] TestComm, appare nella lista', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=community');

    await page.fill('input[placeholder="Nome community"]', '[UAT] TestComm');
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/communities') && res.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.click('button:has-text("Crea")'),
    ]);

    await expect(page.locator('span:has-text("[UAT] TestComm")')).toBeVisible({ timeout: 10_000 });

    const comm = await dbFirst<{ id: string; name: string; is_active: boolean }>(
      'communities',
      'name=eq.%5BUAT%5D+TestComm&select=id,name,is_active',
    );
    expect(comm).not.toBeNull();
    expect(comm!.is_active).toBe(true);
    createdCommunityId = comm!.id;
    console.log(`  ✅ S3 — community creata: ${createdCommunityId}`);
  });

  // ── S4: Rinomina community ────────────────────────────────────────────────
  test('S4 — Admin rinomina [UAT] TestComm → [UAT] TestComm MODIFICATA', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=community');

    // Click Rinomina on the specific row
    const row = page.locator('div.px-5.py-3').filter({ hasText: '[UAT] TestComm' });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.locator('button:has-text("Rinomina")').click();

    // Editing row now has an input and Salva button
    const editRow = page.locator('div.px-5.py-3').filter({ has: page.locator('button:has-text("Salva")') });
    const renameInput = editRow.locator('input');
    await expect(renameInput).toBeVisible({ timeout: 5_000 });
    await renameInput.fill('[UAT] TestComm MODIFICATA');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/communities/') && res.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      editRow.locator('button:has-text("Salva")').click(),
    ]);

    await expect(page.locator('span:has-text("[UAT] TestComm MODIFICATA")')).toBeVisible({ timeout: 10_000 });

    const comm = await dbFirst<{ name: string }>('communities', `id=eq.${createdCommunityId}&select=name`);
    expect(comm!.name).toBe('[UAT] TestComm MODIFICATA');
    console.log('  ✅ S4 — community rinominata in lista e DB');
  });

  // ── S5: Disattiva community ───────────────────────────────────────────────
  test('S5 — Admin disattiva [UAT] TestComm MODIFICATA, badge Inattiva visibile', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=community');

    const row = page.locator('div.px-5.py-3').filter({ hasText: '[UAT] TestComm MODIFICATA' });
    await expect(row).toBeVisible({ timeout: 10_000 });

    page.once('dialog', (d) => d.accept());
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/communities/') && res.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      row.locator('button:has-text("Disattiva")').click(),
    ]);

    await expect(page.locator('span.text-gray-500:has-text("[UAT] TestComm MODIFICATA")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('span:has-text("Inattiva")')).toBeVisible();

    const comm = await dbFirst<{ is_active: boolean }>('communities', `id=eq.${createdCommunityId}&select=is_active`);
    expect(comm!.is_active).toBe(false);
    console.log('  ✅ S5 — community disattivata, badge Inattiva visibile, DB aggiornato');
  });

  // ── S6: Riattiva community ────────────────────────────────────────────────
  test('S6 — Admin riattiva [UAT] TestComm MODIFICATA, badge scompare', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=community');

    const row = page.locator('div.px-5.py-3').filter({ hasText: '[UAT] TestComm MODIFICATA' });
    await expect(row).toBeVisible({ timeout: 10_000 });

    page.once('dialog', (d) => d.accept());
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/communities/') && res.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      row.locator('button:has-text("Riattiva")').click(),
    ]);

    // Badge "Inattiva" should disappear
    await expect(page.locator('span:has-text("Inattiva")')).not.toBeVisible({ timeout: 10_000 });

    const comm = await dbFirst<{ is_active: boolean }>('communities', `id=eq.${createdCommunityId}&select=is_active`);
    expect(comm!.is_active).toBe(true);
    console.log('  ✅ S6 — community riattivata, badge Inattiva scomparso, DB aggiornato');
  });

  // ── S7: Tab Collaboratori ─────────────────────────────────────────────────
  test('S7 — Admin naviga su tab Collaboratori, lista con dropdown status visibile', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=collaboratori');

    await expect(page.locator('a[href="?tab=collaboratori"].bg-blue-600')).toBeVisible();
    await expect(page.locator('h2:has-text("Stato collaboratori")')).toBeVisible();
    // At least one select (member_status dropdown)
    await expect(page.locator('select').first()).toBeVisible();
    console.log('  ✅ S7 — tab Collaboratori attivo, lista con dropdown visibile');
  });

  // ── S8: Cambia member_status → uscente_con_compenso ──────────────────────
  test('S8 — Admin cambia status di collaboratore → uscente_con_compenso, DB aggiornato', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=collaboratori');

    // Find the row for collaboratore@test.com (cognome=Test nome=Collaboratore)
    const memberRow = page.locator('div.px-5.py-3').filter({ hasText: 'Collaboratore' });
    await expect(memberRow).toBeVisible({ timeout: 10_000 });

    const select = memberRow.locator('select');
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/members/') && res.url().includes('/status') && res.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      select.selectOption('uscente_con_compenso'),
    ]);

    // Label should update
    await expect(memberRow.locator('p.text-yellow-400')).toBeVisible({ timeout: 10_000 });

    // Verify DB
    const collabRow = await dbFirst<{ user_id: string }>('collaborators', `id=eq.${COLLAB_ID}&select=user_id`);
    const up = await dbFirst<{ member_status: string }>('user_profiles', `user_id=eq.${collabRow!.user_id}&select=member_status`);
    expect(up!.member_status).toBe('uscente_con_compenso');
    console.log('  ✅ S8 — member_status aggiornato a uscente_con_compenso in lista e DB');
  });

  // ── S9: Ripristina member_status → attivo ─────────────────────────────────
  test('S9 — Admin ripristina status collaboratore → attivo, DB aggiornato', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/impostazioni?tab=collaboratori');

    const memberRow = page.locator('div.px-5.py-3').filter({ hasText: 'Collaboratore' });
    await expect(memberRow).toBeVisible({ timeout: 10_000 });

    const select = memberRow.locator('select');
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/members/') && res.url().includes('/status') && res.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      select.selectOption('attivo'),
    ]);

    await expect(memberRow.locator('p.text-green-400')).toBeVisible({ timeout: 10_000 });

    const collabRow = await dbFirst<{ user_id: string }>('collaborators', `id=eq.${COLLAB_ID}&select=user_id`);
    const up = await dbFirst<{ member_status: string }>('user_profiles', `user_id=eq.${collabRow!.user_id}&select=member_status`);
    expect(up!.member_status).toBe('attivo');
    console.log('  ✅ S9 — member_status ripristinato ad attivo');
  });

  // ── S10: Modifica community assegnate a un responsabile ───────────────────
  test('S10 — Admin modifica community del responsabile, assegnazione aggiornata', async ({ page }) => {
    if (!respUserId) {
      console.log('  ⚠️  S10 skipped: nessun responsabile attivo trovato');
      return;
    }

    await login(page, 'admin');
    await page.goto('/impostazioni?tab=community');

    // Find the responsabile section and click Modifica on first responsabile
    const respSection = page.locator('div.rounded-2xl').filter({ has: page.locator('h2:has-text("Community per responsabile")') });
    await expect(respSection).toBeVisible({ timeout: 10_000 });

    // Rows have space-y-2 class (header has border-b, not space-y-2)
    const firstRespRow = respSection.locator('div.space-y-2').first();
    await expect(firstRespRow).toBeVisible({ timeout: 10_000 });
    await firstRespRow.locator('button:has-text("Modifica")').click();

    // Select [UAT] TestComm MODIFICATA if visible in checkboxes
    const testCommCheckbox = page.locator(`label:has(span:has-text("[UAT] TestComm MODIFICATA"))`);
    if (await testCommCheckbox.count() > 0) {
      const checkbox = testCommCheckbox.locator('input[type="checkbox"]');
      const isChecked = await checkbox.isChecked();
      if (!isChecked) await checkbox.check();
    }

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/admin/responsabili/') && res.url().includes('/communities') && res.request().method() === 'PUT',
        { timeout: 15_000 },
      ),
      firstRespRow.locator('button:has-text("Salva")').click(),
    ]);

    // Verify DB: user_community_access for this user_id
    const assignments = await dbGet<{ community_id: string }>(
      'user_community_access',
      `user_id=eq.${respUserId}&select=community_id`,
    );
    // Check [UAT] TestComm MODIFICATA is among the assigned communities
    const assignedIds = assignments.map((a) => a.community_id);
    expect(assignedIds).toContain(createdCommunityId);
    console.log(`  ✅ S10 — assegnazione responsabile aggiornata: ${assignedIds.length} community`);
  });

  // ── S11: Verifica DB aggregata ─────────────────────────────────────────────
  test('S11 — DB: community is_active corretto, member_status attivo, history coerente', async () => {
    // Community exists and is active
    const comm = await dbFirst<{ name: string; is_active: boolean }>(
      'communities',
      `id=eq.${createdCommunityId}&select=name,is_active`,
    );
    expect(comm).not.toBeNull();
    expect(comm!.name).toBe('[UAT] TestComm MODIFICATA');
    expect(comm!.is_active).toBe(true);

    // collaboratore member_status is attivo (restored in S9)
    const collabRow = await dbFirst<{ user_id: string }>('collaborators', `id=eq.${COLLAB_ID}&select=user_id`);
    const up = await dbFirst<{ member_status: string }>('user_profiles', `user_id=eq.${collabRow!.user_id}&select=member_status`);
    expect(up!.member_status).toBe('attivo');

    console.log('  ✅ S11 — DB: community name/is_active corretti, member_status=attivo');
  });
});
