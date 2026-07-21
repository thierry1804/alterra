import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { db, type WorkerRecord } from "../db/db";
import {
  getNfcAvailability,
  NfcReaderSession,
  playPresenceFeedback,
  type NfcTagRead,
} from "../lib/nfc";
import {
  hasPresenceToday,
  logPresenceEntry,
  lookupWorkerByNfcTag,
  workerLabel,
} from "../lib/presence-log";

type ScanUiState = "idle" | "scanning" | "success" | "unknown" | "error" | "duplicate";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function scanStateClass(state: ScanUiState): string {
  switch (state) {
    case "success":
      return "border-emerald-600 bg-emerald-50";
    case "unknown":
    case "error":
      return "border-red-300 bg-red-50";
    case "duplicate":
      return "border-amber-300 bg-amber-50";
    default:
      return "border-zinc-300 bg-white";
  }
}

export default function NfcScan() {
  const { user } = useAuth();
  const sessionRef = useRef<NfcReaderSession | null>(null);
  const nfcAvailable = getNfcAvailability() === "supported";

  const [scanState, setScanState] = useState<ScanUiState>(nfcAvailable ? "scanning" : "idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(
    nfcAvailable ? null : "Web NFC indisponible sur cet appareil.",
  );
  const [lastScanLabel, setLastScanLabel] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(!nfcAvailable);
  const [manualWorkerId, setManualWorkerId] = useState("");
  const [busy, setBusy] = useState(false);

  const teamWorkers: WorkerRecord[] =
    useLiveQuery(async () => {
      if (!user?.teamId) return [];
      return db.workers.where("teamId").equals(user.teamId).sortBy("lastName");
    }, [user?.teamId]) ?? [];

  const todayLogs =
    useLiveQuery(() => db.presenceLog.where("date").equals(new Date().toISOString().slice(0, 10)).toArray(), []) ??
    [];

  const sortedLogs = useMemo(
    () => [...todayLogs].sort((a, b) => b.arrivalTime.localeCompare(a.arrivalTime)),
    [todayLogs],
  );

  const pendingSyncCount = useMemo(() => sortedLogs.filter((log) => !log.synced).length, [sortedLogs]);

  const resetScanVisual = useCallback(() => {
    window.setTimeout(() => {
      setScanState(nfcAvailable ? "scanning" : "idle");
      setStatusMessage(nfcAvailable ? null : "Web NFC indisponible sur cet appareil.");
    }, 2200);
  }, [nfcAvailable]);

  const handleTagRead = useCallback(
    async (tag: NfcTagRead) => {
      setBusy(true);
      try {
        const worker = await lookupWorkerByNfcTag(tag.tagId);
        if (!worker) {
          await logPresenceEntry({
            nfcTagId: tag.tagId,
            workerId: null,
            workerLabel: `Badge ${tag.tagId.slice(0, 8)}…`,
            source: "NFC",
            status: "unknown",
          });
          setScanState("unknown");
          setStatusMessage("Badge non enregistré — présence loguée localement.");
          setLastScanLabel(`Badge ${tag.tagId.slice(0, 12)}…`);
          setLastScanTime(formatTime(new Date().toISOString()));
          playPresenceFeedback("unknown");
          resetScanVisual();
          return;
        }

        if (await hasPresenceToday(worker.workerId)) {
          setScanState("duplicate");
          setStatusMessage(`${worker.label} est déjà enregistré(e) ce matin.`);
          setLastScanLabel(worker.label);
          setLastScanTime(formatTime(new Date().toISOString()));
          playPresenceFeedback("error");
          resetScanVisual();
          return;
        }

        const entry = await logPresenceEntry({
          nfcTagId: tag.tagId,
          workerId: worker.workerId,
          workerLabel: worker.label,
          source: "NFC",
          status: "ok",
        });

        setScanState("success");
        setStatusMessage(`${worker.label} enregistré(e).`);
        setLastScanLabel(worker.label);
        setLastScanTime(formatTime(entry.arrivalTime));
        playPresenceFeedback("success");
        resetScanVisual();
      } catch {
        setScanState("error");
        setStatusMessage("Erreur lors de l'enregistrement.");
        playPresenceFeedback("error");
        resetScanVisual();
      } finally {
        setBusy(false);
      }
    },
    [resetScanVisual],
  );

  useEffect(() => {
    if (!nfcAvailable) return;

    const session = new NfcReaderSession();
    sessionRef.current = session;

    void session.start({
      onRead: (tag) => {
        void handleTagRead(tag);
      },
      onError: (error) => {
        if (error.message === "NFC_PERMISSION_DENIED") {
          setScanState("error");
          setStatusMessage("Autorisez l'accès NFC dans les paramètres du navigateur.");
          session.stop();
          return;
        }
        if (session.active) {
          setScanState("scanning");
        }
      },
    });

    return () => {
      session.stop();
      sessionRef.current = null;
    };
  }, [nfcAvailable, handleTagRead]);

  async function handleManualSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!manualWorkerId) return;

    const worker = teamWorkers.find((row) => row.id === manualWorkerId);
    if (!worker) return;

    setBusy(true);
    setStatusMessage(null);
    try {
      if (await hasPresenceToday(worker.id)) {
        setScanState("duplicate");
        setStatusMessage(`${workerLabel(worker)} est déjà enregistré(e) ce matin.`);
        playPresenceFeedback("error");
        resetScanVisual();
        return;
      }

      const entry = await logPresenceEntry({
        nfcTagId: "MANUAL",
        workerId: worker.id,
        workerLabel: workerLabel(worker),
        source: "MANUAL",
        status: "ok",
      });

      setScanState("success");
      setStatusMessage(`${workerLabel(worker)} enregistré(e) (mode manuel).`);
      setLastScanLabel(workerLabel(worker));
      setLastScanTime(formatTime(entry.arrivalTime));
      setManualWorkerId("");
      playPresenceFeedback("success");
      resetScanVisual();
    } catch {
      setScanState("error");
      setStatusMessage("Enregistrement manuel échoué.");
      playPresenceFeedback("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Présence · Matin</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Scannez les badges NFC de votre équipe à l'arrivée sur site.
          </p>
        </div>
        <p className="text-xs text-zinc-500">Sync {pendingSyncCount}</p>
      </header>

      <div
        className={`rounded-md border-2 p-6 text-center transition-colors ${scanStateClass(scanState)} ${
          scanState === "scanning" ? "animate-pulse" : ""
        }`}
      >
        <p className="text-sm font-medium text-zinc-900">
          {scanState === "scanning"
            ? "Approchez le badge NFC"
            : scanState === "success"
              ? "Présence enregistrée"
              : scanState === "unknown"
                ? "Badge inconnu"
                : scanState === "duplicate"
                  ? "Déjà scanné"
                  : "Lecteur NFC"}
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          {busy
            ? "Traitement…"
            : statusMessage ??
              (nfcAvailable
                ? "Le scan reprend automatiquement après chaque badge."
                : "Utilisez le mode manuel ci-dessous.")}
        </p>
      </div>

      {(lastScanLabel || lastScanTime) && (
        <p className="text-sm text-zinc-700">
          Dernier scan : {lastScanLabel ?? "—"}
          {lastScanTime ? ` · ${lastScanTime}` : ""}
        </p>
      )}

      <section className="rounded-md border border-zinc-200 bg-white p-4">
        <button
          type="button"
          onClick={() => setManualOpen((open) => !open)}
          className="text-sm font-medium text-zinc-900 underline"
        >
          {manualOpen ? "Masquer le mode manuel" : "Mode manuel — dégradé"}
        </button>

        {manualOpen && (
          <form onSubmit={(event) => void handleManualSubmit(event)} className="mt-3 space-y-3">
            <p className="text-xs text-zinc-600">
              Si le NFC est indisponible ou le badge non programmé, enregistrez la présence manuellement.
            </p>
            <select
              value={manualWorkerId}
              onChange={(event) => setManualWorkerId(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Sélectionner un MOC</option>
              {teamWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {workerLabel(worker)} ({worker.matricule})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy || !manualWorkerId}
              className="w-full rounded-md bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Enregistrer présence manuelle
            </button>
          </form>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-900">Journal du jour</h2>
        {sortedLogs.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Aucune présence enregistrée aujourd'hui.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
            {sortedLogs.slice(0, 20).map((log) => (
              <li key={log.clientUuid} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className={log.status === "unknown" ? "text-red-700" : "text-zinc-800"}>
                  {log.workerLabel}
                  {log.status === "unknown" ? " · badge inconnu" : ""}
                  {log.source === "MANUAL" ? " · manuel" : ""}
                </span>
                <span className="text-xs text-zinc-500">{formatTime(log.arrivalTime)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
