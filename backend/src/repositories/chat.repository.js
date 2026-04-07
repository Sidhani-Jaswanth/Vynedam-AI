const Chat = require("../../models/chat.model");

class ChatRepository {
  listByUser(userId) {
    return Chat.find({ userId, deletedAt: null })
      .sort({ isPinned: -1, updatedAt: -1 })
      .lean();
  }

  findByIdForUser(chatId, userId) {
    return Chat.findOne({ _id: chatId, userId, deletedAt: null }).lean();
  }

  create(payload) {
    return Chat.create(payload);
  }

  rename(chatId, userId, name) {
    return Chat.findOneAndUpdate(
      { _id: chatId, userId, deletedAt: null },
      { $set: { name } },
      { returnDocument: "after" }
    ).lean();
  }

  setPinned(chatId, userId, isPinned) {
    return Chat.findOneAndUpdate(
      { _id: chatId, userId, deletedAt: null },
      { $set: { isPinned } },
      { returnDocument: "after" }
    ).lean();
  }

  addMessage(chatId, userId, message) {
    return Chat.findOneAndUpdate(
      { _id: chatId, userId, deletedAt: null },
      {
        $push: { messages: message },
        $set: {
          lastMessage: {
            sender: message.sender,
            text: message.text,
            createdAt: new Date(),
          },
        },
      },
      { returnDocument: "after" }
    ).lean();
  }

  clearMessages(chatId, userId) {
    return Chat.findOneAndUpdate(
      { _id: chatId, userId, deletedAt: null },
      { $set: { messages: [], lastMessage: null } },
      { returnDocument: "after" }
    ).lean();
  }

  softDelete(chatId, userId) {
    return Chat.findOneAndUpdate(
      { _id: chatId, userId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { returnDocument: "after" }
    ).lean();
  }

  softDeleteAll(userId) {
    return Chat.updateMany({ userId, deletedAt: null }, { $set: { deletedAt: new Date() } });
  }
}

module.exports = new ChatRepository();
