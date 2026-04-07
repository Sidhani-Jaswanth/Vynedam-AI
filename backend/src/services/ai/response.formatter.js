function formatAiResponse({ text, type, project = null }) {
  if (type === "project" && project) {
    return {
      type: "project",
      title: project.title,
      files: project.files,
      previewUrl: project.previewUrl || null,
      downloadUrl: project.downloadUrl || null,
      text,
    };
  }

  return {
    type,
    text,
  };
}

module.exports = { formatAiResponse };
