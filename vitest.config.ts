import { join } from "node:path"
import { defineConfig } from "vitest/config"
import autoImport from "unplugin-auto-import/vite"
import { resolveModuleExportNames } from "mlly"
import { projectDir } from "./shared/dir"

const h3Exports = await resolveModuleExportNames("h3", {
  url: import.meta.url,
})

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/**/*.test.ts", "shared/**/*.test.ts", "test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@shared": join(projectDir, "shared"),
      "#": join(projectDir, "server"),
    },
  },
  plugins: [
    // https://github.com/unjs/nitro/blob/v2/src/core/config/resolvers/imports.ts
    autoImport({
      imports: [{
        from: "h3",
        imports: h3Exports.filter(n => !/^[A-Z]/.test(n) && n !== "use"),
      }],
      dirs: ["server/utils", "shared"],
      dts: false,
    }),
  ],
})
