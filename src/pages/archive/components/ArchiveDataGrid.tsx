import { Download, Eye, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ArchiveItem, ArchiveType } from "@/types/archive";
import { cn } from "@/lib/utils";

interface ArchiveDataGridProps {
  items: ArchiveItem[];
  onDelete: (item: ArchiveItem) => void;
  onExport: (item: ArchiveItem) => void;
  onRestore: (item: ArchiveItem) => void;
  onView: (item: ArchiveItem) => void;
}

const typeLabels: Record<ArchiveType, string> = {
  car: "Voiture",
  client: "Client",
  contract: "Contrat",
  payment: "Paiement",
  reservation: "Réservation",
};

const typeClasses: Record<ArchiveType, string> = {
  car: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900",
  client: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900",
  contract: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  payment: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900",
  reservation: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900",
};

export function ArchiveDataGrid({ items, onDelete, onExport, onRestore, onView }: ArchiveDataGridProps) {
  return (
    <Card className="overflow-hidden rounded-xl p-0 dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-border bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-5 py-4 font-bold">Type</th>
              <th className="px-5 py-4 font-bold">Nom / Référence</th>
              <th className="px-5 py-4 font-bold">Description</th>
              <th className="px-5 py-4 font-bold">Date archivage</th>
              <th className="px-5 py-4 font-bold">Raison</th>
              <th className="px-5 py-4 font-bold">Statut</th>
              <th className="px-5 py-4 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-slate-800">
            {items.map((item) => (
              <tr className="bg-white transition-smooth hover:bg-blue-50/40 dark:bg-slate-900 dark:hover:bg-blue-950/20" key={`${item.type}-${item.id}`}>
                <td className="px-5 py-4">
                  <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1", typeClasses[item.type])}>
                    {typeLabels[item.type]}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-950 dark:text-slate-100">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground dark:text-slate-400">{item.subtitle}</p>
                </td>
                <td className="max-w-[320px] px-5 py-4 text-slate-600 dark:text-slate-300">
                  <p className="truncate">{item.description || "-"}</p>
                </td>
                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{formatDate(item.archivedAt)}</td>
                <td className="max-w-[240px] px-5 py-4 text-slate-600 dark:text-slate-300">
                  <p className="truncate">{item.archivedReason || "-"}</p>
                </td>
                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{item.status || "-"}</td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <IconButton label="Voir détails" onClick={() => onView(item)}>
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Restaurer" onClick={() => onRestore(item)}>
                      <RotateCcw className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Exporter" onClick={() => onExport(item)}>
                      <Download className="h-4 w-4" />
                    </IconButton>
                    <IconButton danger label="Supprimer définitivement" onClick={() => onDelete(item)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function IconButton({
  children,
  danger,
  label,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-slate-600 transition-smooth hover:bg-blue-50 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
        danger && "hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-300",
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
