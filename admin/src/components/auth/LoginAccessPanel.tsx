import { Button } from "../ui/button";
import type { AppAccessLink, DemoAccount } from "../../lib/access-info";

interface LoginAccessPanelProps {
  roles: string[];
  otherApp: AppAccessLink;
  demoAccounts?: DemoAccount[];
  onSelectDemo?: (email: string, password: string) => void;
}

export default function LoginAccessPanel({
  roles,
  otherApp,
  demoAccounts,
  onSelectDemo,
}: LoginAccessPanelProps) {
  const showDemo = import.meta.env.DEV && demoAccounts && demoAccounts.length > 0;

  return (
    <aside className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-sm font-medium text-zinc-900">Accès à cette interface</h2>
        <ul className="mt-2 space-y-1 text-sm text-zinc-600">
          {roles.map((role) => (
            <li key={role}>{role}</li>
          ))}
        </ul>
      </div>

      <div className="border-t border-zinc-200 pt-4">
        <h2 className="text-sm font-medium text-zinc-900">Autre application</h2>
        <p className="mt-1 text-sm text-zinc-600">{otherApp.description}</p>
        <a
          href={otherApp.href}
          className="mt-2 inline-block text-sm font-medium text-zinc-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          {otherApp.label} →
        </a>
      </div>

      {showDemo && (
        <div className="border-t border-zinc-200 pt-4">
          <h2 className="text-sm font-medium text-zinc-900">Comptes de démonstration</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Environnement local uniquement — cliquez pour pré-remplir le formulaire.
          </p>
          <ul className="mt-3 space-y-2">
            {demoAccounts.map((account) => (
              <li
                key={account.email}
                className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-zinc-900">{account.role}</p>
                  <p className="truncate text-zinc-600">{account.email}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onSelectDemo?.(account.email, account.password)}
                >
                  Utiliser
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
