const express = require("express");
const rateLimit = require("express-rate-limit");
const { validateBody } = require("../middleware/validate.middleware");
const { requireAccessToken } = require("../middleware/auth.middleware");
const { signupSchema, loginSchema, refreshSchema, logoutSchema } = require("../validators/auth.validator");
const { signup, login, refresh, logout, me } = require("../controllers/auth.controller");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/signup", authLimiter, validateBody(signupSchema), signup);
router.post("/login", authLimiter, validateBody(loginSchema), login);
router.post("/refresh", authLimiter, validateBody(refreshSchema), refresh);
router.post("/logout", validateBody(logoutSchema), logout);
router.get("/me", requireAccessToken, me);

module.exports = router;
