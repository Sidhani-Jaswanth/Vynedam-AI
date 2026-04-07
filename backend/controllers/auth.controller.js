const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function sanitizeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
  };
}

async function signup(req, res) {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }

    const normalizedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const rawPassword = String(password);

    if (normalizedName.length < 2) {
      return res.status(400).json({ error: "name must be at least 2 characters" });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: "invalid email format" });
    }

    if (rawPassword.length < 8) {
      return res.status(400).json({ error: "password must be at least 8 characters" });
    }

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({ error: "email already in use" });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
    });

    const token = signToken(user._id);
    return res.status(201).json({ success: true, token, user: sanitizeUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: "email already in use" });
    }
    console.error("Signup error:", error.message);
    return res.status(500).json({ error: "Signup failed" });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: "invalid email format" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user._id);
    return res.status(200).json({ success: true, token, user: sanitizeUser(user) });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ error: "Login failed" });
  }
}

async function me(req, res) {
  try {
    const userId = req.user?.sub;
    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    console.error("Me error:", error.message);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
}

async function oauthCallback(req, res) {
  try {
    if (!req.user) {
      return res.redirect("http://localhost:3000/auth/error");
    }
    const token = signToken(req.user._id);
    return res.redirect(`http://localhost:3000/auth/success?token=${token}`);
  } catch (error) {
    console.error("OAuth callback error:", error.message);
    return res.redirect("http://localhost:3000/auth/error");
  }
}

module.exports = { signup, login, me, oauthCallback };
