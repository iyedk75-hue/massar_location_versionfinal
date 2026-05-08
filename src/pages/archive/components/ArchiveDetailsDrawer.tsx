import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Archive, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ArchiveItem } from "@/types/archive";

interface ArchiveDetailsDrawerProps {
  item: ArchiveItem | null;
  onClose: () => void;
  open: boolean;
}

export function ArchiveDetailsDrawer({ item, onClose, open }: ArchiveDetailsDrawerProps) {
  return (
    <DialogPrimitive.Root onOpenChange={(value) => !value && onClose()} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/45 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <DialogPrimitive.Content className="fixed right-0 top-0 z-50 flex h-full w-[min(96vw,520px)] flex-col border-l border-border bg-white shadow-2xl outline-none data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5 dark:border-slate-800">
            <div>
              <DialogPrimitive.Title className="text-xl font-bold text-slate-950 dark:text-slate-100">
                Détails archive
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground dark:text-slate-400">
                Informations principales et données liées.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button aria-label="Fermer" size="icon" type="button" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          {item ? (
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <section className="rounded-xl border border-border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-slate-100">
                  <Archive className="h-4 w-4 text-blue-600" />
                  {item.title}
                </div>
                <Detail label="Type" value={item.type} />
                <Detail label="Référence" value={item.subtitle || "-"} />
                <Detail label="Description" value={item.description || "-"} />
                <Detail label="Statut" value={item.status || "-"} />
                <Detail label="Date archivage" value={formatDate(item.archivedAt)} />
                <Detail label="Raison archivage" value={item.archivedReason || "-"} />
              </section>

              <section className="rounded-xl border border-border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-3 text-sm font-bold text-slate-950 dark:text-slate-100">Données liées</p>
                <div className="grid gap-2">
                  {Object.entries(item.originalData).map(([key, value]) => (
                    <Detail key={key} label={key} value={formatValue(value)} />
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="p-5 text-sm text-muted-foreground dark:text-slate-400">Aucune archive sélectionnée.</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border py-2 text-sm last:border-b-0 dark:border-slate-800">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">{label}</span>
      <span className="break-words text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatValue(value: unknown) {
  if (value == null) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
