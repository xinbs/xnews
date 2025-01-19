export function Footer() {
  const sources = [
    {
      category: "科技资讯",
      links: [
        { name: "Hacker News", url: "https://news.ycombinator.com" },
        { name: "Product Hunt", url: "https://www.producthunt.com" },
        { name: "GitHub", url: "https://github.com/trending" },
        { name: "IT之家", url: "https://www.ithome.com" },
        { name: "V2EX", url: "https://v2ex.com" },
        { name: "Linux中国", url: "https://linux.cn" },
        { name: "Solidot", url: "https://www.solidot.org" },
      ],
    },
    {
      category: "社交媒体",
      links: [
        { name: "微博", url: "https://weibo.com" },
        { name: "知乎", url: "https://zhihu.com" },
        { name: "哔哩哔哩", url: "https://bilibili.com" },
        { name: "抖音", url: "https://douyin.com" },
        { name: "快手", url: "https://kuaishou.com" },
        { name: "贴吧", url: "https://tieba.baidu.com" },
        { name: "酷安", url: "https://coolapk.com" },
      ],
    },
    {
      category: "新闻资讯",
      links: [
        { name: "36氪", url: "https://36kr.com" },
        { name: "澎湃新闻", url: "https://thepaper.cn" },
        { name: "今日头条", url: "https://toutiao.com" },
        { name: "参考消息", url: "http://www.cankaoxiaoxi.com" },
        { name: "联合早报", url: "https://www.zaobao.com" },
        { name: "卫星通讯社", url: "http://sputniknews.cn" },
      ],
    },
    {
      category: "财经资讯",
      links: [
        { name: "华尔街见闻", url: "https://wallstreetcn.com" },
        { name: "雪球", url: "https://xueqiu.com" },
        { name: "格隆汇", url: "https://gelonghui.com" },
        { name: "金十数据", url: "https://jin10.com" },
        { name: "FastBull", url: "https://fastbull.cn" },
      ],
    },
  ]

  return (
    <footer className="mt-8 pb-4 text-sm text-neutral-400">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {sources.map(category => (
            <div key={category.category}>
              <h3 className="font-medium mb-4 text-neutral-500">{category.category}</h3>
              <ul className="space-y-2">
                {category.links.map(link => (
                  <li key={link.name}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-neutral-600 transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-center pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <span>NewsNow  2025 By </span>
          <a
            href="https://github.com/majiajue/newsnow"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-600 transition-colors"
          >
            majiajue
          </a>
        </div>
      </div>
    </footer>
  )
}
