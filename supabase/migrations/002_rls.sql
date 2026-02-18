-- ============================================================
-- Staff Manager — Migration 002: Row Level Security
-- ============================================================
-- Helper: get current user's role
create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from user_profiles where user_id = auth.uid()
$$;

-- Helper: is current user active?
create or replace function is_active_user()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select is_active from user_profiles where user_id = auth.uid()),
    false
  )
$$;

-- Helper: get current user's member_status
create or replace function get_my_member_status()
returns text language sql security definer stable as $$
  select member_status from user_profiles where user_id = auth.uid()
$$;

-- Helper: can current user manage a given community?
-- (true for admin/super_admin always; responsabile only if assigned)
create or replace function can_manage_community(p_community_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_profiles up
    where up.user_id = auth.uid()
      and (
        up.role in ('amministrazione','super_admin')
        or (
          up.role = 'responsabile'
          and exists (
            select 1 from user_community_access uca
            where uca.user_id = auth.uid()
              and uca.community_id = p_community_id
          )
        )
      )
  )
$$;

-- Helper: get collaborator_id for current user
create or replace function get_my_collaborator_id()
returns uuid language sql security definer stable as $$
  select id from collaborators where user_id = auth.uid()
$$;

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
alter table user_profiles            enable row level security;
alter table user_community_access    enable row level security;
alter table collaborators            enable row level security;
alter table collaborator_communities enable row level security;
alter table compensations            enable row level security;
alter table compensation_attachments enable row level security;
alter table compensation_history     enable row level security;
alter table expense_reimbursements   enable row level security;
alter table expense_attachments      enable row level security;
alter table expense_history          enable row level security;
alter table documents                enable row level security;
alter table tickets                  enable row level security;
alter table ticket_messages          enable row level security;
alter table announcements            enable row level security;
alter table benefits                 enable row level security;
alter table resources                enable row level security;
alter table events                   enable row level security;
alter table notifications            enable row level security;
alter table communities              enable row level security;

-- ============================================================
-- COMMUNITIES — readable by all authenticated active users
-- ============================================================
create policy "communities_read" on communities
  for select using (is_active_user());

-- ============================================================
-- USER PROFILES
-- ============================================================
-- Own profile always readable
create policy "user_profiles_own_read" on user_profiles
  for select using (user_id = auth.uid());

-- Admin/super_admin can read all
create policy "user_profiles_admin_read" on user_profiles
  for select using (get_my_role() in ('amministrazione','super_admin'));

-- Responsabile can read profiles of collaborators in their communities
create policy "user_profiles_responsabile_read" on user_profiles
  for select using (
    get_my_role() = 'responsabile'
    and exists (
      select 1 from collaborators c
      join collaborator_communities cc on cc.collaborator_id = c.id
      join user_community_access uca on uca.community_id = cc.community_id
      where c.user_id = user_profiles.user_id
        and uca.user_id = auth.uid()
    )
  );

-- Super admin manages all profiles
create policy "user_profiles_superadmin_write" on user_profiles
  for all using (get_my_role() = 'super_admin');

-- ============================================================
-- USER COMMUNITY ACCESS
-- ============================================================
create policy "uca_admin_all" on user_community_access
  for all using (get_my_role() in ('amministrazione','super_admin'));

create policy "uca_own_read" on user_community_access
  for select using (user_id = auth.uid());

-- ============================================================
-- COLLABORATORS
-- ============================================================
-- Own record always readable (all fields — IBAN included)
create policy "collaborators_own_read" on collaborators
  for select using (user_id = auth.uid());

-- Admin reads all
create policy "collaborators_admin_read" on collaborators
  for select using (get_my_role() in ('amministrazione','super_admin'));

-- Responsabile reads collaborators in their assigned communities
create policy "collaborators_responsabile_read" on collaborators
  for select using (
    get_my_role() = 'responsabile'
    and exists (
      select 1 from collaborator_communities cc
      join user_community_access uca on uca.community_id = cc.community_id
      where cc.collaborator_id = collaborators.id
        and uca.user_id = auth.uid()
    )
  );

-- Collaboratore can update own allowed fields only (enforced also in app layer)
create policy "collaborators_own_update" on collaborators
  for update using (user_id = auth.uid());

-- Admin can insert/update/delete
create policy "collaborators_admin_write" on collaborators
  for all using (get_my_role() in ('amministrazione','super_admin'));

-- ============================================================
-- COLLABORATOR COMMUNITIES
-- ============================================================
create policy "collab_communities_own_read" on collaborator_communities
  for select using (
    exists (select 1 from collaborators c where c.id = collaborator_id and c.user_id = auth.uid())
  );

