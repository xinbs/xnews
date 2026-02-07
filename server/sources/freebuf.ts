import * as cheerio from "cheerio"

// 定义文章统计信息接口
interface ArticleStats {
  views: number
  collections: number
}

// 定义作者信息接口
interface AuthorInfo {
  name: string
  avatar?: string
  profileUrl?: string
}

// 定义文章数据接口
interface ArticleData {
  title: string
  url: string
  description: string
  publishTime: string
  author: AuthorInfo
  stats: ArticleStats
  album?: string
  image?: string
  category?: string
}

// 辅助函数：安全提取文本
function safeExtract($element: cheerio.Cheerio<any>, selector: string): string {
  const result = $element.find(selector).first().text().trim()
  return result || ""
}

// 辅助函数：安全提取属性
function safeExtractAttribute($element: cheerio.Cheerio<any>, selector: string, attribute: string): string {
  return $element.find(selector).first().attr(attribute) || ""
}

// 辅助函数：格式化URL
function formatUrl(url: string | undefined, baseUrl: string = "https://www.freebuf.com"): string {
  if (!url) return ""
  return url.startsWith("http") ? url : `${baseUrl}${url}`
}

// 辅助函数：提取统计信息
function extractStats($article: cheerio.Cheerio<any>): ArticleStats {
  const stats: ArticleStats = { views: 0, collections: 0 }

  // 提取围观数
  const viewElement = $article.find("a:contains(\"围观\")")
  if (viewElement.length) {
    const viewText = viewElement.find("span").first().text()
    stats.views = Number.parseInt(viewText) || 0
  }

  // 提取收藏数
  const collectElement = $article.find("a:contains(\"收藏\")")
  if (collectElement.length) {
    const collectText = collectElement.find("span").first().text()
    stats.collections = Number.parseInt(collectText) || 0
  }

  return stats
}

// 辅助函数：提取作者信息
function extractAuthor($article: cheerio.Cheerio<any>): AuthorInfo {
  const author: AuthorInfo = { name: "" }

  const authorLink = $article.find(".item-bottom a").first()
  if (authorLink.length) {
    author.name = authorLink.find("span").last().text().trim()
    author.profileUrl = formatUrl(authorLink.attr("href"))

    const avatarImg = authorLink.find(".ant-avatar img")
    if (avatarImg.length) {
      author.avatar = avatarImg.attr("src")
    }
  }

  return author
}

// 辅助函数：提取分类信息
function extractCategory($article: cheerio.Cheerio<any>): string {
  // 从URL路径推断分类
  const articleUrl = $article.find(".title-left .title").parent().attr("href") || ""
  if (articleUrl.includes("/articles/web/")) return "Web安全"
  if (articleUrl.includes("/articles/database/")) return "数据安全"
  if (articleUrl.includes("/articles/network/")) return "网络安全"
  if (articleUrl.includes("/articles/mobile/")) return "移动安全"
  if (articleUrl.includes("/articles/cloud/")) return "云安全"

  return ""
}

// 通过截取freebuf的文章url获取新闻id
function extractIdFromUrl(url: string): string {
  // 找到最后一个斜杠
  const lastPart = url.slice(url.lastIndexOf("/") + 1) // "460614.html"
  // 去掉 .html，只保留数字
  const match = lastPart.match(/\d+/)
  return match ? match[0] : ""
}

export default defineSource(async () => {
  const baseUrl = "https://www.freebuf.com"
  try {
    const html = await myFetch<any>(baseUrl, {
      headers: {
        "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Referer": "https://www.freebuf.com/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      },
    })
    const $ = cheerio.load(html)
    const articles: ArticleData[] = []
    $(".article-item").each((index: number, articleElement) => {
      const $article = $(articleElement)

      try {
        const titleLink = $article.find(".title-left .title").parent()
        const title = titleLink.find(".title").text().trim()
        const url = formatUrl(titleLink.attr("href"), baseUrl)

        if (!title) return

        const description = safeExtract($article, ".item-right .text-line-2")
        const publishTime = safeExtract($article, ".item-bottom span:last-child")
        const author = extractAuthor($article)
        const stats = extractStats($article)
        const album = safeExtract($article, ".from-column span")
        const image = safeExtractAttribute($article, ".img-view img", "src")
        const category = extractCategory($article)

        const article: ArticleData = {
          title,
          url,
          description,
          publishTime,
          author,
          stats,
          album: album || undefined,
          image: image || undefined,
          category: category || undefined,
        }

        articles.push(article)
      } catch (error) {
        console.warn(`解析第${index + 1}篇文章时出错:`, error instanceof Error ? error.message : String(error))
      }
    })
    return articles.map(item => ({
      id: extractIdFromUrl(item.url),
      title: item.title,
      url: item.url,
      extra: {
        hover: item.description,
        time: item.publishTime,
        author: item.author,
        stats: item.stats,
        album: item.album,
      },
    }))
  } catch {
    const fallback = defineRSSHubSource("/freebuf/articles/network", { limit: 30 })
    return fallback()
  }
})
