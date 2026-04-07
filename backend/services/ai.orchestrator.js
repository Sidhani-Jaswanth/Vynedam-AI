const axios = require("axios");
const logger = require("../config/logger");
const projectService = require("./project.service");
const executionService = require("./execution.service");

// Helper to handle AI API interaction and failure fallback
async function callAiProvider(prompt, retries = 1) {
  const primaryApiKey = String(process.env.AI_API_KEY || "").trim();
  const fallbackApiKey = String(process.env.FALLBACK_AI_KEY || "").trim();
  const apiUrl = process.env.AI_API_URL;
  const fallbackApiUrl = String(process.env.FALLBACK_AI_URL || "").trim() || apiUrl;
  const model = String(process.env.AI_MODEL || "").trim();

  const systemPrompt = `You are a strict, expert project-scaffolding AI.
You must absolutely ONLY return a valid JSON object. No explanations, no markdown codeblocks containing the json, NO plain text.
The JSON object must have this EXACT structure:
{
  "type": "project",
  "title": "Project Name",
  "language": "html | node | react | python | java",
  "framework": "express | flask | spring | vanilla",
  "entry": "main file name",
  "installCommand": "npm install (or equivalent)",
  "runCommand": "npm start (or equivalent)",
  "port": 3000,
  "files": [
    {
      "path": "relative/file/path.ext",
      "content": "Full source code here"
    }
  ]
}

- Ensure all files are inside the "files" array.
- "type" MUST be "project"
- Never output markdown formatting.
- If no setup is needed, leave installCommand and runCommand empty strings.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt }
  ];

  let apiKey = primaryApiKey || fallbackApiKey;
  let targetUrl = apiUrl;

  const payload = { messages, model };
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  try {
    let response = await axios.post(targetUrl, payload, { headers, timeout: 45000, validateStatus: () => true });

    if ((response.status === 401 || response.status === 403) && primaryApiKey && fallbackApiKey && apiKey === primaryApiKey) {
      // Failover
      headers.Authorization = `Bearer ${fallbackApiKey}`;
      response = await axios.post(fallbackApiUrl, payload, { headers, timeout: 45000, validateStatus: () => true });
    }
    
    if (response.status >= 400) {
      throw new Error(`AI Request failed with status ${response.status}`);
    }

    const aiText = response.data?.choices?.[0]?.message?.content || response.data?.text || response.data?.output || "";
    return extractJson(aiText);
  } catch (error) {
    if (retries > 0) {
      logger.warn("AI generation failed, retrying...");
      return callAiProvider(prompt, retries - 1);
    }
    throw error;
  }
}

function extractJson(text) {
  try {
    // Strip markdown codeblock if the AI accidentally wrapped the JSON
    let cleanText = text.trim();
    if (cleanText.startsWith("\`\`\`json")) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith("\`\`\`")) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith("\`\`\`")) {
      cleanText = cleanText.slice(0, -3);
    }

    cleanText = cleanText.trim();
    return JSON.parse(cleanText);
  } catch (err) {
    throw new Error("AI did not return valid JSON: " + text.slice(0, 100));
  }
}

function validateProjectJson(json) {
  if (json.type !== "project") throw new Error("Invalid output: type is not project");
  if (!json.files || !Array.isArray(json.files) || json.files.length === 0) {
    throw new Error("Invalid output: files array is empty or missing");
  }
  return true;
}

module.exports = {
  callAiProvider,
  validateProjectJson
};
