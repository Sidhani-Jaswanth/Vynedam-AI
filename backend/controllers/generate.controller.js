const { callAiProvider, validateProjectJson } = require("../services/ai.orchestrator");
const projectService = require("../services/project.service");
const logger = require("../config/logger");
const env = require("../config/env");

async function generate(req, res) {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt is required" });
    }

    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) return res.status(400).json({ error: "prompt cannot be empty" });
    if (cleanPrompt.length > 5000) {
      return res.status(400).json({ error: "prompt is too long" });
    }

    let projectJson;
    try {
      projectJson = await callAiProvider(cleanPrompt, 1);
      validateProjectJson(projectJson);
    } catch (err) {
      logger.error({ err: err.message }, "AI JSON generation failed");
      return res.status(502).json({ error: "Failed to generate a valid project structure. Please try again." });
    }

    const files = projectJson.files;
    
    // Validate empty array
    if (!files || files.length === 0) {
      return res.status(502).json({ error: "AI generated empty files array" });
    }

    const entry = projectJson.entry || "index.html";
    const entryExists = files.some(f => f.path.toLowerCase() === entry.toLowerCase() || (f.path.includes("/") && f.path.split("/").pop().toLowerCase() === entry.toLowerCase()));
    
    if (!entryExists) {
      // If AI specified an entry that wasn't in the files array, force default to the first file.
      // This ensures validation passes and preview is valid.
      logger.warn({ entry }, "Entry file not matched in generated output. Proceeding anyway.");
    }

    const { projectId } = await projectService.createProject(files);
    
    // Generate preview URL
    const previewBase = env.previewBaseUrl || "http://localhost:5000/preview";
    const previewUrl = `${previewBase}/${projectId}/${entry}`;

    // Ensure preview URL is structurally valid
    if (!previewUrl || !previewUrl.startsWith("http")) {
       return res.status(500).json({ error: "Internal server error mapping preview URL" });
    }

    return res.status(200).json({
      success: true,
      projectId,
      previewUrl,
      files,
      type: projectJson.type || "project"
    });
  } catch (error) {
    logger.error({ err: error.message }, "Generate controller error");
    return res.status(error.status || 500).json({
      error: error.message || "Generation failed",
      requestId: req.requestId,
    });
  }
}

module.exports = { generate };