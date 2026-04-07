const { spawn } = require("child_process");

const TEST_PORT = "5071";
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (_) {
      // Keep polling until server is up.
    }
    await delay(250);
  }
  throw new Error("Server did not become ready in time");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: TEST_PORT,
    USE_DB: "false",
    AI_SANDBOX_MODE: "true",
    REQUIRE_AUTH: "false",
    REQUIRE_AUTH_KEY: "false",
    ENABLE_LEGACY_GENERATE_ROUTE: "false",
    JWT_SECRET: process.env.JWT_SECRET || "test-jwt-secret",
    CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
  };

  const server = spawn(process.execPath, ["app.js"], {
    cwd: __dirname + "/..",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  server.stdout.on("data", () => {
    // No-op: useful when debugging locally.
  });

  try {
    await waitForServer(`${BASE_URL}/health`);

    const health = await fetch(`${BASE_URL}/health`);
    assert(health.status === 200, `Expected /health 200, got ${health.status}`);

    const ready = await fetch(`${BASE_URL}/ready`);
    assert(ready.status === 200, `Expected /ready 200, got ${ready.status}`);

    const generateHelp = await fetch(`${BASE_URL}/api/generate`);
    assert(generateHelp.status === 200, `Expected GET /api/generate 200, got ${generateHelp.status}`);

    const invalidGenerate = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert(invalidGenerate.status === 400, `Expected invalid generate 400, got ${invalidGenerate.status}`);

    const validGenerate = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Create hello world" }),
    });
    assert(validGenerate.status === 200, `Expected valid generate 200, got ${validGenerate.status}`);

    const payload = await validGenerate.json();
    assert(payload && payload.success === true, "Expected generate payload.success === true");
    assert(typeof payload.result === "string" && payload.result.length > 0, "Expected generate payload.result text");

    console.log("Backend smoke tests passed");
  } finally {
    server.kill("SIGTERM");
    await delay(300);
    if (!server.killed) server.kill("SIGKILL");

    if (stderr.trim()) {
      console.error(stderr.trim());
    }
  }
}

run().catch((error) => {
  console.error("Backend smoke tests failed:", error.message);
  process.exit(1);
});
