import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/vendor-shims.ts"],
      // Mirrors the retired root lib/**/*.js c8 gate (`--per-file --lines 75
      // --branches 60 --statements 75`) now scoped to src/lib/** following
      // the M1 in-process TypeScript port.
      thresholds: {
        perFile: true,
        lines: 75,
        branches: 60,
        statements: 75,
      },
    },
  },
});
