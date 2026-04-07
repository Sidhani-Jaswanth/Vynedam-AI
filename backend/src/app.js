const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const env = require("./config/env");
const logger = require("./config/logger");
const { requestContext } = require("./middleware/request-context.middleware");
const { errorMiddleware } = require("./middleware/error.middleware");
const { requireAccessToken } = require("./middleware/auth.middleware");
const { xssProtection } = require("./middleware/xss.middleware");
const authRoutes = require("./routes/auth.routes");
const chatRoutes = require("./routes/chat.routes");
const generateRoutes = require("./routes/generate.routes");

const app = express();
const passport = require("./config/passport");
const PREVIEWS_DIR = path.join(__dirname, "../", env.previewBasePath || "generated_projects");

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "").toLowerCase();
}

const allowedOrigins = String(env.corsOrigin || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const normalizedAllowedOrigins = new Set(allowedOrigins.map(normalizeOrigin));

app.set("trust proxy", 1);
app.use(helmet());
app.use(compression());
app.use(requestContext);
app.use(
  cors({
    origin(origin, callback) {
      if (env.allowAllCors) return callback(null, true);
      if (!origin) return callback(null, true);

      const normalizedOrigin = normalizeOrigin(origin);
      if (normalizedAllowedOrigins.has(normalizedOrigin)) return callback(null, true);
      if (normalizedOrigin.includes("localhost") || normalizedOrigin.includes("127.0.0.1")) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(xssProtection);
app.use(passport.initialize());
app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object") mongoSanitize.sanitize(req.body);
  if (req.params && typeof req.params === "object") mongoSanitize.sanitize(req.params);
  if (req.query && typeof req.query === "object") mongoSanitize.sanitize(req.query);
  next();
});
app.use(hpp());

morgan.token("req-id", (req) => req.requestId);
app.use(
  morgan(env.isProduction ? ":req-id :method :url :status :response-time ms" : ":req-id :method :url :status :response-time ms", {
    stream: {
      write: (message) => logger.info({ http: message.trim() }, "HTTP request"),
    },
  })
);

const authLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMaxAuth,
  standardHeaders: true,
  legacyHeaders: false,
});
const generateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMaxGenerate,
  standardHeaders: true,
  legacyHeaders: false,
});
const generalLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMaxGeneral,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health" || req.path === "/ready",
});
app.use(generalLimiter);

const previewMiddlewares = env.previewRequireAuth ? [requireAccessToken] : [];
app.use("/preview", ...previewMiddlewares, express.static(PREVIEWS_DIR));
app.get("/previews/:previewId/download", ...previewMiddlewares, (req, res) => {
  const { previewId } = req.params;
  if (!/^[0-9a-fA-F-]{36}$/.test(previewId)) {
    return res.status(400).json({ success: false, message: "Invalid preview id", data: {}, error: { message: "Invalid preview id" } });
  }

  const previewDir = path.join(PREVIEWS_DIR, previewId);
  if (!fs.existsSync(previewDir) || !fs.statSync(previewDir).isDirectory()) {
    return res.status(404).json({ success: false, message: "Preview not found", data: {}, error: { message: "Preview not found" } });
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename=project-${previewId}.zip`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    logger.error({ err: err.message, previewId }, "Zip archive error");
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Failed to generate zip", data: {}, error: { message: "Failed to generate zip" } });
    } else {
      res.end();
    }
  });

  archive.pipe(res);
  archive.directory(previewDir, false);
  archive.finalize();
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Health OK",
    data: { ok: true, ts: new Date().toISOString(), requestId: req.requestId },
    error: null,
  });
});

app.get("/ready", (req, res) => {
  const checks = {
    hasJwt: Boolean(env.jwtSecret),
    hasAiConfig: env.aiSandboxMode || Boolean(env.aiApiUrl && (env.aiApiKey || env.fallbackAiKey)),
    hasCors: !env.isProduction || Boolean(env.corsOrigin),
    hasAuthKeyConfig: !env.requireAuthKey || Boolean(env.authKey || env.authKeyUrl),
  };

  const ok = Object.values(checks).every(Boolean);
  return res.status(ok ? 200 : 503).json({
    success: ok,
    message: ok ? "Ready" : "Not ready",
    data: { checks, requestId: req.requestId },
    error: ok ? null : { message: "Readiness checks failed" },
  });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/generate", generateLimiter, generateRoutes);
if (env.enableLegacyGenerateRoute) {
  app.use("/generate", generateLimiter, generateRoutes);
}

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend working",
    data: { service: "vynedam-backend" },
    error: null,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    data: {},
    error: { message: "Route not found", requestId: req.requestId },
  });
});

app.use(errorMiddleware);

module.exports = app;