create policy "collab_communities_admin_all" on collaborator_communities
  for all using (get_my_role() in ('amministrazione','super_admin'));

create policy "collab_communities_responsabile_read" on collaborator_communities
  for select using (
    get_my_role() = 'responsabile'
    and exists (
      select 1 from user_community_access uca
      where uca.community_id = collaborator_communities.community_id
        and uca.user_id = auth.uid()
    )
  );

-- ============================================================
-- COMPENSATIONS
-- ============================================================
-- Collaboratore: own compensations only
create policy "compensations_own_read" on compensations
  for select using (collaborator_id = get_my_collaborator_id());

create policy "compensations_own_insert" on compensations
  for insert with check (
    collaborator_id = get_my_collaborator_id()
    and get_my_role() = 'collaboratore'
    and is_active_user()
    -- Uscenti con compenso can still insert (to submit existing work)
    and get_my_member_status() != 'uscente_senza_compenso'
  );

-- Collaboratore can update only own BOZZA records
create policy "compensations_own_update_bozza" on compensations
  for update using (
    collaborator_id = get_my_collaborator_id()
    and stato = 'BOZZA'
    and get_my_role() = 'collaboratore'
  );

-- Responsabile: read + state-change for assigned communities
create policy "compensations_responsabile_read" on compensations
  for select using (can_manage_community(community_id));

create policy "compensations_responsabile_update" on compensations
  for update using (
    get_my_role() = 'responsabile'
    and can_manage_community(community_id)
    and stato in ('INVIATO','INTEGRAZIONI_RICHIESTE')
  );

-- Admin: full access
create policy "compensations_admin_all" on compensations
  for all using (get_my_role() in ('amministrazione','super_admin'));

-- ============================================================
-- COMPENSATION ATTACHMENTS
-- ============================================================
create policy "comp_attachments_own_read" on compensation_attachments
  for select using (
    exists (
      select 1 from compensations c
      where c.id = compensation_id
        and c.collaborator_id = get_my_collaborator_id()
    )
  );

create policy "comp_attachments_own_insert" on compensation_attachments
  for insert with check (
    exists (
      select 1 from compensations c
      where c.id = compensation_id
        and c.collaborator_id = get_my_collaborator_id()
        and c.stato in ('BOZZA','INTEGRAZIONI_RICHIESTE')
    )
  );

create policy "comp_attachments_manager_read" on compensation_attachments
  for select using (
    exists (
      select 1 from compensations c
      where c.id = compensation_id
        and can_manage_community(c.community_id)
    )
  );

create policy "comp_attachments_admin_all" on compensation_attachments
  for all using (get_my_role() in ('amministrazione','super_admin'));

-- ============================================================
-- COMPENSATION HISTORY (timeline — anonymous)
-- ============================================================
create policy "comp_history_own_read" on compensation_history
  for select using (
    exists (
      select 1 from compensations c
      where c.id = compensation_id
        and c.collaborator_id = get_my_collaborator_id()
    )
  );

create policy "comp_history_manager_read" on compensation_history
  for select using (
    exists (
      select 1 from compensations c
      where c.id = compensation_id
        and can_manage_community(c.community_id)
    )
  );

create policy "comp_history_insert_authenticated" on compensation_history
  for insert with check (is_active_user());

-- ============================================================
-- EXPENSE REIMBURSEMENTS (same pattern as compensations)
-- ============================================================
create policy "expenses_own_read" on expense_reimbursements
  for select using (collaborator_id = get_my_collaborator_id());

create policy "expenses_own_insert" on expense_reimbursements
  for insert with check (
    collaborator_id = get_my_collaborator_id()
    and get_my_role() = 'collaboratore'
    and is_active_user()
    and get_my_member_status() != 'uscente_senza_compenso'
  );

create policy "expenses_own_update_inviato" on expense_reimbursements
  for update using (
    collaborator_id = get_my_collaborator_id()
    and stato = 'INVIATO'
    and get_my_role() = 'collaboratore'
  );

create policy "expenses_responsabile_read" on expense_reimbursements
  for select using (can_manage_community(community_id));

create policy "expenses_responsabile_update" on expense_reimbursements
  for update using (
    get_my_role() = 'responsabile'
    and can_manage_community(community_id)
    and stato in ('INVIATO','INTEGRAZIONI_RICHIESTE')
  );

create policy "expenses_admin_all" on expense_reimbursements
  for all using (get_my_role() in ('amministrazione','super_admin'));

