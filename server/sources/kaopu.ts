type Res = {
  description: string
  link: string
  // Date
  pubDate: string
  publisher: string
  title: string
}[]
export default defineSource(async () => {
  const url = "https://kaopucdn.azureedge.net/jsondata/news_list_beta_hans_0.json"
  const res: Res = await $fetch(url)
  return res
    .slice(0, 30)
    .map((k) => {
      return {
        id: k.link,
        title: k.title,
        pubDate: k.pubDate,
        extra: {
          hover: k.description,
          info: k.publisher,
        },
        url: k.link,
      }
    })
},
)
