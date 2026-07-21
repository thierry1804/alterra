import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { INACTIVITY_LOCK_MS } from "../lib/session";

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "pointerdown",
  "keydown",
  "touchstart",
  "mousemove",
];

export default function InactivityGuard() {
  const { isAuthenticated, lock, touch } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function resetTimer() {
      touch();
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lock();
      }, INACTIVITY_LOCK_MS);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [isAuthenticated, lock, touch]);

  return null;
}
