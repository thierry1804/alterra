import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface PaymentFlowProps {
  periodIso: string;
  total: number;
  exportable: number;
  exported: number;
  blocked: number;
}

/** Le flux de paie en quatre étapes : période, bordereau, export MVola, retour. */
export default function PaymentFlow({
  periodIso,
  total,
  exportable,
  exported,
  blocked,
}: PaymentFlowProps) {
  // Étape en cours : 0 période, 1 bordereau, 2 export, 3 retour.
  const current = total === 0 ? 1 : exportable > 0 ? 2 : exported > 0 ? 3 : 2;

  const steps = [
    { label: "Période", hint: periodIso || "À choisir" },
    {
      label: "Bordereau",
      hint: total === 0 ? "Aucune ligne : à générer" : `${total} ligne(s)`,
    },
    {
      label: "Export MVola",
      hint:
        exportable > 0
          ? `${exportable} prête(s)${blocked > 0 ? ` · ${blocked} bloquée(s) bio` : ""}`
          : blocked > 0
            ? `${blocked} bloquée(s) bio`
            : "Après génération",
    },
    {
      label: "Retour MVola",
      hint: exported > 0 ? `${exported} exportée(s) : importer le retour` : "Après export",
    },
  ];

  return (
    <ol
      aria-label="Étapes du paiement"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 lg:grid-cols-4"
    >
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step.label}
            aria-current={active ? "step" : undefined}
            className={cn("bg-white px-4 py-3", active && "bg-brand-tint")}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold",
                  done || active ? "bg-brand text-white" : "bg-zinc-200 text-zinc-600",
                )}
              >
                {done ? <Check className="h-3 w-3" aria-hidden /> : index + 1}
              </span>
              {step.label}
            </p>
            <p className="mt-0.5 pl-7 text-xs text-muted">{step.hint}</p>
          </li>
        );
      })}
    </ol>
  );
}
