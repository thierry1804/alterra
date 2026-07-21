import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { db } from "../db/db";
import { useAuth } from "../hooks/useAuth";
import {
  formatDisplayDate,
  getDaySession,
  saveDaySession,
  selectableDates,
  todayIsoDate,
} from "../lib/day-session";
import { syncReferentials } from "../sync/ReferentialSync";
import { syncBiometricTemplatesFromServer } from "../services/biometric/TemplateCache";

export default function ActivitySelect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const activities = useLiveQuery(() => db.activities.filter((a) => a.active).toArray(), []) ?? [];

  const [date, setDate] = useState(todayIsoDate());
  const [activityId, setActivityId] = useState("");
  const [defaultQuantity, setDefaultQuantity] = useState("1");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const dates = useMemo(() => selectableDates(), []);

  useEffect(() => {
    if (user?.role === "CHEF_SERVICE") {
      navigate("/validation", { replace: true });
    }
  }, [user?.role, navigate]);

  useEffect(() => {
    async function bootstrap() {
      const existing = await getDaySession();
      if (existing) {
        setDate(existing.date);
        setActivityId(existing.activityId);
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
          `${result.workers} MOC · ${result.activities} activités · ${bioCount} templates bio`,
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
    if (!activityId) {
      setError("Sélectionnez une activité.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantité par défaut invalide.");
      return;
    }

    await saveDaySession({
      activityId,
      date,
      defaultQuantity: quantity,
    });
    navigate("/batch");
  }

  if (loading) {
    return <p className="p-4 text-sm text-zinc-600">Chargement…</p>;
  }

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-zinc-900">Activité du jour</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Choisissez l&apos;activité et la date avant la saisie en lot.
        </p>
      </header>

      {syncMessage && (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          {syncing ? "Synchronisation référentiel…" : syncMessage}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="pointage-date" className="text-sm font-medium text-zinc-700">
          Date
        </label>
        <select
          id="pointage-date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
        >
          {dates.map((isoDate) => (
            <option key={isoDate} value={isoDate}>
              {formatDisplayDate(isoDate)}
            </option>
          ))}
        </select>
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
          <p className="text-sm text-zinc-500">Aucune activité en cache. Connectez-vous pour synchroniser.</p>
        )}
        <div className="space-y-2">
          {activities.map((activity) => (
            <button
              key={activity.id}
              type="button"
              onClick={() => setActivityId(activity.id)}
              className={`w-full rounded-md border p-3 text-left ${
                activityId === activity.id
                  ? "border-zinc-400 bg-zinc-100"
                  : "border-zinc-200 bg-white hover:bg-zinc-50"
              }`}
            >
              <p className="text-sm font-medium text-zinc-900">{activity.label}</p>
              <p className="text-xs text-zinc-500">
                {activity.unitRate.toLocaleString("fr-MG")} Ar / {activity.unit}
              </p>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="button"
        onClick={() => void handleContinue()}
        className="w-full rounded-md bg-zinc-900 py-2.5 text-sm font-medium text-white"
      >
        Continuer vers la saisie lot
      </button>
    </div>
  );
}
