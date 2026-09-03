import { createHash } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import type { CacheInfo } from "../types"
import { fetchBriefingArticle } from "./briefing-fetch"

const origin = "https://m.tgb.cn"
const key = "retail-tgb:v1"
const hash = (s: string) => createHash("sha256").update(s).digest("hex")
const day = (n: number) => new Date(n + 28800000).toISOString().slice(0, 10)
const start = (n: number) => Date.parse(`${day(n)}T00:00:00+08:00`) - 6 * 86400000
export const TGB_LIMITS = { requests: 120, listPages: 24, threadsPerDay: 8, storedPosts: 4200, returnedPerDay: 200, intervalMs: 1200 }
export interface TgbPost {
  id: string
  parentId: string
  kind: "post" | "reply"
  title: string
  text: string
  textHash: string
  authorHash: string
  url: string
  publishedAt: string
  observedAt: string
  truncated: boolean
}
interface Candidate {
  id: string
  path: string
  title: string
  authorHash: string
  publishedAt: string
  replies: number
  checkedAt?: string
}
export function tgbTime(s: string): number {
  if (!/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return Number.NaN
  const iso = `20${s.replace(" ", "T")}:00+08:00`
  const n = Date.parse(iso)
  return Number.isFinite(n) && new Date(n + 28800000).toISOString().slice(0, 16) === `20${s.replace(" ", "T")}` ? n : Number.NaN
}
export function tgbUrl(path: string): string {
  const u = new URL(path, origin)
  if (u.origin !== origin || u.username || u.password || u.hash || !/^\/a\/[a-zA-Z0-9]+(?:-\d{1,4})?$/.test(u.pathname) || [...u.searchParams].some(([k, v]) => k !== "type" || v !== "new")) throw new Error("Invalid public thread URL")
  return u.href
}
function document(html: string) {
  if (html.length > 1000000) throw new Error("Oversized public page")
  const $ = load(html)
  if (/身份核实|验证码|访问验证|登录/.test($("title").text())) throw new Error("Public access unavailable")
  $("script,style,iframe,[hidden],[style*='display:none'],[style*='display: none']").remove()
  return $
}
export function tgbCandidates(html: string, now: number): Candidate[] {
  const $ = document(html)
  if (!$(".todayItem").length) throw new Error("Public list missing")
  return $(".todayItem").map((_, el) => {
    const row = $(el)
    const a = row.find("a.today_title")
    const path = a.attr("href") || ""
    const id = a.attr("data-topicid") || ""
    const n = tgbTime(row.find(".today_time").text().trim())
    const author = row.find("a.today_name").attr("href") || ""
    if (!/^\d{1,20}$/.test(id) || !/^\/a\/[a-zA-Z0-9]+$/.test(path) || !/^\/blog\/\d+$/.test(author) || !Number.isFinite(n) || n > now) return null
    return { id, path, title: a.text().trim().slice(0, 120), authorHash: hash(`tgb:${author}`), publishedAt: new Date(n).toISOString(), replies: Math.max(0, Number(row.find(".today_pl span").text()) || 0) }
  }).get()
}
export function tgbThread(html: string, candidate: Candidate, now: number): { posts: TgbPost[], next: string | null } {
  const $ = document(html)
  const posts: TgbPost[] = []
  const stamp = new Date(now).toISOString()
  if (!$("h1").length) throw new Error("Public thread missing")
  const emit = (kind: "post" | "reply", id: string, authorHash: string, publishedAt: string, text: string) => {
    const n = Date.parse(publishedAt)
    text = text.replace(/\s+/g, " ").trim()
    if (!Number.isFinite(n) || n < start(now) || n > now || text.length < 6) return
    // Only excerpts needed for classification are stored; never expose profile fields.
    const excerpt = text.slice(0, 1200)
    posts.push({ id: `tgb:${kind === "post" ? "p" : "r"}:${id}`, parentId: `tgb:p:${candidate.id}`, kind, title: candidate.title, text: excerpt, textHash: hash(excerpt), authorHash, publishedAt, observedAt: stamp, url: tgbUrl(candidate.path), truncated: text.length > 1200 })
  }
  const published = tgbTime($("meta[property='og:release_date']").attr("content") || $(".Pagetime .left").first().text().trim())
  // The list is the source of the publication clock; never borrow the newest reply time.
  if (Number.isFinite(published) && new Date(published).toISOString() !== candidate.publishedAt) throw new Error("Thread clock mismatch")
  emit("post", candidate.id, candidate.authorHash, candidate.publishedAt, $(".tzitem_text").text())
  $(".plItem").each((_, el) => {
    const row = $(el)
    const id = row.find("[data-replyid]").attr("data-replyid") || ""
    const author = row.find("a.plName").attr("href") || ""
    const n = tgbTime(row.find(".pl_time").text().trim())
    if (/^\d{1,20}$/.test(id) && /^\/blog\/\d+$/.test(author) && Number.isFinite(n)) emit("reply", id, hash(`tgb:${author}`), new Date(n).toISOString(), row.find(".pl_text").text())
  })
  const href = $("a").filter((_, el) => $(el).text().trim() === "下一页").attr("href")
  const next = href ? tgbUrl(href) : null
  if (next && new URL(next).pathname.replace(/-\d+$/, "") !== candidate.path) throw new Error("Cross-thread pagination rejected")
  return { posts, next }
}

interface Saved {
  checkedAt: string
  fetchedAt: string | null
  state: string
  posts: TgbPost[]
  candidates: Candidate[]
  coverage: Record<string, unknown>
  error: string | null
}
const envelope = (data: unknown): NewsItem => ({ id: key, title: "Public discussion cache", url: origin, tgb: data } as NewsItem)
export function createTgbSampler({ getCache, setCache, fetchArticle = fetchBriefingArticle, now = Date.now, limits = TGB_LIMITS }: {
  getCache: (key: string) => Promise<CacheInfo | undefined>
  setCache: (key: string, rows: NewsItem[]) => Promise<unknown>
  fetchArticle?: typeof fetchBriefingArticle
  now?: () => number
  limits?: typeof TGB_LIMITS
}) {
  let running: Promise<any> | null = null
  const read = async (k: string) => (await getCache(k))?.items[0] as (NewsItem & { tgb?: any }) | undefined
  const publicResult = (saved: Saved) => {
    const byDay = new Map<string, number>()
    const posts = saved.posts.filter(p => Date.parse(p.publishedAt) >= start(now()) && Date.parse(p.publishedAt) <= now()).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id)).filter((p) => {
      const localDay = day(Date.parse(p.publishedAt))
      const count = byDay.get(localDay) || 0
      byDay.set(localDay, count + 1)
      return count < limits.returnedPerDay
    })
    return { version: 1, source: "tgb-public", fetchedAt: saved.fetchedAt, checkedAt: saved.checkedAt, state: saved.state, error: saved.error, posts, coverage: { ...saved.coverage, returned: posts.length, byDay: Object.fromEntries([...byDay].map(([d, n]) => [d, Math.min(n, limits.returnedPerDay)])), windowDays: 7, timezone: "Asia/Shanghai", bounded: true, complete: false } }
  }
  async function run() {
    const previous: Saved | undefined = (await read(key))?.tgb
    const elapsed = now() - Date.parse(previous?.checkedAt || "")
    if (previous && elapsed >= 0 && elapsed < 3600000) return publicResult({ ...previous, state: previous.state === "fresh" ? "cached" : previous.state })
    let saved: Saved = { checkedAt: new Date(now()).toISOString(), fetchedAt: previous?.fetchedAt || null, state: "empty", posts: previous?.posts || [], candidates: previous?.candidates || [], coverage: {}, error: null }
    const candidates = new Map(saved.candidates.filter(p => Date.parse(p.publishedAt) >= start(now())).map(p => [p.id, p]))
    const collected = new Map(saved.posts.filter(p => Date.parse(p.publishedAt) >= start(now())).map(p => [p.id, p]))
    const budgetKey = `${key}:budget`
    const hour = Math.floor(now() / 3600000)
    const oldBudget = (await read(budgetKey))?.tgb
    let used = oldBudget?.hour === hour ? Number(oldBudget.used) : 0
    let requests = 0
    let emptyBodies = 0
    let sourceFailed = false
    const fetchPage = async (url: string) => {
      if (!Number.isFinite(used) || used >= limits.requests) throw new Error("Sampling budget exhausted")
      used++
      requests++
      await setCache(budgetKey, [envelope({ hour, used })])
      await delay(limits.intervalMs)
      return fetchArticle(url, ["m.tgb.cn"])
    }
    try {
      const pages = new Map<number, Candidate[]>()
      const list = async (page: number) => {
        if (pages.has(page)) return
        const rows = tgbCandidates(await fetchPage(`${origin}/mIndex?blockID=1&flag=1&pageNo=${page}`), now())
        pages.set(page, rows)
        for (const row of rows) {
          if (Date.parse(row.publishedAt) >= start(now())) candidates.set(row.id, { ...row, checkedAt: candidates.get(row.id)?.checkedAt })
        }
      }
      // Discover dates from clocks, not hard-coded historical page numbers.
      for (const page of [1, 32, 128, 512, 1024, 2048]) {
        if (pages.size >= limits.listPages) break
        await list(page)
        if (pages.get(page)?.some(r => Date.parse(r.publishedAt) < start(now()))) break
      }
      while (pages.size < limits.listPages && used < limits.requests - 7) {
        const sorted = [...pages].sort((a, b) => a[0] - b[0])
        const gap = sorted.slice(1).map((entry, i) => ({ lo: sorted[i], hi: entry })).filter(({ lo, hi }) => hi[0] - lo[0] > 1 && lo[1][0] && hi[1][0] && day(Date.parse(lo[1][0].publishedAt)) !== day(Date.parse(hi[1][0].publishedAt)) && Date.parse(lo[1][0].publishedAt) >= start(now())).sort((a, b) => (b.hi[0] - b.lo[0]) - (a.hi[0] - a.lo[0]))[0]
        if (!gap) break
        await list(Math.floor((gap.lo[0] + gap.hi[0]) / 2))
      }
      const days = Array.from({ length: 7 }, (_, i) => day(start(now()) + i * 86400000))
      const groups = days.map(d => [...candidates.values()].filter(p => day(Date.parse(p.publishedAt)) === d).sort((a, b) => (a.checkedAt || "").localeCompare(b.checkedAt || "") || b.replies - a.replies || a.id.localeCompare(b.id)).slice(0, limits.threadsPerDay))
      for (let i = 0; i < limits.threadsPerDay && used < limits.requests; i++) {
        for (const group of groups) {
          const candidate = group[i]
          if (!candidate || used >= limits.requests) continue
          const parsed = tgbThread(await fetchPage(tgbUrl(`${candidate.path}?type=new`)), candidate, now())
          for (const post of parsed.posts) collected.set(post.id, post)
          if (parsed.posts.length) saved.fetchedAt = new Date(now()).toISOString()
          if (!parsed.posts.length) emptyBodies++
          candidate.checkedAt = new Date(now()).toISOString()
          // One extra public page only; no deep-page crawling or trust in reply totals.
          if (i < 2 && parsed.next && parsed.posts.some(p => p.kind === "reply") && used < limits.requests) {
            const extra = tgbThread(await fetchPage(parsed.next), candidate, now())
            for (const post of extra.posts) collected.set(post.id, post)
            if (extra.posts.length) saved.fetchedAt = new Date(now()).toISOString()
          }
        }
      }
    } catch {
      sourceFailed = true
      saved.error = "Public source unavailable, changed or budget exhausted; partial archive retained; no access bypass"
    }
    const posts = [...collected.values()].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)).slice(-limits.storedPosts)
    saved = { ...saved, state: sourceFailed ? (requests > 1 && posts.length ? "partial" : "error") : posts.length ? "fresh" : "empty", posts, candidates: [...candidates.values()].slice(-2000), coverage: { requests, emptyBodies, candidateCount: candidates.size, stored: posts.length, sourceFailed } }
    await setCache(key, [envelope(saved)])
    return publicResult(saved)
  }
  return () => {
    if (!running) {
      running = run().finally(() => {
        running = null
      })
    }
    return running
  }
}
