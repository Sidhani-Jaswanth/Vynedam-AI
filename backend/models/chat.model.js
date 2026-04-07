const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["user", "ai"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20000,
    },
    previewUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    downloadUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      default: "New Chat",
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    lastMessage: {
      sender: {
        type: String,
        enum: ["user", "ai"],
      },
      text: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
      createdAt: {
        type: Date,
      },
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

chatSchema.index({ userId: 1, isPinned: -1, updatedAt: -1 });
chatSchema.index({ userId: 1, deletedAt: 1, updatedAt: -1 });

module.exports = mongoose.model("Chat", chatSchema);
