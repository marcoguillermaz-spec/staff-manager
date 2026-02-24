export type AdminKPIs = {
  pendingCompsCount: number;
  pendingExpsCount: number;
  inApprovalAmount: number;
  toPayAmount: number;
  docsToSignCount: number;
  activeCollabsCount: number;
};

export type AdminCommunityCard = {
  id: string;
  name: string;
  pendingComps: number;
  pendingExps: number;
  docsToSign: number;
  collabCount: number;
};

export type AdminCollabBreakdown = {
  byStatus: { key: string; label: string; count: number }[];
  byContract: { key: string; label: string; count: number }[];
};

export type AdminPeriodMetrics = {
  currentMonth: { paidAmount: number; approvedCount: number; newCollabs: number };
  lastMonth:    { paidAmount: number; approvedCount: number; newCollabs: number };
  ytd:          { paidAmount: number; approvedCount: number; newCollabs: number };
};

export type AdminUrgentItem = {
  key: string;
  entityType: 'compensation' | 'expense' | 'document';
  entityId: string;
  collabName: string;
  collabCognome: string;
  collabId: string;
  communityId: string;
  communityName: string;
  daysWaiting: number;
  stato: string;
  amount: number;
  href: string;
};

export type AdminFeedItem = {
  key: string;
  entityType: 'compensation' | 'expense' | 'document';
  entityId: string;
  collabId: string;
  collabName: string;
  collabCognome: string;
  communityId: string;
  communityName: string;
  stato: string;
  createdAt: string;
  amount: number;
  href: string;
};

export type AdminBlockItem = {
  key: string;
  blockType: 'must_change_password' | 'onboarding_incomplete' | 'stalled_comp' | 'stalled_exp';
  userId: string;
  collabId: string;
  collabName: string;
  collabEmail: string;
  entityId?: string;
  href: string;
  daysWaiting?: number;
};

export type AdminDashboardData = {
  kpis: AdminKPIs;
  communityCards: AdminCommunityCard[];
  collabBreakdown: AdminCollabBreakdown;
  periodMetrics: AdminPeriodMetrics;
  urgentItems: AdminUrgentItem[];
  feedItems: AdminFeedItem[];
  blockItems: AdminBlockItem[];
  communities: { id: string; name: string }[];
};
