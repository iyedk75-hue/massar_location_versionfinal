import type { LucideIcon } from "lucide-react";
import { MoreHorizontalIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Ouvrir les actions" className="h-8 w-8 rounded-md" size="icon" type="button" variant="ghost">
          <MoreHorizontalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {regularActions.map((action) => (
          <ActionMenuItem action={action} key={action.label} />
        ))}
        {regularActions.length > 0 && destructiveActions.length > 0 && <DropdownMenuSeparator />}
        {destructiveActions.map((action) => (
          <ActionMenuItem action={action} key={action.label} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActionMenuItem({ action }: { action: DataGridActionItem }) {
  const Icon = action.icon;
  const toneClassName = getActionToneClassName(action);

  if (action.href) {
    return (
      <DropdownMenuItem
        asChild
        className={cn(toneClassName, action.disabled && "pointer-events-none opacity-50")}
        variant={action.destructive ? "destructive" : "default"}
      >
        <Link to={action.href}>
          <Icon className="mr-2 h-4 w-4" />
          {action.label}
        </Link>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      className={cn(toneClassName, action.disabled && "pointer-events-none opacity-50")}
      onClick={() => {
        if (!action.disabled) action.onClick?.();
      }}
      variant={action.destructive ? "destructive" : "default"}
    >
      <Icon className="mr-2 h-4 w-4" />
      {action.label}
    </DropdownMenuItem>
  );
}

function getActionToneClassName(action: DataGridActionItem) {
  if (action.destructive) return undefined;

  const tone = action.tone ?? inferActionTone(action.label);
  const classNames: Record<DataGridActionTone, string> = {
    archive: "text-slate-600 focus:text-slate-600 [&_svg]:text-slate-600",
    default: "text-slate-700 focus:text-slate-700 [&_svg]:text-slate-600",
    edit: "text-amber-600 focus:text-amber-600 [&_svg]:text-amber-600",
    info: "text-violet-600 focus:text-violet-600 [&_svg]:text-violet-600",
    success: "text-green-600 focus:text-green-600 [&_svg]:text-green-600",
    view: "text-blue-600 focus:text-blue-600 [&_svg]:text-blue-600",
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
