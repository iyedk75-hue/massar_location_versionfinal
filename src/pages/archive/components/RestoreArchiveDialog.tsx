import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ArchiveItem } from "@/types/archive";

interface RestoreArchiveDialogProps {
  item: ArchiveItem | null;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}

export function RestoreArchiveDialog({ item, onCancel, onConfirm, open }: RestoreArchiveDialogProps) {
  return (
    <Dialog onOpenChange={(value) => !value && onCancel()} open={open}>
      <DialogContent className="w-[min(92vw,460px)] dark:border-slate-800 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle>Restaurer l’élément</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground dark:text-slate-400">
          Voulez-vous restaurer cet élément dans son espace d’origine ?
        </p>
        {item && <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold dark:bg-slate-950">{item.title}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="outline">
            Annuler
          </Button>
          <Button onClick={onConfirm} type="button">
            Restaurer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
