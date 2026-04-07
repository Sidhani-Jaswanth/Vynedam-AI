const mongoose = require("mongoose");
const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");
const { startPreviewCleanupJob } = require("./jobs/preview-cleanup.job");
const { registerAiEventHandlers } = require("./events/ai.events");
const aiRetryQueue = require("./jobs/ai-retry.queue");

let server;
let shuttingDown = false;
let cleanupTimer;

async function start() {
  if (!env.jwtSecret) throw new Error("JWT_SECRET is missing");
  if (env.isProduction && !env.corsOrigin) throw new Error("CORS_ORIGIN is required in production");

  const hasAnyAiKey = Boolean(env.aiApiKey || env.fallbackAiKey);
  if (!env.aiApiUrl || !hasAnyAiKey) {
    if (!env.aiSandboxMode) {
      throw new Error("AI_API_URL and one of AI_API_KEY or FALLBACK_AI_KEY are required when AI_SANDBOX_MODE is false");
    }
  }

  if (env.requireAuthKey && !env.authKey && !env.authKeyUrl) {
    throw new Error("REQUIRE_AUTH_KEY is true but neither AUTH_KEY nor AUTH_KEY_URL is configured");
  }

  if (env.useDb) {
    if (!env.mongoUri) throw new Error("MONGO_URI missing");
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    logger.info("MongoDB connected");
  } else {
    logger.warn("MongoDB disabled (USE_DB=false)");
  }

  registerAiEventHandlers();
  setInterval(() => {
    aiRetryQueue.processQueue(async () => {
      // Placeholder worker for retry analytics queue.
    });
  }, 10_000).unref();

  cleanupTimer = startPreviewCleanupJob();

  server = await new Promise((resolve, reject) => {
    const instance = app.listen(env.port, () => {
      logger.info({ port: env.port }, "Server running");
      resolve(instance);
    });

    instance.once("error", (error) => reject(error));
  });

  return server;
}

async function shutdown(signal = "SIGTERM", exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Starting graceful shutdown");

  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  logger.info("Shutdown complete");
  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown("SIGINT", 0).catch((err) => {
  logger.error({ err: err.message }, "Graceful shutdown failed");
  process.exit(1);
}));

process.on("SIGTERM", () => shutdown("SIGTERM", 0).catch((err) => {
  logger.error({ err: err.message }, "Graceful shutdown failed");
  process.exit(1);
}));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
  shutdown("UNHANDLED_REJECTION", 1).catch((err) => {
    logger.error({ err: err.message }, "Shutdown failed after unhandled rejection");
    process.exit(1);
  });
});

process.on("uncaughtException", (error) => {
  logger.error({ err: error.message, stack: error.stack }, "Uncaught exception");
  shutdown("UNCAUGHT_EXCEPTION", 1).catch((err) => {
    logger.error({ err: err.message }, "Shutdown failed after uncaught exception");
    process.exit(1);
  });
});

if (require.main === module) {
  start().catch((e) => {
    logger.error({ err: e.message }, "Startup failed");
    process.exit(1);
  });
}

module.exports = { app, start, shutdown };
