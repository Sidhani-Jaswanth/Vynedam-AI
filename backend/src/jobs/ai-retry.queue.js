const logger = require("../config/logger");

const queue = [];
let processing = false;

async function processQueue(worker) {
  if (processing) return;
  processing = true;

  while (queue.length) {
    const job = queue.shift();
    try {
      await worker(job.payload);
      logger.info({ id: job.id }, "AI retry job completed");
    } catch (error) {
      logger.error({ id: job.id, err: error.message }, "AI retry job failed");
    }
  }

  processing = false;
}

function enqueue(payload) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  queue.push({ id, payload });
  return id;
}

module.exports = {
  enqueue,
  processQueue,
};
