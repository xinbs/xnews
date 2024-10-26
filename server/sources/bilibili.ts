interface Res {
  code: number
  message: string
  ttl: number
  data: {
    trending: {
      title: string
      trackid: string
      list: {
        keyword: string
        show_name: string
        icon: string
        uri: string
        goto: string
        heat_score: number
      }[]
    }
  }
}

const hotSearch = defineSource(async () => {
  const url = "https://api.bilibili.com/x/web-interface/wbi/search/square?limit=30"
  const cookie = (await $fetch.raw(`https://bilibili.tv`)).headers.getSetCookie()
  const res: Res = await $fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "cookie": cookie[0].replace(/.tv/g, ".com"),
      "referer": "https://www.bilibili.com/",
    },
  })

  return res.data.trending.list.map(k => ({
    id: k.keyword,
    title: k.show_name,
    url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(k.keyword)}`,
    extra: {
      icon: k.icon && `/api/proxy?img=${encodeURIComponent(k.icon)}`,
    },
  }))
})

export default defineSource({
  "bilibili": hotSearch,
  "bilibili-hot-search": hotSearch,
})