-- ============================================================
-- EXPENSE ATTACHMENTS
-- ============================================================
create policy "exp_attachments_own_read" on expense_attachments
  for select using (
    exists (
      select 1 from expense_reimbursements e
      where e.id = reimbursement_id
        and e.collaborator_id = get_my_collaborator_id()
    )
  );

create policy "exp_attachments_own_insert" on expense_attachments
  for insert with check (
    exists (
      select 1 from expense_reimbursements e
      where e.id = reimbursement_id
        and e.collaborator_id = get_my_collaborator_id()
        and e.stato in ('INVIATO','INTEGRAZIONI_RICHIESTE')
    )
  );

create policy "exp_attachments_manager_read" on expense_attachments
  for select using (
    exists (
      select 1 from expense_reimbursements e
      where e.id = reimbursement_id
        and can_manage_community(e.community_id)
    )
  );

create policy "exp_attachments_admin_all" on expense_attachments
  for all using (get_my_role() in ('amministrazione','super_admin'));

-- ============================================================
-- EXPENSE HISTORY
-- ============================================================
create policy "exp_history_own_read" on expense_history
  for select using (
    exists (
      select 1 from expense_reimbursements e
      where e.id = reimbursement_id
        and e.collaborator_id = get_my_collaborator_id()
    )
  );

create policy "exp_history_manager_read" on expense_history
  for select using (
    exists (
      select 1 from expense_reimbursements e
      where e.id = reimbursement_id
        and can_manage_community(e.community_id)
    )
  );

create policy "exp_history_insert_authenticated" on expense_history
  for insert with check (is_active_user());

-- ============================================================
-- DOCUMENTS
-- ============================================================
-- Collaboratore: own documents
-- Uscente_con_compenso: can see all own docs
-- Uscente_senza_compenso: can see own docs (read only, no new)
create policy "documents_own_read" on documents
  for select using (collaborator_id = get_my_collaborator_id());

-- Collaboratore can upload signed document
create policy "documents_own_upload_signed" on documents
  for update using (
    collaborator_id = get_my_collaborator_id()
    and stato_firma = 'DA_FIRMARE'
    and get_my_role() = 'collaboratore'
  );

create policy "documents_manager_read" on documents
  for select using (can_manage_community(community_id));

create policy "documents_admin_all" on documents
  for all using (get_my_role() in ('amministrazione','super_admin'));

-- ============================================================
-- TICKETS
-- ============================================================
create policy "tickets_own_read" on tickets
  for select using (creator_user_id = auth.uid());

create policy "tickets_own_insert" on tickets
  for insert with check (
    creator_user_id = auth.uid()
    and is_active_user()
  );

create policy "tickets_manager_read" on tickets
  for select using (
    can_manage_community(community_id)
    or get_my_role() in ('amministrazione','super_admin')
  );

create policy "tickets_admin_update" on tickets
  for update using (get_my_role() in ('amministrazione','super_admin','responsabile'));

-- ============================================================
-- TICKET MESSAGES
-- ============================================================
create policy "ticket_messages_read" on ticket_messages
  for select using (
    exists (
      select 1 from tickets t
      where t.id = ticket_id
        and (
          t.creator_user_id = auth.uid()
          or can_manage_community(t.community_id)
          or get_my_role() in ('amministrazione','super_admin')
        )
    )
  );

create policy "ticket_messages_insert" on ticket_messages
  for insert with check (
    author_user_id = auth.uid()
    and is_active_user()
    and exists (
      select 1 from tickets t
      where t.id = ticket_id
        and (
          t.creator_user_id = auth.uid()
          or can_manage_community(t.community_id)
          or get_my_role() in ('amministrazione','super_admin')
        )
    )
  );

-- ============================================================
-- CONTENT TABLES (announcements, benefits, resources, events)
-- Visible to all active users (filtered by community in app)
-- ============================================================
create policy "announcements_read" on announcements
  for select using (is_active_user());

create policy "announcements_admin_write" on announcements
  for all using (get_my_role() in ('amministrazione','super_admin','responsabile'));

create policy "benefits_read" on benefits
  for select using (is_active_user());

create policy "benefits_admin_write" on benefits
  for all using (get_my_role() in ('amministrazione','super_admin'));

create policy "resources_read" on resources
  for select using (is_active_user());

create policy "resources_admin_write" on resources
  for all using (get_my_role() in ('amministrazione','super_admin'));

create policy "events_read" on events
  for select using (is_active_user());

create policy "events_admin_write" on events
  for all using (get_my_role() in ('amministrazione','super_admin'));

-- ============================================================
-- NOTIFICATIONS — own only
-- ============================================================
create policy "notifications_own" on notifications
  for all using (user_id = auth.uid());
