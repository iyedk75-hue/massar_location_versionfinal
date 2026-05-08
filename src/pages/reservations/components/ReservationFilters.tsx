import { CarFront, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Car } from "@/types/car";
import { getStatusLabel } from "@/components/StatusBadge";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import {
  reservationPeriodOptions,
  reservationStatuses,
  type ReservationFiltersState,
  type ReservationFilterStatus,
  type ReservationPeriodFilter,
} from "@/pages/reservations/components/reservationViewUtils";

interface ReservationFiltersProps {
  cars: Car[];
  filters: ReservationFiltersState;
  onChange: (filters: ReservationFiltersState) => void;
  showDateInput?: boolean;
  selectedDate?: string;
  onSelectedDateChange?: (date: string) => void;
}

export function ReservationFilters({
  cars,
  filters,
  onChange,
  onSelectedDateChange,
  selectedDate,
  showDateInput = false,
}: ReservationFiltersProps) {
  const update = <Key extends keyof ReservationFiltersState>(key: Key, value: ReservationFiltersState[Key]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:grid-cols-[minmax(280px,1fr)_180px_220px_180px_auto]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 rounded-lg pl-10 dark:border-slate-800 dark:bg-slate-950"
          onChange={(event) => update("query", event.target.value)}
          placeholder="Rechercher client, voiture, immatriculation..."
          value={filters.query}
        />
      </div>

      <select
        className="h-11 rounded-lg border border-input bg-white px-3 text-sm outline-none transition-smooth focus:ring-2 focus:ring-ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        onChange={(event) => update("status", event.target.value as ReservationFilterStatus)}
        value={filters.status}
      >
        {reservationStatuses.map((status) => (
          <option key={status} value={status}>
            {status === "ALL" ? "Tous les statuts" : getStatusLabel(status)}
          </option>
        ))}
      </select>

      <div className="relative">
        <CarFront className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <select
          className="h-11 w-full rounded-lg border border-input bg-white px-10 text-sm outline-none transition-smooth focus:ring-2 focus:ring-ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          onChange={(event) => update("carId", Number(event.target.value))}
          value={filters.carId}
        >
          <option value={0}>Toutes les voitures</option>
          {cars.map((car) => (
            <option key={car.id} value={car.id}>
              {formatCarName(car.brand, car.model)} ({formatRegistrationNumber(car.registrationNumber)})
            </option>
          ))}
        </select>
      </div>

      {showDateInput ? (
        <Input
          className="h-11 rounded-lg dark:border-slate-800 dark:bg-slate-950"
          onChange={(event) => onSelectedDateChange?.(event.target.value)}
          type="date"
          value={selectedDate}
        />
      ) : (
        <select
          className="h-11 rounded-lg border border-input bg-white px-3 text-sm outline-none transition-smooth focus:ring-2 focus:ring-ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          onChange={(event) => update("period", event.target.value as ReservationPeriodFilter)}
          value={filters.period}
        >
          {reservationPeriodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      <Button
        className="h-11 rounded-lg"
        onClick={() => onChange({ carId: 0, period: "ALL", query: "", status: "ALL" })}
        type="button"
        variant="outline"
      >
        <RotateCcw className="h-4 w-4" />
        Réinitialiser
      </Button>
    </div>
  );
}
