const { app, start } = require("./src/server");

if (require.main === module) {
  start().catch((error) => {
    console.error("Startup failed:", error.message);
    process.exit(1);
  });
}

module.exports = app;
