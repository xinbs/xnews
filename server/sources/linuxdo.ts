import http2 from "node:http2"
import process from "node:process"

interface Res {
  topic_list: {
    can_create_topic: boolean
    more_topics_url: string
    per_page: number
    top_tags: string[]
    topics: {
      id: number
      title: string
      fancy_title: string
      posts_count: number
      reply_count: number
      highest_post_number: number
      image_url: null | string
      created_at: Date
      last_posted_at: Date
      bumped: boolean
      bumped_at: Date
      unseen: boolean
      pinned: boolean
      excerpt?: string
      visible: boolean
      closed: boolean
      archived: boolean
      like_count: number
      has_summary: boolean
      last_poster_username: string
      category_id: number
      pinned_globally: boolean
    }[]
  }
}

async function fetchLinuxDo<T>(url: string): Promise<T> {
  // Cloudflare Workers 的 fetch 原生支持 HTTP/2，直接用 myFetch
  if (process.env.CF_PAGES) {
    return myFetch<T>(url)
  }

  // Node.js 环境下使用 http2 模块，避免 Cloudflare 的 HTTP/1.1 拦截
  return new Promise((resolve, reject) => {
    const client = http2.connect("https://linux.do")
    const req = client.request({
      ":path": new URL(url).pathname + new URL(url).search,
      ":method": "GET",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "accept": "application/json",
    })

    let data = ""
    req.on("data", chunk => data += chunk)
    req.on("end", () => {
      client.close()
      try {
        resolve(JSON.parse(data) as T)
      } catch {
        reject(new Error(`Invalid JSON response: ${data.slice(0, 200)}`))
      }
    })
    req.on("error", (err) => {
      client.close()
      reject(err)
    })
    req.end()
  })
}

const hot = defineSource(async () => {
  const res = await fetchLinuxDo<Res>("https://linux.do/hot.json")
  return res.topic_list.topics
    .filter(k => k.visible && !k.archived && !k.pinned)
    .map(k => ({
      id: k.id,
      title: k.title,
      url: `https://linux.do/t/topic/${k.id}`,
    }))
})

const latest = defineSource(async () => {
  const res = await fetchLinuxDo<Res>("https://linux.do/latest.json?order=created")
  return res.topic_list.topics
    .filter(k => k.visible && !k.archived && !k.pinned)
    .map(k => ({
      id: k.id,
      title: k.title,
      pubDate: new Date(k.created_at).valueOf(),
      url: `https://linux.do/t/topic/${k.id}`,
    }))
})

export default defineSource({
  "linuxdo": latest,
  "linuxdo-latest": latest,
  "linuxdo-hot": hot,
})
