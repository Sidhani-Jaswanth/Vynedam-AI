const logger = require("../config/logger");
const eventBus = require("./event-bus");

function registerAiEventHandlers() {
  eventBus.on("ai.generated", (payload) => {
    logger.info(
      {
        type: payload.type,
        latencyMs: payload.latencyMs,
        requestId: payload.requestId,
      },
      "AI response generated"
    );
  });

  eventBus.on("ai.failed", (payload) => {
    logger.error(
      {
        reason: payload.reason,
        requestId: payload.requestId,
      },
      "AI generation failed"
    );
  });
}

module.exports = { registerAiEventHandlers };
