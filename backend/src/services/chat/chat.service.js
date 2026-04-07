const mongoose = require("mongoose");
const AppError = require("../../utils/app-error");
const chatRepository = require("../../repositories/chat.repository");

function normalizeName(name, fallback = "New Chat") {
  const trimmed = String(name || "").trim();
  return trimmed ? trimmed.slice(0, 120) : fallback;
}

function toDto(chat, includeMessages = true, pagination = null) {
  const allMessages = chat.messages || [];
  return {
    id: String(chat._id || chat.id),
    name: chat.name,
    isPinned: Boolean(chat.isPinned),
    lastMessage: chat.lastMessage || null,
    messages: includeMessages
      ? allMessages.map((m) => ({
          id: String(m._id || m.id),
          sender: m.sender,
          text: m.text,
          previewUrl: m.previewUrl,
          downloadUrl: m.downloadUrl,
          createdAt: m.createdAt,
        }))
      : undefined,
    messageCount: allMessages.length,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    pagination,
  };
}

class ChatService {
  parseUserId(user) {
    const id = user?.sub;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) throw new AppError("Invalid user token", 401);
    return new mongoose.Types.ObjectId(id);
  }

  parseChatId(chatId) {
    if (!mongoose.Types.ObjectId.isValid(chatId)) throw new AppError("Invalid chat id", 400);
    return chatId;
  }

  async listChats(user) {
    const userId = this.parseUserId(user);
    const chats = await chatRepository.listByUser(userId);
    return chats.map((chat) => toDto(chat, false));
  }

  async getChat(user, chatId, paginationQuery = {}) {
    const userId = this.parseUserId(user);
    const parsedChatId = this.parseChatId(chatId);

    const chat = await chatRepository.findByIdForUser(parsedChatId, userId);
    if (!chat) throw new AppError("Chat not found", 404);

    const page = Math.max(1, Number(paginationQuery.page || 1));
    const limit = Math.min(200, Math.max(1, Number(paginationQuery.limit || 50)));
    const total = chat.messages?.length || 0;
    const start = Math.max(0, total - page * limit);
    const end = total - (page - 1) * limit;
    const pagedMessages = (chat.messages || []).slice(start, end);

    return toDto(
      { ...chat, messages: pagedMessages },
      true,
      {
        page,
        limit,
        total,
        hasMore: start > 0,
      }
    );
  }

  async createChat(user, payload = {}) {
    const userId = this.parseUserId(user);
    const chat = await chatRepository.create({
      userId,
      name: normalizeName(payload.name),
      messages: [],
      isPinned: false,
      deletedAt: null,
      lastMessage: null,
    });
    return toDto(chat, true);
  }

  async renameChat(user, chatId, payload = {}) {
    const userId = this.parseUserId(user);
    const parsedChatId = this.parseChatId(chatId);
    const chat = await chatRepository.rename(parsedChatId, userId, normalizeName(payload.name));
    if (!chat) throw new AppError("Chat not found", 404);
    return toDto(chat, true);
  }

  async setPin(user, chatId, payload = {}) {
    const userId = this.parseUserId(user);
    const parsedChatId = this.parseChatId(chatId);
    const chat = await chatRepository.setPinned(parsedChatId, userId, Boolean(payload.isPinned));
    if (!chat) throw new AppError("Chat not found", 404);
    return toDto(chat, false);
  }

  async addMessage(user, chatId, payload = {}) {
    const userId = this.parseUserId(user);
    const parsedChatId = this.parseChatId(chatId);

    const sender = String(payload.sender || "").trim();
    if (!["user", "ai"].includes(sender)) throw new AppError("sender must be user or ai", 400);

    const text = String(payload.text || "").trim();
    if (!text) throw new AppError("text is required", 400);

    const message = {
      sender,
      text,
      ...(payload.previewUrl ? { previewUrl: String(payload.previewUrl) } : {}),
      ...(payload.downloadUrl ? { downloadUrl: String(payload.downloadUrl) } : {}),
    };

    const chat = await chatRepository.addMessage(parsedChatId, userId, message);
    if (!chat) throw new AppError("Chat not found", 404);
    return toDto(chat, true);
  }

  async clearChat(user, chatId) {
    const userId = this.parseUserId(user);
    const parsedChatId = this.parseChatId(chatId);
    const chat = await chatRepository.clearMessages(parsedChatId, userId);
    if (!chat) throw new AppError("Chat not found", 404);
    return toDto(chat, true);
  }

  async deleteChat(user, chatId) {
    const userId = this.parseUserId(user);
    const parsedChatId = this.parseChatId(chatId);
    const chat = await chatRepository.softDelete(parsedChatId, userId);
    if (!chat) throw new AppError("Chat not found", 404);
    return { id: String(chat._id) };
  }

  async clearAllChats(user) {
    const userId = this.parseUserId(user);
    await chatRepository.softDeleteAll(userId);
  }
}

module.exports = new ChatService();
