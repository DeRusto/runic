import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // agent worktrees live under .claude/ and hold copies of every test
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});
