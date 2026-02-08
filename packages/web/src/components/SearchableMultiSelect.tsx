import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { Input } from "./ui/input";

type MultiSelectOption = {
  value: string;
  label: string;
  description?: string;
};

type SearchableMultiSelectProps = {
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

export function SearchableMultiSelect({
  values,
  onValuesChange,
  options,
  placeholder = "Select",
  searchPlaceholder = "Search...",
  emptyText = "No results",
  disabled,
  className
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const valueSet = useMemo(() => new Set(values), [values]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const lowered = query.trim().toLowerCase();
    return options.filter((option) => {
      const haystack = `${option.label} ${option.value} ${option.description ?? ""}`
        .trim()
        .toLowerCase();
      return haystack.includes(lowered);
    });
  }, [options, query]);

  const labelByValue = useMemo(() => {
    const map = new Map<string, string>();
    options.forEach((option) => map.set(option.value, option.label));
    return map;
  }, [options]);

  const triggerText = useMemo(() => {
    if (values.length === 0) return placeholder;
    if (values.length === 1) return labelByValue.get(values[0]) ?? values[0];
    return `${values.length} selected`;
  }, [labelByValue, placeholder, values]);

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
        <span className={cn("block truncate", values.length === 0 && "text-slate-500")}>
          {triggerText}
        </span>
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
          <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-500">
            <span>{values.length} selected</span>
            <button
              type="button"
              className="text-emerald-300 hover:text-emerald-200"
              onClick={() => onValuesChange([])}
              disabled={values.length === 0}
            >
              Clear selection
            </button>
          </div>
          <div className="max-h-64 overflow-auto p-1 text-sm">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">{emptyText}</div>
            ) : (
              filtered.map((option) => {
                const selected = valueSet.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-slate-200 hover:bg-slate-900/70",
                      selected && "bg-slate-900/70 text-emerald-200"
                    )}
                    onClick={() => {
                      const next = selected
                        ? values.filter((value) => value !== option.value)
                        : [...values, option.value];
                      onValuesChange(next);
                    }}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 items-center justify-center rounded border border-slate-600 text-[10px]",
                        selected && "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                      )}
                    >
                      {selected ? "v" : ""}
                    </span>
                    <span className="flex flex-col">
                      <span>{option.label}</span>
                      {option.description ? (
                        <span className="text-xs text-slate-500">{option.description}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
