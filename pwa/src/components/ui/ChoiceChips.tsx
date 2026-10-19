import { cn } from "../../lib/cn";

interface ChoiceChipsProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** Choix unique en pastilles : plus rapide au pouce qu'une liste déroulante pour peu d'options. */
export default function ChoiceChips({ label, value, options, onChange }: ChoiceChipsProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? "" : option.value)}
            className={cn(
              "alterra-focus min-h-10 rounded-full border px-4 text-sm font-medium transition-colors",
              selected
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700 active:bg-zinc-100",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
