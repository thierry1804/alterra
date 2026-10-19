import { cn } from "../../lib/cn";

interface SegmentedTabsProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** Commutateur segmenté à deux ou trois choix (ex. Nouvelle / Mes demandes). */
export default function SegmentedTabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedTabsProps<T>) {
  return (
    <div className="flex rounded-xl bg-zinc-100 p-1" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "alterra-focus min-h-10 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors",
            value === option.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
