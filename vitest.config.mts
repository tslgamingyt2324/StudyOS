import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Component/data-layer smoke tests. Unit tests for pure logic live in tests/*.test.ts
// and run with `npm test` (node:test); these run with `npm run test:ui`.
export default defineConfig({
  plugins: [react()],
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    include: ["tests-ui/**/*.test.tsx", "tests-ui/**/*.test.ts"],
    setupFiles: ["tests-ui/setup.ts"],
    testTimeout: 20000,
    pool: "forks",
  },
});
