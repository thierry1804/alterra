import { FormEvent, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { uuidv7 } from "../lib/uuid";
import { syncNow } from "../sync/SyncManager";

export default function Pointage() {
  const workers = useLiveQuery(() => db.workers.toArray(), []) ?? [];
  const activities = useLiveQuery(() => db.activities.filter((a) => a.active).toArray(), []) ?? [];
  const pendingCount = useLiveQuery(() => db.pointings_pending.count(), []) ?? 0;

  const [workerId, setWorkerId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [quantity, setQuantity] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const now = new Date();
    await db.pointings_pending.add({
      clientUuid: uuidv7(),
      workerId,
      activityId,
      quantity: Number(quantity),
      date: now.toISOString().slice(0, 10),
      createdByClientAt: now.toISOString(),
      status: "local",
    });
    setQuantity("");
    if (navigator.onLine) void syncNow();
  }

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Saisie pointage</h1>
        <span className="text-sm text-slate-500">{pendingCount} en attente de sync</span>
      </header>

      <form onSubmit={onSubmit} className="space-y-3">
        <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} required className="w-full rounded border p-2">
          <option value="">MOC…</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.firstName} {w.lastName}
            </option>
          ))}
        </select>

        <select value={activityId} onChange={(e) => setActivityId(e.target.value)} required className="w-full rounded border p-2">
          <option value="">Activité…</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label} ({a.unit})
            </option>
          ))}
        </select>

        <input
          type="number"
          step="0.01"
          placeholder="Quantité"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          className="w-full rounded border p-2"
        />

        <button type="submit" className="w-full rounded bg-slate-900 py-2 text-white">
          Enregistrer
        </button>
      </form>
    </div>
  );
}
