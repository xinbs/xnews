import { createHash } from "node:crypto"
import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import type { CacheInfo } from "../types"
import { fetchBriefingArticle } from "./briefing-fetch"

export const RETAIL_LIMITS = { ttlMs: 3600000, retryMs: 300000, windowMs: 86400000, posts: 10, authors: 2, concurrent: 2, requestsPerHour: 160 }
const hosts = ["guba.eastmoney.com"]
const hash = (s: string) => createHash("sha256").update(s).digest("hex")
export const validRetailCode = (code: string) => /^(?:00|30|60|68|43|83|87|92)\d{4}$/.test(code)

// Parse a JSON assignment, never execute scripts received from the publisher.
export function extractRetailJson(html: string, variable: "article_list" | "post_article"): any {
  if (html.length > 1000000) throw new Error("Oversized forum page")
  const match = new RegExp(`\\bvar\\s+${variable}\\s*=\\s*\\{`).exec(html)
  if (!match) throw new Error("Forum data unavailable (login, challenge or changed markup)")
  const start = match.index + match[0].lastIndexOf("{")
  let depth = 0
  let quoted = false
  let escaped = false
  for (let i = start; i < html.length; i++) {
    const c = html[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (c === "\\") escaped = true
      else if (c === "\"") quoted = false
    } else if (c === "\"") {
      quoted = true
    } else if (c === "{") {
      depth++
    } else if (c === "}" && --depth === 0) {
      return JSON.parse(html.slice(start, i + 1))
    }
  }
  throw new Error("Incomplete forum JSON")
}

function shanghaiTime(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return Number.NaN
  return Date.parse(`${value.replace(" ", "T")}+08:00`)
}
function plain(html: string) {
  const $ = load(html)
  $("script,style,iframe").remove()
  return $.root().text().replace(/\s+/g, " ").trim()
}
export interface RetailPost {
  id: string
  code: string
  title: string
  text: string
  url: string
  authorHash: string
  publishedAt: string
  textHash: string
  truncated: boolean
}
export interface RetailSample {
  version: 1
  source: "eastmoney-guba"
  code: string
  fetchedAt: string | null
  checkedAt: string
  state: "fresh" | "cached" | "partial" | "empty" | "error" | "busy"
  posts: RetailPost[]
  coverage: { windowHours: 24, listed: number, eligible: number, recent2h: number, selected: number, bodyFailures: number, oldestListedAt: string | null, newestListedAt: string | null, firstPageOnly: true, capped: boolean }
  error: string | null
}

export function retailCandidates(html: string, code: string, now: number) {
  const data = extractRetailJson(html, "article_list")
  if (!Array.isArray(data.re) || String(data.bar_code) !== code || data.re.length > 200) throw new Error("Invalid forum list contract")
  const seen = new Set<string>()
  const authors = new Map<string, number>()
  const eligible = data.re.filter((row: any) => {
    const time = shanghaiTime(row.post_publish_time)
    const id = String(row.post_id)
    const author = String(row.user_id || "")
    if (row.post_type !== 0 || Number(row.post_top_status) !== 0 || String(row.stockbar_code) !== code || !/^\d{5,20}$/.test(id) || !author || !Number.isFinite(time) || time > now || now - time > RETAIL_LIMITS.windowMs || seen.has(id)) return false
    seen.add(id)
    return true
  }).sort((a: any, b: any) => shanghaiTime(b.post_publish_time) - shanghaiTime(a.post_publish_time))
  const selected = eligible.filter((row: any) => {
    const author = hash(`eastmoney:${row.user_id}`)
    const count = authors.get(author) || 0
    authors.set(author, count + 1)
    return count < RETAIL_LIMITS.authors
  }).slice(0, RETAIL_LIMITS.posts)
  return { selected, eligible, listed: data.re.length }
}

export function retailPost(html: string, row: any, code: string): RetailPost {
  const data = extractRetailJson(html, "post_article")
  if (String(data.post_id) !== String(row.post_id) || !data.post_content || String(data.post_user?.user_id) !== String(row.user_id) || data.post_publish_time !== row.post_publish_time) throw new Error("Forum body identity mismatch")
  const text = plain(data.post_content)
  if (text.length < 6 || /加.{0,3}(?:微信|微芯|群)|私信.{0,6}(?:领|联系)|测试.{0,8}(?:接口|发帖)/.test(text)) throw new Error("Empty or promotional forum body")
  return { id: String(row.post_id), code, title: plain(String(data.post_title || "")).slice(0, 120), text: text.slice(0, 1200), url: `https://guba.eastmoney.com/news,${code},${row.post_id}.html`, authorHash: hash(`eastmoney:${row.user_id}`), publishedAt: new Date(shanghaiTime(row.post_publish_time)).toISOString(), textHash: hash(text), truncated: text.length > 1200 }
}

