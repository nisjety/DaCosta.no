module.exports = async () => {
  // Close Redis connection
  if (global.__redis__) {
    await global.__redis__.quit();
  }
}; 