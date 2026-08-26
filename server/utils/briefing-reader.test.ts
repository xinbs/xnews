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
