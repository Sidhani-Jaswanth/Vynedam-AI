const asyncHandler = require("../utils/async-handler");
const { ok } = require("../utils/response");
const authService = require("../services/auth/auth.service");

const signup = asyncHandler(async (req, res) => {
  const data = await authService.signup({
    ...req.body,
    userAgent: req.headers["user-agent"] || "",
    ipAddress: req.ip,
  });
  return ok(res, data, "Signup successful", 201);
});

const login = asyncHandler(async (req, res) => {
  const data = await authService.login({
    ...req.body,
    userAgent: req.headers["user-agent"] || "",
    ipAddress: req.ip,
  });
  return ok(res, data, "Login successful", 200);
});

const refresh = asyncHandler(async (req, res) => {
  const data = await authService.refresh(req.body.refreshToken, {
    userAgent: req.headers["user-agent"] || "",
    ipAddress: req.ip,
  });
  return ok(res, data, "Token refreshed", 200);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user?.sub, req.body?.refreshToken);
  return ok(res, {}, "Logged out", 200);
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.sub);
  return ok(res, { user }, "Profile fetched", 200);
});

module.exports = {
  signup,
  login,
  refresh,
  logout,
  me,
};
