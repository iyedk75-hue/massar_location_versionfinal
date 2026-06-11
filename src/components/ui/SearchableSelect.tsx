import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
  keywords?: string;
};

interface SearchableSelectProps {
  value: string | number | null | undefined;
  options: SearchableSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function SearchableSelect({
  ariaLabel,
  className,
  disabled = false,
  emptyLabel = "Aucun résultat",
  onValueChange,
  options,
  placeholder = "Sélectionner",
  searchPlaceholder = "Rechercher...",
  value,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const valueKey = value == null ? "" : String(value);

  const selectedOption = options.find((option) => String(option.value) === valueKey);
  const filteredOptions = useMemo(() => {
    const needle = normalizeSearch(query);
    if (!needle) return options;

    return options.filter((option) => {
      const haystack = normalizeSearch(`${option.label} ${option.description ?? ""} ${option.value} ${option.keywords ?? ""}`);
      return haystack.includes(needle);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const nextActiveIndex = filteredOptions.findIndex((option) => !option.disabled);
    setActiveIndex(nextActiveIndex >= 0 ? nextActiveIndex : 0);
  }, [filteredOptions, open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function selectOption(option: SearchableSelectOption) {
    if (option.disabled) return;
    onValueChange(String(option.value));
    setOpen(false);
    setQuery("");
  }

  function moveActive(direction: 1 | -1) {
    if (!filteredOptions.length) return;

    let nextIndex = activeIndex;
    for (let step = 0; step < filteredOptions.length; step += 1) {
      nextIndex = (nextIndex + direction + filteredOptions.length) % filteredOptions.length;
      if (!filteredOptions[nextIndex]?.disabled) {
        setActiveIndex(nextIndex);
        return;
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (!open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option) selectOption(option);
    }
  }

  return (
    <div className="relative" onKeyDown={handleKeyDown} ref={rootRef}>
      <button
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-white px-3 text-left text-sm text-foreground shadow-sm outline-none transition duration-150 hover:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900",
          className,
        )}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className={cn("flex min-w-0 items-center gap-2 truncate", !selectedOption && "text-muted-foreground")}>
          <span className="min-w-0 truncate">{selectedOption?.label ?? placeholder}</span>
          {selectedOption?.description && (
            <span className="shrink-0 text-xs font-normal text-muted-foreground">{selectedOption.description}</span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-border bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
          <div className="border-b border-border p-2 dark:border-slate-800">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Rechercher"
                className="h-9 w-full rounded-lg border border-input bg-white pl-8 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                ref={inputRef}
                type="search"
                value={query}
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1" id={listboxId} role="listbox">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              filteredOptions.map((option, index) => {
                const selected = String(option.value) === valueKey;
                const active = index === activeIndex;

                return (
                  <button
                    aria-disabled={option.disabled}
                    aria-selected={selected}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition duration-150",
                      active && "bg-slate-100 dark:bg-slate-800",
                      selected && "font-semibold text-blue-700 dark:text-blue-300",
                      option.disabled
                        ? "cursor-not-allowed opacity-45"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                    )}
                    disabled={option.disabled}
                    key={`${option.value}-${option.label}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option)}
                    role="option"
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate">{option.label}</span>
                      {option.description && (
                        <span className="shrink-0 text-xs font-normal text-slate-500 dark:text-slate-400">
                          {option.description}
                        </span>
                      )}
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
