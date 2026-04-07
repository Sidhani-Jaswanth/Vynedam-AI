const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/auth.controller");
const { signup, login, me, oauthCallback } = authController;
const { requireJwt } = require("../middleware/auth.middleware");

const router = express.Router();

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 25,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: "Too many auth attempts, please try again later" },
});

const passport = require("passport");

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.get("/me", requireJwt, me);

// OAuth Routes
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get("/google/callback", passport.authenticate("google", { session: false, failureRedirect: "http://localhost:3000/auth/error" }), authController.oauthCallback);

router.get("/github", passport.authenticate("github", { scope: ["user:email"], session: false }));
router.get("/github/callback", passport.authenticate("github", { session: false, failureRedirect: "http://localhost:3000/auth/error" }), authController.oauthCallback);

router.get("/microsoft", passport.authenticate("microsoft", { scope: ["user.read"], session: false }));
router.get("/microsoft/callback", passport.authenticate("microsoft", { session: false, failureRedirect: "http://localhost:3000/auth/error" }), authController.oauthCallback);

module.exports = router;
