import { useCallback, useEffect, useRef, useState } from "react";
import Button from "../ui/Button";
import type { BiometricCheckResult } from "../../lib/biometric";
import {
  bridgeIntentUrl,
  bridgeOutcomeMessage,
  createBridgeSession,
  isAndroidBrowser,
  waitForBridgeSession,
  type BridgeSession,
  type BridgeSessionView,
} from "../../lib/bio-bridge";

interface BridgeVerificationProps {
  workerId: string;
  referenceDate?: string;
  autoStart?: boolean;
  onResult: (result: BiometricCheckResult) => void;
}

type Phase = "idle" | "creating" | "waiting" | "done" | "error";

export default function BridgeVerification({
  workerId,
  referenceDate,
  autoStart = false,
  onResult,
}: BridgeVerificationProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<BridgeSession | null>(null);
  const [view, setView] = useState<BridgeSessionView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const autoStartedRef = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  const watch = useCallback(
    async (created: BridgeSession) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const finished = await waitForBridgeSession(created.id, {
        signal: controller.signal,
        onUpdate: setView,
      });
      if (!finished) return;
      setView(finished);
      setMessage(bridgeOutcomeMessage(finished.outcome, finished.status));
      setPhase("done");
      if (finished.bioResult) {
        onResult({
          id: finished.id,
          workerId,
          result: finished.bioResult,
          score: null,
          weekIso: null,
          performedAt: new Date().toISOString(),
        });
      }
    },
    [onResult, workerId],
  );

  useEffect(() => {
    if (phase !== "waiting" || !session) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void watch(session);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase, session, watch]);

  const start = useCallback(async () => {
    setPhase("creating");
    setMessage(null);
    setView(null);
    try {
      const created = await createBridgeSession(workerId, referenceDate);
      setSession(created);
      setPhase("waiting");
      window.location.href = bridgeIntentUrl(created.reference);
      void watch(created);
    } catch {
      setPhase("error");
      setMessage("Impossible de lancer la vérification. Vérifiez la connexion puis réessayez.");
    }
  }, [watch, workerId, referenceDate]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || !isAndroidBrowser()) return;
    autoStartedRef.current = true;
    void start();
  }, [autoStart, start]);

  function reopen() {
    if (session) window.location.href = bridgeIntentUrl(session.reference);
  }

  function cancel() {
    abortRef.current?.abort();
    setPhase("idle");
    setSession(null);
    setView(null);
    setMessage(null);
  }

  if (!isAndroidBrowser()) return null;

  return (
    <div className="w-full max-w-md space-y-3">
      {phase === "waiting" && (
        <div className="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-3 text-sm text-zinc-200">
          <p className="font-medium">Vérification en cours dans le moteur biométrique…</p>
          <p className="mt-1 text-xs opacity-80">
            Si rien ne s&apos;ouvre, vérifiez que le pont biométrique est installé.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={reopen}>
              Rouvrir
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={cancel}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {(phase === "done" || phase === "error") && message && (
        <p
          className={`rounded-md border px-4 py-3 text-sm ${
            view?.bioResult === "OK"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-100"
          }`}
        >
          {message}
        </p>
      )}

      {phase !== "waiting" && (
        <Button
          type="button"
          size="lg"
          className="w-full rounded-2xl bg-emerald-400 text-zinc-900 hover:bg-emerald-300"
          disabled={phase === "creating"}
          onClick={() => void start()}
        >
          {phase === "creating"
            ? "Préparation…"
            : phase === "done"
              ? "Revérifier avec le moteur biométrique"
              : "Vérifier avec le moteur biométrique"}
        </Button>
      )}
    </div>
  );
}
