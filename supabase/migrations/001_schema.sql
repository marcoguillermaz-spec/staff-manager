-- ============================================================
-- Staff Manager — Migration 001: Full schema
-- ============================================================

-- ── Enable extensions ──────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ============================================================
-- COMMUNITIES
-- ============================================================
create table communities (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

insert into communities (name) values ('Testbusters'), ('Peer4Med');

-- ============================================================
-- USER PROFILES  (role + activation state)
-- ============================================================
create table user_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null unique,
  role          text not null check (role in ('collaboratore','responsabile','amministrazione','super_admin')),
  is_active     boolean not null default true,
  member_status text not null default 'attivo'
                  check (member_status in ('attivo','uscente_con_compenso','uscente_senza_compenso')),
  created_at    timestamptz default now()
);

-- ── Community access for responsabili / admin ──────────────
create table user_community_access (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  community_id uuid references communities(id) on delete cascade not null,
  unique (user_id, community_id)
);

-- ============================================================
-- COLLABORATORS  (anagrafica — sensitive fields via RLS)
-- ============================================================
create table collaborators (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade not null unique,
  nome                text not null,
  cognome             text not null,
  codice_fiscale      text unique,
  partita_iva         text,
  data_nascita        date,
  indirizzo           text,
  telefono            text,
  email               text not null,
  iban                text,                    -- visible only to owner + admin
  note                text,
  tshirt_size         text,
  foto_profilo_url    text,
  data_ingresso       date,
  ha_figli_a_carico   boolean default false,
  figli_dettaglio     jsonb,                   -- {eta, soglia_reddito, ...}
  created_at          timestamptz default now()
);

-- ── Collaborator ↔ Community (many-to-many) ────────────────
create table collaborator_communities (
  id               uuid primary key default gen_random_uuid(),
  collaborator_id  uuid references collaborators(id) on delete cascade not null,
  community_id     uuid references communities(id) on delete cascade not null,
  unique (collaborator_id, community_id)
);

