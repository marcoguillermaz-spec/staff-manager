// ── Roles ──────────────────────────────────────────────────
export type Role = 'collaboratore' | 'responsabile' | 'amministrazione' | 'super_admin';

export type MemberStatus = 'attivo' | 'uscente_con_compenso' | 'uscente_senza_compenso';

// ── Compensation ────────────────────────────────────────────
export type CompensationType = 'OCCASIONALE' | 'PIVA';

export type CompensationStatus =
  | 'BOZZA'
  | 'INVIATO'
  | 'INTEGRAZIONI_RICHIESTE'
  | 'PRE_APPROVATO_RESP'
  | 'APPROVATO_ADMIN'
  | 'RIFIUTATO'
  | 'PAGATO';

// ── Expense ─────────────────────────────────────────────────
export type ExpenseStatus =
  | 'INVIATO'
  | 'INTEGRAZIONI_RICHIESTE'
  | 'PRE_APPROVATO_RESP'
  | 'APPROVATO_ADMIN'
  | 'RIFIUTATO'
  | 'PAGATO';

// ── Document ─────────────────────────────────────────────────
export type DocumentType = 'CONTRATTO_OCCASIONALE' | 'RICEVUTA_PAGAMENTO' | 'CU';
export type DocumentSignStatus = 'DA_FIRMARE' | 'FIRMATO' | 'NON_RICHIESTO';

// ── Ticket ──────────────────────────────────────────────────
export type TicketStatus = 'APERTO' | 'IN_LAVORAZIONE' | 'CHIUSO';
export type TicketPriority = 'BASSA' | 'NORMALE' | 'ALTA';

// ── Integration reasons checklist ───────────────────────────
export const INTEGRATION_REASONS = [
  'Allegato mancante',
  'Dati incompleti',
  'Importo non coerente',
  'Periodo non valido',
  'Altro',
] as const;

export type IntegrationReason = typeof INTEGRATION_REASONS[number];

// ── Role labels (anonymous — shown in timeline) ─────────────
export const ROLE_LABELS: Record<Role, string> = {
  collaboratore:   'Collaboratore',
  responsabile:    'Responsabile',
  amministrazione: 'Amministrazione',
  super_admin:     'Amministrazione',
};

// ── Status display labels ────────────────────────────────────
export const COMPENSATION_STATUS_LABELS: Record<CompensationStatus, string> = {
  BOZZA:                 'Bozza',
  INVIATO:               'Inviato',
  INTEGRAZIONI_RICHIESTE:'Integrazioni richieste',
  PRE_APPROVATO_RESP:    'Pre-approvato',
  APPROVATO_ADMIN:       'Approvato',
  RIFIUTATO:             'Rifiutato',
  PAGATO:                'Pagato',
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  INVIATO:               'Inviato',
  INTEGRAZIONI_RICHIESTE:'Integrazioni richieste',
  PRE_APPROVATO_RESP:    'Pre-approvato',
  APPROVATO_ADMIN:       'Approvato',
  RIFIUTATO:             'Rifiutato',
  PAGATO:                'Pagato',
};

// ── Supabase DB row types (minimal, extend as needed) ────────
export interface UserProfile {
  id: string;
  user_id: string;
  role: Role;
  is_active: boolean;
  member_status: MemberStatus;
  created_at: string;
}

export interface Community {
  id: string;
  name: string;
  created_at: string;
}

export interface Collaborator {
  id: string;
  user_id: string;
  nome: string;
  cognome: string;
  codice_fiscale: string | null;
  partita_iva: string | null;
  data_nascita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  email: string;
  iban: string | null;
  note: string | null;
  tshirt_size: string | null;
  foto_profilo_url: string | null;
  data_ingresso: string | null;
  ha_figli_a_carico: boolean;
  figli_dettaglio: Record<string, unknown> | null;
  created_at: string;
}
