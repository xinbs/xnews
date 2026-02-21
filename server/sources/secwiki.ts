import * as cheerio from "cheerio"

const baseUrl = "https://www.sec-wiki.com"

const secwikiLatest = defineSource(async () => {
  const html = await myFetch<string>(baseUrl)
  const $ = cheerio.load(html)
  const items = $("#content1 p").toArray().flatMap((el) => {
    const $el = $(el)
    const dateText = $el.find("span.dropcap").first().text().trim()
    const titleLink = $el.find("a").first()
    const title = titleLink.text().trim()
    const href = titleLink.attr("href")
    if (!title || !href) return []
    const url = href.startsWith("http") ? href : new URL(href, baseUrl).toString()
    return [{
      id: url,
      title,
      url,
      pubDate: dateText ? new Date(dateText).valueOf() : undefined,
    }]
  })
  if (!items.length) throw new Error("Cannot parse latest items")
  return items
})

const secwikiWeekly = defineSource(async () => {
  const weeklyUrl = `${baseUrl}/weekly`
  const weeklyHtml = await myFetch<string>(weeklyUrl)
  const $ = cheerio.load(weeklyHtml)
  const issueHref = $(".issues a[href^=\"/weekly/\"]").first().attr("href")
    ?? $("a[href^=\"/weekly/\"]").first().attr("href")
  if (!issueHref) throw new Error("Cannot find weekly issue")
  const issueUrl = new URL(issueHref, baseUrl).toString()
  const issueHtml = await myFetch<string>(issueUrl)
  const $$ = cheerio.load(issueHtml)
  const items = $$("#content .single, .single").toArray().flatMap((el) => {
    const $el = $$(el)
    const link = $el.find("a").first().attr("href")
    if (!link) return []
    const url = link.startsWith("http") ? link : new URL(link, baseUrl).toString()
    const tag = $el.find("#tags").first().text().replace(/\s+/g, " ").trim()
    const titleNode = $el.clone()
    titleNode.find("a").remove()
    titleNode.find("#tags").remove()
    const title = titleNode.text().replace(/\s+/g, " ").trim()
    if (!title) return []
    return [{
      id: url,
      title,
      url,
      extra: tag ? { info: tag } : undefined,
    }]
  })
  if (!items.length) throw new Error("Cannot parse weekly items")
  return items
})

const doonsecWechat = defineRSSSource("https://wechat.doonsec.com/rss.xml")

export default defineSource({
  "secwiki": secwikiLatest,
  "secwiki-latest": secwikiLatest,
  "secwiki-weekly": secwikiWeekly,
  "doonsec": doonsecWechat,
})
