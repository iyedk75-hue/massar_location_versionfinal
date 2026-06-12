import { ReservationDataGrid } from "@/pages/reservations/components/ReservationDataGrid";
import { ReservationFilters } from "@/pages/reservations/components/ReservationFilters";
import { ReservationStatsCards } from "@/pages/reservations/components/ReservationStatsCards";
import type { ReservationFiltersState, ReservationViewModel } from "@/pages/reservations/components/reservationViewUtils";
import type { Car } from "@/types/car";
import type { Reservation } from "@/types/reservation";

interface ReservationListViewProps {
  cars: Car[];
  filters: ReservationFiltersState;
  items: ReservationViewModel[];
  onCreate: () => void;
  onArchive: (reservation: Reservation) => void;
  onArchiveSelected: (reservations: Reservation[]) => void | Promise<void>;
  onEdit: (reservation: Reservation) => void;
  onFiltersChange: (filters: ReservationFiltersState) => void;
  onSelect: (reservation: Reservation) => void;
  onStatusChange: (
    id: number,
    status: Reservation["status"],
    details?: { returnMileage?: number | null; returnFuelLevel?: string | null },
  ) => void | Promise<void>;
  stats: {
    all: number;
    cancelled: number;
    completed: number;
    confirmed: number;
    ongoing: number;
    upcoming: number;
  };
}

export function ReservationListView({
  cars,
  filters,
  items,
  onCreate,
  onArchive,
  onArchiveSelected,
  onEdit,
  onFiltersChange,
  onSelect,
  onStatusChange,
  stats,
}: ReservationListViewProps) {
  return (
    <section className="animate-slide-in-up space-y-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-normal text-slate-950 dark:text-slate-100">Liste des réservations</h2>
        <p className="text-sm text-muted-foreground dark:text-slate-400">
          Consultez, filtrez et gérez toutes les réservations de l’agence
        </p>
      </div>

      <ReservationStatsCards stats={stats} />
      <ReservationFilters cars={cars} filters={filters} onChange={onFiltersChange} />
      <ReservationDataGrid
        items={items}
        onArchive={onArchive}
        onArchiveSelected={onArchiveSelected}
        onCreate={onCreate}
        onEdit={onEdit}
        onSelect={onSelect}
        onStatusChange={onStatusChange}
      />
    </section>
  );
}
