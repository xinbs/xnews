import { XMLParser } from "fast-xml-parser"
import type { NewsItem } from "@shared/types"

interface SitemapIndex {
  sitemapindex: {
    sitemap: {
      loc: string
    }
  }
}

interface NewsSitemap {
  urlset: {
    url: Array<{
      "loc": string
      "news:news": {
        "news:publication": {
          "news:name": string
          "news:language": string
        }
        "news:publication_date": string
        "news:title": string
      }
    }>
  }
}

async function fetchMoomooNews(indexUrl: string): Promise<NewsItem[]> {
  // 首先获取 sitemap index
  const indexData = await myFetch(indexUrl) as string
  const indexParser = new XMLParser({
    attributeNamePrefix: "",
    textNodeName: "$text",
    ignoreAttributes: false,
  })
  const indexResult: SitemapIndex = indexParser.parse(indexData)

  // 获取实际的 sitemap URL
  const sitemapUrl = indexResult.sitemapindex.sitemap.loc

  // 获取实际的 sitemap 内容
  const sitemapData = await myFetch(sitemapUrl) as string
  const sitemapParser = new XMLParser({
    attributeNamePrefix: "",
    textNodeName: "$text",
    ignoreAttributes: false,
  })
  const sitemapResult: NewsSitemap = sitemapParser.parse(sitemapData)

  const urls = sitemapResult.urlset.url
  if (!Array.isArray(urls)) {
    return []
  }

  return urls.map(item => ({
    title: item["news:news"]["news:title"],
    url: item.loc,
    id: item.loc,
    pubDate: item["news:news"]["news:publication_date"],
  }))
}

const moomooEn = defineSource(async () => {
  return fetchMoomooNews("https://www.moomoo.com/sitemap-news-en-index-test-48hours.xml")
})

const moomooZhhans = defineSource(async () => {
  return fetchMoomooNews("https://www.moomoo.com/sitemap-news-zhhans-index-test-48hours.xml")
})

const moomooZhhant = defineSource(async () => {
  return fetchMoomooNews("https://www.moomoo.com/sitemap-news-zhhant-index-test-48hours.xml")
})

const moomooJa = defineSource(async () => {
  return fetchMoomooNews("https://www.moomoo.com/sitemap-news-ja-index-test-48hours.xml")
})

export default defineSource({
  "moomoo-en": moomooEn,
  "moomoo-zhhans": moomooZhhans,
  "moomoo-zhhant": moomooZhhant,
  "moomoo-ja": moomooJa,
})
