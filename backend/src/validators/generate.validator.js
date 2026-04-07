const Joi = require("joi");

const generateSchema = Joi.object({
  prompt: Joi.string().trim().min(1).max(5000).required(),
  messages: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid("user", "assistant").required(),
        content: Joi.string().trim().min(1).max(5000).required(),
      })
    )
    .optional(),
});

module.exports = { generateSchema };
