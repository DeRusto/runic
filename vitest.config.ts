import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // agent worktrees live under .claude/ and hold copies of every test
    exclude: [...configDefaults.exclude, ".claude/**"],
    // throwaway values; each test worker gets its own in-memory database
    env: {
      JWT_SECRET: "test-secret",
      INVITE_CODE: "test-invite",
      DATABASE_PATH: ":memory:",
    },
  },
});
