import { expect, it, vi } from "vitest"
import type { CacheInfo } from "../types"
import { createBriefingReader } from "./briefing-reader"

it("only enriches cached known-source articles and negative-caches upstream errors", async () => {
  const cache = new Map<string, CacheInfo>([["ithome", { id: "ithome", updated: 100, items: [{ id: "one", title: "一条新闻", url: "https://www.ithome.com/1" }] }]])
  const fetchArticle = vi.fn().mockRejectedValue(new Error("blocked"))
  const read = createBriefingReader({ getCache: async key => cache.get(key), setCache: async (key, items) => cache.set(key, { id: "ithome", updated: 100, items }), now: () => 100, fetchArticle })
  await expect(read("x", "one")).rejects.toThrow("Unknown")
  await expect(read("ithome", "https://127.0.0.1")).rejects.toThrow("not in")
  expect(fetchArticle).not.toHaveBeenCalled()
  expect((await read("ithome", "one")).state).toBe("unavailable")
  expect((await read("ithome", "one")).state).toBe("cached")
  expect(fetchArticle).toHaveBeenCalledTimes(1)
})

it("reuses a concurrent request and retains source publication time", async () => {
  let finish!: (html: string) => void
  const fetchArticle = vi.fn(() => new Promise<string>((resolve) => {
    finish = resolve
  }))
  const raw = { id: "one", title: "新闻", url: "https://www.ithome.com/1", pubDate: 100 }
  const read = createBriefingReader({ getCache: async key => key === "ithome" ? { id: "ithome", updated: 100, items: [raw] } : undefined, setCache: async () => {}, fetchArticle })
  const first = read("ithome", "one")
  const second = read("ithome", "one")
  await vi.waitFor(() => expect(fetchArticle).toHaveBeenCalledTimes(1))
  finish("<article><p>正文</p></article>")
  expect(await first).toEqual(await second)
  expect((await first).item.preview?.publishedAt).toBe(new Date(100).toISOString())
})

it("resolves known cached Google News stories only to the configured publisher, not generic Google metadata", async () => {
  const cache = new Map<string, CacheInfo>([["reuters", { id: "reuters", updated: 100, items: [{ id: "one", title: "Renewable energy news", url: "https://news.google.com/rss/articles/opaque" }] }]])
  const fetchArticle = vi.fn(async (url: string) => url.includes("news.google.com") ? "<meta property=\"og:description\" content=\"Google News\"><a href=\"https://www.reuters.com/world/article\">Original story</a>" : "<meta property=\"og:description\" content=\"Public Reuters preview\">")
  const read = createBriefingReader({ getCache: async key => cache.get(key), setCache: async (key, items) => cache.set(key, { id: "reuters", updated: 100, items }), now: () => 100, fetchArticle })
  const result = await read("reuters", "one")
  expect(result.item.preview?.summary).toBe("Public Reuters preview")
  expect(result.item.preview?.url).toBe("https://www.reuters.com/world/article")
  cache.get("reuters")!.updated = 200 // A source refresh must not defeat article/negative caching.
  await read("reuters", "one")
  expect(fetchArticle).toHaveBeenCalledTimes(2)
})

it("does not follow arbitrary or private related links; marks inaccessible preview without inventing content", async () => {
  const raw = { id: "one", title: "A headline", url: "https://news.google.com/rss/articles/opaque" }
  const fetchArticle = vi.fn(async () => "<meta property=\"og:description\" content=\"Google News\"><a href=\"http://127.0.0.1/secret\">article</a>")
  const read = createBriefingReader({ getCache: async key => key === "reuters" ? { id: "reuters", updated: 100, items: [raw] } : undefined, setCache: vi.fn(), fetchArticle })
  const result = await read("reuters", "one")
  expect(result.state).toBe("unavailable")
  expect(result.item.preview?.summary).toBe("")
  expect(fetchArticle).toHaveBeenCalledTimes(1)
})
