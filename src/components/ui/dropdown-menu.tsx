import * as React from "react";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type DropdownMenuContextValue = {
  close: () => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  rootRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLElement | null>;
  toggle: () => void;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !contentRef.current?.contains(target)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function handleViewportChange() {
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  const value = React.useMemo(
    () => ({
      close: () => setOpen(false),
      contentRef,
      open,
      rootRef,
      triggerRef,
      toggle: () => setOpen((current) => !current),
    }),
    [open],
  );

  return (
    <DropdownMenuContext.Provider value={value}>
      <div className="relative inline-flex" ref={rootRef}>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  asChild = false,
  children,
}: {
  asChild?: boolean;
  children: React.ReactNode;
}) {
  const context = useDropdownMenuContext("DropdownMenuTrigger");
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      aria-expanded={context.open}
      aria-haspopup="menu"
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        context.triggerRef.current = event.currentTarget as HTMLElement;
        context.toggle();
      }}
      type={asChild ? undefined : "button"}
    >
      {children}
    </Comp>
  );
}

export function DropdownMenuContent({
  align = "center",
  className,
  children,
}: {
  align?: "center" | "end" | "start";
  className?: string;
  children: React.ReactNode;
}) {
  const context = useDropdownMenuContext("DropdownMenuContent");
  const [floatingStyle, setFloatingStyle] = React.useState<React.CSSProperties>({
    left: -9999,
    position: "fixed",
    top: -9999,
  });

  React.useLayoutEffect(() => {
    if (!context.open || typeof window === "undefined") return;

    function updatePosition() {
      const rect = context.triggerRef.current?.getBoundingClientRect();
      const content = context.contentRef.current;
      if (!rect || !content) return;

      const gutter = 8;
      const contentWidth = content.offsetWidth;
      const contentHeight = content.offsetHeight;
      const spaceBelow = window.innerHeight - rect.bottom - gutter;
      const spaceAbove = rect.top - gutter;
      const placeAbove = contentHeight > spaceBelow && spaceAbove > spaceBelow;
      const availableHeight = Math.max(120, (placeAbove ? spaceAbove : spaceBelow) - gutter);

      let top = placeAbove ? rect.top - contentHeight - gutter : rect.bottom + gutter;
      if (top < gutter) top = gutter;
      if (top + contentHeight > window.innerHeight - gutter) {
        top = Math.max(gutter, window.innerHeight - contentHeight - gutter);
      }

      let left = rect.left;
      if (align === "end") {
        left = rect.right - contentWidth;
      } else if (align === "center") {
        left = rect.left + rect.width / 2 - contentWidth / 2;
      }

      left = Math.min(Math.max(gutter, left), Math.max(gutter, window.innerWidth - contentWidth - gutter));

      setFloatingStyle({
        left,
        maxHeight: availableHeight,
        overflowY: "auto",
        position: "fixed",
        top,
      });
    }

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(frame);
  }, [align, context.contentRef, context.open, context.triggerRef]);

  if (!context.open || typeof document === "undefined") return null;

  const rect = context.triggerRef.current?.getBoundingClientRect();
  if (!rect) return null;

  return createPortal(
    <div
      className={cn(
        "z-[100] min-w-36 overflow-hidden rounded-md border border-border bg-white p-1 text-sm text-foreground shadow-md dark:border-slate-800 dark:bg-slate-950",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
      ref={context.contentRef}
      role="menu"
      style={floatingStyle}
    >
      {children}
    </div>,
    document.body,
  );
}

export function DropdownMenuItem({
  asChild = false,
  className,
  onClick,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  asChild?: boolean;
  variant?: "default" | "destructive";
}) {
  const context = useDropdownMenuContext("DropdownMenuItem");
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      className={cn(
        "flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus:bg-muted",
        variant === "destructive" && "text-destructive hover:bg-destructive/10 focus:bg-destructive/10",
        className,
      )}
      onClick={(event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        onClick?.(event);
        context.close();
      }}
      role="menuitem"
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-mx-1 my-1 h-px bg-border", className)} role="separator" {...props} />;
}

function useDropdownMenuContext(component: string) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error(`${component} must be used inside DropdownMenu`);
  return context;
}
