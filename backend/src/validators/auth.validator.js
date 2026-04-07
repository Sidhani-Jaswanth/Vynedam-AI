const Joi = require("joi");

const signupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(1).max(128).required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().trim().required(),
});

const logoutSchema = Joi.object({
  refreshToken: Joi.string().trim().optional(),
});

module.exports = {
  signupSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
};
