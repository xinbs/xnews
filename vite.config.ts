import process from "node:process"
import { join } from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import unocss from "unocss/vite"
import dotenv from "dotenv"
import unimport from "unimport/unplugin"
import nitro from "./nitro.config"
import { projectDir } from "./shared/dir"
import pwa from "./pwa.config"

dotenv.config({
  path: join(projectDir, ".env.server"),
})

export default defineConfig({
  define: {
    __LOGIN_URL__: process.env.G_CLIENT_ID ? `"https://github.com/login/oauth/authorize?client_id=${process.env.G_CLIENT_ID}"` : `"/api/login"`,
  },
  build: {
    sourcemap: true,
    minify: false,
  },
  resolve: {
    alias: {
      "~": join(projectDir, "src"),
      "@shared": join(projectDir, "shared"),
    },
  },
  plugins: [
    TanStackRouterVite({
      // error with auto import and vite-plugin-pwa
      // autoCodeSplitting: true,
    }),
    unimport.vite({
      dirs: ["src/hooks", "shared", "src/utils", "src/atoms"],
      presets: ["react", {
        from: "jotai",
        imports: ["atom", "useAtom", "useAtomValue", "useSetAtom"],
      }],
      imports: [
        { from: "clsx", name: "default", as: "$" },
        { from: "jotai/utils", name: "atomWithStorage" },
      ],
      dts: "imports.app.d.ts",
    }),
    unocss(),
    react(),
    pwa(),
    nitro(),
  ],
})
