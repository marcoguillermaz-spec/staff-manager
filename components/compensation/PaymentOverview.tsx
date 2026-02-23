const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

type YearBreakdown = { year: number; total: number };

type Props = {
  compensPaidByYear: YearBreakdown[];
  compensPending: number;
  expensePaidByYear: YearBreakdown[];
  expensePending: number;
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

export default function PaymentOverview({ compensPaidByYear, compensPending, expensePaidByYear, expensePending }: Props) {
  const hasData =
    compensPaidByYear.length > 0 || compensPending > 0 ||
    expensePaidByYear.length > 0 || expensePending > 0;

  if (!hasData) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-gray-400 mb-3">I miei pagamenti</h2>
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
    </div>
  );
}
