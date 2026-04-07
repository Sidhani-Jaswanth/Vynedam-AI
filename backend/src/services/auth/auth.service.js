const bcrypt = require("bcryptjs");
const AppError = require("../../utils/app-error");
const userRepository = require("../../repositories/user.repository");
const refreshTokenRepository = require("../../repositories/refresh-token.repository");
const { sha256, signAccessToken, signRefreshToken, verifyToken } = require("./token.service");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeUser(user) {
  return {
    id: String(user._id || user.id),
    name: user.name,
    email: user.email,
    role: user.role || "user",
  };
}

function buildTokenResponse(user, accessToken, refreshToken) {
  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: sanitizeUser(user),
  };
}

class AuthService {
  async signup({ name, email, password, userAgent = "", ipAddress = "" }) {
    const normalizedName = String(name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const rawPassword = String(password || "");

    if (!normalizedName || !normalizedEmail || !rawPassword) {
      throw new AppError("name, email and password are required", 400);
    }
    if (normalizedName.length < 2) throw new AppError("name must be at least 2 characters", 400);
    if (!EMAIL_REGEX.test(normalizedEmail)) throw new AppError("invalid email format", 400);
    if (rawPassword.length < 8) throw new AppError("password must be at least 8 characters", 400);

    const existing = await userRepository.findByEmail(normalizedEmail);
    if (existing) throw new AppError("email already in use", 409);

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const user = await userRepository.create({
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
      role: "user",
    });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent,
      ipAddress,
    });

    return buildTokenResponse(user, accessToken, refreshToken);
  }

  async login({ email, password, userAgent = "", ipAddress = "" }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const rawPassword = String(password || "");

    if (!normalizedEmail || !rawPassword) throw new AppError("email and password are required", 400);
    if (!EMAIL_REGEX.test(normalizedEmail)) throw new AppError("invalid email format", 400);

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) throw new AppError("Invalid email or password", 401);

    const ok = await bcrypt.compare(rawPassword, user.passwordHash);
    if (!ok) throw new AppError("Invalid email or password", 401);

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent,
      ipAddress,
    });

    return buildTokenResponse(user, accessToken, refreshToken);
  }

  async refresh(refreshTokenRaw, context = {}) {
    if (!refreshTokenRaw) throw new AppError("refreshToken is required", 400);

    const decoded = verifyToken(refreshTokenRaw);
    if (decoded.type !== "refresh") throw new AppError("Invalid refresh token", 401);

    const tokenHash = sha256(refreshTokenRaw);
    const stored = await refreshTokenRepository.findActiveByHash(tokenHash);
    if (!stored) throw new AppError("Refresh token is invalid or expired", 401);

    const user = await userRepository.findById(decoded.sub);
    if (!user) throw new AppError("User not found", 404);

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);
    const newRefreshHash = sha256(newRefreshToken);

    await refreshTokenRepository.revokeByHash(tokenHash, newRefreshHash);
    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash: newRefreshHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: context.userAgent || "",
      ipAddress: context.ipAddress || "",
    });

    return buildTokenResponse(user, newAccessToken, newRefreshToken);
  }

  async logout(userId, refreshTokenRaw) {
    if (refreshTokenRaw) {
      await refreshTokenRepository.revokeByHash(sha256(refreshTokenRaw));
      return;
    }

    if (userId) {
      await refreshTokenRepository.revokeAllForUser(userId);
      return;
    }

    throw new AppError("refreshToken or authenticated user is required", 400);
  }

  async me(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    return sanitizeUser(user);
  }
}

module.exports = new AuthService();
