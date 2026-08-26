import process from "node:process"
import type { NewsItem } from "@shared/types"
import { previewText } from "./briefing-preview"
// Accounts help attribution, never gate discovery. Search and timeline both
// require an explicit public-user flag from x-kit-api's provenance contract.
export const xNewsProfiles = {
  tech: "(\"AI agent\" OR \"open weights\" OR \"LLM\" OR \"模型发布\" OR \"开源模型\" OR \"人工智能\" OR \"芯片\")",
  world: "(\"ceasefire\" OR \"sanctions\" OR \"central bank\" OR \"renewable energy\" OR \"停火\" OR \"制裁\" OR \"央行\" OR \"外交部\")",
  security: "(CVE OR \"remote code execution\" OR \"actively exploited\" OR ransomware OR \"数据泄露\" OR \"远程代码执行\" OR \"在野利用\")",
} as const
export type XNewsProfile = keyof typeof xNewsProfiles
const attribution: Record<string, string> = { openai: "OpenAI", anthropicai: "Anthropic", googledeepmind: "Google DeepMind", reuters: "Reuters", ap: "Associated Press", bbcworld: "BBC", un_news_centre: "UN News", cisagov: "CISA", thehackersnews: "The Hacker News" }
const topics = {
  tech: /(?:\b(?:AI|LLM|GPT|Claude|Anthropic|OpenAI|Gemini|semiconductor|chip|open.weights)\b|模型|人工智能|芯片|开源|算力)/i,
  world: /(?:\b(?:war|ceasefire|sanctions|election|earthquake|diplomat|central.bank|renewable|energy|tariff)\b|战争|停火|制裁|央行|外交|选举|地震|关税|能源|国际)/i,
  security: /(?:\bCVE-\d{4}|ransomware|data.breach|remote.code.execution|actively.exploited|cyberattack|cybersecurity|\bexploit\b|数据泄露|远程代码执行|在野利用|勒索|网络攻击|安全漏洞)/i,
}
const spam = /airdrop|claim.{0,20}(?:token|reward)|giveaway|referral.code|空投|抽奖|返佣|免费领币|稳赚|博彩|赌球|加群领取/i
const INTERVAL = 10 * 60000
const MAX_BYTES = 512000
const failure = (code: string) => Object.assign(new Error(code), { code })
export const isXNewsEnabled = (env = process.env) => env.X_NEWS_ENABLED === "true" && !env.CF_PAGES
export function normalizeXPosts(payload: unknown, profile: XNewsProfile, now = Date.now()): NewsItem[] {
  const data = payload as {
    success?: unknown
    data?: unknown
  }
  if (!data || data.success !== true || !Array.isArray(data.data) || data.data.length > 100)
    throw failure("X_KIT_INVALID_RESPONSE")
  const seen = new Set<string>()
  const items: NewsItem[] = []
  for (const raw of data.data) {
    if (!raw || typeof raw !== "object" || typeof raw.user?.screenName !== "string" || !raw.user.screenName)
      throw failure("X_KIT_INVALID_POST")
    const handle = raw.user.screenName
    if (!/^\w{1,15}$/.test(handle))
      throw failure("X_KIT_INVALID_POST")
    if (raw.user.protected !== false || raw.restrictedAudience === true || raw.possiblySensitive === true || raw.isRetweet || raw.retweetedStatusId || raw.isQuote || raw.quotedStatusId || raw.isReply || raw.inReplyToStatusId || /^(?:RT\s+@|@)/.test(raw.text || ""))
      continue
    if (typeof raw.id !== "string" || !/^\d{10,25}$/.test(raw.id) || typeof raw.text !== "string" || typeof raw.createdAt !== "string")
      throw failure("X_KIT_INVALID_POST")
    // X supplies RFC dates with an explicit offset; do not substitute fetch time.
    if (!/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)(?:\s+\d{4})?$/i.test(raw.createdAt))
      throw failure("X_KIT_INVALID_TIME")
    const stamp = Date.parse(raw.createdAt)
    if (!Number.isFinite(stamp) || stamp > now + 5 * 60000)
      throw failure("X_KIT_INVALID_TIME")
    if (stamp < now - 48 * 3600000 || seen.has(raw.id))
      continue
    const url = `https://x.com/${handle}/status/${raw.id}`
    if (raw.url && String(raw.url).toLowerCase() !== url.toLowerCase())
      throw failure("X_KIT_INVALID_POST_URL")
    const text = previewText(raw.text, 6000)
    if (!text)
      throw failure("X_KIT_EMPTY_POST")
    if (!topics[profile].test(text) || spam.test(text))
      continue
    const images: unknown[] = Array.isArray(raw.media?.images) ? raw.media.images : []
    const imageUrl = images.find((value) => {
      try {
        const u = new URL(String(value))
        return u.protocol === "https:" && u.hostname === "pbs.twimg.com" && u.pathname.startsWith("/media/") && !u.username && !u.password && !u.port
      } catch {
        return false
      }
    }) as string | undefined
    const relatedUrls = (Array.isArray(raw.urls) ? raw.urls : []).flatMap((link: {
      expandedUrl?: unknown
    }) => {
      try {
        const url = new URL(String(link?.expandedUrl || ""))
        return url.protocol === "https:" && !url.username && !url.password && !url.port && !/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname) && !url.hostname.includes(":") ? [url.href] : []
      } catch {
        return []
      }
    }).slice(0, 10)
    seen.add(raw.id)
    items.push({ id: raw.id, url, relatedUrls, title: Array.from(text.split(/\n+/)[0]).slice(0, 160).join(""), pubDate: new Date(stamp).toISOString(), publisher: attribution[handle.toLowerCase()] || `X · @${handle}`, extra: { info: `X · @${handle}`, hover: text.slice(0, 1200) }, preview: { kind: "listing", summary: text.slice(0, 1200), text, author: `@${handle}`, imageUrl: imageUrl || null, publishedAt: new Date(stamp).toISOString() } })
  }
  return items.sort((a, b) => Date.parse(String(b.pubDate)) - Date.parse(String(a.pubDate))).slice(0, 20)
}
async function readXKitJson(response: Response) {
  if (Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body?.cancel()
    throw failure("X_KIT_RESPONSE_TOO_LARGE")
  }
  const reader = response.body?.getReader()
  if (!reader)
    throw failure("X_KIT_INVALID_RESPONSE")
  const decoder = new TextDecoder()
  let text = ""
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      size += value.byteLength
      if (size > MAX_BYTES) {
        await reader.cancel()
        throw failure("X_KIT_RESPONSE_TOO_LARGE")
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } finally {
    reader.releaseLock()
  }
  return JSON.parse(text)
}
export function createXNewsClient({ env = process.env, fetchImpl = fetch, now = Date.now }: {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  now?: () => number
} = {}) {
  interface Snapshot {
    data: unknown
    at: number
  }
  const surfaces = new Map<string, {
    until: number
    result: Promise<Snapshot>
  }>()
  const pending = new Map<XNewsProfile, Promise<NewsItem[]>>()
  let rateLimitedUntil = 0
  let active = 0
  let budgetAt = now()
  let used = 0
  const waiting: (() => void)[] = []
  const acquire = () => active < 2 ? (active++, Promise.resolve()) : new Promise<void>(resolve => waiting.push(resolve))
  const release = () => {
    const next = waiting.shift()
    if (next)
      next()
    else
      active--
  }
  async function surface(key: string, path: string, params: Record<string, string> = {}): Promise<Snapshot> {
    const saved = surfaces.get(key)
    if (saved && now() < saved.until)
      return saved.result
    const slot = { until: now() + INTERVAL, result: Promise.resolve(null as unknown as Snapshot) }
    const task = (async () => {
      await acquire()
      try {
        if (now() < rateLimitedUntil)
          throw failure("X_KIT_RATE_LIMITED")
        if (now() - budgetAt >= INTERVAL) {
          budgetAt = now()
          used = 0
        }
        if (used >= 7)
          throw failure("X_KIT_BUDGET_EXHAUSTED")
        const base = new URL(env.X_KIT_API_BASE_URL || "http://192.168.31.119:3000")
        if (!/^https?:$/.test(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== "/")
          throw failure("X_KIT_INVALID_CONFIG")
        const url = new URL(path, base)
        for (const [name, value] of Object.entries(params))
          url.searchParams.set(name, value)
        used++
        // Credentials stay in x-kit-api. Shared concurrency, cache and budget
        // apply to all categories; no pagination or trend-query fanout.
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(6000), redirect: "error" })
        if (response.status === 429) {
          const details = await readXKitJson(response).catch(() => null)
          const seconds = Number(response.headers.get("retry-after") || details?.retryAfter)
          rateLimitedUntil = now() + Math.max(INTERVAL, Math.min(3600000, Number.isFinite(seconds) ? seconds * 1000 : INTERVAL))
          throw failure("X_KIT_RATE_LIMITED")
        }
        if (!response.ok) {
          await response.body?.cancel()
          throw failure(`X_KIT_HTTP_${response.status}`)
        }
        const data = await readXKitJson(response)
        if (data?.success !== true || !Array.isArray(data?.data) || data.data.length > 100)
          throw failure("X_KIT_INVALID_RESPONSE")
        if (data.data.length && data.data.every((post: { user?: { protected?: unknown } }) => typeof post?.user?.protected !== "boolean"))
          throw failure("X_KIT_PUBLIC_STATUS_UNAVAILABLE")
        return { data, at: now() }
      } catch (error) {
        slot.until = now() + 60000
        const code = error instanceof Error && /^X_(?:KIT|NEWS)_[A-Z0-9_]+$/.test(error.message) ? error.message : "X_KIT_UNAVAILABLE"
        throw failure(code)
      } finally {
        release()
      }
    })()
    slot.result = task
    surfaces.set(key, slot)
    return task
  }
  return (profile: XNewsProfile): Promise<NewsItem[]> => {
    if (!isXNewsEnabled(env))
      return Promise.reject(failure("X_NEWS_DISABLED"))
    if (!Object.hasOwn(xNewsProfiles, profile))
      return Promise.reject(failure("X_NEWS_UNKNOWN_PROFILE"))
    if (now() < rateLimitedUntil)
      return Promise.reject(failure("X_KIT_RATE_LIMITED"))
    if (pending.has(profile))
      return pending.get(profile)!
    const task = (async () => {
      const since = new Date(now() - 48 * 3600000).toISOString().slice(0, 10)
      const q = `${xNewsProfiles[profile]} (lang:en OR lang:zh) since:${since} -filter:retweets -filter:replies`
      const channels = [
        ["following", "/api/timeline", { count: "30" }],
        [`${profile}-latest`, "/api/search", { q, count: "20", sort: "latest" }],
        [`${profile}-top`, "/api/search", { q, count: "20", sort: "top" }],
      ] as const
      // Do not turn a partially failed collection into a healthy/empty source.
      // The legacy API will retain its last good cache and expose error freshness.
      const results = await Promise.allSettled(channels.map(([key, path, params]) => surface(key, path, params)))
      const failed = results.find(result => result.status === "rejected")
      if (failed?.status === "rejected")
        throw failed.reason
      const items = new Map<string | number, NewsItem>()
      const queues: (string | number)[][] = []
      results.forEach((result, index) => {
        if (result.status !== "fulfilled")
          return
        const normalized = normalizeXPosts(result.value.data, profile, now())
        queues.push(normalized.map(item => item.id))
        for (const item of normalized) {
          const mode = index === 0 ? "following" : index === 1 ? "latest" : "top"
          const existing = items.get(item.id)
          if (existing)
            existing.discovery!.channels.push(mode)
          else
            items.set(item.id, { ...item, discovery: { channels: [mode], fetchedAt: result.value.at, public: true } })
        }
      })
      const authors = new Map<string, number>()
      const selected = new Map<string | number, NewsItem>()
      // Round-robin discovery before sorting: an older useful Top result must
      // not be crowded out by two pages of newer timeline/search posts.
      while (selected.size < 24 && queues.some(queue => queue.length)) {
        for (const queue of queues) {
          const id = queue.shift()
          if (id === undefined || selected.has(id) || selected.size >= 24)
            continue
          const item = items.get(id)!
          const author = item.preview?.author || ""
          const count = authors.get(author) || 0
          if (count < 3) {
            authors.set(author, count + 1)
            selected.set(id, item)
          }
        }
      }
      return [...selected.values()].sort((a, b) => Date.parse(String(b.pubDate)) - Date.parse(String(a.pubDate)))
    })().finally(() => pending.delete(profile))
    pending.set(profile, task)
    return task
  }
}
