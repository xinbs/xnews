import { getCacheTable } from "../../../database/cache"
import { createTgbSampler } from "../../../utils/tgb-sampler"

const sample = createTgbSampler({
  getCache: async key => (await getCacheTable())?.get(key),
  setCache: async (key, items) => {
    const cache = await getCacheTable()
    if (!cache) throw new Error("Sampling requires persistent cache")
    return cache.set(key, items)
  },
})
export default defineEventHandler(async (event) => {
  if (Object.keys(getQuery(event)).length) throw createError({ statusCode: 400, message: "No arbitrary URL, page, force or date parameters accepted" })
  return sample()
})
