import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type DataGridActionTone = "archive" | "default" | "edit" | "info" | "success" | "view";

export type DataGridActionItem = {
  destructive?: boolean;
  disabled?: boolean;
  href?: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  tone?: DataGridActionTone;
};

export function DataGridActionMenu({ actions }: { actions: DataGridActionItem[] }) {
  const regularActions = actions.filter((action) => !action.destructive);
  const destructiveActions = actions.filter((action) => action.destructive);
  const orderedActions = [...regularActions, ...destructiveActions];

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {orderedActions.map((action) => (
        <ActionMenuItem action={action} key={action.label} />
      ))}
    </div>
  );
}

function ActionMenuItem({ action }: { action: DataGridActionItem }) {
  const Icon = action.icon;
  const toneClassName = getActionToneClassName(action);

  if (action.href) {
    return (
      <Link
        aria-disabled={action.disabled ? true : undefined}
        aria-label={action.label}
        className={cn(getActionButtonClassName(action), toneClassName, action.disabled && "pointer-events-none opacity-50")}
        title={action.label}
        to={action.href}
      >
        <Icon className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <button
      aria-label={action.label}
      className={cn(getActionButtonClassName(action), toneClassName)}
      disabled={action.disabled}
      onClick={() => {
        if (!action.disabled) action.onClick?.();
      }}
      title={action.label}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function getActionButtonClassName(action: DataGridActionItem) {
  return cn(
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors",
    "hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    action.destructive && "text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700",
  );
}

function getActionToneClassName(action: DataGridActionItem) {
  if (action.destructive) return undefined;

  const tone = action.tone ?? inferActionTone(action.label);
  const classNames: Record<DataGridActionTone, string> = {
    archive: "text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700",
    default: "text-slate-700 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900",
    edit: "text-amber-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700",
    info: "text-violet-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700",
    success: "text-green-600 hover:border-green-200 hover:bg-green-50 hover:text-green-700",
    view: "text-blue-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
  };

  return classNames[tone];
}

function inferActionTone(label: string): DataGridActionTone {
  const normalizedLabel = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizedLabel.includes("voir")) return "view";
  if (normalizedLabel.includes("modifier")) return "edit";
  if (
    normalizedLabel.includes("demarrer") ||
    normalizedLabel.includes("terminer") ||
    normalizedLabel.includes("reactiver") ||
    normalizedLabel.includes("restaurer") ||
    normalizedLabel.includes("retour") ||
    normalizedLabel.includes("rembourser")
  ) {
    return "success";
  }
  if (normalizedLabel.includes("archiver") || normalizedLabel.includes("archive")) return "archive";
  if (normalizedLabel.includes("telecharger") || normalizedLabel.includes("exporter") || normalizedLabel.includes("imprimer") || normalizedLabel.includes("recu")) {
    return "info";
  }

  return "default";
}
