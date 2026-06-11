import type { Reservation } from "@/types/reservation";
import { generateHourLabels, getLocalDateKey, getReservationTimePosition, getWeekDays } from "@/utils/date";
import { cn } from "@/lib/utils";

const statusAccent: Record<Reservation["status"], string> = {
  CANCELLED: "border-l-red-500 bg-red-50 text-red-800",
  COMPLETED: "border-l-emerald-500 bg-emerald-50 text-emerald-800",
  EN_ATTENTE: "border-l-amber-500 bg-amber-50 text-amber-800",
  ONGOING: "border-l-blue-500 bg-blue-50 text-blue-800",
  RESERVED: "border-l-emerald-500 bg-emerald-50 text-emerald-800",
};

interface CalendarTimeGridProps {
  reservations: Reservation[];
  selectedDate: string;
  onSelectReservation: (reservation: Reservation) => void;
  weekStartDate: Date;
}

export function CalendarTimeGrid({
  reservations,
  selectedDate,
  onSelectReservation,
  weekStartDate,
}: CalendarTimeGridProps) {
  const weekDays = getWeekDays(weekStartDate);
  const hourLabels = generateHourLabels(8, 20);

  const getReservationSpan = (reservation: Reservation): { startDayIdx: number; spanDays: number } | null => {
    const resStart = new Date(reservation.startDate);
    const resEnd = new Date(reservation.endDate);

    let startDayIdx = -1;
    let spanDays = 0;

    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(weekDays[i]);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(weekDays[i]);
      dayEnd.setHours(23, 59, 59, 999);

      if (resStart <= dayEnd && resEnd >= dayStart) {
        if (startDayIdx === -1) {
          startDayIdx = i;
        }
        spanDays++;
      }
    }

    return startDayIdx !== -1 ? { startDayIdx, spanDays } : null;
  };

  const weekEvents = reservations
    .map((reservation) => ({ reservation, span: getReservationSpan(reservation) }))
    .filter((event): event is { reservation: Reservation; span: { startDayIdx: number; spanDays: number } } => Boolean(event.span));

  return (
    <div>
      {/* Time grid */}
      <div className="overflow-x-auto bg-white">
        {/* Days header row */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: `repeat(7, minmax(0, 1fr))` }}>
          {weekDays.map((day) => {
            const dayKey = getLocalDateKey(day);
            const isSelected = dayKey === selectedDate;
            const dayOfWeek = day.toLocaleDateString("fr-FR", { weekday: "short" }).toUpperCase();
            const dayNum = String(day.getDate()).padStart(2, "0");

            return (
              <div
                key={dayKey}
                className={cn(
                  "border-r border-border last:border-r-0 px-4 py-4 text-center",
                  isSelected && "bg-blue-50",
                )}
              >
                <div className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">{dayOfWeek}</div>
                <div className={cn(
                  "text-2xl font-bold",
                  isSelected ? "text-blue-600" : "text-slate-700",
                )}>
                  {dayNum}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid body */}
        <div className="flex gap-0 relative">
          {/* Hours sidebar */}
          <div className="w-20 flex-shrink-0 border-r border-border bg-muted/30">
            {hourLabels.map((hour, idx) => (
              <div key={hour} className="relative border-b border-border h-12 flex items-start justify-center pt-1 text-xs font-medium text-muted-foreground">
                {hour}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="flex flex-1 relative">
            {weekDays.map((day) => {
              const dayKey = getLocalDateKey(day);

              return (
                <div
                  key={dayKey}
                  className="flex-1 border-r border-border last:border-r-0 relative"
                >
                  {/* Time slots */}
                  <div className="relative">
                    {hourLabels.map((_, hourIdx) => (
                      <div
                        key={`${dayKey}-${hourIdx}`}
                        className="relative h-12 border-b border-border/30 hover:bg-blue-50/20 transition-colors cursor-cell"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="pointer-events-none absolute inset-0">
              {weekEvents.map(({ reservation, span }) => {
                const timeInfo = getReservationTimePosition(reservation.startDate, weekDays[span.startDayIdx]);
                const isMultiDay = span.spanDays > 1;

                return (
                  <button
                    key={reservation.id}
                    onClick={() => onSelectReservation(reservation)}
                    style={{
                      left: `calc(${(span.startDayIdx / 7) * 100}% + 4px)`,
                      top: `calc(${timeInfo.topPercent}% + 4px)`,
                      width: `calc(${(span.spanDays / 7) * 100}% - 8px)`,
                    }}
                    className={cn(
                      "pointer-events-auto absolute flex min-h-16 items-center justify-between gap-3 overflow-hidden rounded-lg p-3 text-left text-xs shadow-sm transition hover:shadow-lg",
                      isMultiDay
                        ? "border-l-4 border-l-blue-500 bg-blue-100 text-blue-900"
                        : cn("border-l-4", statusAccent[reservation.status]),
                    )}
                    type="button"
                  >
                    <span className="min-w-0 truncate text-sm font-bold">
                      {reservation.car?.brand} {reservation.car?.model}
                    </span>
                    <span className="shrink-0 truncate text-xs font-semibold">
                      {isMultiDay ? timeInfo.startTime : reservation.client?.fullName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
