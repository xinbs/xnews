import { afterEach, describe, expect, it, vi } from "vitest"
import { getBriefingSourceCatalog } from "../api/s/briefing/sources"
import { createXNewsClient, normalizeXPosts } from "./x-news"
import { createBriefingReader } from "./briefing-reader"

const now = Date.parse("2026-08-26T12:00:00Z")
const post = { id: "2092300846675505602", text: "发布新模型\n\n公开模型说明与测试数据。", createdAt: "Wed Aug 26 11:00:00 +0000 2026", user: { screenName: "OpenAI", protected: false }, url: "https://x.com/OpenAI/status/2092300846675505602", media: { images: ["http://127.0.0.1/a", "https://pbs.twimg.com/media/example.jpg"] } }
const envelope = (data: unknown[] = [post]) => ({ success: true, data })
const response = (data: unknown = envelope()) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } })
const env = { X_NEWS_ENABLED: "true", X_KIT_API_BASE_URL: "http://x-kit.test:3000" }
afterEach(() => vi.unstubAllEnvs())
describe("x discovery contract", () => {
  it("retains body, publication time, safe media and publisher provenance without private profile data", () => {
    const [item] = normalizeXPosts(envelope(), "tech", now)
    expect(item).toMatchObject({ id: post.id, title: "发布新模型", publisher: "OpenAI", pubDate: "2026-08-26T11:00:00.000Z", url: post.url, preview: { text: post.text, author: "@OpenAI", imageUrl: "https://pbs.twimg.com/media/example.jpg" } })
    expect(item).not.toHaveProperty("user")
    expect(item).not.toHaveProperty("stats")
    const wire = normalizeXPosts(envelope([{ ...post, text: "War drives renewable energy demand", user: { screenName: "Reuters", protected: false }, url: post.url.replace("OpenAI", "Reuters") }]), "world", now)
    expect(wire[0].publisher).toBe("Reuters")
  })
  it("accepts independent authors but excludes unknown/protected audiences, quotes, replies and stale posts", () => {
    const broad = { ...post, user: { screenName: "indie_research", protected: false }, url: post.url.replace("OpenAI", "indie_research") }
    expect(normalizeXPosts(envelope([broad, broad]), "tech", now)).toHaveLength(1)
    for (const patch of [{ user: { screenName: "indie_research" } }, { user: { screenName: "indie_research", protected: true } }, { restrictedAudience: true }, { isReply: true }, { inReplyToStatusId: "123" }, { isRetweet: true }, { isQuote: true }, { possiblySensitive: true }, { createdAt: "2026-08-23T12:00:00Z" }])
      expect(normalizeXPosts(envelope([{ ...broad, ...patch }]), "tech", now)).toEqual([])
  })
  it("filters actual content and promotion, not search matching or popularity", () => {
    for (const text of ["AI agent airdrop: claim free tokens!", "今晚足球比赛", "Fear of emotional vulnerability"])
      expect(normalizeXPosts(envelope([{ ...post, text }]), "security", now)).toEqual([])
    expect(normalizeXPosts(envelope([{ ...post, text: "Remote code execution fixed in CVE-2026-12345. See advisory." }]), "security", now)).toHaveLength(1)
    expect(normalizeXPosts(envelope([{ ...post, text: "<b>开源模型正文</b><script>bad()</script>" }]), "tech", now)[0].preview?.text).toBe("开源模型正文")
  })
  it("rejects malformed payloads, unknown/future dates, unsafe IDs and mismatched canonical links", () => {
    for (const body of [{}, { success: false, data: [] }, { success: true, data: {} }, envelope([null]), envelope([{}])])
      expect(() => normalizeXPosts(body, "tech", now)).toThrow(/X_KIT_INVALID/)
    for (const patch of [{ createdAt: "2026-08-26 11:00:00" }, { createdAt: "invalidZ" }, { createdAt: "2027-08-26T00:00:00Z" }, { id: Number("2092300846675505602") }, { url: "http://127.0.0.1/secret" }])
      expect(() => normalizeXPosts(envelope([{ ...post, ...patch }]), "tech", now)).toThrow(/X_KIT_INVALID/)
    expect(() => normalizeXPosts(envelope([{ ...post, text: "<script>bad()</script>" }]), "tech", now)).toThrow("X_KIT_EMPTY_POST")
    expect(normalizeXPosts(envelope([]), "tech", now)).toEqual([])
  })
  it("shares one timeline and six topic searches, with no cookies, pagination, arbitrary URL or account gate", async () => {
    let active = 0
    let maxActive = 0
    const fetchImpl = vi.fn(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise(resolve => setTimeout(resolve, 1))
      active--
      return response(envelope([]))
    })
    const read = createXNewsClient({ env, fetchImpl, now: () => now })
    await Promise.all([read("tech"), read("world"), read("security")])
    const calls = fetchImpl.mock.calls as unknown as [
      URL,
      RequestInit,
    ][]
    expect(calls).toHaveLength(7)
    expect(maxActive).toBe(2)
    expect(calls.filter(([url]) => url.pathname === "/api/timeline")).toHaveLength(1)
    expect(calls.filter(([url]) => url.searchParams.get("sort") === "top")).toHaveLength(3)
    for (const [url, options] of calls) {
      expect(options.headers).toBeUndefined()
      expect(options.redirect).toBe("error")
      expect(options.signal).toBeInstanceOf(AbortSignal)
      expect(url.searchParams.get("cursor")).toBeNull()
      if (url.pathname === "/api/search") {
        expect(url.searchParams.get("q")).toContain("since:2026-08-24")
        expect(url.searchParams.get("q")).not.toContain("from:")
      }
    }
  })
  it("single-flights manual requests, reuses fetched timestamps and valid empty caches", async () => {
    const fetchImpl = vi.fn(async () => response())
    const read = createXNewsClient({ env, fetchImpl, now: () => now })
    const [a, b] = await Promise.all([read("tech"), read("tech")])
    expect(a).toEqual(b)
    expect(a[0].discovery).toEqual({ channels: ["following", "latest", "top"], fetchedAt: now, public: true })
    await read("world")
    await read("world")
    expect(fetchImpl).toHaveBeenCalledTimes(5)
  })
  it("does not label a partially failed or malformed collection as empty or healthy", async () => {
    const fetchImpl = vi.fn(async (url: URL | string | Request) => String(url).includes("sort=top") ? new Response("private upstream details", { status: 500 }) : response())
    const read = createXNewsClient({ env, fetchImpl: fetchImpl as typeof fetch, now: () => now })
    await expect(read("tech")).rejects.toThrow("X_KIT_HTTP_500")
    await expect(read("tech")).rejects.toThrow("X_KIT_HTTP_500")
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
  it("honors 429 across categories and does not replay queued requests", async () => {
    let time = now
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ retryAfter: 1200, error: "secret" }), { status: 429 }))
    const read = createXNewsClient({ env, fetchImpl, now: () => time })
    await expect(read("tech")).rejects.toThrow("X_KIT_RATE_LIMITED")
    const count = fetchImpl.mock.calls.length
    expect(count).toBeLessThanOrEqual(2)
    time += 10 * 60000
    await expect(read("world")).rejects.toThrow("X_KIT_RATE_LIMITED")
    expect(fetchImpl).toHaveBeenCalledTimes(count)
  })
  it("bounds responses and redacts transport and JSON errors", async () => {
    for (const fetchImpl of [vi.fn(async () => new Response("x", { headers: { "content-length": "512001" } })), vi.fn(async () => new Response("x".repeat(512001)))])
      await expect(createXNewsClient({ env, fetchImpl })("tech")).rejects.toThrow("X_KIT_RESPONSE_TOO_LARGE")
    for (const fetchImpl of [vi.fn().mockRejectedValue(new Error("cookie=secret; http://private")), vi.fn(async () => new Response("cookie=secret"))])
      await expect(createXNewsClient({ env, fetchImpl })("tech")).rejects.toThrow(/^X_KIT_UNAVAILABLE$/)
  })
  it("has a global request budget even after repeated source failures", async () => {
    let time = now
    const fetchImpl = vi.fn(async () => new Response("error", { status: 500 }))
    const read = createXNewsClient({ env, fetchImpl, now: () => time })
    for (let i = 0; i < 5; i++) {
      await read("tech").catch(() => { })
      time += 61000
    }
    expect(fetchImpl).toHaveBeenCalledTimes(7)
  })
  it("rejects unknown profiles and unsafe configuration; disabled sources never fetch", async () => {
    const fetchImpl = vi.fn()
    for (const settings of [{}, { ...env, CF_PAGES: "1" }, { ...env, X_NEWS_ENABLED: "false" }])
      await expect(createXNewsClient({ env: settings, fetchImpl })("tech")).rejects.toThrow("X_NEWS_DISABLED")
    await expect(createXNewsClient({ env, fetchImpl })("__proto__" as never)).rejects.toThrow("X_NEWS_UNKNOWN_PROFILE")
    for (const base of ["file:///tmp/secret", "http://user:secret@host", "http://host/private?url=other"])
      await expect(createXNewsClient({ env: { ...env, X_KIT_API_BASE_URL: base }, fetchImpl })("tech")).rejects.toThrow(/X_KIT_/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it("serves cached X previews without arbitrary article fetches, and preserves source switches", async () => {
    const item = normalizeXPosts(envelope(), "tech", now)[0]
    const fetchArticle = vi.fn()
    const read = createBriefingReader({ getCache: async () => ({ id: "x-tech", updated: now, items: [item] }), setCache: vi.fn(), fetchArticle })
    expect((await read("x-tech", String(item.id))).item.preview?.text).toBe(post.text)
    expect(fetchArticle).not.toHaveBeenCalled()
    vi.stubEnv("X_NEWS_ENABLED", "false")
    expect(getBriefingSourceCatalog().sources.filter(s => s.id.startsWith("x-")).every(s => !s.enabled)).toBe(true)
    vi.stubEnv("X_NEWS_ENABLED", "true")
    vi.stubEnv("CF_PAGES", "")
    expect(getBriefingSourceCatalog().sources.filter(s => s.id.startsWith("x-")).map(s => [s.id, s.enabled])).toEqual([["x-tech", true], ["x-world", true], ["x-security", true]])
  })
})

it("keeps older Top discoveries alongside fresh timeline and Latest, with per-author limits", async () => {
  const fetchImpl = vi.fn(async (input: URL | string | Request) => {
    const url = new URL(String(input))
    const mode = url.pathname === "/api/timeline" ? 0 : url.searchParams.get("sort") === "latest" ? 1 : 2
    return response(envelope(Array.from({ length: 20 }, (_, i) => {
      const id = `2092300846675505${mode}${String(i).padStart(2, "0")}`
      const handle = `author${mode}_${i}`
      return { ...post, id, url: `https://x.com/${handle}/status/${id}`, user: { screenName: handle, protected: false }, createdAt: new Date(now - (mode + 1) * 3600000 - i * 1000).toISOString() }
    })))
  })
  const items = await createXNewsClient({ env, fetchImpl: fetchImpl as typeof fetch, now: () => now })("tech")
  expect(items).toHaveLength(24)
  for (const channel of ["following", "latest", "top"])
    expect(items.filter(item => item.discovery?.channels.includes(channel))).toHaveLength(8)
})

it("reports missing upstream privacy metadata as a contract failure, not no news", async () => {
  const fetchImpl = vi.fn(async () => response(envelope([{ ...post, user: { screenName: "OpenAI" } }])))
  await expect(createXNewsClient({ env, fetchImpl, now: () => now })("tech")).rejects.toThrow("X_KIT_PUBLIC_STATUS_UNAVAILABLE")
})
