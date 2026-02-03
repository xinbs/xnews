import * as cheerio from "cheerio"
import { decodeBase64URL } from "#/utils/base64"

export default defineEventHandler(async (event) => {
  const { url, type = "encodeURIComponent", mode, scripts } = getQuery(event)
  if (!url) {
    throw createError({ statusCode: 400, message: "Missing url" })
  }
  const target = type === "encodeURIComponent"
    ? decodeURIComponent(url as string)
    : decodeBase64URL(url as string)

  try {
    // 直连获取 HTML
    const html = await myFetch(target, {
      headers: {
        // 避免部分站点反爬 403
        referer: new URL(target).origin,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    }) as string

    // 阅读模式（抽取正文）
    if (mode === "extract") {
      const $ = cheerio.load(html)
      // 简化：优先 article/main 容器；否则 body
      const main = $("article, main, #root, .content, .RichContent, .QuestionPage").first()
      const content = (main.length ? main.html() : $("body").html()) || ""
      return `<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/><style>img{max-width:100%;height:auto}body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}</style></head><body>${content}</body></html>`
    }

    // 脚本控制：默认去除脚本，若 scripts=1 则原样
    if (scripts !== "1") {
      const $ = cheerio.load(html)
      $("script").remove()
      // 去除危险的 CSP 注入
      $("meta[http-equiv='Content-Security-Policy']").remove()
      return $.html()
    }

    return html
  } catch (e: any) {
    throw createError({ statusCode: 500, message: e?.message || "Render failed" })
  }
})
