import { load } from "cheerio"
import type { NewsItem, NewsPreview } from "@shared/types"

export function previewText(value: unknown, limit = 8000): string {
  if (typeof value !== "string") return ""
  const $ = load(value.slice(0, 200_000))
  $("script,style,iframe,form,nav,header,footer,noscript,svg").remove()
  $("br").replaceWith("\n")
  $("p,li").append("\n\n")
  return $.text().replace(/[\t\r ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, limit)
}

export function previewUrl(value: unknown, base: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    const url = new URL(value, base)
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

function publicationTime(value: unknown): string | null {
  if (value == null || value === "") return null
  // Timezone-less listing dates are not silently promoted to authoritative dates.
  if (typeof value === "string" && !/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(value.trim())) return null
  const date = new Date(value as string | number)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export function feedPreview(item: { link: string, description?: unknown, content?: unknown, created?: unknown, author?: unknown, image?: unknown, enclosures?: { url?: string, type?: string }[] }, kind: NewsPreview["kind"] = "rss"): NewsPreview {
  const $ = load(typeof item.content === "string" ? item.content.slice(0, 200_000) : typeof item.description === "string" ? item.description.slice(0, 200_000) : "")
  const enclosure = item.enclosures?.find(v => v?.url && (!v.type || v.type.startsWith("image/")))
  return {
    kind,
    summary: previewText(item.description, 1200),
    text: previewText(item.content),
    imageUrl: previewUrl(item.image || enclosure?.url || $("img").first().attr("src"), item.link),
    author: previewText(item.author, 120),
    publishedAt: publicationTime(item.created),
  }
}

export function withBriefingPreview(item: NewsItem): NewsItem {
  if (item.preview) return item
  return { ...item, preview: feedPreview({ link: item.url, description: item.extra?.hover, created: item.pubDate ?? item.extra?.date }, "listing") }
}

export function articlePreview(html: string, url: string): NewsPreview {
  const $ = load(html.slice(0, 1_000_000))
  let article: Record<string, any> = {}
  $("script[type='application/ld+json']").slice(0, 8).each((_index, element) => {
    try {
      const value = JSON.parse($(element).text())
      const nodes = (Array.isArray(value) ? value : [value, ...(Array.isArray(value?.["@graph"]) ? value["@graph"] : [])]).slice(0, 30)
      const match = nodes.find(node => /^(?:NewsArticle|Article|BlogPosting)$/.test(String(node?.["@type"])))
      if (match && !article["@type"]) article = match
    } catch { /* Broken metadata is not body evidence. */ }
  })
  const main = $("article, [itemprop='articleBody'], #paragraph, .post-content, .news-content, .main-content .content").first()
  const description = $("meta[property='og:description'],meta[name='description'],meta[name='twitter:description']").first().attr("content") || article.description
  const paywalled = article.isAccessibleForFree === false || article.isAccessibleForFree === "false"
  const schemaBody = article.isAccessibleForFree === true || article.isAccessibleForFree === "true" ? article.articleBody : ""
  const content = paywalled ? "" : main.html() || schemaBody || ""
  const image = Array.isArray(article.image) ? article.image[0] : article.image
  const author = Array.isArray(article.author) ? article.author[0] : article.author
  const preview = feedPreview({ link: url, description, content, image: $("meta[property='og:image']").first().attr("content") || image?.url || image, author: $("meta[name='author']").attr("content") || author?.name || author, created: $("meta[property='article:published_time']").attr("content") || article.datePublished }, "article")
  return { ...preview, url, status: preview.text ? "available" : "partial" }
}

export function sourceFreshness(fetchedAt: number | null, checkedAt: number, state: "fresh" | "cached" | "empty" | "error") {
  return { fetchedAt, checkedAt, state }
}
