import { describe, expect, it } from "vitest"
import { createRetailSampler, extractRetailJson, retailCandidates, retailPost, validRetailCode } from "./retail-sampler"

const time = Date.parse("2026-09-03T03:00:00Z")
const row = (id = 123456, author = "a") => ({ post_id: id, user_id: author, post_type: 0, post_top_status: 0, stockbar_code: "000001", post_publish_time: "2026-09-03 10:00:00" })
const list = (rows = [row()]) => `var article_list=${JSON.stringify({ bar_code: "000001", re: rows })}; var unrelated={evil:true};`
const body = (r = row(), text = "上涨有点快了，我先减仓等待回落") => `var post_article=${JSON.stringify({ post_id: r.post_id, post_user: { user_id: r.user_id, user_nickname: "PRIVATE", post_ip: "PRIVATE" }, post_publish_time: r.post_publish_time, post_title: text, post_content: `<p>${text}</p>` })};`
function harness() {
  let now = time
  let fail = false
  let calls = 0
  const cache = new Map<string, any>()
  const sample = createRetailSampler({ getCache: async key => cache.get(key), setCache: async (key, items) => {
    cache.set(key, { updated: now, items })
  }, now: () => now, fetchArticle: async (url) => {
    calls++
    if (fail) throw new Error("upstream down")
    return url.includes("list,") ? list() : body()
  } })
  return { sample, cache, calls: () => calls, advance: () => {
    now += 3600001
  }, fail: () => {
    fail = true
  } }
}
describe("bounded public retail sampling", () => {
  it("parses balanced JSON without executing scripts; challenges and truncation fail closed", () => {
    expect(extractRetailJson("var article_list={\"re\":[{\"text\":\"}\\\"{\"}]};evil()", "article_list").re).toHaveLength(1)
    expect(() => extractRetailJson("login required", "article_list")).toThrow()
    expect(() => extractRetailJson("var article_list={", "article_list")).toThrow()
    expect(validRetailCode("000001")).toBe(true)
    expect(validRetailCode("https://127.0.0.1")).toBe(false)
  })
  it("filters news, pins, other stocks, future/old times and caps each author", () => {
    const rows = [row(), row(123457), row(123458), { ...row(123459), post_type: 1 }, { ...row(123460), post_top_status: 1 }, { ...row(123461), stockbar_code: "600000" }, { ...row(123462), post_publish_time: "2026-09-04 10:00:00" }]
    expect(retailCandidates(list(rows), "000001", time).selected).toHaveLength(2)
    expect(() => retailCandidates(list(), "600000", time)).toThrow()
  })
  it("validates body identity, strips HTML/profile and records Shanghai time and truncation", () => {
    const post = retailPost(body(), row(), "000001")
    expect(post.publishedAt).toBe("2026-09-03T02:00:00.000Z")
    expect(post.text).not.toContain("<p>")
    expect(JSON.stringify(post)).not.toContain("PRIVATE")
    expect(post.authorHash).toHaveLength(64)
    expect(() => retailPost(body(row(999999)), row(), "000001")).toThrow()
    expect(retailPost(body(row(), "说明".repeat(800)), row(), "000001").truncated).toBe(true)
  })
  it("persists and reuses cached bodies; failures preserve old timestamps with a negative cache", async () => {
    const h = harness()
    const first = await h.sample("000001")
    expect(first.posts).toHaveLength(1)
    expect((await h.sample("000001")).state).toBe("cached")
    expect(h.calls()).toBe(2)
    h.advance()
    h.fail()
    const failed = await h.sample("000001")
    expect(failed.state).toBe("error")
    expect(failed.fetchedAt).toBe(first.fetchedAt)
    expect(failed.posts).toEqual(first.posts)
    await h.sample("000001")
    expect(h.calls()).toBe(3)
  })
  it("single-flights callers, honors persisted hourly budget and rejects arbitrary input", async () => {
    const h = harness()
    const [a, b] = await Promise.all([h.sample("000001"), h.sample("000001")])
    expect(a.posts).toEqual(b.posts)
    expect(h.calls()).toBe(2)
    await expect(h.sample("127.0.0.1")).rejects.toThrow()
    const sample = createRetailSampler({ getCache: async () => ({ items: [{ budget: { hour: Math.floor(time / 3600000), used: 160 } }] }) as any, setCache: async () => {}, now: () => time, fetchArticle: async () => {
      throw new Error("must not fetch")
    } })
    expect((await sample("000001")).state).toBe("error")
  })
})
