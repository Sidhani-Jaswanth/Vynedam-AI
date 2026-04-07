function sanitizeString(value) {
  return String(value)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/javascript:/gi, "");
}

function deepSanitize(input) {
  if (Array.isArray(input)) {
    return input.map(deepSanitize);
  }

  if (input && typeof input === "object") {
    return Object.keys(input).reduce((acc, key) => {
      acc[key] = deepSanitize(input[key]);
      return acc;
    }, {});
  }

  if (typeof input === "string") {
    return sanitizeString(input);
  }

  return input;
}

function xssProtection(req, _res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = deepSanitize(req.body);
  }

  if (req.query && typeof req.query === "object") {
    req.query = deepSanitize(req.query);
  }

  next();
}

module.exports = { xssProtection };
