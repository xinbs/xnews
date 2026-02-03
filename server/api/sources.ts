import sources from "../../shared/sources.json"

export default defineEventHandler(() => {
  return Object.entries(sources).map(([id, source]) => ({
    id,
    ...source,
  }))
})
