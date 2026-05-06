import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    globals: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname),
    },
  },
});
