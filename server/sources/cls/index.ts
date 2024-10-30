import { getSearchParams } from "./utils"

interface Item {
  id: number
  title?: string
  brief: string
  shareurl: string
  // need *1000
  ctime: number
  // 1
  is_ad: number
}
interface TelegraphRes {
  data: {
    roll_data: Item[]
  }
}

interface Depthes {
  data: {
    top_article: Item[]
    depth_list: Item[]
  }
}

// 失效
const depth = defineSource(async () => {
  const apiUrl = `https://www.cls.cn/v3/depth/home/assembled/1000`
  const res: Depthes = await myFetch(apiUrl, {
    query: await getSearchParams(),
  })
  return res.data.depth_list.sort((m, n) => n.ctime - m.ctime).map((k) => {
    return {
      id: k.id,
      title: k.title || k.brief,
      mobileUrl: k.shareurl,
      extra: {
        date: k.ctime * 1000,
      },
      url: `https://www.cls.cn/detail/${k.id}`,
    }
  })
})
// hot 失效

const telegraph = defineSource(async () => {
  const apiUrl = `https://www.cls.cn/nodeapi/updateTelegraphList`
  const res: TelegraphRes = await myFetch(apiUrl, {
    query: await getSearchParams({ }),
    timeout: 10000,
  })
  return res.data.roll_data.filter(k => !k.is_ad).map((k) => {
    return {
      id: k.id,
      title: k.title || k.brief,
      mobileUrl: k.shareurl,
      extra: {
        date: k.ctime * 1000,
      },
      url: `https://www.cls.cn/detail/${k.id}`,
    }
  })
})

export default defineSource({
  "cls": telegraph,
  "cls-telegraph": telegraph,
  "cls-depth": depth,
})
