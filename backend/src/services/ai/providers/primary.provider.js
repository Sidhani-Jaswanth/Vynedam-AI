const env = require("../../../config/env");
const { generateWithFallback } = require("../../../../services/ai.service");

async function callPrimary(prompt, messages) {
  if (!env.aiApiKey) {
    throw new Error("Primary provider is not configured");
  }

  return generateWithFallback(prompt, messages);
}

module.exports = { callPrimary };
