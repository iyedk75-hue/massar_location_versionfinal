import { CalendarDays, ChevronLeft, ChevronRight, Clock, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge, getStatusLabel } from "@/components/StatusBadge";
import { CalendarTimeGrid } from "@/pages/reservations/CalendarTimeGrid";
import { ReservationFilters } from "@/pages/reservations/components/ReservationFilters";
import type { ReservationFiltersState, ReservationViewModel } from "@/pages/reservations/components/reservationViewUtils";
import { reservationTouchesDate, statusColorClasses } from "@/pages/reservations/components/reservationViewUtils";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Reservation } from "@/types/reservation";
import { formatCarName } from "@/utils/car";
import { normalizeClientName } from "@/utils/client";
import { formatDateTime, getLocalDateKey, getStartOfWeek } from "@/utils/date";
import { cn } from "@/lib/utils";

const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

interface ReservationCalendarViewProps {
  calendarMode: "month" | "week";
  cars: Car[];
  carsById: Map<number, Car>;
  clientsById: Map<number, Client>;
  filters: ReservationFiltersState;
  items: ReservationViewModel[];
  monthDate: Date;
  onCalendarModeChange: (mode: "month" | "week") => void;
  onFiltersChange: (filters: ReservationFiltersState) => void;
  onMonthDateChange: (date: Date) => void;
  onSelectReservation: (reservation: Reservation) => void;
  onSelectedDateChange: (date: string) => void;
  onWeekStartDateChange: (date: Date) => void;
  selectedDate: string;
  weekStartDate: Date;
}

