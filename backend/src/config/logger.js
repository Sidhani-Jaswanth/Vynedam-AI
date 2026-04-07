const pino = require("pino");
const env = require("./env");

const logger = pino({
  level: env.isProduction ? "info" : "debug",
  base: undefined,
  transport: env.isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
});

module.exports = logger;
