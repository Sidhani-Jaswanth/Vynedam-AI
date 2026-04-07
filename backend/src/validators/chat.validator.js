const Joi = require("joi");

const createChatSchema = Joi.object({
  name: Joi.string().trim().max(120).optional(),
});

const renameChatSchema = Joi.object({
  name: Joi.string().trim().max(120).required(),
});

const messageSchema = Joi.object({
  sender: Joi.string().valid("user", "ai").required(),
  text: Joi.string().trim().max(20000).required(),
  previewUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).optional().allow(""),
  downloadUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).optional().allow(""),
});

const pinSchema = Joi.object({
  isPinned: Joi.boolean().required(),
});

module.exports = {
  createChatSchema,
  renameChatSchema,
  messageSchema,
  pinSchema,
};
