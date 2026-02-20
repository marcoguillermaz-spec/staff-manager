/**
 * UAT — Blocco Rimborsi
 * Scenari: S3→S4→S5→S6→S7 (flusso completo) + S8 (rifiuto) + S10 (timeline)
 *
 * Prerequisiti:
 *   - Dev server attivo su localhost:3000
 *   - Supabase RLS expense fix applicato (responsabile vede via collaborator_communities)
 */

import { test, expect, type Page } from '@playwright/test';

// ── Supabase REST helper (service role — bypasses RLS) ────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function db<T = unknown>(table: string, params = ''): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  return res.json();
}

async function dbFirst<T = unknown>(table: string, params = ''): Promise<T | null> {
  const rows = await db<T>(table, params + '&limit=1');
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
  collaboratore: { email: 'mario.rossi@test.com',       password: 'Testbusters123' },
  responsabile:  { email: 'responsabile@test.com',       password: 'Testbusters123' },
  admin:         { email: 'admin-test@example.com',      password: 'Testbusters123' },
};

async function login(page: Page, role: keyof typeof CREDS) {
  const { email, password } = CREDS[role];
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });
}

// ── Shared state (serial tests share this closure) ────────────────────────────
let mainExpenseId: string;  // expense that goes through full approval flow
let rejectExpenseId: string; // expense used to test rejection

