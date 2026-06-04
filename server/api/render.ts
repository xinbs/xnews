import http2 from "node:http2"
import process from "node:process"
import * as cheerio from "cheerio"
import { decodeBase64URL } from "#/utils/base64"

async function fetchHTML(target: string): Promise<string> {
  if (process.env.CF_PAGES) {
    return myFetch(target, {
      headers: {
        referer: new URL(target).origin,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    }) as Promise<string>
  }

  try {
    return await myFetch(target, {
      headers: {
        referer: new URL(target).origin,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    }) as string
  } catch (e: any) {
    if (e?.statusCode === 403) {
      const url = new URL(target)
      return new Promise((resolve, reject) => {
        const client = http2.connect(`https://${url.hostname}`)
        const req = client.request({
          ":path": url.pathname + url.search,
          ":method": "GET",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "referer": url.origin,
        })

        let data = ""
        req.on("data", chunk => data += chunk)
        req.on("end", () => {
          client.close()
          resolve(data)
        })
        req.on("error", (err) => {
          client.close()
          reject(err)
        })
        req.end()
      })
    }
    throw e
  }
}

export default defineEventHandler(async (event) => {
  const { url, type = "encodeURIComponent", mode, scripts } = getQuery(event)
  if (!url) {
    throw createError({ statusCode: 400, message: "Missing url" })
  }
  const target = type === "encodeURIComponent"
    ? decodeURIComponent(url as string)
    : decodeBase64URL(url as string)

  try {
    const html = await fetchHTML(target)

    if (mode === "extract") {
      const $ = cheerio.load(html)
      const main = $("article, main, #root, .content, .RichContent, .QuestionPage").first()
      const content = (main.length ? main.html() : $("body").html()) || ""
      return `<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/><style>img{max-width:100%;height:auto}body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}</style></head><body>${content}</body></html>`
    }

    if (scripts !== "1") {
      const $ = cheerio.load(html)
      $("script").remove()
      $("meta[http-equiv='Content-Security-Policy']").remove()
      return $.html()
    }

    return html
  } catch (e: any) {
    throw createError({ statusCode: 500, message: e?.message || "Render failed" })
  }
})
