function classifyPrompt(prompt, messages = []) {
  const value = String(prompt || "").trim().toLowerCase();
  const history = (messages || []).map((m) => String(m.content || "").toLowerCase()).join("\n");

  if (!value) return "casual";
  if (/^(hi|hello|hey|thanks|ok|cool)\b/.test(value)) return "casual";
  if (/(why|how|what|explain|describe|summari[sz]e|review)\b/.test(value)) return "explanation";
  if (/(build|create|generate|project|website|landing|full\s*stack|api)\b/.test(value) || /(project\s*name|file\s*tree|run\s*steps)/.test(history)) {
    return "project";
  }
  if (/(code|debug|bug|refactor|function|class|api|database|sql|typescript|javascript|node|react)/.test(value)) {
    return "coding";
  }

  return "casual";
}

module.exports = { classifyPrompt };
