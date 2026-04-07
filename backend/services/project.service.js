const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const logger = require("../config/logger");
const env = require("../config/env");

const PROJECTS_DIR = path.join(__dirname, "../", env.previewBasePath || "generated_projects");

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function sanitizeFilePath(filePath) {
  // Prevent path traversal
  const normalizedPath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");
  return normalizedPath;
}

async function createProject(files) {
  try {
    const projectId = uuidv4();
    const projectDir = path.join(PROJECTS_DIR, projectId);

    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    if (!files || !Array.isArray(files)) {
      throw new Error("Files must be an array");
    }

    files.forEach((file) => {
      if (!file.path || !file.content) return;
      const safePath = sanitizeFilePath(file.path);
      const fullPath = path.join(projectDir, safePath);
      
      // Prevent saving files outside of the project directory
      if (!fullPath.startsWith(projectDir)) {
        logger.warn({ path: file.path }, "Attempted path traversal");
        return;
      }

      ensureDirectoryExistence(fullPath);
      fs.writeFileSync(fullPath, file.content, "utf8");
    });

    logger.info({ projectId }, "Project created successfully");
    return { projectId, projectDir };
  } catch (error) {
    logger.error({ err: error.message }, "Failed to create project");
    throw error;
  }
}

async function getProjectDir(projectId) {
  // Validate projectId format
  if (!/^[0-9a-fA-F-]{36}$/.test(projectId)) {
    throw new Error("Invalid project ID format");
  }

  const projectDir = path.join(PROJECTS_DIR, projectId);
  if (!fs.existsSync(projectDir)) {
    throw new Error("Project not found");
  }
  return projectDir;
}

module.exports = {
  createProject,
  getProjectDir,
  PROJECTS_DIR
};
