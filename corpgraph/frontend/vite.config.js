import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
    },
  },
  build: {
    rollupOptions: { output: { manualChunks: { graph: ["cytoscape"] } } },
  },
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      include: ["src/App.tsx"],
      reporter: ["text", "json-summary"],
      thresholds: { lines: 100, functions: 100, statements: 97, branches: 87 },
    },
  },
});
