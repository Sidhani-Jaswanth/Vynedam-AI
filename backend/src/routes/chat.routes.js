const express = require("express");
const { requireAccessToken } = require("../middleware/auth.middleware");
const { validateBody } = require("../middleware/validate.middleware");
const {
  listChats,
  getChat,
  createChat,
  renameChat,
  pinChat,
  addMessage,
  clearChat,
  deleteChat,
  clearAllChats,
} = require("../controllers/chat.controller");
const {
  createChatSchema,
  renameChatSchema,
  messageSchema,
  pinSchema,
} = require("../validators/chat.validator");

const router = express.Router();

router.use(requireAccessToken);

router.get("/", listChats);
router.post("/", validateBody(createChatSchema), createChat);
router.delete("/", clearAllChats);
router.get("/:id", getChat);
router.patch("/:id", validateBody(renameChatSchema), renameChat);
router.patch("/:id/pin", validateBody(pinSchema), pinChat);
router.post("/:id/messages", validateBody(messageSchema), addMessage);
router.post("/:id/clear", clearChat);
router.delete("/:id", deleteChat);

module.exports = router;
