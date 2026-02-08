import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { Input } from "./ui/input";

type SearchableSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  className?: string;
};

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  searchPlaceholder = "Search...",
  emptyText = "No results",
  disabled,
  allowEmpty = true,
  className
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const lowered = query.trim().toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(lowered));
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const triggerBase =
    "h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-left text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerBase}
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("block truncate", !value && "text-slate-500")}> {value || placeholder} </span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
          v
        </span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          className="absolute z-50 mt-2 w-full rounded-md border border-slate-800 bg-slate-950/95 shadow-xl"
        >
          <div className="border-b border-slate-800 p-2">
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
          <div className="max-h-64 overflow-auto p-1 text-sm">
            {allowEmpty ? (
              <button
                type="button"
                className={cn(
                  "flex w-full items-center rounded-md px-3 py-2 text-left text-slate-200 hover:bg-slate-900/70",
                  value === "" && "bg-slate-900/70 text-emerald-200"
                )}
                onClick={() => {
                  onValueChange("");
                  setOpen(false);
                }}
              >
                {placeholder}
              </button>
            ) : null}
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">{emptyText}</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-md px-3 py-2 text-left text-slate-200 hover:bg-slate-900/70",
                    option === value && "bg-slate-900/70 text-emerald-200"
                  )}
                  onClick={() => {
                    onValueChange(option);
                    setOpen(false);
                  }}
                >
                  {option}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
