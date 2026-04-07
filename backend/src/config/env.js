const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function toBool(value, fallback = false) {
  if (typeof value === "undefined") return fallback;
  return String(value).toLowerCase() === "true";
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: toNumber(process.env.PORT, 5000),
  useDb: process.env.USE_DB !== "false",
  mongoUri: process.env.MONGO_URI || "",

  corsOrigin: process.env.CORS_ORIGIN || "",
  allowAllCors: toBool(process.env.ALLOW_ALL_CORS, false),

  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  jwtAlgorithms: String(process.env.JWT_ALGORITHMS || "HS256").split(",").map((v) => v.trim()).filter(Boolean),
  jwtIssuer: process.env.JWT_ISSUER || "",
  jwtAudience: String(process.env.JWT_AUDIENCE || "").split(",").map((v) => v.trim()).filter(Boolean),
  jwtMaxAge: process.env.JWT_MAX_AGE || "",

  requireAuth: process.env.REQUIRE_AUTH !== "false",
  requireAuthKey: toBool(process.env.REQUIRE_AUTH_KEY, false),
  authKey: String(process.env.AUTH_KEY || "").trim(),
  authKeyUrl: process.env.AUTH_KEY_URL || "",

  aiApiUrl: process.env.AI_API_URL || "",
  aiApiKey: process.env.AI_API_KEY || "",
  fallbackAiKey: process.env.FALLBACK_AI_KEY || "",
  fallbackAiUrl: process.env.FALLBACK_AI_URL || "",
  aiModel: process.env.AI_MODEL || "",
  aiSandboxMode: toBool(process.env.AI_SANDBOX_MODE, false),
  aiFallbackToSandbox: toBool(process.env.AI_FALLBACK_TO_SANDBOX, false),

  enableLegacyGenerateRoute: toBool(process.env.ENABLE_LEGACY_GENERATE_ROUTE, false),
  previewRequireAuth: toBool(process.env.PREVIEW_REQUIRE_AUTH, false),
  previewTtlHours: toNumber(process.env.PREVIEW_TTL_HOURS, 24),
  previewCleanupIntervalMinutes: toNumber(process.env.PREVIEW_CLEANUP_INTERVAL_MINUTES, 30),

  rateLimitWindowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMaxGeneral: toNumber(process.env.RATE_LIMIT_MAX_GENERAL, 300),
  rateLimitMaxAuth: toNumber(process.env.RATE_LIMIT_MAX_AUTH, 80),
  rateLimitMaxGenerate: toNumber(process.env.RATE_LIMIT_MAX_GENERATE, 60),
};
