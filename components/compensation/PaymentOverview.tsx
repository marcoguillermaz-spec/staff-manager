const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

type YearBreakdown = { year: number; total: number };

type Props = {
  compensPaidByYear: YearBreakdown[];
  compensPending: number;
  expensePaidByYear: YearBreakdown[];
  expensePending: number;
  massimale: number | null;
  paidCurrentYear: number;
  currentYear: number;
};

function OverviewCard({
  title,
  paidByYear,
  pending,
}: {
  title: string;
  paidByYear: YearBreakdown[];
  pending: number;
}) {
  const totalPaid = paidByYear.reduce((s, r) => s + r.total, 0);

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-800 flex-1 min-w-0">
      <div className="px-5 py-4 border-b border-gray-800">
        <h2 className="text-sm font-medium text-gray-200">{title}</h2>
      </div>
      <div className="p-5 space-y-3">
        {paidByYear.length === 0 && pending === 0 ? (
          <p className="text-xs text-gray-600 italic">Nessun dato disponibile.</p>
        ) : (
          <>
            {paidByYear.map(({ year, total }) => (
              <div key={year} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{year}</span>
                <span className="text-sm font-medium text-gray-200">{fmt(total)}</span>
              </div>
            ))}
            {paidByYear.length > 1 && (
              <div className="flex items-center justify-between pt-1 border-t border-gray-800">
                <span className="text-xs text-gray-400">Totale liquidato</span>
                <span className="text-sm font-semibold text-green-400">{fmt(totalPaid)}</span>
              </div>
            )}
            {pending > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-gray-800">
                <span className="text-xs text-gray-500">In attesa di pagamento</span>
                <span className="text-sm text-yellow-400">{fmt(pending)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentOverview({
  compensPaidByYear, compensPending,
  expensePaidByYear, expensePending,
  massimale, paidCurrentYear, currentYear,
}: Props) {
  const hasData =
    compensPaidByYear.length > 0 || compensPending > 0 ||
    expensePaidByYear.length > 0 || expensePending > 0;

  const showMassimale = massimale != null && massimale > 0;
  const pct = showMassimale ? Math.min(100, (paidCurrentYear / massimale) * 100) : 0;
  const isNearLimit = pct >= 80;
  const barColor = pct >= 100 ? 'bg-red-500' : isNearLimit ? 'bg-yellow-400' : 'bg-green-500';

  if (!hasData && !showMassimale) return null;

  return (
    <div className="mb-6 space-y-4">
      {showMassimale && (
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-200">Massimale annuo {currentYear}</h2>
            <span className={`text-xs font-mono ${pct >= 100 ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-gray-400'}`}>
              {fmt(paidCurrentYear)} / {fmt(massimale)}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct >= 100 && (
            <p className="text-xs text-red-400 mt-2">Hai raggiunto il massimale impostato.</p>
          )}
          {isNearLimit && pct < 100 && (
            <p className="text-xs text-yellow-400 mt-2">Stai avvicinandoti al massimale ({pct.toFixed(0)}%).</p>
          )}
        </div>
      )}

      {hasData && (
        <>
          <h2 className="text-sm font-medium text-gray-400">I miei pagamenti</h2>
          <div className="flex gap-4 flex-wrap">
            <OverviewCard
              title="Compensi liquidati"
              paidByYear={compensPaidByYear}
              pending={compensPending}
            />
            <OverviewCard
              title="Rimborsi liquidati"
              paidByYear={expensePaidByYear}
              pending={expensePending}
            />
          </div>
        </>
      )}
    </div>
  );
}
