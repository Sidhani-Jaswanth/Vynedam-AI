const express = require("express");
const { requireJwt } = require("../middleware/auth.middleware");
const {
  listChats,
  getChat,
  createChat,
  renameChat,
  addMessage,
  clearChat,
  deleteChat,
  clearAllChats,
} = require("../controllers/chat.controller");

const router = express.Router();

router.use(requireJwt);

router.get("/", listChats);
router.post("/", createChat);
router.delete("/", clearAllChats);
router.get("/:id", getChat);
router.patch("/:id", renameChat);
router.post("/:id/messages", addMessage);
router.post("/:id/clear", clearChat);
router.delete("/:id", deleteChat);

module.exports = router;
