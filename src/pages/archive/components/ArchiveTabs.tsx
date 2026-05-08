import type { ArchiveType } from "@/types/archive";
import { cn } from "@/lib/utils";

export type ArchiveTab = ArchiveType | "all";

const tabs: Array<{ label: string; value: ArchiveTab }> = [
  { label: "Tous", value: "all" },
  { label: "Clients", value: "client" },
  { label: "Voitures", value: "car" },
  { label: "Réservations", value: "reservation" },
  { label: "Paiements", value: "payment" },
  { label: "Contrats", value: "contract" },
];

export function ArchiveTabs({ active, onChange }: { active: ArchiveTab; onChange: (tab: ArchiveTab) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          className={cn(
            "h-10 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-slate-600 transition-smooth hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
            active === tab.value && "border-blue-600 bg-blue-600 text-white hover:bg-blue-600 dark:bg-blue-600 dark:text-white",
          )}
          key={tab.value}
          onClick={() => onChange(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
