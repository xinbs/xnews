import { createHash } from "node:crypto"
import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { briefingSources } from "@shared/briefing-sources"
import type { CacheInfo } from "../types"
import { articlePreview, withBriefingPreview } from "./briefing-preview"
import { assertArticleUrl, fetchBriefingArticle } from "./briefing-fetch"

export function createBriefingReader({ getCache, setCache, fetchArticle = fetchBriefingArticle, now = Date.now }: {
  getCache: (key: string) => Promise<CacheInfo | undefined>
  setCache: (key: string, items: NewsItem[]) => Promise<unknown>
  fetchArticle?: typeof fetchBriefingArticle
  now?: () => number
}) {
  const running = new Map<string, Promise<{
    item: NewsItem
    state: string
  }>>()
  return async (sourceId: string, itemId: string) => {
    const source = briefingSources.find(source => source.id === sourceId)
    if (!source || itemId.length > 2048)
      throw Object.assign(new Error("Unknown briefing source"), { statusCode: 400 })
    const cache = await getCache(sourceId)
    const raw = cache?.items.find(item => String(item.id) === itemId)
    if (!raw)
      throw Object.assign(new Error("Article is not in the source cache"), { statusCode: 404 })
    const item = withBriefingPreview(raw)
    if ((item.preview?.text.length || 0) >= 300 || !source.articleHosts.length)
      return { item, state: "source-preview" }
    const key = `briefing-preview:v2:${createHash("sha256").update(JSON.stringify([sourceId, itemId, raw.url])).digest("hex")}`
    const saved = await getCache(key)
    if (saved && now() - saved.updated < 24 * 3600000)
      return { item: saved.items[0], state: "cached" }
    if (running.has(key))
      return running.get(key)!
    if (running.size >= 2)
      return { item, state: "busy" }
    const task = (async () => {
      try {
        const candidates = [item.url, ...(item.relatedUrls || [])].filter((url) => {
          try {
            assertArticleUrl(url, source.articleHosts)
            return true
          } catch {
            return false
          }
        })
        if (!candidates.length)
          return { item, state: "source-preview" }
        let url = candidates[0]
        let html = await fetchArticle(url, source.articleHosts)
        if (new URL(url).hostname === "news.google.com") {
          // A Google News headline or consent page is not an article preview.
          // Follow only a visible link to this source's configured publisher.
          const $ = load(html)
          const hosts = source.articleHosts.filter(host => host !== "news.google.com")
          const links = [$("link[rel='canonical']").attr("href"), $("meta[property='og:url']").attr("content"), ...$("a[href]").slice(0, 100).map((_i, el) => $(el).attr("href")).get()]
          const publisherUrl = links.find((link) => {
            try {
              return !!link && assertArticleUrl(link, hosts).pathname !== "/"
            } catch {
              return false
            }
          })
          if (!publisherUrl)
            throw new Error("Publisher article unavailable")
          url = publisherUrl
          html = await fetchArticle(url, hosts)
        }
        const preview = articlePreview(html, url)
        const enriched = { ...item, preview: { ...preview, summary: preview.summary || item.preview!.summary, text: preview.text || item.preview!.text, author: item.preview!.author || preview.author, imageUrl: preview.imageUrl || item.preview!.imageUrl, publishedAt: item.preview!.publishedAt || preview.publishedAt } }
        await setCache(key, [enriched])
        return { item: enriched, state: preview.text ? "enriched" : "partial" }
      } catch {
        // Negative cache prevents a blocked publisher being retried on every click.
        const unavailable = { ...item, preview: { ...item.preview!, status: "unavailable" as const } }
        await setCache(key, [unavailable])
        return { item: unavailable, state: "unavailable" }
      }
    })().finally(() => running.delete(key))
    running.set(key, task)
    return task
  }
}
