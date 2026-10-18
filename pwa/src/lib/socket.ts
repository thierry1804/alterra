import { io, type Socket } from "socket.io-client";
import { getMemoryAccessToken } from "./session";
import type { AppNotification } from "./notifications";
import { emitNotificationsUpdated } from "./notifications";

export const SOCKET_NOTIFICATION_EVENT = "alterra:socket-notification";

let socket: Socket | null = null;

function dispatchSocketNotification(payload: AppNotification): void {
  window.dispatchEvent(new CustomEvent(SOCKET_NOTIFICATION_EVENT, { detail: payload }));
  emitNotificationsUpdated();

  if (
    payload.type === "CLARIFICATION_OPEN" ||
    payload.type === "CLARIFICATION_ANSWERED" ||
    payload.type === "CLARIFICATION_CLOSED"
  ) {
    window.dispatchEvent(new Event("alterra:clarifications-updated"));
  }
  if (payload.type === "POINTAGE_REJECTED" || payload.type === "POINTAGE_VALIDATED") {
    window.dispatchEvent(new Event("alterra:my-pointages-updated"));
  }
}

/** Connexion Socket.IO authentifiée (même origine / proxy Vite). */
export function connectSocket(): Socket | null {
  const token = getMemoryAccessToken();
  if (!token) return null;

  if (socket?.connected) return socket;

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io({
    path: "/socket.io",
    transports: ["websocket", "polling"],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: Infinity,
  });

  socket.on("notification", (payload: AppNotification) => {
    dispatchSocketNotification(payload);
  });

  socket.on("connect_error", () => {
    // Reconnexion automatique ; le polling REST reste le fallback.
  });

  return socket;
}

export function disconnectSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export function isSocketConnected(): boolean {
  return !!socket?.connected;
}

export function getSocket(): Socket | null {
  return socket;
}
