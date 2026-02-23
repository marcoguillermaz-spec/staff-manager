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
export type DocumentType =
  | 'CONTRATTO_OCCASIONALE'
  | 'CONTRATTO_COCOCO'
  | 'CONTRATTO_PIVA'
  | 'RICEVUTA_PAGAMENTO'
  | 'CU';
export type DocumentSignStatus = 'DA_FIRMARE' | 'FIRMATO' | 'NON_RICHIESTO';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CONTRATTO_OCCASIONALE: 'Contratto prestazione occasionale',
  CONTRATTO_COCOCO:      'Contratto collaborazione coordinata',
  CONTRATTO_PIVA:        'Contratto prestazione P.IVA',
  RICEVUTA_PAGAMENTO:    'Ricevuta di pagamento',
  CU:                    'Certificazione Unica',
};

// ── Contract template ─────────────────────────────────────────
export type ContractTemplateType = 'OCCASIONALE' | 'COCOCO' | 'PIVA';

export const CONTRACT_TEMPLATE_LABELS: Record<ContractTemplateType, string> = {
  OCCASIONALE: 'Prestazione occasionale',
  COCOCO:      'Collaborazione coordinata (CoCoCo)',
  PIVA:        'Prestazione P.IVA',
};

export const CONTRACT_TEMPLATE_DOCUMENT_TYPE: Record<ContractTemplateType, DocumentType> = {
  OCCASIONALE: 'CONTRATTO_OCCASIONALE',
  COCOCO:      'CONTRATTO_COCOCO',
  PIVA:        'CONTRATTO_PIVA',
};

export interface ContractTemplate {
  id: string;
  tipo: ContractTemplateType;
  file_url: string;
  file_name: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

export const DOCUMENT_SIGN_STATUS_LABELS: Record<DocumentSignStatus, string> = {
  DA_FIRMARE:    'Da firmare',
  FIRMATO:       'Firmato',
  NON_RICHIESTO: 'Nessuna firma richiesta',
};

export interface Document {
  id: string;
  collaborator_id: string;
  community_id: string | null;
  tipo: DocumentType;
  anno: number | null;
  titolo: string;
  file_original_url: string;       // storage path (not full URL)
  file_original_name: string;
  stato_firma: DocumentSignStatus;
  file_firmato_url: string | null; // storage path
  file_firmato_name: string | null;
  requested_at: string;
  signed_at: string | null;
  created_at: string;
}

// ── Ticket ──────────────────────────────────────────────────
export type TicketStatus = 'APERTO' | 'IN_LAVORAZIONE' | 'CHIUSO';
export type TicketPriority = 'BASSA' | 'NORMALE' | 'ALTA';

export const TICKET_CATEGORIES = [
  'Compensi e pagamenti',
  'Rimborsi spese',
  'Documenti',
  'Accesso e account',
  'Problemi tecnici',
  'Altro',
] as const;

export type TicketCategory = typeof TICKET_CATEGORIES[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  APERTO:         'Aperto',
  IN_LAVORAZIONE: 'In lavorazione',
  CHIUSO:         'Chiuso',
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  BASSA:   'Bassa',
  NORMALE: 'Normale',
  ALTA:    'Alta',
};

export interface Ticket {
  id: string;
  creator_user_id: string;
  community_id: string | null;
  categoria: TicketCategory;
  oggetto: string;
  stato: TicketStatus;
  priority: TicketPriority;
  created_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_user_id: string;
  message: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

// ── Content ──────────────────────────────────────────────────
export interface Announcement {
  id: string;
  community_id: string | null;
  titolo: string;
  contenuto: string;
  pinned: boolean;
  published_at: string;
  created_at: string;
}

export interface Benefit {
  id: string;
  community_id: string | null;
  titolo: string;
  descrizione: string | null;
  codice_sconto: string | null;
  link: string | null;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
}

export interface Resource {
  id: string;
  community_id: string | null;
  titolo: string;
  descrizione: string | null;
  link: string | null;
  file_url: string | null;
  tag: string[] | null;
  created_at: string;
}

export interface ContentEvent {
  id: string;
  community_id: string | null;
  titolo: string;
  descrizione: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
  location: string | null;
  luma_url: string | null;
  luma_embed_url: string | null;
  created_at: string;
}

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
  onboarding_completed: boolean;
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
  nome: string | null;
  cognome: string | null;
  tipo_contratto: ContractTemplateType | null;
  codice_fiscale: string | null;
  partita_iva: string | null;
  data_nascita: string | null;
  luogo_nascita: string | null;
  comune: string | null;
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

// ── Notification ─────────────────────────────────────────
export interface Notification {
  id: string;
  user_id: string;
  tipo: string;
  titolo: string;
  messaggio: string | null;
  entity_type: 'compensation' | 'reimbursement' | 'document' | 'ticket' | null;
  entity_id: string | null;
  read: boolean;
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