-- ============================================================
-- COMPENSATIONS
-- ============================================================
create table compensations (
  id                  uuid primary key default gen_random_uuid(),
  collaborator_id     uuid references collaborators(id) on delete restrict not null,
  community_id        uuid references communities(id) not null,

  tipo                text not null check (tipo in ('OCCASIONALE','PIVA')),
  descrizione         text not null,
  periodo_riferimento text,                   -- e.g. "Marzo 2025"
  data_competenza     date,

  -- Occasionale fields
  importo_lordo       numeric(10,2),
  ritenuta_acconto    numeric(10,2),
  importo_netto       numeric(10,2),

  -- P.IVA fields (optional)
  numero_fattura      text,
  data_fattura        date,
  imponibile          numeric(10,2),
  iva_percentuale     numeric(5,2),
  totale_fattura      numeric(10,2),

  -- State machine
  stato               text not null default 'BOZZA'
                        check (stato in (
                          'BOZZA','INVIATO','INTEGRAZIONI_RICHIESTE',
                          'PRE_APPROVATO_RESP','APPROVATO_ADMIN','RIFIUTATO','PAGATO'
                        )),

  -- Approval trail (role labels used in UI — not raw names)
  manager_approved_by uuid references auth.users(id),
  manager_approved_at timestamptz,
  admin_approved_by   uuid references auth.users(id),
  admin_approved_at   timestamptz,

  -- Integration request
  integration_note    text,                   -- min 20 chars enforced in app
  integration_reasons text[],                 -- checklist items

  -- Payment
  paid_at             timestamptz,
  paid_by             uuid references auth.users(id),
  payment_reference   text,

  note_interne        text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create table compensation_attachments (
  id              uuid primary key default gen_random_uuid(),
  compensation_id uuid references compensations(id) on delete cascade not null,
  file_url        text not null,
  file_name       text not null,
  created_at      timestamptz default now()
);

-- Timeline: anonymous role labels only (never user names)
create table compensation_history (
  id                uuid primary key default gen_random_uuid(),
  compensation_id   uuid references compensations(id) on delete cascade not null,
  stato_precedente  text,
  stato_nuovo       text not null,
  changed_by        uuid references auth.users(id),
  role_label        text not null,            -- 'Collaboratore'|'Responsabile'|'Amministrazione'
  note              text,
  created_at        timestamptz default now()
);

-- ============================================================
-- EXPENSE REIMBURSEMENTS
-- ============================================================
create table expense_reimbursements (
  id                  uuid primary key default gen_random_uuid(),
  collaborator_id     uuid references collaborators(id) on delete restrict not null,
  community_id        uuid references communities(id) not null,
  categoria           text not null,
  descrizione         text not null,
  data_spesa          date not null,
  importo             numeric(10,2) not null,

  stato               text not null default 'INVIATO'
                        check (stato in (
                          'INVIATO','INTEGRAZIONI_RICHIESTE',
                          'PRE_APPROVATO_RESP','APPROVATO_ADMIN','RIFIUTATO','PAGATO'
                        )),

  manager_approved_by uuid references auth.users(id),
  manager_approved_at timestamptz,
  admin_approved_by   uuid references auth.users(id),
  admin_approved_at   timestamptz,

  integration_note    text,
  integration_reasons text[],

  paid_at             timestamptz,
  paid_by             uuid references auth.users(id),
  payment_reference   text,

  note_interne        text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create table expense_attachments (
  id               uuid primary key default gen_random_uuid(),
  reimbursement_id uuid references expense_reimbursements(id) on delete cascade not null,
  file_url         text not null,
  file_name        text not null,
  created_at       timestamptz default now()
);

create table expense_history (
  id               uuid primary key default gen_random_uuid(),
  reimbursement_id uuid references expense_reimbursements(id) on delete cascade not null,
  stato_precedente text,
  stato_nuovo      text not null,
  changed_by       uuid references auth.users(id),
  role_label       text not null,
  note             text,
  created_at       timestamptz default now()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table documents (
  id                  uuid primary key default gen_random_uuid(),
  collaborator_id     uuid references collaborators(id) on delete restrict not null,
  community_id        uuid references communities(id),
  tipo                text not null check (tipo in ('CONTRATTO_OCCASIONALE','RICEVUTA_PAGAMENTO','CU')),
  anno                int,
  file_original_url   text not null,
  file_original_name  text not null,
  stato_firma         text not null default 'DA_FIRMARE'
                        check (stato_firma in ('DA_FIRMARE','FIRMATO','NON_RICHIESTO')),
  file_firmato_url    text,
  file_firmato_name   text,
  requested_at        timestamptz default now(),
  signed_at           timestamptz,
  created_at          timestamptz default now()
);

-- ============================================================
-- TICKETS
-- ============================================================
create table tickets (
  id              uuid primary key default gen_random_uuid(),
  creator_user_id uuid references auth.users(id) not null,
  community_id    uuid references communities(id),
  categoria       text not null,
  oggetto         text not null,
  stato           text not null default 'APERTO'
                    check (stato in ('APERTO','IN_LAVORAZIONE','CHIUSO')),
  priority        text not null default 'NORMALE'
                    check (priority in ('BASSA','NORMALE','ALTA')),
  created_at      timestamptz default now()
);

create table ticket_messages (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid references tickets(id) on delete cascade not null,
  author_user_id  uuid references auth.users(id) not null,
  message         text not null,
  attachment_url  text,
  attachment_name text,
  created_at      timestamptz default now()
);

-- ============================================================
-- CONTENT (announcements, benefits, resources, events)
-- ============================================================
create table announcements (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id),   -- null = all communities
  titolo       text not null,
  contenuto    text not null,
  pinned       boolean default false,
  published_at timestamptz default now(),
  created_at   timestamptz default now()
);

create table benefits (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id),
  titolo       text not null,
  descrizione  text,
  codice_sconto text,
  link         text,
  valid_from   date,
  valid_to     date,
  created_at   timestamptz default now()
);

create table resources (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id),
  titolo       text not null,
  descrizione  text,
  link         text,
  file_url     text,
  tag          text[],
  created_at   timestamptz default now()
);

create table events (
  id             uuid primary key default gen_random_uuid(),
  community_id   uuid references communities(id),
  titolo         text not null,
  descrizione    text,
  start_datetime timestamptz,
  end_datetime   timestamptz,
  location       text,
  luma_url       text,
  luma_embed_url text,
  created_at     timestamptz default now()
);

-- ============================================================
-- IN-APP NOTIFICATIONS
-- ============================================================
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  tipo        text not null,
  titolo      text not null,
  messaggio   text,
  entity_type text,   -- 'compensation'|'reimbursement'|'document'|'ticket'
  entity_id   uuid,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index on compensations (collaborator_id);
create index on compensations (community_id);
create index on compensations (stato);
create index on expense_reimbursements (collaborator_id);
create index on expense_reimbursements (community_id);
create index on expense_reimbursements (stato);
create index on documents (collaborator_id);
create index on documents (stato_firma);
create index on tickets (creator_user_id);
create index on tickets (stato);
create index on notifications (user_id, read);
create index on compensation_history (compensation_id);
create index on expense_history (reimbursement_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger compensations_updated_at
  before update on compensations
  for each row execute function set_updated_at();

create trigger expense_reimbursements_updated_at
  before update on expense_reimbursements
  for each row execute function set_updated_at();
