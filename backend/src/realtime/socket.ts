import type { Server as HttpServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Server, type Socket } from "socket.io";
import { verifyAccessToken } from "../lib/jwt.js";
import { logger } from "../lib/logger.js";
import { areTokensRevoked, isUserBlocked } from "../lib/redis.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const USE_IN_MEMORY = process.env.NODE_ENV === "test" || process.env.REDIS_IN_MEMORY === "true";

const ORIGINS = [process.env.ADMIN_ORIGIN, process.env.PWA_ORIGIN]
  .filter(Boolean)
  .flatMap((origin) => origin!.split(",").map((value) => value.trim()))
  .filter(Boolean) as string[];

let io: Server | null = null;

export function getIo(): Server | null {
  return io;
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

async function authenticateSocket(socket: Socket): Promise<string | null> {
  const raw =
    (typeof socket.handshake.auth?.token === "string" && socket.handshake.auth.token) ||
    (typeof socket.handshake.headers.authorization === "string" &&
      socket.handshake.headers.authorization.replace(/^Bearer\s+/i, ""));

  if (!raw) return null;

  try {
    const payload = verifyAccessToken(raw);
    if (await isUserBlocked(payload.sub)) return null;
    if (await areTokensRevoked(payload.sub, payload.iat)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/** Attache Socket.IO au serveur HTTP Express. Redis adapter si dispo (multi-instances). */
export async function initSocketIo(httpServer: HttpServer): Promise<Server> {
  io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: ORIGINS.length > 0 ? ORIGINS : true, credentials: true },
  });

  if (!USE_IN_MEMORY) {
    try {
      const pubClient = createClient({ url: REDIS_URL });
      const subClient = pubClient.duplicate();
      pubClient.on("error", (err) => logger.warn({ err }, "Socket.IO Redis pub error"));
      subClient.on("error", (err) => logger.warn({ err }, "Socket.IO Redis sub error"));
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info("Socket.IO: Redis adapter connected");
    } catch (err) {
      logger.warn({ err }, "Socket.IO: Redis adapter unavailable — single-node mode");
    }
  }

  io.use(async (socket, next) => {
    const userId = await authenticateSocket(socket);
    if (!userId) {
      next(new Error("UNAUTHENTICATED"));
      return;
    }
    socket.data.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    void socket.join(userRoom(userId));
    logger.debug({ userId, socketId: socket.id }, "Socket.IO connected");
  });

  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(userRoom(userId)).emit(event, payload);
}
