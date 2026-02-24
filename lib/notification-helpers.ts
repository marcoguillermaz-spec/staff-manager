// DB helpers for notification dispatch: settings lookup + person info fetching.
// All functions are fire-and-forget safe — they never throw; they return empty on failure.

import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Svc = SupabaseClient<any, any, any>;

export interface NotificationSetting {
  inapp_enabled: boolean;
  email_enabled: boolean;
}

export type SettingsMap = Map<string, NotificationSetting>;

export interface PersonInfo {
  user_id: string;
  email: string;
  nome: string;
  cognome: string;
}

// Returns a Map keyed by "event_key:recipient_role"
export async function getNotificationSettings(svc: Svc): Promise<SettingsMap> {
  const { data } = await svc
    .from('notification_settings')
    .select('event_key, recipient_role, inapp_enabled, email_enabled');

  const map = new Map<string, NotificationSetting>();
  for (const row of data ?? []) {
    map.set(`${row.event_key}:${row.recipient_role}`, {
      inapp_enabled: row.inapp_enabled,
      email_enabled: row.email_enabled,
    });
  }
  return map;
}

// Fetches collaborator info + email from auth.
export async function getCollaboratorInfo(
  collaboratorId: string,
  svc: Svc,
): Promise<PersonInfo | null> {
  const { data: collab } = await svc
    .from('collaborators')
    .select('user_id, nome, cognome')
    .eq('id', collaboratorId)
    .single();

  if (!collab?.user_id) return null;

  const { data: authUser } = await svc.auth.admin.getUserById(collab.user_id);
  return {
    user_id: collab.user_id,
    email: authUser?.user?.email ?? '',
    nome: collab.nome ?? '',
    cognome: collab.cognome ?? '',
  };
}

// Returns active responsabili assigned to a given community (with email).
export async function getResponsabiliForCommunity(
  communityId: string,
  svc: Svc,
): Promise<PersonInfo[]> {
  const { data: uca } = await svc
    .from('user_community_access')
    .select('user_id')
    .eq('community_id', communityId);

  if (!uca || uca.length === 0) return [];

  const userIds = uca.map((u) => u.user_id);

  const { data: profiles } = await svc
    .from('user_profiles')
    .select('user_id')
    .eq('role', 'responsabile')
    .eq('is_active', true)
    .in('user_id', userIds);

  const activeIds = (profiles ?? []).map((p) => p.user_id);
  if (activeIds.length === 0) return [];

  const [{ data: collabs }, { data: authData }] = await Promise.all([
    svc.from('collaborators').select('user_id, nome, cognome').in('user_id', activeIds),
    svc.auth.admin.listUsers(),
  ]);

  const collabMap = Object.fromEntries((collabs ?? []).map((c) => [c.user_id, c]));
  const emailMap = Object.fromEntries(
    (authData?.users ?? []).map((u) => [u.id, u.email ?? '']),
  );

  return activeIds.map((uid) => ({
    user_id: uid,
    email: emailMap[uid] ?? '',
    nome: collabMap[uid]?.nome ?? '',
    cognome: collabMap[uid]?.cognome ?? '',
  }));
}

// Returns active responsabili for all communities a collaborator belongs to.
export async function getResponsabiliForCollaborator(
  collaboratorId: string,
  svc: Svc,
): Promise<PersonInfo[]> {
  const { data: cc } = await svc
    .from('collaborator_communities')
    .select('community_id')
    .eq('collaborator_id', collaboratorId);

  if (!cc || cc.length === 0) return [];

  const communityIds = [...new Set(cc.map((r) => r.community_id))];

  const { data: uca } = await svc
    .from('user_community_access')
    .select('user_id')
    .in('community_id', communityIds);

  if (!uca || uca.length === 0) return [];

  const userIds = [...new Set(uca.map((u) => u.user_id))];

  const { data: profiles } = await svc
    .from('user_profiles')
    .select('user_id')
    .eq('role', 'responsabile')
    .eq('is_active', true)
    .in('user_id', userIds);

  const activeIds = (profiles ?? []).map((p) => p.user_id);
  if (activeIds.length === 0) return [];

  const [{ data: collabs }, { data: authData }] = await Promise.all([
    svc.from('collaborators').select('user_id, nome, cognome').in('user_id', activeIds),
    svc.auth.admin.listUsers(),
  ]);

  const collabMap = Object.fromEntries((collabs ?? []).map((c) => [c.user_id, c]));
  const emailMap = Object.fromEntries(
    (authData?.users ?? []).map((u) => [u.id, u.email ?? '']),
  );

  return activeIds.map((uid) => ({
    user_id: uid,
    email: emailMap[uid] ?? '',
    nome: collabMap[uid]?.nome ?? '',
    cognome: collabMap[uid]?.cognome ?? '',
  }));
}

// Shortcut: get responsabili for a user (via their collaborator record → communities).
export async function getResponsabiliForUser(
  userId: string,
  svc: Svc,
): Promise<PersonInfo[]> {
  const { data: collab } = await svc
    .from('collaborators')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!collab) return [];
  return getResponsabiliForCollaborator(collab.id, svc);
}
