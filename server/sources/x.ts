import { createXNewsClient } from "../utils/x-news"
import { defineSource } from "../utils/source"

const read = createXNewsClient()
export default defineSource({
  "x-tech": () => read("tech"),
  "x-world": () => read("world"),
  "x-security": () => read("security"),
})
