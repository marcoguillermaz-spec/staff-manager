'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { AdminDashboardData } from './types';
import BlocksDrawer from './BlocksDrawer';

// ── Helpers ────────────────────────────────────────────────
function eur(n: number) {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

const sectionCls = 'rounded-2xl bg-gray-900 border border-gray-800';

// ── KPI Card ───────────────────────────────────────────────
function KpiCard({
  label, value, sub, highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={sectionCls + ' p-5'}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={
        'text-2xl font-semibold tabular-nums ' +
        (highlight ? 'text-amber-300' : 'text-gray-100')
      }>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Community Card ─────────────────────────────────────────
function CommunityCard({
  name, pendingComps, pendingExps, docsToSign, collabCount,
}: {
  name: string;
  pendingComps: number;
  pendingExps: number;
  docsToSign: number;
  collabCount: number;
}) {
  return (
    <div className={sectionCls + ' p-5 space-y-3'}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-100 truncate">{name}</h3>
        <span className="text-xs text-gray-500 shrink-0 ml-2">
          {collabCount} collab.
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 px-3 py-2 text-center">
          <p className={
            'text-lg font-semibold tabular-nums ' +
            (pendingComps > 0 ? 'text-amber-300' : 'text-gray-500')
          }>
            {pendingComps}
          </p>
          <p className="text-[10px] text-gray-500">Compensi</p>
        </div>
        <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 px-3 py-2 text-center">
          <p className={
            'text-lg font-semibold tabular-nums ' +
            (pendingExps > 0 ? 'text-amber-300' : 'text-gray-500')
          }>
            {pendingExps}
          </p>
          <p className="text-[10px] text-gray-500">Rimborsi</p>
        </div>
        <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 px-3 py-2 text-center">
          <p className={
            'text-lg font-semibold tabular-nums ' +
            (docsToSign > 0 ? 'text-blue-300' : 'text-gray-500')
          }>
            {docsToSign}
          </p>
          <p className="text-[10px] text-gray-500">Da firmare</p>
        </div>
      </div>
    </div>
  );
}

// ── Urgenti row ────────────────────────────────────────────
function UrgentRow({
  collabName, communityName, entityType, stato, amount, daysWaiting, href,
}: {
  collabName: string;
  communityName: string;
  entityType: string;
  stato: string;
  amount: number;
  daysWaiting: number;
  href: string;
}) {
  const typeLabel = entityType === 'compensation' ? 'Compenso' : entityType === 'expense' ? 'Rimborso' : 'Documento';
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-xl bg-gray-800/50 border border-gray-700/40 px-4 py-3 hover:bg-gray-800 transition group"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">{collabName}</p>
        <p className="text-xs text-gray-500 truncate">{communityName} · {typeLabel} · {stato}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-gray-100">{eur(amount)}</p>
        <p className="text-xs text-red-400">{daysWaiting}gg in attesa</p>
      </div>
    </Link>
  );
}

// ── Feed row ───────────────────────────────────────────────
function FeedRow({
  collabName, communityName, entityType, stato, amount, createdAt, href,
}: {
  collabName: string;
  communityName: string;
  entityType: string;
  stato: string;
  amount: number;
  createdAt: string;
  href: string;
}) {
  const typeLabel = entityType === 'compensation' ? 'Compenso' : entityType === 'expense' ? 'Rimborso' : 'Documento';
  const date = new Date(createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-xl bg-gray-800/40 border border-gray-700/30 px-4 py-3 hover:bg-gray-800/70 transition"
    >
      <div className="min-w-0">
        <p className="text-sm text-gray-200 truncate">
          <span className="font-medium">{collabName}</span>
          <span className="text-gray-500"> · {typeLabel}</span>
        </p>
        <p className="text-xs text-gray-500 truncate">{communityName} · {stato}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm tabular-nums text-gray-300">{eur(amount)}</p>
        <p className="text-xs text-gray-600">{date}</p>
      </div>
    </Link>
  );
}

// ── Period chart tooltip ───────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.name === 'Importo pagato'
            ? eur(p.value)
            : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const {
    kpis, communityCards, collabBreakdown, periodMetrics,
    urgentItems, feedItems, blockItems, communities,
  } = data;

  const [search, setSearch] = useState('');
  const [communityFilter, setCommunityFilter] = useState('');
  const [showBlocks, setShowBlocks] = useState(false);

  // Feed filtering (client-side)
  const filteredFeed = feedItems.filter(item => {
    const matchText = search.trim() === '' || item.collabName.toLowerCase().includes(search.toLowerCase());
    const matchComm = communityFilter === '' || item.communityId === communityFilter;
    return matchText && matchComm;
  });

  // Period chart data
  const chartData = [
    {
      label: 'Mese prec.',
      'Importo pagato': periodMetrics.lastMonth.paidAmount,
      'Compensi approvati': periodMetrics.lastMonth.approvedCount,
      'Nuovi collab.': periodMetrics.lastMonth.newCollabs,
    },
    {
      label: 'Mese corr.',
      'Importo pagato': periodMetrics.currentMonth.paidAmount,
      'Compensi approvati': periodMetrics.currentMonth.approvedCount,
      'Nuovi collab.': periodMetrics.currentMonth.newCollabs,
    },
    {
      label: 'YTD',
      'Importo pagato': periodMetrics.ytd.paidAmount,
      'Compensi approvati': periodMetrics.ytd.approvedCount,
      'Nuovi collab.': periodMetrics.ytd.newCollabs,
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Panoramica operativa</p>
        </div>
        <button
          onClick={() => setShowBlocks(true)}
          className={
            'relative rounded-xl px-4 py-2 text-sm font-medium transition ' +
            (blockItems.length > 0
              ? 'bg-red-900/40 border border-red-700/50 text-red-300 hover:bg-red-900/60'
              : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-300')
          }
        >
          {blockItems.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {blockItems.length}
            </span>
          )}
          Situazioni di blocco
        </button>
      </div>

      {/* ── KPI cards ── */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard label="Compensi in coda" value={kpis.pendingCompsCount} />
          <KpiCard label="Rimborsi in coda" value={kpis.pendingExpsCount} />
          <KpiCard label="In approvazione" value={eur(kpis.inApprovalAmount)} highlight={kpis.inApprovalAmount > 0} />
          <KpiCard label="Da pagare" value={eur(kpis.toPayAmount)} highlight={kpis.toPayAmount > 0} />
          <KpiCard label="Doc. da firmare" value={kpis.docsToSignCount} />
          <KpiCard label="Collaboratori attivi" value={kpis.activeCollabsCount} />
        </div>
      </section>

      {/* ── Quick actions ── */}
      <section>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/coda"
            className="rounded-xl bg-blue-700 hover:bg-blue-600 px-4 py-2 text-sm font-medium text-white transition"
          >
            Vai alla coda
          </Link>
          <Link
            href="/export"
            className="rounded-xl bg-gray-700 hover:bg-gray-600 px-4 py-2 text-sm font-medium text-gray-200 transition"
          >
            Export pagamenti
          </Link>
          <Link
            href="/documenti"
            className="rounded-xl bg-gray-700 hover:bg-gray-600 px-4 py-2 text-sm font-medium text-gray-200 transition"
          >
            Carica documento
          </Link>
          <Link
            href="/impostazioni"
            className="rounded-xl bg-gray-700 hover:bg-gray-600 px-4 py-2 text-sm font-medium text-gray-200 transition"
          >
            Crea utente
          </Link>
        </div>
      </section>

      {/* ── Community cards ── */}
      {communityCards.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Community</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {communityCards.map(c => (
              <CommunityCard key={c.id} {...c} />
            ))}
          </div>
        </section>
      )}

      {/* ── Urgenti + Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Urgenti */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Urgenti ({urgentItems.length})
          </h2>
          {urgentItems.length === 0 ? (
            <div className={sectionCls + ' flex items-center justify-center h-28'}>
              <p className="text-sm text-gray-500">Nessun elemento urgente.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {urgentItems.map(item => (
                <UrgentRow
                  key={item.key}
                  collabName={`${item.collabName} ${item.collabCognome}`}
                  communityName={item.communityName}
                  entityType={item.entityType}
                  stato={item.stato}
                  amount={item.amount}
                  daysWaiting={item.daysWaiting}
                  href={item.href}
                />
              ))}
            </div>
          )}
        </section>

        {/* Collab breakdown */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Collaboratori
          </h2>
          <div className={sectionCls + ' p-5 space-y-5'}>
            <div>
              <p className="text-xs text-gray-500 mb-2">Per stato</p>
              <div className="space-y-1.5">
                {collabBreakdown.byStatus.map(s => (
                  <div key={s.key} className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">{s.label}</span>
                    <span className="text-xs font-medium text-gray-100 tabular-nums">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-800 pt-4">
              <p className="text-xs text-gray-500 mb-2">Per contratto</p>
              <div className="space-y-1.5">
                {collabBreakdown.byContract.map(c => (
                  <div key={c.key} className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">{c.label}</span>
                    <span className="text-xs font-medium text-gray-100 tabular-nums">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Period metrics chart ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Metriche periodo
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Importo pagato */}
          <div className={sectionCls + ' p-5'}>
            <p className="text-xs text-gray-500 mb-4">Importo pagato (€)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={28}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="Importo pagato" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Conteggi */}
          <div className={sectionCls + ' p-5'}>
            <p className="text-xs text-gray-500 mb-4">Compensi approvati / Nuovi collaboratori</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={20} barCategoryGap="30%">
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                <Bar dataKey="Compensi approvati" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Nuovi collab." fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* YTD summary strip */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className={sectionCls + ' px-4 py-3 text-center'}>
            <p className="text-xs text-gray-500">YTD pagato</p>
            <p className="text-lg font-semibold tabular-nums text-blue-300 mt-0.5">{eur(periodMetrics.ytd.paidAmount)}</p>
          </div>
          <div className={sectionCls + ' px-4 py-3 text-center'}>
            <p className="text-xs text-gray-500">YTD compensi approvati</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-300 mt-0.5">{periodMetrics.ytd.approvedCount}</p>
          </div>
          <div className={sectionCls + ' px-4 py-3 text-center'}>
            <p className="text-xs text-gray-500">YTD nuovi collab.</p>
            <p className="text-lg font-semibold tabular-nums text-violet-300 mt-0.5">{periodMetrics.ytd.newCollabs}</p>
          </div>
        </div>
      </section>

      {/* ── Feed ── */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Attività recenti
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Cerca cognome…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 w-36"
            />
            <select
              value={communityFilter}
              onChange={e => setCommunityFilter(e.target.value)}
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-gray-500"
            >
              <option value="">Tutte le community</option>
              {communities.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        {filteredFeed.length === 0 ? (
          <div className={sectionCls + ' flex items-center justify-center h-20'}>
            <p className="text-sm text-gray-500">Nessuna attività trovata.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFeed.map(item => (
              <FeedRow
                key={item.key}
                collabName={`${item.collabName} ${item.collabCognome}`}
                communityName={item.communityName}
                entityType={item.entityType}
                stato={item.stato}
                amount={item.amount}
                createdAt={item.createdAt}
                href={item.href}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Blocks drawer ── */}
      <BlocksDrawer
        items={blockItems}
        open={showBlocks}
        onClose={() => setShowBlocks(false)}
      />
    </div>
  );
}
