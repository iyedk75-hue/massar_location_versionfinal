import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "destructive" | "outline" | "secondary" | "success";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  destructive: "bg-red-50 text-red-700 ring-red-200",
  outline: "border border-border bg-transparent text-foreground",
  secondary: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-transparent",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
