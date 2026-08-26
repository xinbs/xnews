import { Buffer } from "node:buffer"
import { EventEmitter } from "node:events"
import { lookup } from "node:dns/promises"
import { request } from "node:https"
import { describe, expect, it, vi } from "vitest"
import { briefingSources } from "@shared/briefing-sources"
import solidot from "../sources/solidot"
import freebuf from "../sources/freebuf"
import hackernews from "../sources/hackernews"
import { articlePreview, feedPreview, sourceFreshness } from "./briefing-preview"
import { assertArticleUrl, fetchBriefingArticle, isPublicIPv4 } from "./briefing-fetch"
import { myFetch } from "./fetch"

vi.mock("./fetch", () => ({ myFetch: vi.fn() }))
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }))
vi.mock("node:https", () => ({ request: vi.fn() }))

function mockArticleResponse(statusCode: number, headers: Record<string, string>, body = "", hang = false) {
  vi.mocked(request).mockImplementation(((_url: unknown, _options: unknown, receive: (response: unknown) => void) => {
    const req = Object.assign(new EventEmitter(), {
      destroy(error: Error) {
        req.emit("error", error)
        req.emit("close")
      },
      end() {
        const res = Object.assign(new EventEmitter(), { statusCode, headers, resume() {
          req.emit("close")
        }, destroy() {
          req.emit("close")
        } })
        receive(res)
        if (!hang) {
          res.emit("data", Buffer.from(body))
          res.emit("end")
          req.emit("close")
        }
      },
    })
    return req
  }) as typeof request)
}

