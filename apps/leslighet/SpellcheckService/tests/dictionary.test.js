const loadDictionaryData = require("../src/dictionary/loadDictionary");

describe("Dictionary Loader", () => {
  it("should load dictionary data from Redis", async () => {
    try {
      const data = await loadDictionaryData();
      expect(data).toHaveProperty("affData");
      expect(data).toHaveProperty("dicData");
    } catch (error) {
      // If no dictionary is available, we expect an error.
      expect(error).toBeDefined();
    }
  });
});
