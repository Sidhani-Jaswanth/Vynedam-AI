const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    replacedByTokenHash: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: "",
      maxlength: 512,
    },
    ipAddress: {
      type: String,
      default: "",
      maxlength: 128,
    },
  },
  {
    timestamps: true,
  }
);

refreshTokenSchema.index({ userId: 1, revokedAt: 1, expiresAt: -1 });

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
