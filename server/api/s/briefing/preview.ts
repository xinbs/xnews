import { getCacheTable } from "../../../database/cache"
import { createBriefingReader } from "../../../utils/briefing-reader"

const read = createBriefingReader({
  getCache: async key => (await getCacheTable())?.get(key),
  setCache: async (key, items) => (await getCacheTable())?.set(key, items),
})

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  if (typeof query.sourceId !== "string" || typeof query.itemId !== "string" || query.url !== undefined) throw createError({ statusCode: 400, message: "sourceId and itemId are required; arbitrary URLs are not accepted" })
  return read(query.sourceId, query.itemId)
})
