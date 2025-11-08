import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const indexPath = join(__dirname, "../../output/public/index.html")

// 让 /reader 走 SPA，返回 index.html，由前端 Router 渲染
export default defineEventHandler(async (event) => {
  const html = await readFile(indexPath, "utf-8")
  setHeader(event, "Content-Type", "text/html;charset=utf-8")
  return html
})
