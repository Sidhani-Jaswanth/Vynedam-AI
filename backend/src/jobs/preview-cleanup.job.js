const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const logger = require("../config/logger");

const PREVIEWS_DIR = path.join(process.cwd(), "generated-previews");

function cleanupExpiredPreviews() {
  if (!Number.isFinite(env.previewTtlHours) || env.previewTtlHours <= 0) return;
  if (!fs.existsSync(PREVIEWS_DIR)) return;

  const cutoffMs = Date.now() - env.previewTtlHours * 60 * 60 * 1000;
  const entries = fs.readdirSync(PREVIEWS_DIR, { withFileTypes: true });

  let removed = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(PREVIEWS_DIR, entry.name);
    try {
      const stats = fs.statSync(dirPath);
      if (stats.mtimeMs < cutoffMs) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        removed += 1;
      }
    } catch (error) {
      logger.warn({ err: error.message, dir: entry.name }, "Failed to clean preview directory");
    }
  }

  if (removed > 0) {
    logger.info({ removed }, "Expired preview directories cleaned");
  }
}

function startPreviewCleanupJob() {
  cleanupExpiredPreviews();

  if (!Number.isFinite(env.previewCleanupIntervalMinutes) || env.previewCleanupIntervalMinutes <= 0) {
    return null;
  }

  const interval = setInterval(cleanupExpiredPreviews, env.previewCleanupIntervalMinutes * 60 * 1000);
  interval.unref();
  return interval;
}

module.exports = {
  cleanupExpiredPreviews,
  startPreviewCleanupJob,
};
