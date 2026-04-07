function ok(res, data = {}, message = "OK", status = 200) {
  const legacyFields = data && typeof data === "object" ? data : {};
  return res.status(status).json({
    success: true,
    message,
    data,
    error: null,
    ...legacyFields,
  });
}

function fail(res, message = "Request failed", status = 500, details = null) {
  return res.status(status).json({
    success: false,
    message,
    data: {},
    error: message,
    errorDetails: details,
  });
}

module.exports = { ok, fail };
