import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "../../lib/utils";

interface InlineTextProps {
  value: string;
  /** Nom accessible du champ (ex. « Nom du rôle Finance »). */
  label: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  /** Texte vide accepté (description) ou refusé (nom). */
  allowEmpty?: boolean;
  minLength?: number;
  maxLength?: number;
  className?: string;
  displayClassName?: string;
}

/** Texte modifiable au clic : Entrée valide, Échap annule, la perte de focus valide. */
export default function InlineText({
  value,
  label,
  onCommit,
  placeholder = "Ajouter…",
  allowEmpty = false,
  minLength = 0,
  maxLength,
  className,
  displayClassName,
}: InlineTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Évite le double commit (Entrée puis blur déclenché par le démontage de l'input).
  const done = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function start() {
    done.current = false;
    setDraft(value);
    setEditing(true);
  }

  function cancel() {
    done.current = true;
    setEditing(false);
  }

  function commit() {
    if (done.current) return;
    done.current = true;
    const next = draft.trim();
    setEditing(false);
    if (next === value.trim()) return;
    if (next.length === 0 && !allowEmpty) return;
    if (next.length > 0 && next.length < minLength) return;
    onCommit(next);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label={label}
        value={draft}
        maxLength={maxLength}
        onChange={(event) => setDraft(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") commit();
          if (event.key === "Escape") cancel();
        }}
        onBlur={commit}
        className={cn(
          "h-8 w-full min-w-40 rounded-md border border-brand bg-white px-2 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={`${label} : ${value || "vide"}. Modifier`}
      onClick={(event) => {
        event.stopPropagation();
        start();
      }}
      className={cn(
        "alterra-focus group/inline inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md px-1.5 text-left hover:bg-zinc-100",
        displayClassName,
      )}
    >
      <span className={cn("truncate", !value && "text-subtle italic")}>{value || placeholder}</span>
      <Pencil
        className="h-3 w-3 shrink-0 text-subtle opacity-0 group-hover/inline:opacity-100 group-focus-visible/inline:opacity-100"
        aria-hidden
      />
    </button>
  );
}
