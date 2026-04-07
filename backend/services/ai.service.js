const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PREVIEWS_DIR = path.join(__dirname, "..", "generated-previews");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry(url, payload, config, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await axios.post(url, payload, config);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(400 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

function isSandboxMode() {
  return String(process.env.AI_SANDBOX_MODE || "false").toLowerCase() === "true";
}

function isProjectIntent(prompt) {
  const text = String(prompt || "").toLowerCase();
  const markers = [
    "build",
    "create",
    "project",
    "website",
    "web page",
    "html page",
    "landing page",
    "web app",
    "full stack",
    "frontend",
    "backend",
    "react",
    "node",
    "next.js",
    "api",
    "database",
  ];

  return markers.some((m) => text.includes(m));
}

function isStandalonePageRequest(prompt) {
  const value = String(prompt || "").trim().toLowerCase();
  if (!value) return false;
  if (/^(why|how|what|when|where|who)\b/.test(value)) return false;
  return /(basic|simple|minimal|welcome|portfolio|homepage|home)\s+(html\s+)?page\b/.test(value)
    || /^(html\s+page|web\s+page|landing\s+page)\b/.test(value);
}

function isProjectEditInstruction(prompt) {
  const value = String(prompt || "").toLowerCase();
  return /(change|update|modify|edit|fix|improve|refactor|add|remove|replace|use|set|make|apply|convert|restyle|redesign|dark\s*mode|light\s*mode|color|layout|section|button|header|footer|font|spacing)/.test(value);
}

function isConversationalQuestion(prompt) {
  const value = String(prompt || "").toLowerCase();
  return /^(why|how|what|when|where|who)\b/.test(value) || /(explain|describe|summari[sz]e|review|what\s+does\s+this|how\s+does\s+this)/.test(value);
}

function isCasualPrompt(prompt) {
  const value = String(prompt || "").trim().toLowerCase();
  if (!value) return false;
  const simpleGreeting = /^(hi|hello|hey|yo|hola|sup|gm|good\s*morning|good\s*afternoon|good\s*evening)(\s+(there|bro|buddy|assistant|bot))?([!.?\s]+)?$/.test(value);
  const simpleSmallTalk = /^(how\s+are\s+you|what'?s\s+up|whats\s+up|are\s+you\s+there)([!.?\s]+)?$/.test(value);
  const simpleAck = /^(ok|okay|k|cool|nice|great|awesome|thanks|thank\s+you|thx|got\s*it)(\s+(bro|buddy|assistant|bot|man|mate))?([!.?\s]+)?$/.test(value);
  return simpleGreeting || simpleSmallTalk || simpleAck;
}

function buildSystemPrompt(projectIntent) {
  if (projectIntent) {
    return [
      "You are an expert software architect and coding assistant.",
      "Your job is to convert user prompts into runnable projects.",
      "Return markdown with this exact structure and order:",
      "1) Project Name",
      "2) Stack",
      "3) File Tree",
      "4) Files (every file must have a heading with relative path and a fenced code block)",
      "5) Run Steps",
      "Rules:",
      "- Include complete code, not pseudo code.",
      "- Prefer minimal but runnable project scope.",
      "- Always include at least one previewable static entry: index.html with any required style.css/script.js.",
      "- If the requested stack is React/Next/full-stack, still include a small static preview build in index.html for live preview plus full project files.",
      "- Keep explanations short and practical.",
      "- Do not output escaped newlines or HTML entities.",
      "- Use forward slashes in file paths.",
    ].join(" ");
  }

  return [
    "You are a helpful software assistant.",
    "Respond clearly and concisely.",
    "For coding requests, use markdown and include code blocks when needed.",
    "Avoid escaped sequences and noisy JSON output.",
  ].join(" ");
}

function buildExplainerPrompt() {
  return [
    "You are a senior software mentor.",
    "Answer in plain conversational language.",
    "Do not return project templates, file trees, run steps, or full code scaffolding unless explicitly asked.",
    "For explanation questions, prioritize clarity over verbosity.",
    "Use short paragraphs or bullets and avoid code fences unless user explicitly requests code.",
  ].join(" ");
}

function summarizeProjectForQuestion(projectText, questionPrompt) {
  const text = String(projectText || "");
  const q = String(questionPrompt || "").trim();
  const lower = text.toLowerCase();

  const projectNameMatch = text.match(/project\s*name\s*[\r\n]+[#\-*\s]*([^\r\n]+)/i);
  const stackMatch = text.match(/stack\s*[\r\n]+([\s\S]*?)(?:\r?\n\s*##\s|\r?\n\s*file\s*tree)/i);
  const projectName = projectNameMatch?.[1]?.trim() || "your webpage";
  const stackRaw = stackMatch?.[1] || "";
  const stack = stackRaw
    .replace(/[`*#-]/g, " ")
    .split(/\r?\n|,/) 
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");

  const hasHero = /hero/.test(lower);
  const hasNav = /<nav|navigation|menu/.test(lower);
  const hasButton = /<button|button/.test(lower);
  const hasJs = /<script|function\s+\w+\(|javascript/.test(lower);

  const features = [];
  if (hasHero) features.push("a hero section for the main headline");
  if (hasNav) features.push("navigation links to move between sections");
  if (hasButton) features.push("interactive buttons for user actions");
  if (hasJs) features.push("small JavaScript behavior for interactivity");

  const featureLine = features.length
    ? `It includes ${features.join(", ")}.`
    : "It includes standard page structure, styling, and optional interactivity.";

  const stackLine = stack ? `The stack used is ${stack}.` : "It is built with common web technologies.";

  return [
    `This project (${projectName}) is a basic webpage template intended as a starting point.`,
    stackLine,
    featureLine,
    q ? `For your question "${q}": it mainly serves as a simple, editable foundation you can customize section by section.` : "You can now customize text, colors, and layout to match your needs.",
  ].join(" ");
}

function looksLikeStructuredProject(text) {
  const value = String(text || "");
  const hasFileTree = /file\s*tree/i.test(value);
  const hasCodeBlocks = /```[\w.+-]*\n[\s\S]*?```/.test(value);
  const hasRunSteps = /run\s*steps|how\s*to\s*run|installation/i.test(value);
  return hasFileTree && hasCodeBlocks && hasRunSteps;
}

function looksLikePromptParrot(text, prompt) {
  const output = String(text || "").trim();
  const userPrompt = String(prompt || "").trim();
  if (!output || !userPrompt) return false;

  const normalizedOutput = output.toLowerCase();
  const normalizedPrompt = userPrompt.toLowerCase();

  // Common proxy/model artifact: prompt echoed inside simple HTML tags.
  if (/^<font[^>]*>[\s\S]*<\/font>$/i.test(output)) {
    return true;
  }

  const noCode = !/```[\s\S]*?```/.test(output);
  const noProjectMarkers = !/(project\s*name|file\s*tree|run\s*steps|index\.html)/i.test(output);
  const containsPrompt = normalizedOutput.includes(normalizedPrompt);
  const tooShort = output.length <= Math.max(220, userPrompt.length + 120);

  return containsPrompt && tooShort && noCode && noProjectMarkers;
}

function enforceProjectSections(text) {
  let output = String(text || "").trim();
  if (!output) return output;

  // Ensure Project Name label is always present.
  if (!/project\s*name/i.test(output)) {
    const firstLine = output.split("\n").find((line) => line.trim()) || "Generated Project";
    const cleanTitle = firstLine.replace(/^#+\s*/, "").replace(/=+\s*$/, "").trim();
    output = `## Project Name\n${cleanTitle}\n\n${output}`;
  }

  // Normalize common headings to stable labels.
  output = output
    .replace(/^#{1,6}\s*stack\s*$/gim, "## Stack")
    .replace(/^#{1,6}\s*file\s*tree\s*$/gim, "## File Tree")
    .replace(/^#{1,6}\s*files\s*$/gim, "## Files")
    .replace(/^#{1,6}\s*(run\s*steps|how\s*to\s*run|installation)\s*$/gim, "## Run Steps");

  return output;
}

function sanitizeRelativeFile(filePath) {
  const normalized = String(filePath || "").replace(/\\/g, "/").trim();
  if (!normalized) return null;
  if (normalized.startsWith("/") || normalized.includes("..")) return null;
  if (!/^[A-Za-z0-9_./-]+$/.test(normalized)) return null;
  return normalized;
}

function extractProjectFilesFromText(text) {
  const files = new Map();
  const content = String(text || "");
  const blockRegex = /```([\w.+-]*)\r?\n([\s\S]*?)```/g;
  let match;

  while ((match = blockRegex.exec(content)) !== null) {
    const lang = String(match[1] || "").toLowerCase();
    const code = String(match[2] || "").trimEnd();
    if (!code) continue;

    const prefix = content.slice(Math.max(0, match.index - 260), match.index);
    const pathMatches = [...prefix.matchAll(/([A-Za-z0-9_./-]+\.[A-Za-z0-9_-]+)/g)];
    let relPath = null;
    if (pathMatches.length > 0) {
      relPath = sanitizeRelativeFile(pathMatches[pathMatches.length - 1][1]);
    }

    if (!relPath) {
      if (lang === "html") relPath = "index.html";
      if (lang === "css") relPath = "style.css";
      if (lang === "javascript" || lang === "js") relPath = "script.js";
      if (lang === "typescript" || lang === "ts") relPath = "index.ts";
      if (lang === "tsx") relPath = "index.tsx";
      if (lang === "jsx") relPath = "index.jsx";
      if (lang === "json") relPath = "data.json";
      if (lang === "md" || lang === "markdown") relPath = "README.md";
    }

    if (!relPath) continue;

    if (!files.has(relPath)) {
      files.set(relPath, code);
    }
  }

  return files;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildFallbackPreviewIndex(files) {
  const listItems = [...files.keys()]
    .map((file) => `<li><code>${escapeHtml(file)}</code></li>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Generated Project Preview</title>
  <style>
    body { font-family: Arial, sans-serif; background:#0f172a; color:#e2e8f0; margin:0; padding:24px; }
    .card { max-width:900px; margin:0 auto; background:#111827; border:1px solid #334155; border-radius:12px; padding:20px; }
    h1 { margin-top:0; font-size:24px; }
    p { color:#cbd5e1; }
    ul { margin:12px 0 0; padding-left:20px; }
    li { margin:6px 0; }
    code { background:#1f2937; padding:2px 6px; border-radius:6px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Project Generated</h1>
    <p>A direct browser preview entry was not provided by the model, but the project files are ready.</p>
    <p>Use <strong>Download ZIP</strong> to get all files, then run locally using the provided Run Steps.</p>
    <h2>Included Files</h2>
    <ul>${listItems}</ul>
  </div>
</body>
</html>`;
}

function ensurePreviewDir() {
  if (!fs.existsSync(PREVIEWS_DIR)) {
    fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
  }
}

function buildBaseUrl(req) {
  if (!req) return "";
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = forwardedProto ? String(forwardedProto).split(",")[0] : req.protocol;
  return `${proto}://${req.get("host")}`;
}

function generatePreviewFromResponse(aiText, req) {
  const files = extractProjectFilesFromText(aiText);
  if (!files.size) return null;

  ensurePreviewDir();
  const previewId = crypto.randomUUID();
  const previewRoot = path.join(PREVIEWS_DIR, previewId);
  fs.mkdirSync(previewRoot, { recursive: true });

  for (const [relPath, fileContent] of files.entries()) {
    const safeRelPath = sanitizeRelativeFile(relPath);
    if (!safeRelPath) continue;
    const outPath = path.join(previewRoot, safeRelPath);
    const outDir = path.dirname(outPath);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, fileContent, "utf8");
  }

  const htmlEntries = [...files.keys()].filter((file) => file.toLowerCase().endsWith(".html"));
  const rootIndex = htmlEntries.find((file) => file.toLowerCase() === "index.html") || null;
  const chosenHtml = rootIndex || htmlEntries[0] || null;

  if (!rootIndex) {
    const fallbackIndexPath = path.join(previewRoot, "index.html");
    if (chosenHtml) {
      const target = chosenHtml.startsWith("./") ? chosenHtml.slice(2) : chosenHtml;
      const redirectHtml = `<!doctype html><html><head><meta charset="utf-8"/><meta http-equiv="refresh" content="0; url=${encodeURI(
        target
      )}"><title>Opening Preview...</title></head><body></body></html>`;
      fs.writeFileSync(fallbackIndexPath, redirectHtml, "utf8");
    } else {
      fs.writeFileSync(fallbackIndexPath, buildFallbackPreviewIndex(files), "utf8");
    }
  }

  const baseUrl = buildBaseUrl(req);
  const previewUrl = `${baseUrl}/previews/${previewId}/index.html`;
  const downloadUrl = `${baseUrl}/previews/${previewId}/download`;

  return {
    previewId,
    previewUrl,
    downloadUrl,
  };
}

function buildAuthHeaders(apiKey, authMode = "bearer") {
  if (authMode === "x-api-key") {
    return { "x-api-key": apiKey };
  }

  if (authMode === "api-key") {
    return { "api-key": apiKey };
  }

  return { Authorization: `Bearer ${apiKey}` };
}

async function callProvider({ apiUrl, apiKey, model, messages, authMode = "bearer" }) {
  const payload = { messages };
  const latestUserMessage = [...(messages || [])]
    .reverse()
    .find((m) => String(m?.role || "").toLowerCase() === "user");
  if (latestUserMessage?.content) {
    payload.prompt = String(latestUserMessage.content);
  }
  if (model) payload.model = model;

  return postWithRetry(
    apiUrl,
    payload,
    {
      timeout: 45000,
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(apiKey, authMode),
      },
      validateStatus: () => true,
    },
    1
  );
}

function extractAiText(data) {
  return (
    data.text ||
    data.output ||
    data.result ||
    data?.choices?.[0]?.text ||
    data?.choices?.[0]?.message?.content ||
    ""
  );
}

function normalizeAiText(value) {
  let text = String(value || "").trim();

  // Handle doubly-escaped text returned by some proxies.
  if (text.includes("\\n") || text.includes('\\"') || text.includes("\\t")) {
    text = text
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\u003c/gi, "<")
      .replace(/\\u003e/gi, ">")
      .replace(/\\u0026/gi, "&");
  }

  // Remove wrapping quotes if proxy returns a JSON-encoded string.
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  text = text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

  return text;
}

function sandboxResponse(prompt) {
  const clean = String(prompt || "").trim();
  const short = clean.length > 220 ? `${clean.slice(0, 220)}...` : clean;
  return `Sandbox response: received your prompt - "${short}"`;
}

function normalizeConversationMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return [];
  return rawMessages
    .slice(-20)
    .map((m) => ({
      role: String(m?.role || "").toLowerCase(),
      content: String(m?.content || "").trim(),
    }))
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content);
}

function hasProjectContextInMessages(messages) {
  const text = (messages || []).map((m) => m.content).join("\n").toLowerCase();
  return /(project\s*name|file\s*tree|run\s*steps|index\.html|```html|```css|```javascript|website|web\s*app)/.test(text);
}

async function generateWithFallback(prompt, conversationMessages = []) {
  try {
    if (isSandboxMode()) {
      return sandboxResponse(prompt);
    }

    const primaryApiKey = String(process.env.AI_API_KEY || "").trim();
    const fallbackApiKey = String(process.env.FALLBACK_AI_KEY || "").trim();
    const apiUrl = process.env.AI_API_URL;
    const fallbackApiUrl = String(process.env.FALLBACK_AI_URL || "").trim() || apiUrl;
    const model = String(process.env.AI_MODEL || "").trim();
    const normalizedConversation = normalizeConversationMessages(conversationMessages);
    const projectContext = hasProjectContextInMessages(normalizedConversation);
    const casualPrompt = isCasualPrompt(prompt);
    const explicitProjectIntent = isProjectIntent(prompt) || isStandalonePageRequest(prompt);
    const projectEditInstruction = isProjectEditInstruction(prompt);
    const conversationalQuestion = isConversationalQuestion(prompt);
    const explanationMode = !casualPrompt && projectContext && conversationalQuestion;
    const projectIntent = !casualPrompt && !explanationMode && (explicitProjectIntent || (projectContext && projectEditInstruction && !conversationalQuestion));

    if (!primaryApiKey && !fallbackApiKey) {
      const error = new Error("Missing AI_API_KEY and FALLBACK_AI_KEY in .env");
      error.status = 500;
      error.publicMessage = "AI is not configured: missing key";
      throw error;
    }

    if (!apiUrl) {
      const error = new Error("Missing AI_API_URL in .env");
      error.status = 500;
      error.publicMessage = "AI is not configured: missing API URL";
      throw error;
    }

    let effectiveApiKey = primaryApiKey || fallbackApiKey;
    let effectiveApiUrl = apiUrl;

    const callProviderWithAuthModeFallback = async (messages, apiKey, targetUrl) => {
      const authModes = ["bearer", "x-api-key", "api-key"];
      let providerResponse = null;

      for (const authMode of authModes) {
        providerResponse = await callProvider({
          apiUrl: targetUrl,
          apiKey,
          model,
          messages,
          authMode,
        });

        const isUnauthorized = providerResponse.status === 401 || providerResponse.status === 403;
        if (!isUnauthorized) {
          return providerResponse;
        }
      }

      return providerResponse;
    };

    const callProviderWithKeyFailover = async (messages) => {
      let providerResponse = await callProviderWithAuthModeFallback(messages, effectiveApiKey, effectiveApiUrl);

      const isUnauthorized = providerResponse.status === 401 || providerResponse.status === 403;
      const canRetryWithFallback = isUnauthorized && Boolean(primaryApiKey && fallbackApiKey) && effectiveApiKey === primaryApiKey;

      if (canRetryWithFallback) {
        effectiveApiKey = fallbackApiKey;
        effectiveApiUrl = fallbackApiUrl;
        providerResponse = await callProviderWithAuthModeFallback(messages, effectiveApiKey, effectiveApiUrl);
      }

      return providerResponse;
    };

    const modelMessages = [
      {
        role: "system",
        content: explanationMode ? buildExplainerPrompt() : buildSystemPrompt(projectIntent),
      },
      ...normalizedConversation,
    ];

    const hasCurrentPrompt = normalizedConversation.some(
      (m) => m.role === "user" && m.content === String(prompt || "").trim()
    );
    if (!hasCurrentPrompt) {
      modelMessages.push({ role: "user", content: prompt });
    }

    const response = await callProviderWithKeyFailover(modelMessages);

    if (response.status < 200 || response.status >= 300) {
      const error = new Error(`AI upstream failed with status ${response.status}`);
      error.status = 502;
      error.publicMessage = response.status === 401 ? "AI key unauthorized" : "AI provider error";
      throw error;
    }

    const data = response.data || {};
    let normalized = normalizeAiText(extractAiText(data));

    // If model returns an unstructured answer for project prompts, force one reformat pass.
    if (projectIntent && normalized && !looksLikeStructuredProject(normalized)) {
      const reformatted = await callProviderWithKeyFailover([
        {
          role: "system",
          content: buildSystemPrompt(true),
        },
        {
          role: "user",
          content: `User prompt: ${prompt}`,
        },
        {
          role: "assistant",
          content: normalized,
        },
        {
          role: "user",
          content:
            "Reformat the previous answer into the exact required project structure with complete files and runnable steps. Do not omit code.",
        },
      ]);

      if (reformatted.status >= 200 && reformatted.status < 300) {
        normalized = normalizeAiText(extractAiText(reformatted.data || {}));
      }
    }

    // Some providers return prompt-parrot or tiny HTML snippets on follow-up edits.
    // Force one stronger retry using recent conversation context.
    if (projectIntent && (looksLikePromptParrot(normalized, prompt) || !looksLikeStructuredProject(normalized))) {
      const strongerRetry = await callProviderWithKeyFailover([
        {
          role: "system",
          content: buildSystemPrompt(true),
        },
        ...normalizedConversation.slice(-10),
        {
          role: "user",
          content:
            `Follow-up request: ${prompt}\n` +
            "Return a full updated project response with complete files and run steps. " +
            "Do not echo the prompt. Do not wrap text in simple HTML tags. Include actual code blocks.",
        },
      ]);

      if (strongerRetry.status >= 200 && strongerRetry.status < 300) {
        const retried = normalizeAiText(extractAiText(strongerRetry.data || {}));
        if (retried) {
          normalized = retried;
        }
      }
    }

    if (projectIntent) {
      normalized = enforceProjectSections(normalized);
    } else if (explanationMode && (looksLikeStructuredProject(normalized) || /```[\s\S]*?```/.test(normalized))) {
      const plainExplanation = await callProviderWithKeyFailover([
        {
          role: "system",
          content: buildExplainerPrompt(),
        },
        ...normalizedConversation.slice(-8),
        {
          role: "user",
          content: `Question: ${prompt}`,
        },
        {
          role: "assistant",
          content: normalized,
        },
        {
          role: "user",
          content:
            "Rewrite your answer as a plain explanation only. No file tree. No run steps. No project template. No fenced code blocks.",
        },
      ]);

      if (plainExplanation.status >= 200 && plainExplanation.status < 300) {
        normalized = normalizeAiText(extractAiText(plainExplanation.data || {}));
      }

      // Final safety strip if provider still returns fenced code.
      normalized = String(normalized || "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      // Provider may still return project headings/templates after rewrite instruction.
      // Force a plain-language summary fallback for stable ChatGPT-like behavior.
      if (!normalized || looksLikeStructuredProject(normalized) || /```[\s\S]*?```/.test(normalized)) {
        normalized = summarizeProjectForQuestion(projectContext ? normalizedConversation.map((m) => m.content).join("\n") : normalized, prompt);
      }
    } else if (looksLikeStructuredProject(normalized)) {
      const plainResponse = await callProviderWithKeyFailover([
        {
          role: "system",
          content: buildSystemPrompt(false),
        },
        {
          role: "user",
          content: `User prompt: ${prompt}`,
        },
        {
          role: "assistant",
          content: normalized,
        },
        {
          role: "user",
          content:
            "Reply naturally as a normal chat assistant. Do not return project structure, file trees, code scaffolding, or run steps unless explicitly requested.",
        },
      ]);

      if (plainResponse.status >= 200 && plainResponse.status < 300) {
        normalized = normalizeAiText(extractAiText(plainResponse.data || {}));
      }
    }

    if (!normalized) {
      const error = new Error("Empty response from AI");
      error.status = 502;
      error.publicMessage = "AI provider returned empty response";
      throw error;
    }

    return normalized;

  } catch (error) {
    console.error("AI Error:", error.message);

    const canFallbackToSandbox =
      String(process.env.AI_FALLBACK_TO_SANDBOX || "false").toLowerCase() === "true";
    const isTimeout =
      error.code === "ECONNABORTED" ||
      String(error.message || "").toLowerCase().includes("timeout");
    const isUnauthorized =
      error?.status === 401 ||
      error?.status === 403 ||
      String(error?.publicMessage || "").toLowerCase().includes("unauthorized") ||
      String(error?.message || "").toLowerCase().includes("unauthorized") ||
      String(error?.message || "").toLowerCase().includes("invalid api key");

    if (canFallbackToSandbox && (isTimeout || isUnauthorized)) {
      return sandboxResponse(prompt);
    }

    if (error.status || error.publicMessage) {
      throw error;
    }

    const wrapped = new Error("AI generation failed");
    wrapped.status = 500;
    wrapped.publicMessage = "AI generation failed";
    throw wrapped;
  }
}

module.exports = { generateWithFallback, generatePreviewFromResponse };