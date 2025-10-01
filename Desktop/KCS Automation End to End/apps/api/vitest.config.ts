import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    alias: {
      "@kcs/llm": "../../packages/llm/src",
      "@kcs/types": "../../packages/types/src",
      "@kcs/shared": "../../packages/shared/src"
    }
  }
});

