import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  RENTED: "bg-blue-50 text-blue-700 ring-blue-200",
  MAINTENANCE: "bg-amber-50 text-amber-700 ring-amber-200",
  UNAVAILABLE: "bg-red-50 text-red-700 ring-red-200",
  EN_ATTENTE: "bg-orange-50 text-orange-700 ring-orange-200",
  RESERVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ONGOING: "bg-blue-50 text-blue-700 ring-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 ring-red-200",
  GENERATED: "bg-slate-50 text-slate-700 ring-slate-200",
  SIGNED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const dotStyles: Record<string, string> = {
  AVAILABLE: "bg-emerald-500",
  RENTED: "bg-blue-500",
  MAINTENANCE: "bg-amber-500",
  UNAVAILABLE: "bg-red-500",
  EN_ATTENTE: "bg-orange-500",
  RESERVED: "bg-emerald-500",
  ONGOING: "bg-blue-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-red-500",
  GENERATED: "bg-slate-500",
  SIGNED: "bg-emerald-500",
};

const labels: Record<string, string> = {
  AVAILABLE: "Disponible",
  RENTED: "Louée",
  MAINTENANCE: "Maintenance",
  UNAVAILABLE: "Indisponible",
  EN_ATTENTE: "À venir",
  RESERVED: "Confirmée",
  ONGOING: "En cours",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
  GENERATED: "Généré",
  SIGNED: "Signé",
};

export function getStatusLabel(status: string) {
  return labels[status] ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ring-1 transition-smooth-500",
        styles[status] ?? styles.GENERATED,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full transition-smooth-500", dotStyles[status] ?? dotStyles.GENERATED)} />
      {getStatusLabel(status)}
    </span>
  );
}
