const express = require("express");
const rateLimit = require("express-rate-limit");
const { signup, login, me } = require("../controllers/auth.controller");
const { requireJwt } = require("../middleware/auth.middleware");

const router = express.Router();

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 25,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: "Too many auth attempts, please try again later" },
});

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.get("/me", requireJwt, me);

module.exports = router;
