const { generateWithFallback } = require("../../../../services/ai.service");

async function callFallback(prompt, messages) {
  return generateWithFallback(prompt, messages);
}

module.exports = { callFallback };
