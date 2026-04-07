const axios = require("axios");
const crypto = require("crypto");

function constantTimeEquals(left, right) {
  const leftDigest = crypto.createHash("sha256").update(String(left || "")).digest();
  const rightDigest = crypto.createHash("sha256").update(String(right || "")).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

async function requireAuthKey(req, res, next) {
  try {
    const rawHeader = req.headers["x-auth-key"];
    const key = String(rawHeader || "").trim();
    if (!key) return res.status(401).json({ error: "Missing x-auth-key" });

    // Prefer local static key validation when AUTH_KEY is configured.
    const configuredAuthKey = String(process.env.AUTH_KEY || "").trim();
    if (configuredAuthKey) {
      if (!constantTimeEquals(key, configuredAuthKey)) {
        return res.status(401).json({ error: "Invalid auth key" });
      }
      return next();
    }

    const url = process.env.AUTH_KEY_URL;
    if (!url) return res.status(500).json({ error: "AUTH_KEY_URL not configured" });

    const response = await axios.post(
      url,
      { key },
      { timeout: 7000, validateStatus: () => true }
    );

    if (response.status < 200 || response.status >= 300) {
      return res.status(401).json({ error: "Invalid auth key" });
    }

    const data = response.data || {};
    if (typeof data.valid === "boolean" && data.valid === false) {
      return res.status(401).json({ error: "Invalid auth key" });
    }

    return next();
  } catch {
    return res.status(401).json({ error: "Auth key verification failed" });
  }
}

module.exports = { requireAuthKey };