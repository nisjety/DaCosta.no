const request = require("supertest");
const app = require("../src/app");

describe("API Endpoints", () => {
  it("should check a word", async () => {
    const res = await request(app)
      .post("/api/spell/check")
      .send({ word: "huss", context: "Jeg bor i et hus." });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("correct");
  });

  it("should add a new word", async () => {
    const res = await request(app)
      .post("/api/spell/add")
      .send({ word: "nyttord" });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("success", true);
  });
});
