import { getCacheTable } from "../../../database/cache"
import { createRetailSampler, validRetailCode } from "../../../utils/retail-sampler"

const sample = createRetailSampler({
  getCache: async key => (await getCacheTable())?.get(key),
  setCache: async (key, items) => {
    const cache = await getCacheTable()
    if (!cache) throw new Error("Sampling requires persistent cache")
    return cache.set(key, items)
  },
})

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  if (typeof query.code !== "string" || !validRetailCode(query.code) || Object.keys(query).some(key => key !== "code"))
    throw createError({ statusCode: 400, message: "Only a validated A-share code is accepted; arbitrary URLs and force refresh are forbidden" })
  return sample(query.code)
})
