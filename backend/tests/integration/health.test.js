process.env.NODE_ENV = "test";
process.env.USE_DB = "false";
process.env.AI_SANDBOX_MODE = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

const request = require("supertest");
const app = require("../../app");

describe("health endpoints", () => {
  test("GET /health returns standard success envelope", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        message: expect.any(String),
        data: expect.any(Object),
        error: null,
      })
    );
  });

  test("GET /ready returns standard success envelope", async () => {
    const response = await request(app).get("/ready");
    expect([200, 503]).toContain(response.status);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: expect.any(Boolean),
        message: expect.any(String),
        data: expect.any(Object),
      })
    );
  });
});
