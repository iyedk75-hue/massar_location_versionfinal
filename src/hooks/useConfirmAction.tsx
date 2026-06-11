import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ConfirmActionName =
  | "archiver"
  | "annuler"
  | "demarrer"
  | "démarrer"
  | "desactiver"
  | "désactiver"
  | "modifier"
  | "nettoyer"
  | "reactiver"
  | "réactiver"
  | "restaurer"
  | "retour"
  | "supprimer"
  | "terminer"
  | "valider"
  | (string & {});

type ConfirmVariant = "default" | "destructive";

export interface ConfirmActionOptions {
  action: ConfirmActionName;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void | Promise<void>;
}

interface PendingConfirmation extends Required<Omit<ConfirmActionOptions, "variant">> {
  variant: ConfirmVariant;
}

interface ConfirmActionContextValue {
  confirmAction: (options: ConfirmActionOptions) => void;
}

const ConfirmActionContext = createContext<ConfirmActionContextValue | null>(null);

export function ConfirmActionProvider({ children }: PropsWithChildren) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => {
    if (!loading) setPending(null);
  }, [loading]);

  const confirmAction = useCallback((options: ConfirmActionOptions) => {
    if (normalizeAction(options.action) === "modifier") {
      void options.onConfirm();
      return;
    }

    const defaults = getActionDefaults(options.action);
    setPending({
      action: options.action,
      cancelLabel: options.cancelLabel ?? "Annuler",
      confirmLabel: options.confirmLabel ?? defaults.confirmLabel,
      description: options.description ?? defaults.description,
      onConfirm: options.onConfirm,
      title: options.title ?? defaults.title,
      variant: options.variant ?? defaults.variant,
    });
  }, []);

  const value = useMemo(() => ({ confirmAction }), [confirmAction]);

  async function handleConfirm() {
    if (!pending) return;
    try {
      setLoading(true);
      await pending.onConfirm();
      setPending(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmActionContext.Provider value={value}>
      {children}
      <AlertDialog onOpenChange={(open) => !open && close()} open={Boolean(pending)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading} onClick={close}>
              {pending?.cancelLabel ?? "Annuler"}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                pending?.variant === "destructive" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
              disabled={loading}
              onClick={() => void handleConfirm()}
            >
              {loading ? "Traitement..." : pending?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmActionContext.Provider>
  );
}

export function useConfirmAction() {
  const context = useContext(ConfirmActionContext);
  if (!context) {
    throw new Error("useConfirmAction must be used inside ConfirmActionProvider");
  }
  return context;
}

function getActionDefaults(action: ConfirmActionName): Pick<PendingConfirmation, "confirmLabel" | "description" | "title" | "variant"> {
  switch (normalizeAction(action)) {
    case "archiver":
      return {
        confirmLabel: "Archiver",
        description: "Cette action déplacera l'élément dans les archives.",
        title: "Archiver cet élément ?",
        variant: "default",
      };
    case "annuler":
      return {
        confirmLabel: "Annuler",
        description: "Cette action changera le statut et peut impacter le suivi de location.",
        title: "Annuler cette action ?",
        variant: "destructive",
      };
    case "demarrer":
      return {
        confirmLabel: "Démarrer",
        description: "Cette action lancera le traitement sélectionné.",
        title: "Démarrer cette action ?",
        variant: "default",
      };
    case "desactiver":
      return {
        confirmLabel: "Désactiver",
        description: "L'élément restera disponible dans l'historique, mais ne sera plus actif.",
        title: "Désactiver cet élément ?",
        variant: "destructive",
      };
    case "nettoyer":
      return {
        confirmLabel: "Nettoyer",
        description: "Les éléments concernés seront supprimés définitivement.",
        title: "Nettoyer les archives ?",
        variant: "destructive",
      };
    case "reactiver":
      return {
        confirmLabel: "Réactiver",
        description: "L'élément redeviendra actif et utilisable dans l'application.",
        title: "Réactiver cet élément ?",
        variant: "default",
      };
    case "restaurer":
      return {
        confirmLabel: "Restaurer",
        description: "Cette action replacera l'élément dans son espace d'origine.",
        title: "Restaurer cet élément ?",
        variant: "default",
      };
    case "retour":
      return {
        confirmLabel: "Confirmer retour",
        description: "Cette action terminera la location avec les informations de retour saisies.",
        title: "Enregistrer le retour ?",
        variant: "default",
      };
    case "supprimer":
      return {
        confirmLabel: "Supprimer",
        description: "Cette action est irréversible.",
        title: "Supprimer cet élément ?",
        variant: "destructive",
      };
    case "terminer":
      return {
        confirmLabel: "Terminer",
        description: "Cette action marquera l'opération comme terminée.",
        title: "Terminer cette action ?",
        variant: "default",
      };
    case "valider":
      return {
        confirmLabel: "Valider",
        description: "Cette action confirmera les informations sélectionnées.",
        title: "Valider cette action ?",
        variant: "default",
      };
    default:
      return {
        confirmLabel: "Confirmer",
        description: "Voulez-vous continuer cette action ?",
        title: "Confirmer l'action ?",
        variant: "default",
      };
  }
}

function normalizeAction(action: ConfirmActionName) {
  return action
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
