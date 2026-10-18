import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { LoadingScreen } from "../components/ui/feedback";
import { IconChevronRight } from "../components/icons";
import ContextHelp, { GlossaryTerm } from "../components/ui/ContextHelp";
import { db } from "../db/db";
import { useAuth } from "../hooks/useAuth";
import { getDaySession, saveDaySession, todayIsoDate } from "../lib/day-session";
import { syncReferentials } from "../sync/ReferentialSync";
import { syncBiometricTemplatesFromServer } from "../services/biometric/TemplateCache";

export default function ActivitySelect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const activities = useLiveQuery(() => db.activities.filter((a) => a.active).toArray(), []) ?? [];
  const [search, setSearch] = useState("");
  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activities;
    return activities.filter((a) => a.label.toLowerCase().includes(query));
  }, [activities, search]);

  // Toujours la date du jour — pas de saisie rétroactive depuis cet écran.
  const date = todayIsoDate();
  const [subActivityId, setSubActivityId] = useState("");
  const [defaultQuantity, setDefaultQuantity] = useState("1");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === "CHEF_SERVICE") {
      navigate("/validation", { replace: true });
    }
  }, [user?.role, navigate]);

  useEffect(() => {
    async function bootstrap() {
      const existing = await getDaySession();
      if (existing) {
        setSubActivityId(existing.subActivityId);
        setDefaultQuantity(String(existing.defaultQuantity));
      }
      setLoading(false);
    }
    void bootstrap();
  }, []);

  useEffect(() => {
    async function refreshReferentials() {
      setSyncing(true);
      setSyncMessage(null);
      try {
        const result = await syncReferentials({
          siteId: user?.siteId,
          teamId: user?.teamId,
        });
        let bioCount = 0;
        try {
          bioCount = await syncBiometricTemplatesFromServer();
        } catch {
          bioCount = 0;
        }
        setSyncMessage(
          `${result.workers} travailleur(s) · ${result.activities} activités · ${bioCount} modèles bio`,
        );
      } catch {
        const cachedActivities = await db.activities.count();
        if (cachedActivities === 0) {
          setSyncMessage("Hors ligne — cache vide");
        } else {
          setSyncMessage(`${cachedActivities} activité(s) en cache local`);
        }
      } finally {
        setSyncing(false);
      }
    }

    void refreshReferentials();
  }, [user?.siteId, user?.teamId]);

  async function handleContinue() {
    setError(null);
    const quantity = Number(defaultQuantity);
    if (!subActivityId) {
      setError("Sélectionnez une activité.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantité par défaut invalide.");
      return;
    }

    await saveDaySession({
      subActivityId,
      date,
      defaultQuantity: quantity,
    });
    navigate("/batch");
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-4 p-4">
      <header>
        <p className="alterra-eyebrow">Étape 1 sur 2 · Préparation</p>
        <h1 className="mt-1 text-lg font-semibold text-zinc-900">Activité du jour</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Choisissez l&apos;activité du jour avant la saisie en lot.
        </p>
      </header>

      <ContextHelp id="activity-select" title="Activité du jour">
        <p>
          Choisissez l&apos;activité et la quantité par défaut avant d&apos;ouvrir la saisie en lot.
        </p>
        <GlossaryTerm term="MOC">
          Main-d&apos;œuvre communautaire — travailleur du programme.
        </GlossaryTerm>
      </ContextHelp>

      {syncMessage && (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          {syncing ? "Synchronisation référentiel…" : syncMessage}
        </p>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-700">Date</p>
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {new Date(`${date}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })}{" "}
          — aujourd&apos;hui
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="default-quantity" className="text-sm font-medium text-zinc-700">
          Quantité par défaut
        </label>
        <input
          id="default-quantity"
          type="number"
          min="0.01"
          step="0.01"
          value={defaultQuantity}
          onChange={(event) => setDefaultQuantity(event.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-700">Activité</p>
        {activities.length === 0 && (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <p>Aucune activité en cache. Connectez-vous pour synchroniser le référentiel.</p>
          </div>
        )}
        {activities.length > 0 && (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Chercher une activité…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-md border border-zinc-300 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        )}
        {activities.length > 0 && filteredActivities.length === 0 && (
          <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">
            Aucune activité ne correspond.
          </p>
        )}
        <div className="space-y-2">
          {filteredActivities.map((activity) => {
            const isSelected = subActivityId === activity.id;
            return (
              <button
                key={activity.id}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    void handleContinue();
                  } else {
                    setError(null);
                    setSubActivityId(activity.id);
                  }
                }}
                aria-pressed={isSelected}
                className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-brand bg-brand-tint ring-1 ring-brand"
                    : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                    isSelected ? "border-brand" : "border-zinc-300"
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && <span className="h-2 w-2 rounded-full bg-brand" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-zinc-900">
                    {activity.label}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    <span className="alterra-num">
                      {activity.unitRate.toLocaleString("fr-MG")}
                    </span>{" "}
                    Ar / {activity.unit}
                  </span>
                </span>
                {isSelected && (
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand">
                    Continuer
                    <IconChevronRight className="h-4 w-4 shrink-0" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
