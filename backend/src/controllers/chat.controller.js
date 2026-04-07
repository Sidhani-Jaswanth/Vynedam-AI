const asyncHandler = require("../utils/async-handler");
const { ok } = require("../utils/response");
const chatService = require("../services/chat/chat.service");

const listChats = asyncHandler(async (req, res) => {
  const chats = await chatService.listChats(req.user);
  return ok(res, { chats }, "Chats fetched", 200);
});

const getChat = asyncHandler(async (req, res) => {
  const chat = await chatService.getChat(req.user, req.params.id, req.query);
  return ok(res, { chat }, "Chat fetched", 200);
});

const createChat = asyncHandler(async (req, res) => {
  const chat = await chatService.createChat(req.user, req.body);
  return ok(res, { chat }, "Chat created", 201);
});

const renameChat = asyncHandler(async (req, res) => {
  const chat = await chatService.renameChat(req.user, req.params.id, req.body);
  return ok(res, { chat }, "Chat renamed", 200);
});

const pinChat = asyncHandler(async (req, res) => {
  const chat = await chatService.setPin(req.user, req.params.id, req.body);
  return ok(res, { chat }, "Chat updated", 200);
});

const addMessage = asyncHandler(async (req, res) => {
  const chat = await chatService.addMessage(req.user, req.params.id, req.body);
  return ok(res, { chat }, "Message added", 200);
});

const clearChat = asyncHandler(async (req, res) => {
  const chat = await chatService.clearChat(req.user, req.params.id);
  return ok(res, { chat }, "Chat cleared", 200);
});

const deleteChat = asyncHandler(async (req, res) => {
  const deleted = await chatService.deleteChat(req.user, req.params.id);
  return ok(res, { deleted }, "Chat deleted", 200);
});

const clearAllChats = asyncHandler(async (req, res) => {
  await chatService.clearAllChats(req.user);
  return ok(res, {}, "All chats deleted", 200);
});

module.exports = {
  listChats,
  getChat,
  createChat,
  renameChat,
  pinChat,
  addMessage,
  clearChat,
  deleteChat,
  clearAllChats,
};
