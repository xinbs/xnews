import { Buffer } from "node:buffer"
import { lookup } from "node:dns/promises"
import { request } from "node:https"
import { isIP } from "node:net"

export function isPublicIPv4(ip: string): boolean {
  if (isIP(ip) !== 4) return false
  const [a, b, c] = ip.split(".").map(Number)
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113))
}

export function assertArticleUrl(input: string, hosts: string[]): URL {
  const url = new URL(input)
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new Error("Article host is not allowed")
  return url
}

export async function fetchBriefingArticle(input: string, hosts: string[], redirects = 0): Promise<string> {
  const url = assertArticleUrl(input, hosts)
  // Resolve once, reject non-public answers, and pin the actual connection to
  // that answer. Redirects must repeat both checks (no DNS rebinding window).
  const records = await Promise.race([lookup(url.hostname, { all: true, family: 4 }), new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error("DNS timeout")), 3000)
    timer.unref()
  })])
  if (!records.length || records.some(record => !isPublicIPv4(record.address))) throw new Error("Non-public article address")
  const result = await new Promise<{ html: string, location?: string }>((resolve, reject) => {
    const req = request(url, {
      family: 4,
      lookup: (_host, _options, callback) => callback(null, records[0].address, 4),
      headers: { "User-Agent": "xnews-briefing/1.0", "Accept": "text/html" },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0)) {
        res.resume()
        resolve({ html: "", location: res.headers.location })
        return
      }
      if (res.statusCode !== 200 || !/text\/html/i.test(res.headers["content-type"] || "") || Number(res.headers["content-length"] || 0) > 1_000_000) {
        res.destroy()
        reject(new Error("Article response unavailable"))
        return
      }
      const chunks: Buffer[] = []
      let bytes = 0
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length
        if (bytes > 1_000_000) req.destroy(new Error("Article too large"))
        else chunks.push(chunk)
      })
      res.on("error", reject)
      res.on("end", () => resolve({ html: Buffer.concat(chunks).toString("utf8") }))
    })
    const timer = setTimeout(() => req.destroy(new Error("Article timeout")), 8000)
    req.on("error", reject)
    req.on("close", () => clearTimeout(timer))
    req.end()
  })
  if (result.location) {
    if (redirects >= 2) throw new Error("Too many article redirects")
    return fetchBriefingArticle(new URL(result.location, url).href, hosts, redirects + 1)
  }
  return result.html
}
