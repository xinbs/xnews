import { ourongxing, react } from "@ourongxing/eslint-config"

export default ourongxing({
  type: "app",
  ignores: ["**/routeTree.gen.ts"],
}).append(react({
  files: ["src/**"],
}))
