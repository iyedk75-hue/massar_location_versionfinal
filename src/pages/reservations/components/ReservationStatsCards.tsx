import { Ban, CalendarCheck2, CalendarClock, CheckCircle2, ClipboardList, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReservationStatsCardsProps {
  stats: {
    all: number;
    cancelled: number;
    completed: number;
    confirmed: number;
    ongoing: number;
    upcoming: number;
  };
}

const statCards = [
  { key: "all", label: "Total réservations", tone: "blue", icon: ClipboardList },
  { key: "upcoming", label: "À venir", tone: "orange", icon: CalendarClock },
  { key: "ongoing", label: "En cours", tone: "sky", icon: PlayCircle },
  { key: "confirmed", label: "Confirmées", tone: "emerald", icon: CheckCircle2 },
  { key: "completed", label: "Terminées", tone: "slate", icon: CalendarCheck2 },
  { key: "cancelled", label: "Annulées", tone: "red", icon: Ban },
] as const;

const toneClasses = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-200",
  red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function ReservationStatsCards({ stats }: ReservationStatsCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {statCards.map((card) => {
        const Icon = card.icon;

        return (
          <Card
            className="flex min-h-[104px] items-center gap-3 rounded-xl p-4 transition-smooth hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            key={card.key}
          >
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", toneClasses[card.tone])}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-muted-foreground dark:text-slate-400">{card.label}</p>
              <p className="mt-1 text-2xl font-bold leading-none text-slate-950 dark:text-slate-100">{stats[card.key]}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
