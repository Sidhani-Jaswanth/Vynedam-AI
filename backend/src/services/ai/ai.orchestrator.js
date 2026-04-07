const AppError = require("../../utils/app-error");
const logger = require("../../config/logger");
const { classifyPrompt } = require("./prompt.classifier");
const { formatAiResponse } = require("./response.formatter");
const { buildProjectPayload } = require("./project.extractor");
const { callPrimary } = require("./providers/primary.provider");
const { callFallback } = require("./providers/fallback.provider");
const eventBus = require("../../events/event-bus");
const aiRetryQueue = require("../../jobs/ai-retry.queue");
const cache = require("../common/cache.service");

async function withTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("AI provider timeout")), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function withRetry(fn, retries = 1) {
  let lastError;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

class AiOrchestrator {
  async generate({ prompt, messages, req }) {
    const startedAt = Date.now();
    const type = classifyPrompt(prompt, messages);
    const cacheKey = `ai:${type}:${Buffer.from(JSON.stringify({ prompt, messages })).toString("base64")}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let text;
    try {
      text = await withRetry(() => withTimeout(callPrimary(prompt, messages), 45000), 1);
    } catch (primaryError) {
      logger.warn({ err: primaryError.message }, "Primary AI provider failed, using fallback");
      aiRetryQueue.enqueue({ prompt, messages, reason: primaryError.message });
      try {
        text = await withRetry(() => withTimeout(callFallback(prompt, messages), 45000), 1);
      } catch (fallbackError) {
        eventBus.emit("ai.failed", {
          requestId: req?.requestId,
          reason: fallbackError.message,
        });
        throw new AppError(fallbackError.publicMessage || fallbackError.message || "AI generation failed", fallbackError.status || 502);
      }
    }

    const project = type === "project" ? buildProjectPayload(text, req) : null;
    const latencyMs = Date.now() - startedAt;

    logger.info({ latencyMs, type }, "AI generation completed");
    eventBus.emit("ai.generated", {
      requestId: req?.requestId,
      type,
      latencyMs,
    });
    const formatted = formatAiResponse({ text, type, project });
    cache.set(cacheKey, formatted, 30_000);
    return formatted;
  }
}

module.exports = new AiOrchestrator();
