import "dotenv/config";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { ensureBuckets } from "./services/storage/minio.js";

const PORT = Number(process.env.PORT ?? 3001);

async function main() {
  await prisma.$connect();
  await ensureBuckets().catch((err) => logger.warn({ err }, "MinIO bucket bootstrap skipped"));

  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV }, "ALTERRA API listening");
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down gracefully");
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
