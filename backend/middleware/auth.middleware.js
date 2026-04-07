const jwt = require("jsonwebtoken");

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireJwt(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) return res.status(401).json({ error: "Missing Bearer token" });
    if (!process.env.JWT_SECRET) return res.status(500).json({ error: "JWT_SECRET not configured" });

    const verifyOptions = {
      algorithms: parseCsv(process.env.JWT_ALGORITHMS).length
        ? parseCsv(process.env.JWT_ALGORITHMS)
        : ["HS256"],
    };

    const issuer = String(process.env.JWT_ISSUER || "").trim();
    if (issuer) {
      verifyOptions.issuer = issuer;
    }

    const audience = parseCsv(process.env.JWT_AUDIENCE);
    if (audience.length > 0) {
      verifyOptions.audience = audience.length === 1 ? audience[0] : audience;
    }

    const maxAge = String(process.env.JWT_MAX_AGE || "").trim();
    if (maxAge) {
      verifyOptions.maxAge = maxAge;
    }

    req.user = jwt.verify(token, process.env.JWT_SECRET, verifyOptions);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireJwt };