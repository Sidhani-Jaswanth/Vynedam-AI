const AppError = require("../utils/app-error");
const { verifyToken } = require("../services/auth/token.service");

function requireAccessToken(req, _res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return next(new AppError("Missing Bearer token", 401));

    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch {
    return next(new AppError("Invalid or expired token", 401));
  }
}

function requireRole(roles = []) {
  return (req, _res, next) => {
    const role = req.user?.role || "user";
    if (!roles.length || roles.includes(role)) return next();
    return next(new AppError("Forbidden", 403));
  };
}

module.exports = {
  requireAccessToken,
  requireRole,
};
