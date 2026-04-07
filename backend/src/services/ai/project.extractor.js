const { generatePreviewFromResponse } = require("../../../services/ai.service");

function extractFilesFromResponse(text) {
  const files = [];
  const regex = /([A-Za-z0-9_./-]+\.[A-Za-z0-9_-]+)\s*\n```[\w+-]*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(String(text || ""))) !== null) {
    files.push({
      path: match[1],
      content: match[2],
    });
  }
  return files;
}

function extractTitle(text) {
  const match = String(text || "").match(/project\s*name\s*[\r\n]+[#\-*\s]*([^\r\n]+)/i);
  return match?.[1]?.trim() || "Generated Project";
}

function buildProjectPayload(text, req) {
  const preview = generatePreviewFromResponse(text, req);
  return {
    title: extractTitle(text),
    files: extractFilesFromResponse(text),
    previewUrl: preview?.previewUrl || null,
    downloadUrl: preview?.downloadUrl || null,
  };
}

module.exports = { buildProjectPayload };
