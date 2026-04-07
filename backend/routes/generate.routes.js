const express = require("express");
const { requireAuthKey } = require("../middleware/apikey.middleware");
const { requireJwt } = require("../middleware/auth.middleware");
const { generate } = require("../controllers/generate.controller");

const router = express.Router();

const shouldRequireJwt = process.env.REQUIRE_AUTH !== "false";
const shouldRequireAuthKey = process.env.REQUIRE_AUTH_KEY === "true";

const middlewares = [];
if (shouldRequireAuthKey) middlewares.push(requireAuthKey);
if (shouldRequireJwt) middlewares.push(requireJwt);

router.post("/", ...middlewares, generate);
router.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Use POST /api/generate with prompt in JSON body.",
    jwtRequired: shouldRequireJwt,
    authKeyRequired: shouldRequireAuthKey,
  });
});

module.exports = router;