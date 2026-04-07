const AppError = require("../utils/app-error");

function validateBody(schema) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body || {}, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return next(
        new AppError(
          "Validation failed",
          400,
          error.details.map((d) => ({
            field: d.path.join("."),
            message: d.message,
          }))
        )
      );
    }

    req.body = value;
    return next();
  };
}

module.exports = { validateBody };
