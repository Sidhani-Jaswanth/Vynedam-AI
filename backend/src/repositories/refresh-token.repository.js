const RefreshToken = require("../../models/refresh-token.model");

class RefreshTokenRepository {
  create(payload) {
    return RefreshToken.create(payload);
  }

  findActiveByHash(tokenHash) {
    return RefreshToken.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).lean();
  }

  revokeByHash(tokenHash, replacedByTokenHash = null) {
    return RefreshToken.findOneAndUpdate(
      { tokenHash, revokedAt: null },
      {
        $set: {
          revokedAt: new Date(),
          replacedByTokenHash,
        },
      },
      { returnDocument: "after" }
    ).lean();
  }

  revokeAllForUser(userId) {
    return RefreshToken.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }
}

module.exports = new RefreshTokenRepository();
