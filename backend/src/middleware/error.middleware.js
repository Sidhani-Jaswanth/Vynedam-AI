const logger = require("../config/logger");
const AppError = require("../utils/app-error");
const { fail } = require("../utils/response");

function errorMiddleware(err, req, res, _next) {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : "Internal server error";

  logger.error(
    {
      requestId: req.requestId,
      userId: req.user?.sub || null,
      statusCode,
      err: err.message,
      stack: err.stack,
    },
    "Request failed"
  );

  return fail(res, message, statusCode, isAppError ? err.details : null);
}

module.exports = { errorMiddleware };
