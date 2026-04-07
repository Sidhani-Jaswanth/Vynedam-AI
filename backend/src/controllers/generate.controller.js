const asyncHandler = require("../utils/async-handler");
const { ok } = require("../utils/response");
const aiOrchestrator = require("../services/ai/ai.orchestrator");

const generate = asyncHandler(async (req, res) => {
  const result = await aiOrchestrator.generate({
    prompt: req.body.prompt,
    messages: req.body.messages || [],
    req,
  });

  return ok(
    res,
    {
      result: result.text,
      type: result.type,
      project: result.type === "project"
        ? {
            type: "project",
            title: result.title,
            files: result.files,
            previewUrl: result.previewUrl,
            downloadUrl: result.downloadUrl,
          }
        : null,
      previewUrl: result.previewUrl || null,
      downloadUrl: result.downloadUrl || null,
    },
    "Generation successful",
    200
  );
});

module.exports = { generate };
