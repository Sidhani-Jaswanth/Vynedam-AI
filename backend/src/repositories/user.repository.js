const User = require("../../models/user.model");

class UserRepository {
  findByEmail(email) {
    return User.findOne({ email }).lean();
  }

  findById(id) {
    return User.findById(id).lean();
  }

  create(payload) {
    return User.create(payload);
  }
}

module.exports = new UserRepository();
