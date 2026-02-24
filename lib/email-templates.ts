// HTML email templates for transactional notifications.
// All templates share a common header (Testbusters logo) and legal footer.

const LOGO_URL =
  'https://nyajqcjqmgxctlqighql.supabase.co/storage/v1/object/public/avatars/brand/testbusters_logo.png';

// APP_URL is the base URL of the application.
// Set the APP_URL environment variable in production to point to the live deployment.
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

const BRAND_COLOR = '#E8320A';

// ── Shared layout ────────────────────────────────────────────
function layout(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Staff Manager — Testbusters</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:${BRAND_COLOR};padding:28px 40px;text-align:center;">
              <img src="${LOGO_URL}" width="56" height="56" alt="Testbusters" style="display:inline-block;border-radius:50%;" />
              <div style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.05em;margin-top:10px;text-transform:uppercase;">Staff Manager</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;line-height:1.6;">
                Sede legale (non aperta al pubblico)<br/>
                Via Marco Ulpio Traiano 17, 20149 Milano
              </p>
              <p style="margin:0;font-size:10px;color:#d1d5db;line-height:1.6;">
                Testbusters S.r.l. Società Benefit &nbsp;|&nbsp; P.Iva / CF 08459930965 &nbsp;|&nbsp;
                Cod. Dest. M5UXCR1 &nbsp;|&nbsp; Cap. Soc. 50.000€
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function greeting(nome: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:#374151;">Ciao <strong>${nome}</strong>,</p>`;
}

function highlight(rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px 16px;font-size:12px;color:#6b7280;width:40%;">${r.label}</td>
          <td style="padding:8px 16px;font-size:13px;color:#111827;font-weight:600;">${r.value}</td>
        </tr>`,
    )
    .join('');
  return `<table width="100%" cellpadding="0" cellspacing="0"
    style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:20px 0;border-collapse:collapse;">
    ${cells}
  </table>`;
}

function ctaButton(label: string): string {
  return `<div style="text-align:center;margin:28px 0 8px;">
    <a href="${APP_URL}"
       style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;
              font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;letter-spacing:0.02em;">
      ${label}
    </a>
  </div>`;
}

function bodyText(text: string): string {
  return `<p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">${text}</p>`;
}

function note(text: string): string {
  return `<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:10px 16px;border-radius:0 6px 6px 0;margin:12px 0;">
    <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;"><strong>Nota:</strong> ${text}</p>
  </div>`;
}

function eur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

// ── E1 — Integrazioni richieste (compenso o rimborso) ────────
export function emailIntegrazioni(p: {
  nome: string;
  tipo: 'Compenso' | 'Rimborso';
  importo: number;
  data: string;
  nota?: string | null;
}): { subject: string; html: string } {
  const body = `
    ${greeting(p.nome)}
    ${bodyText(`Il tuo <strong>${p.tipo}</strong> del <strong>${p.data}</strong> richiede integrazioni prima di poter essere elaborato.`)}
    ${highlight([
      { label: 'Tipo', value: p.tipo },
      { label: 'Importo', value: eur(p.importo) },
      { label: 'Stato', value: 'Integrazioni richieste' },
    ])}
    ${p.nota ? note(p.nota) : ''}
    ${bodyText('Accedi all\'app per completare le informazioni richieste.')}
    ${ctaButton('Vai all\'app')}
  `;
  return {
    subject: `Hai un ${p.tipo.toLowerCase()} che richiede integrazioni`,
    html: layout(body),
  };
}

// ── E2 — Approvato ──────────────────────────────────────────
export function emailApprovato(p: {
  nome: string;
  tipo: 'Compenso' | 'Rimborso';
  importo: number;
  data: string;
}): { subject: string; html: string } {
  const body = `
    ${greeting(p.nome)}
    ${bodyText(`Il tuo <strong>${p.tipo}</strong> del <strong>${p.data}</strong> è stato <strong>approvato</strong> dall'amministrazione.`)}
    ${highlight([
      { label: 'Tipo', value: p.tipo },
      { label: 'Importo', value: eur(p.importo) },
      { label: 'Stato', value: 'Approvato' },
    ])}
    ${bodyText('Il pagamento verrà elaborato nei prossimi giorni.')}
    ${ctaButton('Vai all\'app')}
  `;
  return {
    subject: `Il tuo ${p.tipo.toLowerCase()} è stato approvato ✓`,
    html: layout(body),
  };
}

// ── E3 — Rifiutato ──────────────────────────────────────────
export function emailRifiutato(p: {
  nome: string;
  tipo: 'Compenso' | 'Rimborso';
  importo: number;
  data: string;
}): { subject: string; html: string } {
  const body = `
    ${greeting(p.nome)}
    ${bodyText(`Il tuo <strong>${p.tipo}</strong> del <strong>${p.data}</strong> non è stato approvato.`)}
    ${highlight([
      { label: 'Tipo', value: p.tipo },
      { label: 'Importo', value: eur(p.importo) },
      { label: 'Stato', value: 'Rifiutato' },
    ])}
    ${bodyText('Per chiarimenti contatta il tuo responsabile o apri un ticket di supporto.')}
    ${ctaButton('Vai all\'app')}
  `;
  return {
    subject: `Il tuo ${p.tipo.toLowerCase()} non è stato approvato`,
    html: layout(body),
  };
}

// ── E4 — Pagato ─────────────────────────────────────────────
export function emailPagato(p: {
  nome: string;
  tipo: 'Compenso' | 'Rimborso';
  importo: number;
  dataPagamento: string;
}): { subject: string; html: string } {
  const body = `
    ${greeting(p.nome)}
    ${bodyText(`Il pagamento del tuo <strong>${p.tipo}</strong> è stato registrato.`)}
    ${highlight([
      { label: 'Tipo', value: p.tipo },
      { label: 'Importo pagato', value: eur(p.importo) },
      { label: 'Data', value: p.dataPagamento },
    ])}
    ${bodyText('Puoi consultare il dettaglio e il riepilogo dei pagamenti nell\'app.')}
    ${ctaButton('Vai all\'app')}
  `;
  return {
    subject: `Pagamento effettuato — ${p.tipo} ${p.dataPagamento}`,
    html: layout(body),
  };
}

// ── E5 — Documento da firmare ───────────────────────────────
export function emailDocumentoDaFirmare(p: {
  nome: string;
  titoloDocumento: string;
  data: string;
}): { subject: string; html: string } {
  const body = `
    ${greeting(p.nome)}
    ${bodyText('È disponibile un nuovo documento che richiede la tua firma.')}
    ${highlight([
      { label: 'Documento', value: p.titoloDocumento },
      { label: 'Caricato il', value: p.data },
    ])}
    ${bodyText('Accedi all\'app, scarica il documento, firmalo e carica la versione firmata.')}
    ${ctaButton('Firma il documento')}
  `;
  return {
    subject: 'Hai un nuovo documento da firmare',
    html: layout(body),
  };
}

// ── E6 — Nuovo compenso/rimborso inviato (→ responsabile) ───
export function emailNuovoInviato(p: {
  nomeResponsabile: string;
  nomeCollaboratore: string;
  tipo: 'Compenso' | 'Rimborso';
  importo: number;
  community: string;
  data: string;
}): { subject: string; html: string } {
  const body = `
    ${greeting(p.nomeResponsabile)}
    ${bodyText(`<strong>${p.nomeCollaboratore}</strong> ha inviato un nuovo <strong>${p.tipo}</strong> in attesa di pre-approvazione.`)}
    ${highlight([
      { label: 'Collaboratore', value: p.nomeCollaboratore },
      { label: 'Community', value: p.community },
      { label: 'Importo', value: eur(p.importo) },
      { label: 'Data invio', value: p.data },
    ])}
    ${bodyText('Accedi all\'app per esaminarlo e pre-approvarlo o richiedere integrazioni.')}
    ${ctaButton('Vai all\'app')}
  `;
  return {
    subject: `Nuovo ${p.tipo.toLowerCase()} da approvare — ${p.nomeCollaboratore}`,
    html: layout(body),
  };
}

// ── E8 — Invito utente ──────────────────────────────────────
export function emailInvito(p: {
  email: string;
  password: string;
  ruolo: string;
}): { subject: string; html: string } {
  const body = `
    ${bodyText('Sei stato invitato ad accedere a <strong>Staff Manager</strong>, la piattaforma di gestione collaboratori di Testbusters.')}
    ${highlight([
      { label: 'Email',              value: p.email },
      { label: 'Password temporanea', value: p.password },
      { label: 'Ruolo',              value: p.ruolo },
    ])}
    ${note('Al primo accesso ti verrà chiesto di impostare una nuova password personale.')}
    ${bodyText('Clicca sul pulsante qui sotto per accedere alla piattaforma.')}
    ${ctaButton('Accedi a Staff Manager')}
  `;
  return {
    subject: 'Sei stato invitato a Staff Manager — Testbusters',
    html: layout(body),
  };
}

// ── E7 — Nuovo ticket (→ responsabile) ─────────────────────
export function emailNuovoTicket(p: {
  nomeResponsabile: string;
  nomeCollaboratore: string;
  oggetto: string;
  categoria: string;
  data: string;
}): { subject: string; html: string } {
  const body = `
    ${greeting(p.nomeResponsabile)}
    ${bodyText(`<strong>${p.nomeCollaboratore}</strong> ha aperto un nuovo ticket di supporto.`)}
    ${highlight([
      { label: 'Collaboratore', value: p.nomeCollaboratore },
      { label: 'Categoria', value: p.categoria },
      { label: 'Oggetto', value: p.oggetto },
      { label: 'Data', value: p.data },
    ])}
    ${bodyText('Accedi all\'app per leggere il messaggio e rispondere.')}
    ${ctaButton('Vai al ticket')}
  `;
  return {
    subject: `Nuovo ticket di supporto — ${p.oggetto}`,
    html: layout(body),
  };
}
