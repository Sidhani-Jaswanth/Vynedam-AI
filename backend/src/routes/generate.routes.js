const express = require("express");
const { requireAccessToken } = require("../middleware/auth.middleware");
const { requireAuthKey } = require("../middleware/apikey.middleware");
const env = require("../config/env");
const { validateBody } = require("../middleware/validate.middleware");
const { generateSchema } = require("../validators/generate.validator");
const { generate } = require("../controllers/generate.controller");

const router = express.Router();

const middlewares = [];
if (env.requireAuthKey) middlewares.push(requireAuthKey);
if (env.requireAuth) middlewares.push(requireAccessToken);

router.post("/", ...middlewares, validateBody(generateSchema), generate);
router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Use POST /api/generate with prompt in JSON body.",
    data: {
      jwtRequired: env.requireAuth,
      authKeyRequired: env.requireAuthKey,
    },
    error: null,
  });
});

module.exports = router;
