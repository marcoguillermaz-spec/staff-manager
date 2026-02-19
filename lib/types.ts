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

export const EXPENSE_CATEGORIES = [
  'Trasporto',
  'Vitto',
  'Alloggio',
  'Materiale di consumo',
  'Formazione',
  'Telefonia',
  'Altro',
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

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

// ── Compensation DB row types ────────────────────────────────
export interface Compensation {
  id: string;
  collaborator_id: string;
  community_id: string;
  tipo: CompensationType;
  descrizione: string;
  periodo_riferimento: string | null;
  data_competenza: string | null;
  // Occasionale
  importo_lordo: number | null;
  ritenuta_acconto: number | null;
  importo_netto: number | null;
  // P.IVA
  numero_fattura: string | null;
  data_fattura: string | null;
  imponibile: number | null;
  iva_percentuale: number | null;
  totale_fattura: number | null;
  // State machine
  stato: CompensationStatus;
  manager_approved_by: string | null;
  manager_approved_at: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  integration_note: string | null;
  integration_reasons: string[] | null;
  paid_at: string | null;
  paid_by: string | null;
  payment_reference: string | null;
  note_interne: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompensationAttachment {
  id: string;
  compensation_id: string;
  file_url: string;
  file_name: string;
  created_at: string;
}

export interface CompensationHistory {
  id: string;
  compensation_id: string;
  stato_precedente: string | null;
  stato_nuovo: string;
  changed_by: string | null;
  role_label: string;
  note: string | null;
  created_at: string;
}

// ── Shared timeline event shape ───────────────────────────
export interface HistoryEvent {
  id: string;
  stato_precedente: string | null;
  stato_nuovo: string;
  role_label: string;
  note: string | null;
  created_at: string;
}

// ── Expense DB row types ──────────────────────────────────
export interface Expense {
  id: string;
  collaborator_id: string;
  categoria: ExpenseCategory;
  data_spesa: string;
  importo: number;
  descrizione: string;
  stato: ExpenseStatus;
  manager_approved_by: string | null;
  manager_approved_at: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  integration_note: string | null;
  paid_at: string | null;
  paid_by: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseAttachment {
  id: string;
  reimbursement_id: string;
  file_url: string;
  file_name: string;
  created_at: string;
}

export interface ExpenseHistory {
  id: string;
  reimbursement_id: string;
  stato_precedente: string | null;
  stato_nuovo: string;
  changed_by: string | null;
  role_label: string;
  note: string | null;
  created_at: string;
}
