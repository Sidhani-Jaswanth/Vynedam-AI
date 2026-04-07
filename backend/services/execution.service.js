const { spawn } = require("child_process");
const portfinder = require("portfinder");
const kill = require("tree-kill");
const logger = require("../config/logger");
const path = require("path");

const runningProcesses = new Map(); // projectId -> { child, port }

async function startProcess(projectId, projectDir, installCommand, runCommand, language) {
  // If static HTML, no process needed
  if (language === "html" || language === "vanilla") {
    const backendPort = process.env.PORT || 3001;
    return `http://localhost:${backendPort}/preview/${projectId}/index.html`;
  }

  // Kill existing process for this project if any
  if (runningProcesses.has(projectId)) {
    const existing = runningProcesses.get(projectId);
    logger.info({ projectId }, "Killing existing process for project");
    await killProcess(existing.child.pid);
    runningProcesses.delete(projectId);
  }

  // Assign dynamic port
  const port = await portfinder.getPortPromise({ port: 30000, stopPort: 40000 });

  return new Promise((resolve, reject) => {
    logger.info({ projectId, installCommand, runCommand }, "Starting project execution");

    // Execute the install and run scripts.
    // In a production environment, this should be highly sandboxed. 
    // Here we use powershell/sh execution.
    const isWin = process.platform === "win32";
    const shell = isWin ? "powershell.exe" : "sh";
    const cOption = isWin ? "-Command" : "-c";

    let fullCommand = "";
    if (installCommand && runCommand) {
      fullCommand = `${installCommand} ; ${runCommand}`;
    } else if (runCommand) {
      fullCommand = runCommand;
    } else {
      reject(new Error("No runCommand specified"));
      return;
    }

    const env = { 
      ...process.env, 
      PORT: port.toString() // Inject port for framework to pick up
    };

    const child = spawn(shell, [cOption, fullCommand], {
      cwd: projectDir,
      env: env,
      stdio: "pipe",
    });

    runningProcesses.set(projectId, { child, port });

    child.stdout.on("data", (data) => {
      logger.info({ projectId, out: data.toString().trim() }, "Process STDOUT");
      
      // Attempt to resolve promise early if we see standard indicators of readiness
      const output = data.toString().toLowerCase();
      if (
        output.includes("listening on") || 
        output.includes("server is running") || 
        output.includes("http://localhost:") ||
        output.includes("started server on")
      ) {
        resolve(`http://localhost:${port}`);
      }
    });

    child.stderr.on("data", (data) => {
      logger.error({ projectId, err: data.toString().trim() }, "Process STDERR");
    });

    child.on("close", (code) => {
      logger.info({ projectId, code }, "Process exited");
      runningProcesses.delete(projectId);
      if (code !== 0) {
       // Only reject if it hasn't resolved yet
       // It's possible the server starts and crashes immediately, or just exits.
      }
    });

    child.on("error", (error) => {
      logger.error({ projectId, err: error.message }, "Process failed to start");
      reject(error);
    });

    // Fallback resolution after 5 seconds if no ready log format is detected
    setTimeout(() => {
       if (runningProcesses.has(projectId)) {
          resolve(`http://localhost:${port}`);
       }
    }, 5000);
  });
}

function killProcess(pid) {
  return new Promise((resolve, reject) => {
    kill(pid, "SIGKILL", (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = {
  startProcess,
  runningProcesses
};
