import { cn } from "../../lib/utils";

interface FilterChipsProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** Filtre à choix unique en pastilles : tous les choix visibles d'un coup d'œil, un clic suffit. */
export default function FilterChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: FilterChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {options.map((option) => (
        <button
          key={option.value || "all"}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "alterra-focus rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
