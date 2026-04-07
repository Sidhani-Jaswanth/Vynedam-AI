const mongoose = require("mongoose");
const Chat = require("../models/chat.model");

function normalizeName(name, fallback = "New Chat") {
  const trimmed = String(name || "").trim();
  return trimmed ? trimmed.slice(0, 120) : fallback;
}

function toProject(chat, includeMessages = true) {
  return {
    id: String(chat._id),
    name: chat.name,
    messages: includeMessages
      ? (chat.messages || []).map((m) => ({
          id: String(m._id),
          sender: m.sender,
          text: m.text,
          previewUrl: m.previewUrl,
          downloadUrl: m.downloadUrl,
          createdAt: m.createdAt,
        }))
      : undefined,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messageCount: chat.messages?.length || 0,
  };
}

function parseUserId(req) {
  const id = req.user?.sub;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

async function listChats(req, res) {
  try {
    const userId = parseUserId(req);
    if (!userId) return res.status(401).json({ error: "Invalid user token" });

    const chats = await Chat.find({ userId }).sort({ updatedAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      chats: chats.map((chat) => toProject(chat, false)),
    });
  } catch (error) {
    console.error("List chats error:", error.message);
    return res.status(500).json({ error: "Failed to list chats" });
  }
}

async function getChat(req, res) {
  try {
    const userId = parseUserId(req);
    if (!userId) return res.status(401).json({ error: "Invalid user token" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid chat id" });
    }

    const chat = await Chat.findOne({ _id: id, userId }).lean();
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    return res.status(200).json({ success: true, chat: toProject(chat, true) });
  } catch (error) {
    console.error("Get chat error:", error.message);
    return res.status(500).json({ error: "Failed to fetch chat" });
  }
}

async function createChat(req, res) {
  try {
    const userId = parseUserId(req);
    if (!userId) return res.status(401).json({ error: "Invalid user token" });

    const { name } = req.body || {};
    const chat = await Chat.create({
      userId,
      name: normalizeName(name),
      messages: [],
    });

    return res.status(201).json({ success: true, chat: toProject(chat, true) });
  } catch (error) {
    console.error("Create chat error:", error.message);
    return res.status(500).json({ error: "Failed to create chat" });
  }
}

async function renameChat(req, res) {
  try {
    const userId = parseUserId(req);
    if (!userId) return res.status(401).json({ error: "Invalid user token" });

    const { id } = req.params;
    const { name } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid chat id" });
    }

    const chat = await Chat.findOneAndUpdate(
      { _id: id, userId },
      { $set: { name: normalizeName(name) } },
      { returnDocument: "after" }
    ).lean();

    if (!chat) return res.status(404).json({ error: "Chat not found" });
    return res.status(200).json({ success: true, chat: toProject(chat, true) });
  } catch (error) {
    console.error("Rename chat error:", error.message);
    return res.status(500).json({ error: "Failed to rename chat" });
  }
}

async function addMessage(req, res) {
  try {
    const userId = parseUserId(req);
    if (!userId) return res.status(401).json({ error: "Invalid user token" });

    const { id } = req.params;
    const { sender, text, previewUrl, downloadUrl } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid chat id" });
    }

    if (!["user", "ai"].includes(sender)) {
      return res.status(400).json({ error: "sender must be user or ai" });
    }

    const cleanText = String(text || "").trim();
    if (!cleanText) {
      return res.status(400).json({ error: "text is required" });
    }

    let cleanPreviewUrl;
    let cleanDownloadUrl;
    if (sender === "ai" && typeof previewUrl !== "undefined") {
      cleanPreviewUrl = String(previewUrl || "").trim();
      if (cleanPreviewUrl.length > 2000) {
        return res.status(400).json({ error: "previewUrl is too long" });
      }
      if (cleanPreviewUrl) {
        try {
          new URL(cleanPreviewUrl);
        } catch {
          if (!cleanPreviewUrl.startsWith("/previews/")) {
            return res.status(400).json({ error: "previewUrl must be a valid URL" });
          }
        }
      }
    }

    if (sender === "ai" && typeof downloadUrl !== "undefined") {
      cleanDownloadUrl = String(downloadUrl || "").trim();
      if (cleanDownloadUrl.length > 2000) {
        return res.status(400).json({ error: "downloadUrl is too long" });
      }
      if (cleanDownloadUrl) {
        try {
          new URL(cleanDownloadUrl);
        } catch {
          if (!cleanDownloadUrl.startsWith("/previews/")) {
            return res.status(400).json({ error: "downloadUrl must be a valid URL" });
          }
        }
      }
    }

    const chat = await Chat.findOneAndUpdate(
      { _id: id, userId },
      {
        $push: {
          messages: {
            sender,
            text: cleanText,
            ...(cleanPreviewUrl ? { previewUrl: cleanPreviewUrl } : {}),
            ...(cleanDownloadUrl ? { downloadUrl: cleanDownloadUrl } : {}),
          },
        },
      },
      { returnDocument: "after" }
    ).lean();

    if (!chat) return res.status(404).json({ error: "Chat not found" });
    return res.status(200).json({ success: true, chat: toProject(chat, true) });
  } catch (error) {
    console.error("Add message error:", error.message);
    return res.status(500).json({ error: "Failed to add message" });
  }
}

async function clearChat(req, res) {
  try {
    const userId = parseUserId(req);
    if (!userId) return res.status(401).json({ error: "Invalid user token" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid chat id" });
    }

    const chat = await Chat.findOneAndUpdate(
      { _id: id, userId },
      { $set: { messages: [] } },
      { returnDocument: "after" }
    ).lean();

    if (!chat) return res.status(404).json({ error: "Chat not found" });
    return res.status(200).json({ success: true, chat: toProject(chat, true) });
  } catch (error) {
    console.error("Clear chat error:", error.message);
    return res.status(500).json({ error: "Failed to clear chat" });
  }
}

async function deleteChat(req, res) {
  try {
    const userId = parseUserId(req);
    if (!userId) return res.status(401).json({ error: "Invalid user token" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid chat id" });
    }

    const result = await Chat.deleteOne({ _id: id, userId });
    if (!result.deletedCount) return res.status(404).json({ error: "Chat not found" });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete chat error:", error.message);
    return res.status(500).json({ error: "Failed to delete chat" });
  }
}

async function clearAllChats(req, res) {
  try {
    const userId = parseUserId(req);
    if (!userId) return res.status(401).json({ error: "Invalid user token" });

    await Chat.deleteMany({ userId });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Clear all chats error:", error.message);
    return res.status(500).json({ error: "Failed to clear chats" });
  }
}

module.exports = {
  listChats,
  getChat,
  createChat,
  renameChat,
  addMessage,
  clearChat,
  deleteChat,
  clearAllChats,
};