describe("briefing preview contract", () => {
  it("pins a public DNS answer and rejects private DNS or a foreign redirect", async () => {
    vi.mocked(request).mockClear()
    vi.mocked(lookup).mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never)
    await expect(fetchBriefingArticle("https://www.ithome.com/a", ["ithome.com"])).rejects.toThrow("Non-public")
    expect(request).not.toHaveBeenCalled()
    vi.mocked(lookup).mockResolvedValue([{ address: "8.8.8.8", family: 4 }] as never)
    mockArticleResponse(200, { "content-type": "text/html" }, "<article>公开正文</article>")
    expect(await fetchBriefingArticle("https://www.ithome.com/a", ["ithome.com"])).toContain("公开正文")
    const options = vi.mocked(request).mock.calls[0][1] as { family: number, lookup: (host: string, options: object, callback: (...args: unknown[]) => void) => void }
    const pinned = vi.fn()
    options.lookup("www.ithome.com", {}, pinned)
    expect(options.family).toBe(4)
    expect(pinned).toHaveBeenCalledWith(null, "8.8.8.8", 4)
    mockArticleResponse(302, { location: "https://internal.invalid/private" })
    await expect(fetchBriefingArticle("https://www.ithome.com/a", ["ithome.com"])).rejects.toThrow("not allowed")
  })
  it("bounds redirect depth, response bytes and total request time", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "8.8.8.8", family: 4 }] as never)
    mockArticleResponse(302, { location: "/next" })
    await expect(fetchBriefingArticle("https://www.ithome.com/a", ["ithome.com"])).rejects.toThrow("Too many")
    mockArticleResponse(200, { "content-type": "text/html" }, "a".repeat(1_000_001))
    await expect(fetchBriefingArticle("https://www.ithome.com/a", ["ithome.com"])).rejects.toThrow("too large")
    vi.useFakeTimers()
    try {
      mockArticleResponse(200, { "content-type": "text/html" }, "", true)
      const stalled = expect(fetchBriefingArticle("https://www.ithome.com/a", ["ithome.com"])).rejects.toThrow("timeout")
      await vi.advanceTimersByTimeAsync(8001)
      await stalled
    } finally {
      vi.useRealTimers()
    }
  })
  it("retains Solidot listing paragraphs while preserving the existing title and date", async () => {
    vi.mocked(myFetch).mockResolvedValueOnce("<div class=\"block_m\"><div class=\"bg_htit\"><a href=\"/story?sid=42\">开源技术更新</a></div><div class=\"talk_time\">发表于2026年08月26日 10时30分</div><div class=\"p_mainnew\"><p>有用的正文片段</p><script>bad()</script></div></div>")
    const [item] = await solidot()
    expect(item).toMatchObject({ id: "/story?sid=42", title: "开源技术更新", preview: { text: "有用的正文片段" } })
    expect(item.pubDate).toBe("2026-08-26 10:30")
    expect(item.preview?.publishedAt).toBe("2026-08-26T02:30:00.000Z")
    expect(JSON.stringify(item.preview)).not.toContain("bad")
  })
  it("preserves HN discussion links and only adds public HTTPS article candidates", async () => {
    vi.mocked(myFetch).mockResolvedValueOnce("<table><tr class=\"athing\" id=\"42\"><td class=\"titleline\"><a href=\"https://openai.com/news/example\">AI research</a></td></tr><tr class=\"athing\" id=\"43\"><td class=\"titleline\"><a href=\"javascript:bad()\">Unsafe link</a></td></tr></table>")
    const items = await hackernews()
    expect(items[0]).toMatchObject({ id: "42", title: "AI research", url: "https://news.ycombinator.com/item?id=42", relatedUrls: ["https://openai.com/news/example"] })
    expect(items[1].relatedUrls).toEqual([])
    vi.mocked(myFetch).mockReset()
  })
  it("preserves FreeBuf summary, author and image when RSSHub has no articles", async () => {
    vi.mocked(myFetch).mockImplementation(async (url: unknown) => String(url).startsWith("https://rsshub.") ? { items: [] } : "<div class=\"article-item\"><div class=\"title-left\"><a href=\"/articles/web/123.html\"><span class=\"title\">漏洞修复说明</span></a></div><div class=\"item-right\"><div class=\"text-line-2\">修复版本与影响范围</div></div><div class=\"item-bottom\"><a href=\"/author/a\"><span>研究团队</span></a><span>今天</span></div><div class=\"img-view\"><img src=\"https://image.freebuf.com/cover.png\"></div></div>")
    const [item] = await freebuf()
    expect(item).toMatchObject({ id: "123", title: "漏洞修复说明", preview: { summary: "修复版本与影响范围", author: "研究团队", imageUrl: "https://image.freebuf.com/cover.png" } })
    expect(item.preview?.publishedAt).toBeNull()
    expect(item.extra?.hover).toBe("修复版本与影响范围")
    vi.mocked(myFetch).mockReset()
  })
  it("keeps useful RSS text and an actual image, without executable HTML", () => {
    const preview = feedPreview({ description: "<p>真实摘要</p><script>steal()</script>", content: "<p>正文内容</p><img src=\"/cover.jpg\" onerror=\"steal()\">", link: "https://www.ithome.com/a/1" })
    expect(preview.summary).toBe("真实摘要")
    expect(preview.text).toBe("正文内容")
    expect(preview.imageUrl).toBe("https://www.ithome.com/cover.jpg")
    expect(JSON.stringify(preview)).not.toContain("steal")
  })
  it("keeps missing publication time unknown and rejects script images", () => {
    const preview = feedPreview({ link: "https://example.com", description: "短摘要", image: "javascript:alert(1)", created: "not a date" })
    expect(preview.publishedAt).toBeNull()
    expect(preview.imageUrl).toBeNull()
    expect(briefingSources.find(source => source.id === "zaobao")?.publisher).toBe("早晨报（早报聚合）")
  })
  it("extracts public article paragraphs without navigation or scripts", () => {
    const preview = articlePreview("<nav>导航</nav><article><p>新闻正文。</p><script>bad()</script><p>第二段。</p></article><meta property=\"og:image\" content=\"/photo.jpg\">", "https://www.ithome.com/1")
    expect(preview.text).toBe("新闻正文。\n\n第二段。")
    expect(preview.imageUrl).toBe("https://www.ithome.com/photo.jpg")
    expect(articlePreview("<body>登录后阅读</body>", "https://www.ithome.com/1").text).toBe("")
  })
  it("exposes the cache timestamp and source failure without rewriting legacy updatedTime", () => {
    expect(sourceFreshness(100, 900, "cached")).toEqual({ fetchedAt: 100, checkedAt: 900, state: "cached" })
    expect(sourceFreshness(100, 900, "error")).toMatchObject({ fetchedAt: 100, state: "error" })
  })
  it("rejects arbitrary hosts, credentials, ports and non-public addresses", () => {
    for (const url of ["http://127.0.0.1/a", "https://www.ithome.com.evil.test/a", "https://u:p@www.ithome.com/a", "https://www.ithome.com:444/a"]) expect(() => assertArticleUrl(url, ["ithome.com"])).toThrow()
    for (const ip of ["127.0.0.1", "10.1.1.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.1.1", "0.0.0.0", "224.0.0.1", "192.0.2.1", "::1"]) expect(isPublicIPv4(ip)).toBe(false)
    expect(isPublicIPv4("8.8.8.8")).toBe(true)
    expect(assertArticleUrl("https://www.ithome.com/1", ["ithome.com"]).hostname).toBe("www.ithome.com")
  })
})

it("uses public structured descriptions but never extracts paywalled articleBody", () => {
  const preview = articlePreview("<script type=\"application/ld+json\">{\"@type\":\"NewsArticle\",\"description\":\"A public article description\",\"articleBody\":\"Paid full body\",\"isAccessibleForFree\":false,\"image\":{\"url\":\"https://images.example.org/a.jpg\"}}</script>", "https://www.reuters.com/world/a")
  expect(preview.summary).toBe("A public article description")
  expect(preview.text).toBe("")
  expect(preview.imageUrl).toBe("https://images.example.org/a.jpg")
})

it("extracts free article schema and ignores malformed structured blocks", () => {
  const preview = articlePreview("<script type=\"application/ld+json\">{bad}</script><script type=\"application/ld+json\">{\"@graph\":[{\"@type\":\"NewsArticle\",\"description\":\"Summary\",\"articleBody\":\"<p>Public body</p>\",\"isAccessibleForFree\":true}]}</script>", "https://www.reuters.com/world/a")
  expect(preview.summary).toBe("Summary")
  expect(preview.text).toBe("Public body")
})
