import type { SourceID } from "./types"

// The editorial source profile lives in xnews, never in downstream consumers.
const publicArticleHosts = ["openai.com", "anthropic.com", "deepmind.google", "blog.google", "microsoft.com", "github.com", "huggingface.co", "arxiv.org", "reuters.com", "apnews.com", "bbc.com", "cisa.gov", "thehackernews.com", "bleepingcomputer.com", "helpnetsecurity.com"]
export const briefingSources: { id: SourceID, category: string, publisher: string, articleHosts: string[], role: "factual" | "hot-discovery" | "primary-discovery" }[] = [
  { id: "ithome", category: "technology", publisher: "IT之家", articleHosts: ["ithome.com"], role: "factual" },
  { id: "36kr-quick", category: "technology", publisher: "36氪", articleHosts: ["36kr.com"], role: "factual" },
  { id: "hackernews", category: "technology", publisher: "Hacker News", articleHosts: publicArticleHosts, role: "factual" },
  { id: "solidot", category: "technology", publisher: "Solidot", articleHosts: ["solidot.org"], role: "factual" },
  { id: "reuters", category: "world", publisher: "Reuters", articleHosts: ["news.google.com", "reuters.com"], role: "factual" },
  { id: "zaobao", category: "world", publisher: "早晨报（早报聚合）", articleHosts: [], role: "factual" },
  { id: "kaopu", category: "world", publisher: "靠谱新闻聚合", articleHosts: [], role: "factual" },
  { id: "freebuf", category: "security", publisher: "FreeBuf", articleHosts: ["freebuf.com"], role: "factual" },
  { id: "secwiki-latest", category: "security", publisher: "SecWiki", articleHosts: [], role: "factual" },
  { id: "cls-telegraph", category: "economy", publisher: "财联社", articleHosts: [], role: "factual" },
  { id: "wallstreetcn-quick", category: "economy", publisher: "华尔街见闻", articleHosts: [], role: "factual" },
  { id: "jin10", category: "economy", publisher: "金十数据", articleHosts: [], role: "factual" },
  { id: "x-tech", category: "technology", publisher: "X · 科技与 AI", articleHosts: publicArticleHosts, role: "primary-discovery" },
  { id: "x-world", category: "world", publisher: "X · 国际要闻", articleHosts: publicArticleHosts, role: "primary-discovery" },
  { id: "x-security", category: "security", publisher: "X · 网络安全", articleHosts: publicArticleHosts, role: "primary-discovery" },
  { id: "tencent-hot", category: "general", publisher: "腾讯新闻热榜", articleHosts: ["inews.qq.com", "view.inews.qq.com", "qq.com"], role: "hot-discovery" },
  { id: "thepaper", category: "general", publisher: "澎湃新闻", articleHosts: ["thepaper.cn"], role: "hot-discovery" },
  { id: "toutiao", category: "general", publisher: "今日头条热榜", articleHosts: ["toutiao.com"], role: "hot-discovery" },
  { id: "baidu", category: "general", publisher: "百度热搜", articleHosts: ["baidu.com"], role: "hot-discovery" },
  { id: "ifeng", category: "general", publisher: "凤凰网热榜", articleHosts: ["ifeng.com"], role: "hot-discovery" },
  { id: "x-hot", category: "general", publisher: "X · 综合热点", articleHosts: publicArticleHosts, role: "primary-discovery" },
]