type CachePayload = NewsItem & { retail?: RetailSample, budget?: { hour: number, used: number } }
const envelope = (id: string, payload: Partial<CachePayload>): CachePayload => ({ id, title: "Retail sampling cache", url: "https://guba.eastmoney.com/", ...payload })

export function createRetailSampler({ getCache, setCache, fetchArticle = fetchBriefingArticle, now = Date.now }: {
  getCache: (key: string) => Promise<CacheInfo | undefined>
  setCache: (key: string, items: NewsItem[]) => Promise<unknown>
  fetchArticle?: typeof fetchBriefingArticle
  now?: () => number
}) {
  const running = new Map<string, Promise<RetailSample>>()
  let budget: { hour: number, used: number } | undefined, budgetLoaded: Promise<void> | undefined
  let budgetWrite: Promise<unknown> = Promise.resolve()
  const fetchBounded = async (url: string) => {
    await (budgetLoaded ||= getCache("retail-budget:v1").then((saved) => {
      budget = (saved?.items[0] as CachePayload)?.budget
    }))
    const hour = Math.floor(now() / 3600000)
    if (!budget || budget.hour !== hour) budget = { hour, used: 0 }
    if (budget.used >= RETAIL_LIMITS.requestsPerHour) throw new Error("Hourly sampling budget exhausted")
    budget.used++
    // Reserve before network I/O; process restarts do not reset the hourly budget.
    const reserved = { ...budget }
    await (budgetWrite = budgetWrite.then(() => setCache("retail-budget:v1", [envelope("budget", { budget: reserved })])))
    return fetchArticle(url, hosts)
  }
  return async (code: string): Promise<RetailSample> => {
    if (!validRetailCode(code)) throw Object.assign(new Error("A-share stock code required"), { statusCode: 400 })
    const key = `retail-sample:v1:${code}`
    const saved = await getCache(key)
    const previous = (saved?.items[0] as CachePayload)?.retail
    const checkedAt = new Date(now()).toISOString()
    if (previous && now() - Date.parse(previous.checkedAt) < (["error", "busy"].includes(previous.state) ? RETAIL_LIMITS.retryMs : RETAIL_LIMITS.ttlMs))
      return { ...previous, state: previous.state === "fresh" ? "cached" : previous.state }
    if (running.has(code)) return running.get(code)!
    const empty: RetailSample = { version: 1, source: "eastmoney-guba", code, fetchedAt: null, checkedAt, state: "empty", posts: [], error: null, coverage: { windowHours: 24, listed: 0, eligible: 0, recent2h: 0, selected: 0, bodyFailures: 0, oldestListedAt: null, newestListedAt: null, firstPageOnly: true, capped: false } }
    if (running.size >= RETAIL_LIMITS.concurrent) return { ...(previous || empty), checkedAt, state: "busy", error: "Sampling concurrency limit; retry later" }
    const task = (async (): Promise<RetailSample> => {
      try {
        const list = retailCandidates(await fetchBounded(`https://guba.eastmoney.com/list,${code},f.html`), code, now())
        const posts: RetailPost[] = []
        const texts = new Set<string>()
        let bodyFailures = 0
        for (const row of list.selected) {
          try {
            const post = retailPost(await fetchBounded(`https://guba.eastmoney.com/news,${code},${row.post_id}.html`), row, code)
            if (!texts.has(post.textHash)) {
              texts.add(post.textHash)
              posts.push(post)
            }
          } catch {
            bodyFailures++
          }
        }
        if (list.selected.length && !posts.length) throw new Error("No usable forum bodies")
        const stamp = (row: any) => row ? new Date(shanghaiTime(row.post_publish_time)).toISOString() : null
        const result: RetailSample = { ...empty, fetchedAt: checkedAt, posts, state: bodyFailures ? "partial" : posts.length ? "fresh" : "empty", coverage: { ...empty.coverage, listed: list.listed, eligible: list.eligible.length, recent2h: list.eligible.filter((row: any) => now() - shanghaiTime(row.post_publish_time) <= 7200000).length, selected: list.selected.length, bodyFailures, oldestListedAt: stamp(list.eligible.at(-1)), newestListedAt: stamp(list.eligible[0]), capped: list.eligible.length > posts.length || list.listed >= 80 } }
        await setCache(key, [envelope(code, { retail: result })])
        return result
      } catch {
        const result: RetailSample = { ...(previous || empty), checkedAt, state: "error", error: "Public source unavailable, malformed or sampling budget exhausted; no login/challenge bypass" }
        await setCache(key, [envelope(code, { retail: result })])
        return result
      }
    })().finally(() => running.delete(code))
    running.set(code, task)
    return task
  }
}
