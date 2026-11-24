import {
  Copy,
  ExternalLink,
  GitCompare,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import type { AccessRole } from "../../lib/access";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface RoleRowMenuProps {
  role: AccessRole;
  onOpenDetail: () => void;
  onDuplicate: () => void;
  onCompare: () => void;
  onShowUsers: () => void;
  onDelete: () => void;
}

/** Menu d'actions d'une ligne, visible au survol et au focus clavier de la ligne. */
export default function RoleRowMenu({
  role,
  onOpenDetail,
  onDuplicate,
  onCompare,
  onShowUsers,
  onDelete,
}: RoleRowMenuProps) {
  const deleteBlocked = role.isSystem
    ? "Rôle système : suppression impossible"
    : role.userCount > 0
      ? `Rôle attribué à ${role.userCount} utilisateur${role.userCount > 1 ? "s" : ""}`
      : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions du rôle ${role.name}`}
          onClick={(event) => event.stopPropagation()}
          className="alterra-focus inline-flex h-8 w-8 items-center justify-center rounded-md text-subtle opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-900 focus-visible:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem onSelect={onOpenDetail}>
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Ouvrir le détail
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy className="h-3.5 w-3.5" aria-hidden /> Dupliquer
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCompare}>
          <GitCompare className="h-3.5 w-3.5" aria-hidden /> Comparer avec…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onShowUsers} disabled={role.userCount === 0}>
          <Users className="h-3.5 w-3.5" aria-hidden /> Voir les utilisateurs
          <ExternalLink className="ml-auto h-3 w-3 text-subtle" aria-hidden />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive disabled={deleteBlocked !== null} onSelect={onDelete}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          <span className="flex flex-col">
            Supprimer
            {deleteBlocked && (
              <span className="text-[11px] font-normal text-subtle">{deleteBlocked}</span>
            )}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