export function ReservationCalendarView({
  calendarMode,
  cars,
  carsById,
  clientsById,
  filters,
  items,
  monthDate,
  onCalendarModeChange,
  onFiltersChange,
  onMonthDateChange,
  onSelectReservation,
  onSelectedDateChange,
  onWeekStartDateChange,
  selectedDate,
  weekStartDate,
}: ReservationCalendarViewProps) {
  const reservations = items.map(({ car, client, reservation, secondClient }) => ({ ...reservation, car, client, secondClient }));
  const calendarDays = buildCalendarDays(monthDate);
  const selectedDayItems = items.filter((item) => reservationTouchesDate(item.reservation, selectedDate));

  const goPrevious = () => {
    if (calendarMode === "week") {
      const prev = new Date(weekStartDate);
      prev.setDate(prev.getDate() - 7);
      onWeekStartDateChange(prev);
      onSelectedDateChange(getLocalDateKey(prev));
      onMonthDateChange(prev);
      return;
    }

    onMonthDateChange(addMonths(monthDate, -1));
  };

  const goNext = () => {
    if (calendarMode === "week") {
      const next = new Date(weekStartDate);
      next.setDate(next.getDate() + 7);
      onWeekStartDateChange(next);
      onSelectedDateChange(getLocalDateKey(next));
      onMonthDateChange(next);
      return;
    }

    onMonthDateChange(addMonths(monthDate, 1));
  };

  const goToday = () => {
    const today = new Date();
    onMonthDateChange(today);
    onWeekStartDateChange(getStartOfWeek(today));
    onSelectedDateChange(getLocalDateKey(today));
  };

  return (
    <section className="animate-slide-in-up space-y-4">
      <ReservationFilters
        cars={cars}
        filters={filters}
        onChange={onFiltersChange}
        onSelectedDateChange={(date) => {
          if (!date) return;
          const nextDate = new Date(`${date}T00:00:00`);
          onSelectedDateChange(date);
          onMonthDateChange(nextDate);
          onWeekStartDateChange(getStartOfWeek(nextDate));
        }}
        selectedDate={selectedDate}
        showDateInput
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusLegend />
        <div className="text-sm text-muted-foreground dark:text-slate-400">
          {selectedDayItems.length} réservation{selectedDayItems.length > 1 ? "s" : ""} le{" "}
          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(`${selectedDate}T00:00:00`))}
        </div>
      </div>

      <Card className="overflow-hidden rounded-xl p-0 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-border p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button aria-label="Période précédente" onClick={goPrevious} size="icon" type="button" variant="outline">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="min-w-44 text-center text-lg font-semibold text-slate-950 dark:text-slate-100">
              {calendarMode === "week" ? formatWeekTitle(weekStartDate) : formatMonthTitle(monthDate)}
            </h3>
            <Button aria-label="Période suivante" onClick={goNext} size="icon" type="button" variant="outline">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1 dark:border-slate-800 dark:bg-slate-950">
              {[
                { label: "Mois", value: "month" as const },
                { label: "Semaine", value: "week" as const },
              ].map((item) => (
                <button
                  className={cn(
                    "h-9 rounded-md px-4 text-sm font-semibold text-muted-foreground transition-smooth dark:text-slate-400",
                    calendarMode === item.value && "bg-blue-600 text-white shadow-sm dark:text-white",
                  )}
                  key={item.value}
                  onClick={() => {
                    onCalendarModeChange(item.value);
                    if (item.value === "week") onWeekStartDateChange(getStartOfWeek(new Date(`${selectedDate}T00:00:00`)));
                  }}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Button onClick={goToday} type="button" variant="outline">
              Aujourd'hui
            </Button>
          </div>
        </div>

        {calendarMode === "week" ? (
          <CalendarTimeGrid
            reservations={reservations}
            selectedDate={selectedDate}
            onSelectReservation={onSelectReservation}
            weekStartDate={weekStartDate}
          />
        ) : (
          <CalendarGrid
            carsById={carsById}
            clientsById={clientsById}
            days={calendarDays}
            monthDate={monthDate}
            onSelectDate={onSelectedDateChange}
            onSelectReservation={onSelectReservation}
            reservations={reservations}
            selectedDate={selectedDate}
          />
        )}
      </Card>

      <Card className="rounded-xl p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">Résumé du jour</h3>
            <p className="text-sm text-muted-foreground dark:text-slate-400">Sélection rapide sans liste complète.</p>
          </div>
          <CalendarDays className="h-5 w-5 text-blue-600" />
        </div>
        {selectedDayItems.length ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {selectedDayItems.slice(0, 6).map((item) => (
              <button
                className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 text-left transition-smooth hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-900 dark:hover:bg-blue-950/20"
                key={item.reservation.id}
                onClick={() => onSelectReservation(item.reservation)}
                type="button"
              >
                <div className={cn("h-10 w-1.5 rounded-full", getStatusBarClass(item.reservation.status))} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
                    {item.car ? formatCarName(item.car.brand, item.car.model) : "Voiture inconnue"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground dark:text-slate-400">
                    {item.client ? normalizeClientName(item.client.fullName) : "Client inconnu"}
                  </p>
                </div>
                <StatusBadge status={item.reservation.status} />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground dark:border-slate-800 dark:text-slate-400">
            Aucune réservation trouvée
          </div>
        )}
      </Card>
    </section>
  );
}

function CalendarGrid({
  carsById,
  clientsById,
  days,
  monthDate,
  onSelectDate,
  onSelectReservation,
  reservations,
  selectedDate,
}: {
  carsById: Map<number, Car>;
  clientsById: Map<number, Client>;
  days: Date[];
  monthDate: Date;
  onSelectDate: (date: string) => void;
  onSelectReservation: (reservation: Reservation) => void;
  reservations: Reservation[];
  selectedDate: string;
}) {
  const eventSegments = buildMonthEventSegments(days, reservations);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[840px]">
        <div className="grid border-b border-border dark:border-slate-800" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {weekdays.map((day) => (
            <div className="px-3 py-3 text-center text-sm font-semibold text-muted-foreground dark:text-slate-400" key={day}>
              {day}
            </div>
          ))}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {days.map((date) => {
            const dateKey = getLocalDateKey(date);
            const dayReservations = reservations.filter((reservation) => reservationTouchesDate(reservation, dateKey));
            const inMonth = date.getMonth() === monthDate.getMonth();
            const selected = selectedDate === dateKey;

            return (
              <button
                className={cn(
                  "relative min-h-32 border-b border-r border-border bg-white p-2 text-left align-top transition-smooth hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-blue-950/20",
                  !inMonth && "bg-muted/30 text-muted-foreground dark:bg-slate-950/70 dark:text-slate-500",
                  selected && "bg-blue-50 ring-2 ring-inset ring-blue-600 dark:bg-blue-950/30",
                )}
                key={dateKey}
                onClick={() => onSelectDate(dateKey)}
                type="button"
              >
                <div className="mb-2 flex justify-between gap-2">
                  <span className={cn("text-sm font-semibold", !inMonth && "font-normal")}>
                    {String(date.getDate()).padStart(2, "0")}
                  </span>
                  {dayReservations.length > 2 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                      {dayReservations.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          <div
            className="pointer-events-none absolute inset-0 grid"
            style={{
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gridTemplateRows: "repeat(6, minmax(8rem, 1fr))",
            }}
          >
            {eventSegments.map((segment) => (
              <button
                className={cn(
                  "pointer-events-auto z-10 mx-2 h-9 rounded-lg px-3 text-left text-xs font-semibold shadow-sm ring-1 transition-smooth hover:-translate-y-0.5 hover:shadow-md",
                  statusColorClasses[segment.reservation.status],
                )}
                key={segment.key}
                onClick={() => onSelectReservation(segment.reservation)}
                style={{
                  gridColumn: `${segment.columnStart} / span ${segment.span}`,
                  gridRow: segment.row + 1,
                  marginTop: `${34 + segment.lane * 36}px`,
                }}
                type="button"
              >
                <span className="flex h-full min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{formatCalendarReservationTitle(segment.reservation, carsById, clientsById)}</span>
                  <span className="hidden shrink-0 items-center gap-1 opacity-80 xl:flex">
                    <Clock className="h-3 w-3" />
                    {segment.span > 1 ? formatEventDateSpan(segment.reservation) : formatTimeRange(segment.reservation)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground dark:text-slate-400">
      <LegendItem color="bg-orange-500" label="À venir" />
      <LegendItem color="bg-blue-500" label="En cours" />
      <LegendItem color="bg-emerald-500" label="Confirmée" />
      <LegendItem color="bg-slate-400" label="Terminée" />
      <LegendItem color="bg-red-500" label="Annulée" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      {label}
    </span>
  );
}

function buildCalendarDays(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstDay = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
}

function formatWeekTitle(startDate: Date) {
  const start = getStartOfWeek(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

type MonthEventSegment = {
  columnStart: number;
  key: string;
  lane: number;
  reservation: Reservation;
  row: number;
  span: number;
};

function buildMonthEventSegments(days: Date[], reservations: Reservation[]): MonthEventSegment[] {
  const rowLanes: Array<Array<Array<{ end: number; start: number }>>> = Array.from({ length: 6 }, () => []);
  const sortedReservations = [...reservations].sort(
    (first, second) => new Date(first.startDate).getTime() - new Date(second.startDate).getTime(),
  );

  return sortedReservations.flatMap((reservation) => {
    const touchedIndexes = days
      .map((day, index) => (reservationTouchesDate(reservation, getLocalDateKey(day)) ? index : -1))
      .filter((index) => index >= 0);

    if (!touchedIndexes.length) return [];

    const segments: MonthEventSegment[] = [];
    let segmentStart = touchedIndexes[0];
    const lastTouchedIndex = touchedIndexes[touchedIndexes.length - 1];

    while (segmentStart <= lastTouchedIndex) {
      const row = Math.floor(segmentStart / 7);
      const segmentEnd = Math.min(lastTouchedIndex, row * 7 + 6);
      const lane = getMonthEventLane(rowLanes[row], segmentStart, segmentEnd);

      segments.push({
        columnStart: (segmentStart % 7) + 1,
        key: `${reservation.id}-${segmentStart}`,
        lane,
        reservation,
        row,
        span: segmentEnd - segmentStart + 1,
      });

      segmentStart = segmentEnd + 1;
    }

    return segments;
  });
}

function getMonthEventLane(lanes: Array<Array<{ end: number; start: number }>>, start: number, end: number) {
  const laneIndex = lanes.findIndex((lane) => lane.every((range) => end < range.start || start > range.end));

  if (laneIndex >= 0) {
    lanes[laneIndex].push({ end, start });
    return laneIndex;
  }

  lanes.push([{ end, start }]);
  return lanes.length - 1;
}

function formatEventDateSpan(reservation: Reservation) {
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });
  return `${formatter.format(new Date(reservation.startDate))}-${formatter.format(new Date(reservation.endDate))}`;
}

function formatTimeRange(reservation: Reservation) {
  const start = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(reservation.startDate));
  const end = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(reservation.endDate));
  return `${start} -> ${end}`;
}

function formatCalendarReservationTitle(
  reservation: Reservation,
  carsById: Map<number, Car>,
  clientsById: Map<number, Client>,
) {
  const car = carsById.get(reservation.carId) ?? reservation.car;
  const client = clientsById.get(reservation.clientId) ?? reservation.client;

  if (car) return formatCarName(car.brand, car.model);
  if (client) return normalizeClientName(client.fullName);
  return `Réservation #${reservation.id}`;
}

function getStatusBarClass(status: Reservation["status"]) {
  return {
    CANCELLED: "bg-red-500",
    COMPLETED: "bg-slate-400",
    EN_ATTENTE: "bg-orange-500",
    ONGOING: "bg-blue-500",
    RESERVED: "bg-emerald-500",
  }[status];
}
