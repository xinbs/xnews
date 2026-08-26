import { createHash } from "node:crypto"
import type { NewsItem } from "@shared/types"
import { briefingSources } from "@shared/briefing-sources"
import type { CacheInfo } from "../types"
import { articlePreview, withBriefingPreview } from "./briefing-preview"
import { fetchBriefingArticle } from "./briefing-fetch"

export function createBriefingReader({ getCache, setCache, fetchArticle = fetchBriefingArticle, now = Date.now }: {
  getCache: (key: string) => Promise<CacheInfo | undefined>
  setCache: (key: string, items: NewsItem[]) => Promise<unknown>
  fetchArticle?: typeof fetchBriefingArticle
  now?: () => number
}) {
  const running = new Map<string, Promise<{ item: NewsItem, state: string }>>()
  return async (sourceId: string, itemId: string) => {
    const source = briefingSources.find(source => source.id === sourceId)
    if (!source || itemId.length > 2048) throw Object.assign(new Error("Unknown briefing source"), { statusCode: 400 })
    const cache = await getCache(sourceId)
    const raw = cache?.items.find(item => String(item.id) === itemId)
    if (!raw) throw Object.assign(new Error("Article is not in the source cache"), { statusCode: 404 })
    const item = withBriefingPreview(raw)
    if ((item.preview?.text.length || 0) >= 300 || !source.articleHosts.length) return { item, state: "source-preview" }
    const key = `briefing-preview:${createHash("sha256").update(JSON.stringify([sourceId, itemId, raw.url, cache?.updated])).digest("hex")}`
    const saved = await getCache(key)
    if (saved && now() - saved.updated < 24 * 3600_000) return { item: saved.items[0], state: "cached" }
    if (running.has(key)) return running.get(key)!
    if (running.size >= 2) return { item, state: "busy" }
    const task = (async () => {
      try {
        const preview = articlePreview(await fetchArticle(item.url, source.articleHosts), item.url)
        const enriched = { ...item, preview: { ...preview, summary: preview.summary || item.preview!.summary, imageUrl: preview.imageUrl || item.preview!.imageUrl, publishedAt: preview.publishedAt || item.preview!.publishedAt } }
        await setCache(key, [enriched])
        return { item: enriched, state: preview.text ? "enriched" : "partial" }
      } catch {
        // Negative cache prevents a blocked publisher being retried on every click.
        await setCache(key, [item])
        return { item, state: "unavailable" }
      }
    })().finally(() => running.delete(key))
    running.set(key, task)
    return task
  }
}
