import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

export default function Dashboard() {
  const { user, signOut } = useAuth();

  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get("/sites").then((r) => r.data.data),
  });

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Bonjour {user?.firstName} — {user?.role}
        </h1>
        <button onClick={signOut} className="text-sm text-slate-500 underline">
          Déconnexion
        </button>
      </header>
      <section>
        <h2 className="mb-2 text-lg font-medium">Sites</h2>
        <ul className="space-y-1">
          {sites?.map((site: { id: string; name: string; shortCode: string }) => (
            <li key={site.id} className="rounded border px-3 py-2">
              {site.name} ({site.shortCode})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
