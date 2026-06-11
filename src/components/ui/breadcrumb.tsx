import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Breadcrumb({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <nav aria-label="Fil d'Ariane" className={cn("flex items-center text-sm text-muted-foreground", className)} {...props} />;
}

export function BreadcrumbItem({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex min-w-0 items-center font-medium", className)} {...props} />;
}

export function BreadcrumbSeparator({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span aria-hidden="true" className={cn("mx-2 inline-flex text-muted-foreground/70", className)} {...props}>
      <ChevronRight className="h-4 w-4" />
    </span>
  );
}
