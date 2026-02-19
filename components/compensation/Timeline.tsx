import type { HistoryEvent } from '@/lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Timeline({ events }: { events: HistoryEvent[] }) {
  if (!events.length) return null;

  return (
    <div className="space-y-0">
      {events.map((ev, i) => (
        <div key={ev.id} className="flex gap-3">
          {/* Line + dot */}
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-gray-500 mt-1.5 shrink-0" />
            {i < events.length - 1 && <div className="w-px flex-1 bg-gray-700 my-1" />}
          </div>

          {/* Content */}
          <div className="pb-4 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-300">{ev.role_label}</span>
              {ev.stato_precedente && (
                <>
                  <span className="text-xs text-gray-600">→</span>
                  <span className="text-xs text-gray-400">{ev.stato_nuovo}</span>
                </>
              )}
              {!ev.stato_precedente && (
                <span className="text-xs text-gray-500">Creato come {ev.stato_nuovo}</span>
              )}
              <span className="text-xs text-gray-600">{formatDate(ev.created_at)}</span>
            </div>
            {ev.note && (
              <p className="mt-1 text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
                {ev.note}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
