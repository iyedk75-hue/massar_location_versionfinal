import { CalendarDays, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReservationViewMode } from "@/pages/reservations/components/reservationViewUtils";

interface ReservationViewToggleProps {
  mode: ReservationViewMode;
  onChange: (mode: ReservationViewMode) => void;
}

export function ReservationViewToggle({ mode, onChange }: ReservationViewToggleProps) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {[
        { icon: CalendarDays, label: "Vue calendrier", value: "calendar" as const },
        { icon: ListChecks, label: "Vue liste", value: "list" as const },
      ].map((item) => {
        const Icon = item.icon;
        const active = mode === item.value;

        return (
          <button
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-slate-600 transition-smooth hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
              active && "bg-blue-600 text-white shadow-sm hover:bg-blue-600 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-600",
            )}
            key={item.value}
            onClick={() => onChange(item.value)}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
