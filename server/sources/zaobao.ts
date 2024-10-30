import { Buffer } from "node:buffer"
import * as cheerio from "cheerio"
import iconv from "iconv-lite"
import type { NewsItem } from "@shared/types"

export default defineSource(async () => {
  const response: ArrayBuffer = await myFetch("https://www.kzaobao.com/top.html", {
    responseType: "arrayBuffer",
  })
  const base = "https://www.kzaobao.com"
  const utf8String = iconv.decode(Buffer.from(response), "gb2312")
  const $ = cheerio.load(utf8String)
  const $main = $("div[id^='cd0'] tr")
  const news: NewsItem[] = []
  $main.each((_, el) => {
    const a = $(el).find("h3>a")
    // https://www.kzaobao.com/shiju/20241002/170659.html
    const url = a.attr("href")
    const title = a.text()
    const date = $(el).find("td:nth-child(3)").text()
    if (url && title && date) {
      news.push({
        url: base + url,
        title,
        id: url,
        pubDate: parseRelativeDate(date, "Asia/Shanghai").valueOf(),
      })
    }
  })
  return news.sort((m, n) => n.pubDate! > m.pubDate! ? 1 : -1)
})
