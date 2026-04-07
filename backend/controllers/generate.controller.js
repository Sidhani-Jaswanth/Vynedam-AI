const { generateWithFallback, generatePreviewFromResponse } = require("../services/ai.service");

function isProjectPrompt(text) {
  const value = String(text || "").toLowerCase();
  const explicitBuildIntent = /(build|create|make|generate|develop|code|give|show|design|provide)/.test(value);
  const projectTargets = /(project|website|web\s*page|page|web app|webapp|landing page|frontend|backend|api|react|next\.?js|full\s*stack|index\.html|html page|landing)/.test(value);
  const implicitProjectAsk = /(basic|simple|minimal|welcome|portfolio|homepage|home page).*(website|web\s*page|html\s*page|landing\s*page|page)/.test(value);
  return (explicitBuildIntent && projectTargets) || implicitProjectAsk || /(website|web\s*page|html\s*page|landing\s*page)/.test(value);
}

function looksLikeProjectOutput(text) {
  const value = String(text || "");
  return /(project\s*name|file\s*tree|run\s*steps|index\.html|```html|```css|```javascript|npm\s+install|npm\s+run\s+dev|yarn\s+dev)/i.test(value);
}

function isCasualPrompt(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return false;
  const simpleGreeting = /^(hi|hello|hey|yo|hola|sup|gm|good\s*morning|good\s*afternoon|good\s*evening)(\s+(there|bro|buddy|assistant|bot))?([!.?\s]+)?$/.test(value);
  const simpleSmallTalk = /^(how\s+are\s+you|what'?s\s+up|whats\s+up|are\s+you\s+there)([!.?\s]+)?$/.test(value);
  const simpleAck = /^(ok|okay|k|cool|nice|great|awesome|thanks|thank\s+you|thx|got\s*it)(\s+(bro|buddy|assistant|bot|man|mate))?([!.?\s]+)?$/.test(value);
  return simpleGreeting || simpleSmallTalk || simpleAck;
}

function isConversationalQuestion(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return false;
  return /^(why|how|what|when|where|who)\b/.test(value) || /(explain|describe|summari[sz]e|review|what\s+does\s+this|how\s+does\s+this)/.test(value);
}

function normalizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return [];
  return rawMessages
    .slice(-20)
    .map((m) => ({
      role: String(m?.role || "").toLowerCase(),
      content: String(m?.content || "").trim(),
    }))
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content);
}

function hasProjectContext(messages) {
  const text = messages.map((m) => m.content).join("\n").toLowerCase();
  return /(project\s*name|file\s*tree|run\s*steps|index\.html|```html|```css|```javascript|website|web\s*app)/.test(text);
}

async function generate(req, res) {
  try {
    const { prompt, messages } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt is required" });
    }

    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) return res.status(400).json({ error: "prompt cannot be empty" });
    if (cleanPrompt.length > 5000) {
      return res.status(400).json({ error: "prompt is too long" });
    }

    const normalizedMessages = normalizeMessages(messages);
    const casualPrompt = isCasualPrompt(cleanPrompt);
    const conversationalQuestion = isConversationalQuestion(cleanPrompt);
    const result = await generateWithFallback(cleanPrompt, normalizedMessages);
    const projectOutput = looksLikeProjectOutput(result);
    const projectPrompt = !casualPrompt && !conversationalQuestion && (projectOutput || isProjectPrompt(cleanPrompt) || hasProjectContext(normalizedMessages));

    // Preview/download artifacts are only valid for project-like responses and non-casual prompts.
    const preview = projectPrompt && projectOutput ? generatePreviewFromResponse(result, req) : null;

    return res.status(200).json({
      success: true,
      result,
      previewUrl: preview?.previewUrl || null,
      downloadUrl: preview?.downloadUrl || null,
    });
  } catch (error) {
    console.error("Generate error:", error.message);
    return res.status(error.status || 500).json({
      error: error.publicMessage || "Generation failed",
      requestId: req.requestId,
    });
  }
}

module.exports = { generate };