// ── Test suite ────────────────────────────────────────────────────────────────
test.describe.serial('Rimborsi UAT', () => {

  test.beforeAll(async () => {
    // Clean up any pre-existing test expenses from this collaborator so we start fresh
    const collaboratorId = '3a55c2da-4906-42d7-81e1-c7c7b399ab4b';
    const existing = await db<{ id: string }>('expense_reimbursements',
      `collaborator_id=eq.${collaboratorId}&select=id`);
    for (const e of existing) {
      await dbDelete('expense_history',          `reimbursement_id=eq.${e.id}`);
      await dbDelete('expense_attachments',      `reimbursement_id=eq.${e.id}`);
      await dbDelete('expense_reimbursements',   `id=eq.${e.id}`);
    }
    console.log(`  🧹 Cleaned ${existing.length} existing expense(s)`);
  });

  // ── S1: Collaboratore crea un rimborso ─────────────────────────────────────
  test('S1 — Collaboratore: crea rimborso, verifica stato INVIATO nel DB', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/rimborsi/nuova');

    await page.selectOption('select', 'Trasporto');
    await page.fill('input[type="date"]', '2026-02-10');
    await page.fill('input[type="number"]', '75');
    await page.fill('textarea', 'Biglietto treno Roma-Milano per UAT test');

    await page.click('button:has-text("Invia rimborso")');
    await page.waitForURL('/rimborsi', { timeout: 15_000 });

    // Verify DB
    const expense = await dbFirst<{ id: string; stato: string; importo: number }>(
      'expense_reimbursements',
      'select=id,stato,importo&importo=eq.75&order=created_at.desc',
    );
    expect(expense).not.toBeNull();
    expect(expense!.stato).toBe('INVIATO');
    expect(expense!.importo).toBe(75);
    mainExpenseId = expense!.id;
    console.log(`  ✅ S1 — expense ${mainExpenseId} — stato: INVIATO`);
  });

  // ── S2: Collaboratore crea rimborso senza allegato ─────────────────────────
  test('S2 — Collaboratore: crea rimborso senza allegato (opzionale)', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto('/rimborsi/nuova');

    await page.selectOption('select', 'Alloggio');
    await page.fill('input[type="date"]', '2026-02-11');
    await page.fill('input[type="number"]', '200');
    await page.fill('textarea', 'Hotel per UAT rifiuto test');

    await page.click('button:has-text("Invia rimborso")');
    await page.waitForURL('/rimborsi', { timeout: 15_000 });

    const expense = await dbFirst<{ id: string; stato: string }>(
      'expense_reimbursements',
      'select=id,stato&importo=eq.200&order=created_at.desc',
    );
    expect(expense!.stato).toBe('INVIATO');
    rejectExpenseId = expense!.id;
    console.log(`  ✅ S2 — expense ${rejectExpenseId} (per S8 rifiuto) — stato: INVIATO`);
  });

  // ── S3: Responsabile vede i rimborsi in /approvazioni?tab=rimborsi ─────────
  test('S3 — Responsabile: vede rimborsi nella tab Approvazioni', async ({ page }) => {
    await login(page, 'responsabile');
    await page.goto('/approvazioni?tab=rimborsi');

    // At least one row should be visible
    await expect(page.locator('table tbody tr')).toHaveCount(2, { timeout: 10_000 });

    // "Dettaglio →" link for our main expense
    const detailLink = page.locator(`a[href="/rimborsi/${mainExpenseId}"]`);
    await expect(detailLink).toBeVisible();
    console.log(`  ✅ S3 — responsabile vede ${mainExpenseId} nella lista`);
  });

  // ── S4: Responsabile richiede integrazioni ─────────────────────────────────
  test('S4 — Responsabile: richiede integrazioni (nota corta → disabilitato)', async ({ page }) => {
    await login(page, 'responsabile');
    await page.goto(`/rimborsi/${mainExpenseId}`);

    // Click "Richiedi integrazioni"
    await page.click('button:has-text("Richiedi integrazioni")');

    // Modal opens — short note → button disabled
    await page.fill('textarea', 'Troppo corta');
    const submitBtn = page.locator('button:has-text("Invia richiesta")');
    await expect(submitBtn).toBeDisabled();

    // Long enough note → button enabled
    await page.fill('textarea', 'Per favore allega la ricevuta originale del biglietto del treno.');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Wait for modal to close and badge to change to yellow (INTEGRAZIONI_RICHIESTE)
    await page.waitForSelector('span.text-yellow-300', { timeout: 15_000 });
    const expense = await dbFirst<{ stato: string; integration_note: string }>(
      'expense_reimbursements',
      `select=stato,integration_note&id=eq.${mainExpenseId}`,
    );
    expect(expense!.stato).toBe('INTEGRAZIONI_RICHIESTE');
    expect(expense!.integration_note).toContain('ricevuta originale');
    console.log(`  ✅ S4 — stato: INTEGRAZIONI_RICHIESTE, nota salvata`);
  });

  // ── S5: Collaboratore ri-invia ─────────────────────────────────────────────
  test('S5 — Collaboratore: ri-invia dopo integrazioni', async ({ page }) => {
    await login(page, 'collaboratore');
    await page.goto(`/rimborsi/${mainExpenseId}`);

    // Integration note visible in yellow
    await expect(page.locator('text=ricevuta originale').first()).toBeVisible();

    // "Ri-invia" button
    await page.click('button:has-text("Ri-invia")');
    // Wait for badge to change to blue (INVIATO) — yellow badge disappears
    await page.waitForSelector('span.text-blue-300', { timeout: 15_000 });

    const expense = await dbFirst<{ stato: string }>('expense_reimbursements',
      `select=stato&id=eq.${mainExpenseId}`);
    expect(expense!.stato).toBe('INVIATO');
    console.log(`  ✅ S5 — stato: INVIATO (dopo ri-invio)`);
  });

  // ── S6: Responsabile pre-approva ───────────────────────────────────────────
  test('S6 — Responsabile: pre-approva entrambi i rimborsi', async ({ page }) => {
    await login(page, 'responsabile');

    // Pre-approve main expense
    await page.goto(`/rimborsi/${mainExpenseId}`);
    await page.click('button:has-text("Pre-approva")');
    // Wait for badge to change to indigo (PRE_APPROVATO_RESP)
    await page.waitForSelector('span.text-indigo-300', { timeout: 15_000 });

    let expense = await dbFirst<{ stato: string; manager_approved_at: string }>(
      'expense_reimbursements',
      `select=stato,manager_approved_at&id=eq.${mainExpenseId}`,
    );
    expect(expense!.stato).toBe('PRE_APPROVATO_RESP');
    expect(expense!.manager_approved_at).not.toBeNull();
    console.log(`  ✅ S6a — main expense: PRE_APPROVATO_RESP`);

    // Pre-approve reject expense (so admin can reject it)
    await page.goto(`/rimborsi/${rejectExpenseId}`);
    await page.click('button:has-text("Pre-approva")');
    await page.waitForSelector('span.text-indigo-300', { timeout: 15_000 });

    expense = await dbFirst<{ stato: string; manager_approved_at: string }>(
      'expense_reimbursements',
      `select=stato,manager_approved_at&id=eq.${rejectExpenseId}`,
    );
    expect(expense!.stato).toBe('PRE_APPROVATO_RESP');
    console.log(`  ✅ S6b — reject expense: PRE_APPROVATO_RESP`);
  });

  // ── S8: Admin rifiuta ─────────────────────────────────────────────────────
  test('S8 — Admin: rifiuta un rimborso pre-approvato', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`/rimborsi/${rejectExpenseId}`);

    await page.click('button:has-text("Rifiuta")');
    // Wait for badge to change to red (RIFIUTATO)
    await page.waitForSelector('span.text-red-300', { timeout: 15_000 });

    const expense = await dbFirst<{ stato: string }>('expense_reimbursements',
      `select=stato&id=eq.${rejectExpenseId}`);
    expect(expense!.stato).toBe('RIFIUTATO');
    console.log(`  ✅ S8 — stato: RIFIUTATO`);
  });

  // ── S7: Admin approva definitivamente e segna come pagato ────────────────
  test('S7 — Admin: approva + segna come pagato (con riferimento)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`/rimborsi/${mainExpenseId}`);

    // Verify tab Coda shows the expense
    await page.goto('/coda?tab=rimborsi');
    await expect(page.locator(`a[href="/rimborsi/${mainExpenseId}"]`)).toBeVisible();

    // Approve admin
    await page.goto(`/rimborsi/${mainExpenseId}`);
    await page.click('button:has-text("Approva")');
    // Wait for badge to change to green (APPROVATO_ADMIN) — indigo badge disappears
    await page.waitForSelector('span.text-green-300', { timeout: 15_000 });

    let expense = await dbFirst<{ stato: string; admin_approved_at: string; paid_at?: string | null; payment_reference?: string | null }>(
      'expense_reimbursements',
      `select=stato,admin_approved_at&id=eq.${mainExpenseId}`,
    );
    expect(expense!.stato).toBe('APPROVATO_ADMIN');
    expect(expense!.admin_approved_at).not.toBeNull();
    console.log(`  ✅ S7a — stato: APPROVATO_ADMIN`);

    // Mark paid
    await page.click('button:has-text("Segna come pagato")');
    await page.fill('input[type="text"]', 'CRO-2026-UAT-001');
    await page.click('button:has-text("Conferma pagamento")');
    // Wait for badge to change to emerald (PAGATO)
    await page.waitForSelector('span.text-emerald-300', { timeout: 15_000 });

    expense = await dbFirst<{ stato: string; admin_approved_at: string; paid_at?: string | null; payment_reference?: string | null }>(
      'expense_reimbursements',
      `select=stato,paid_at,payment_reference&id=eq.${mainExpenseId}`,
    );
    expect(expense!.stato).toBe('PAGATO');
    expect(expense!.paid_at).not.toBeNull();
    expect(expense!.payment_reference).toBe('CRO-2026-UAT-001');
    console.log(`  ✅ S7b — stato: PAGATO, ref: ${expense!.payment_reference}`);
  });

  // ── S10: Timeline cronologia completa ────────────────────────────────────
  test('S10 — Timeline: tutti gli eventi registrati nell\'ordine corretto', async ({ page }) => {
    const history = await db<{
      stato_precedente: string | null;
      stato_nuovo: string;
      role_label: string;
    }>(
      'expense_history',
      `reimbursement_id=eq.${mainExpenseId}&select=stato_precedente,stato_nuovo,role_label&order=created_at.asc`,
    );

    // Expected sequence
    const expected = [
      { from: null,                     to: 'INVIATO',                label: 'Collaboratore' },
      { from: 'INVIATO',                to: 'INTEGRAZIONI_RICHIESTE', label: 'Responsabile' },
      { from: 'INTEGRAZIONI_RICHIESTE', to: 'INVIATO',                label: 'Collaboratore' },
      { from: 'INVIATO',                to: 'PRE_APPROVATO_RESP',     label: 'Responsabile' },
      { from: 'PRE_APPROVATO_RESP',     to: 'APPROVATO_ADMIN',        label: 'Amministrazione' },
      { from: 'APPROVATO_ADMIN',        to: 'PAGATO',                 label: 'Amministrazione' },
    ];

    expect(history).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(history[i].stato_precedente).toBe(expected[i].from);
      expect(history[i].stato_nuovo).toBe(expected[i].to);
      expect(history[i].role_label).toBe(expected[i].label);
    }

    // Also verify UI shows timeline on detail page
    await login(page, 'collaboratore');
    await page.goto(`/rimborsi/${mainExpenseId}`);
    await expect(page.locator('text=Cronologia')).toBeVisible();
    // Pagato badge visible (use CSS class to avoid strict mode: badge + timeline both have "PAGATO")
    await expect(page.locator('span.text-emerald-300')).toBeVisible();

    console.log(`  ✅ S10 — ${history.length} eventi in cronologia, sequenza corretta`);
    console.log('  History:', history.map(h => `${h.stato_precedente ?? 'null'} → ${h.stato_nuovo} (${h.role_label})`).join(' | '));
  });

  // ── S9: Guardrail ruoli ──────────────────────────────────────────────────
  test('S9 — Guardrail: /rimborsi redirect se non collaboratore', async ({ page }) => {
    await login(page, 'responsabile');
    await page.goto('/rimborsi');
    // Should redirect away from /rimborsi (responsabile has no access)
    await expect(page).not.toHaveURL('/rimborsi');
    console.log(`  ✅ S9a — responsabile rediretto da /rimborsi → ${page.url()}`);
  });

  test('S9 — Guardrail: API transizione → 403 per ruolo non autorizzato', async ({ page }) => {
    // responsabile non può fare approve_admin
    await login(page, 'responsabile');

    const res = await page.evaluate(
      async ({ id }: { id: string }) => {
        const r = await fetch(`/api/expenses/${id}/transition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve_admin' }),
        });
        return r.status;
      },
      { id: mainExpenseId },
    );
    expect(res).toBe(403);
    console.log(`  ✅ S9b — responsabile → approve_admin → 403`);
  });
});
