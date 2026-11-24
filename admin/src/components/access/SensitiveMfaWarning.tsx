import { ShieldAlert } from "lucide-react";
import type { AccessRole, PermissionResource } from "../../lib/access";
import { lacksMfaOnSensitive, sensitiveLabels } from "../../lib/access-sensitive";
import { Hint } from "../ui/tooltip";

interface SensitiveMfaWarningProps {
  role: Pick<AccessRole, "name" | "permissions" | "mfaRequired">;
  resources: PermissionResource[];
}

/** Petite alerte discrète : un rôle qui valide, paie ou exporte sans exiger la double authentification. */
export default function SensitiveMfaWarning({ role, resources }: SensitiveMfaWarningProps) {
  if (!lacksMfaOnSensitive(role)) return null;
  const labels = sensitiveLabels(role, resources);
  return (
    <Hint
      side="top"
      label={
        <span className="block max-w-xs">
          <span className="block font-semibold">MFA recommandée</span>
          <span className="block opacity-90">
            Ce rôle peut : {labels.join(", ").toLowerCase()}.
          </span>
        </span>
      }
    >
      <button
        type="button"
        onClick={(event) => event.stopPropagation()}
        aria-label={`Alerte : le rôle ${role.name} a des droits sensibles sans MFA (${labels.join(", ")})`}
        className="alterra-focus inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-warning hover:bg-warning-bg"
      >
        <ShieldAlert className="h-4 w-4" aria-hidden />
      </button>
    </Hint>
  );
}
