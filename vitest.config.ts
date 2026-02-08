import { fileURLToPath } from "node:url"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"

const rootDir = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "~": rootDir,
      "@": rootDir
    }
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: [
      "tests/components/**/*.test.ts",
      "tests/store/**/*.test.ts",
      "tests/composables/**/*.test.ts"
    ]
  }
})
