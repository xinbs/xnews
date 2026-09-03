import { describe, expect, it } from "vitest"
import { TGB_LIMITS, createTgbSampler, tgbCandidates, tgbThread, tgbTime, tgbUrl } from "./tgb-sampler"

const now = Date.parse("2026-09-03T06:00:00Z")
const list = `<title>forum</title><div class="todayItem"><a class="today_title" data-topicid="123456" href="/a/Abc12">半导体讨论</a><a class="today_name" href="/blog/123">不应保留昵称</a><span class="today_time">26-09-01 12:30</span><span class="today_pl"><span>3</span></span></div>`
const body = `<title>thread</title><h1>半导体讨论</h1><div class="tzitem_text">半导体需求增长，但需要等待财报确认。<script>evil()</script></div><div style="display:none">博主要求身份验证</div><div class="plItem"><a class="plName" href="/blog/124">不应保留昵称</a><p class="pl_time">26-09-02 12:30</p><div data-replyid="777777"></div><div class="pl_text">还没有买入，等回调再看。</div></div>`
describe("tGB public weekly collector", () => {
  it("validates real Shanghai dates, public paths and rejects access gates", () => {
    expect(tgbTime("26-09-01 12:30")).toBe(Date.parse("2026-09-01T04:30:00Z"))
    expect(Number.isNaN(tgbTime("26-02-31 12:30"))).toBe(true)
    expect(() => tgbUrl("https://127.0.0.1/a/abc")).toThrow()
    expect(() => tgbUrl("/a/abc?force=1")).toThrow()
    expect(() => tgbCandidates("<title>身份核实</title>", now)).toThrow()
    expect(() => tgbCandidates("<title>forum</title>", now)).toThrow()
  })
  it("separates post and reply clocks, hashes authors, strips scripts and bounds text", () => {
    const candidate = tgbCandidates(list, now)[0]
    const result = tgbThread(body, candidate, now)
    expect(result.posts.map(p => p.kind)).toEqual(["post", "reply"])
    expect(result.posts[0].publishedAt).toBe("2026-09-01T04:30:00.000Z")
    expect(result.posts[1].publishedAt).toBe("2026-09-02T04:30:00.000Z")
    expect(JSON.stringify(result)).not.toMatch(/evil|不应保留昵称/)
    expect(result.posts[0].authorHash).toHaveLength(64)
    expect(tgbThread(body.replace("半导体需求增长，但需要等待财报确认。", "长文本".repeat(500)), candidate, now).posts[0].truncated).toBe(true)
    expect(() => tgbThread(`${body}<a href="/a/Other-2?type=new">下一页</a>`, candidate, now)).toThrow()
    expect(() => tgbThread(`<meta property="og:release_date" content="26-09-02 12:30">${body}`, candidate, now)).toThrow(/clock mismatch/)
  })
  it("single-flights, persists cache/budget, retains original dates on source failure", async () => {
    const cache = new Map<string, any>()
    let calls = 0
    let clock = now
    let fail = false
    const options = { getCache: async (key: string) => cache.get(key), setCache: async (key: string, items: any) => {
      cache.set(key, { items })
    }, now: () => clock, limits: { ...TGB_LIMITS, listPages: 1, threadsPerDay: 1, intervalMs: 0 }, fetchArticle: async (url: string) => {
      calls++
      if (fail) throw new Error("SECRET")
      return url.includes("mIndex") ? list : body
    } }
    const sample = createTgbSampler(options)
    const [a, b] = await Promise.all([sample(), sample()])
    expect(a.posts).toHaveLength(2)
    expect(b).toEqual(a)
    expect(calls).toBe(2)
    expect((await createTgbSampler(options)()).state).toBe("cached")
    expect(calls).toBe(2)
    clock += 3600001
    fail = true
    const failed = await sample()
    expect(failed.state).toBe("error")
    expect(failed.fetchedAt).toBe(a.fetchedAt)
    expect(failed.posts).toEqual(a.posts)
    expect(JSON.stringify(failed)).not.toContain("SECRET")
    await sample()
    expect(calls).toBe(3)
  })
  it("honors a persisted exhausted budget without network and rejects future list posts", async () => {
    let calls = 0
    const result = await createTgbSampler({ getCache: async key => key.endsWith(":budget") ? { items: [{ tgb: { hour: Math.floor(now / 3600000), used: 120 } }] } as any : undefined, setCache: async () => {}, now: () => now, fetchArticle: async () => {
      calls++
      return list
    } })()
    expect(calls).toBe(0)
    expect(result.state).toBe("error")
    expect(tgbCandidates(list.replace("26-09-01", "26-09-04"), now)).toHaveLength(0)
  })
  it("retains valid newly fetched bodies and their clock when later pagination fails", async () => {
    const cache = new Map<string, any>()
    const sample = createTgbSampler({ getCache: async key => cache.get(key), setCache: async (key, items) => {
      cache.set(key, { items })
    }, now: () => now, limits: { ...TGB_LIMITS, listPages: 1, threadsPerDay: 1, intervalMs: 0 }, fetchArticle: async (url) => {
      if (url.includes("mIndex")) return list
      if (url.includes("-2")) throw new Error("access challenge")
      return `${body}<a href="/a/Abc12-2?type=new">下一页</a>`
    } })
    const result = await sample()
    expect(result.state).toBe("partial")
    expect(result.posts).toHaveLength(2)
    expect(result.fetchedAt).toBe(new Date(now).toISOString())
    expect(result.posts.every((p: any) => p.observedAt <= result.fetchedAt)).toBe(true)
    expect(result.coverage.complete).toBe(false)
  })
})
