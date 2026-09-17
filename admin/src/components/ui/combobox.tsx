import { useEffect, useRef, useState } from "react";
import { Input } from "./input";
import { cn } from "../../lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  id?: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

/** Champ texte avec autocomplete façon select2 : tape pour filtrer, clique pour choisir. */
export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  required,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function selectOption(option: ComboboxOption) {
    onChange(option.value);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={open ? query : (selected?.label ?? "")}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (filtered.length > 0) selectOption(filtered[0]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={className}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-300 bg-white text-sm shadow-md">
          {filtered.length === 0 && <li className="px-3 py-2 text-zinc-500">Aucun résultat.</li>}
          {filtered.map((option) => (
            <li
              key={option.value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectOption(option)}
              className={cn(
                "cursor-pointer px-3 py-2 hover:bg-zinc-100",
                option.value === value && "bg-zinc-50 font-medium",
              )}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
