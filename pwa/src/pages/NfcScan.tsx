import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { cn } from "../lib/cn";
import { IconCheck, IconPresence } from "../components/icons";
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
  const [busy, setBusy] = useState(false);

  const teamWorkers: WorkerRecord[] =
    useLiveQuery(async () => {
      if (!user?.teamId) return [];
      return db.workers.where("teamId").equals(user.teamId).sortBy("lastName");
    }, [user?.teamId]) ?? [];

  const todayLogsResult = useLiveQuery(
    () => db.presenceLog.where("date").equals(new Date().toISOString().slice(0, 10)).toArray(),
    [],
  );

  const sortedLogs = useMemo(
    () => [...(todayLogsResult ?? [])].sort((a, b) => b.arrivalTime.localeCompare(a.arrivalTime)),
    [todayLogsResult],
  );

  const pendingSyncCount = useMemo(
    () => sortedLogs.filter((log) => !log.synced).length,
    [sortedLogs],
  );

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

  async function registerManual(workerId: string) {
    const worker = teamWorkers.find((row) => row.id === workerId);
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

  const presentIds = new Set(
    sortedLogs.filter((log) => log.status !== "unknown" && log.workerId).map((log) => log.workerId),
  );
  const presentCount = teamWorkers.filter((worker) => presentIds.has(worker.id)).length;
  const timeByWorker = new Map<string, string>();
  sortedLogs.forEach((log) => {
    if (log.workerId && !timeByWorker.has(log.workerId)) {
      timeByWorker.set(log.workerId, formatTime(log.arrivalTime));
    }
  });

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Présence"
        subtitle={
          <>
            <span className="alterra-num font-semibold text-zinc-900">{presentCount}</span> sur{" "}
            <span className="alterra-num">{teamWorkers.length}</span> présents ce matin
            {pendingSyncCount > 0 && (
              <>
                {" · "}
                <span className="alterra-num">{pendingSyncCount}</span> à envoyer
              </>
            )}
          </>
        }
      />

      <div className="flex rounded-xl bg-zinc-100 p-1" role="tablist" aria-label="Mode de pointage">
        {[
          { open: false, label: "Badge NFC" },
          { open: true, label: "Manuel" },
        ].map((tab) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={manualOpen === tab.open}
            onClick={() => setManualOpen(tab.open)}
            className={cn(
              "alterra-focus min-h-10 flex-1 rounded-lg text-sm font-semibold transition-colors",
              manualOpen === tab.open ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!manualOpen && (
        <div
          className={`rounded-2xl border-2 p-6 text-center transition-colors ${scanStateClass(scanState)}`}
        >
          <div
            className={cn(
              "mx-auto grid h-28 w-28 place-items-center rounded-full border-2 border-brand/30 bg-brand-tint text-brand",
              scanState === "scanning" && "animate-pulse",
            )}
          >
            <IconPresence className="h-12 w-12" />
          </div>
          <p className="mt-3 text-base font-semibold text-zinc-900">
            {scanState === "scanning"
              ? "Approchez le badge du téléphone"
              : scanState === "success"
                ? "Présence enregistrée"
                : scanState === "unknown"
                  ? "Badge inconnu"
                  : scanState === "duplicate"
                    ? "Déjà scanné"
                    : "Lecteur NFC"}
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            {busy
              ? "Traitement…"
              : (statusMessage ??
                (nfcAvailable
                  ? "Le scan reprend automatiquement après chaque badge."
                  : "NFC indisponible sur cet appareil : passez en mode Manuel."))}
          </p>
          {(lastScanLabel || lastScanTime) && (
            <p className="mt-2 text-xs text-zinc-600">
              Dernier scan : {lastScanLabel ?? "—"}
              {lastScanTime ? ` · ${lastScanTime}` : ""}
            </p>
          )}
        </div>
      )}

      {manualOpen && statusMessage && (
        <p
          className={cn(
            "rounded-xl px-3 py-2 text-sm",
            scanState === "success"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-900",
          )}
        >
          {statusMessage}
        </p>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Équipe{manualOpen ? " · touchez pour marquer présent" : ""}
        </h2>
        {teamWorkers.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucun travailleur dans cette équipe.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {teamWorkers.map((worker) => {
              const present = presentIds.has(worker.id);
              return (
                <li key={worker.id}>
                  <button
                    type="button"
                    disabled={!manualOpen || present || busy}
                    onClick={() => void registerManual(worker.id)}
                    className="alterra-focus flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default"
                  >
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2",
                        present ? "border-brand bg-brand text-white" : "border-zinc-300",
                      )}
                      aria-hidden="true"
                    >
                      {present && <IconCheck className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-900">
                        {workerLabel(worker)}
                      </span>
                      <span className="alterra-num block text-xs text-zinc-500">
                        {worker.matricule}
                      </span>
                    </span>
                    {present ? (
                      <span className="alterra-num text-xs font-semibold text-brand">
                        {timeByWorker.get(worker.id)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[0.6875rem] font-bold text-amber-900">
                        ATTENDU
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {sortedLogs.some((log) => log.status === "unknown") && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Badges inconnus
          </h2>
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-red-200 bg-red-50/50">
            {sortedLogs
              .filter((log) => log.status === "unknown")
              .slice(0, 10)
              .map((log) => (
                <li
                  key={log.clientUuid}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-red-800"
                >
                  <span>{log.workerLabel}</span>
                  <span className="alterra-num text-xs">{formatTime(log.arrivalTime)}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
