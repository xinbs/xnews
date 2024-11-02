import { getCacheTable } from "#/database/cache"

export default defineEventHandler(async (event) => {
  try {
    const { sources } = await readBody(event)
    const cacheTable = await getCacheTable()
    if (sources && cacheTable) {
      const data = await cacheTable.getEntries(sources)
      return data
    }
  } catch {
    //
  }
})
