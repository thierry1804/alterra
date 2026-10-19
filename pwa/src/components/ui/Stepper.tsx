import { cn } from "../../lib/cn";
import { IconCheck } from "../icons";

interface StepperProps {
  steps: string[];
  /** Index (0-based) de l'étape en cours. */
  current: number;
}

/** Indicateur d'étapes compact : cercles numérotés reliés par un pointillé. */
export default function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Étapes">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap",
                active ? "font-semibold text-zinc-900" : "text-zinc-500",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold",
                  done || active ? "bg-brand text-white" : "bg-zinc-200 text-zinc-600",
                )}
              >
                {done ? <IconCheck className="h-3 w-3" /> : index + 1}
              </span>
              {label}
            </span>
            {index < steps.length - 1 && (
              <span
                className="h-px flex-1 border-t border-dashed border-zinc-300"
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
