import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ArchiveItem } from "@/types/archive";

interface PermanentDeleteDialogProps {
  item: ArchiveItem | null;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}

export function PermanentDeleteDialog({ item, onCancel, onConfirm, open }: PermanentDeleteDialogProps) {
  return (
    <Dialog onOpenChange={(value) => !value && onCancel()} open={open}>
      <DialogContent className="w-[min(92vw,480px)] dark:border-slate-800 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle>Suppression définitive</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground dark:text-slate-400">
          Cette action est irréversible. Voulez-vous vraiment supprimer cet élément ?
        </p>
        {item && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800 dark:bg-red-950/30 dark:text-red-200">{item.title}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="outline">
            Annuler
          </Button>
          <Button onClick={onConfirm} type="button" variant="destructive">
            Supprimer définitivement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
