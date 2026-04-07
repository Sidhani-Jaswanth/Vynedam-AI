const axios = require("axios");
const crypto = require("crypto");
const env = require("../config/env");
const AppError = require("../utils/app-error");

function constantTimeEquals(left, right) {
  const leftDigest = crypto.createHash("sha256").update(String(left || "")).digest();
  const rightDigest = crypto.createHash("sha256").update(String(right || "")).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

async function requireAuthKey(req, _res, next) {
  try {
    const key = String(req.headers["x-auth-key"] || "").trim();
    if (!key) return next(new AppError("Missing x-auth-key", 401));

    if (env.authKey) {
      if (!constantTimeEquals(key, env.authKey)) {
        return next(new AppError("Invalid auth key", 401));
      }
      return next();
    }

    if (!env.authKeyUrl) {
      return next(new AppError("AUTH_KEY_URL not configured", 500));
    }

    const response = await axios.post(env.authKeyUrl, { key }, { timeout: 7000, validateStatus: () => true });
    if (response.status < 200 || response.status >= 300) {
      return next(new AppError("Invalid auth key", 401));
    }

    if (response.data && response.data.valid === false) {
      return next(new AppError("Invalid auth key", 401));
    }

    return next();
  } catch {
    return next(new AppError("Auth key verification failed", 401));
  }
}

module.exports = { requireAuthKey };
