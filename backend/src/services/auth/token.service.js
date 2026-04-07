const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function signAccessToken(user) {
  const payload = {
    sub: String(user._id || user.id),
    role: user.role || "user",
  };

  const options = {
    expiresIn: env.jwtExpiresIn,
  };

  if (env.jwtIssuer) options.issuer = env.jwtIssuer;
  if (env.jwtAudience.length) options.audience = env.jwtAudience.length === 1 ? env.jwtAudience[0] : env.jwtAudience;

  return jwt.sign(payload, env.jwtSecret, options);
}

function signRefreshToken(user) {
  const tokenId = crypto.randomUUID();
  const payload = {
    sub: String(user._id || user.id),
    type: "refresh",
    jti: tokenId,
  };

  const options = {
    expiresIn: env.jwtRefreshExpiresIn,
  };

  if (env.jwtIssuer) options.issuer = env.jwtIssuer;
  if (env.jwtAudience.length) options.audience = env.jwtAudience.length === 1 ? env.jwtAudience[0] : env.jwtAudience;

  return jwt.sign(payload, env.jwtSecret, options);
}

function verifyToken(token) {
  const options = {
    algorithms: env.jwtAlgorithms.length ? env.jwtAlgorithms : ["HS256"],
  };

  if (env.jwtIssuer) options.issuer = env.jwtIssuer;
  if (env.jwtAudience.length) options.audience = env.jwtAudience.length === 1 ? env.jwtAudience[0] : env.jwtAudience;
  if (env.jwtMaxAge) options.maxAge = env.jwtMaxAge;

  return jwt.verify(token, env.jwtSecret, options);
}

module.exports = {
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyToken,
};
