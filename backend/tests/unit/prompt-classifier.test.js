const { classifyPrompt } = require("../../src/services/ai/prompt.classifier");

describe("prompt classifier", () => {
  test("classifies project prompts", () => {
    expect(classifyPrompt("build me a react project")).toBe("project");
  });

  test("classifies coding prompts", () => {
    expect(classifyPrompt("debug this javascript function")).toBe("coding");
  });

  test("classifies explanation prompts", () => {
    expect(classifyPrompt("explain this architecture")).toBe("explanation");
  });

  test("classifies casual prompts", () => {
    expect(classifyPrompt("hello")).toBe("casual");
  });
});
