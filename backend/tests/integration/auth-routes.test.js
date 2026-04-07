process.env.NODE_ENV = "test";
process.env.USE_DB = "false";
process.env.AI_SANDBOX_MODE = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

const request = require("supertest");
const app = require("../../app");

describe("auth route validation", () => {
  test("POST /api/auth/refresh requires refreshToken", async () => {
    const response = await request(app).post("/api/auth/refresh").send({});
    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.any(String),
      })
    );
  });
});
