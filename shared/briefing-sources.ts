import type { SourceID } from "./types"

// The editorial source profile lives in xnews, never in downstream consumers.
const publicArticleHosts = ["openai.com", "anthropic.com", "deepmind.google", "blog.google", "microsoft.com", "github.com", "huggingface.co", "arxiv.org", "reuters.com", "apnews.com", "bbc.com", "cisa.gov", "thehackernews.com", "bleepingcomputer.com", "helpnetsecurity.com"]
export const briefingSources: { id: SourceID, category: string, publisher: string, articleHosts: string[] }[] = [
  { id: "ithome", category: "technology", publisher: "IT之家", articleHosts: ["ithome.com"] },
  { id: "36kr-quick", category: "technology", publisher: "36氪", articleHosts: ["36kr.com"] },
  { id: "hackernews", category: "technology", publisher: "Hacker News", articleHosts: publicArticleHosts },
  { id: "solidot", category: "technology", publisher: "Solidot", articleHosts: ["solidot.org"] },
  { id: "reuters", category: "world", publisher: "Reuters", articleHosts: ["news.google.com", "reuters.com"] },
  { id: "zaobao", category: "world", publisher: "早晨报（早报聚合）", articleHosts: [] },
  { id: "kaopu", category: "world", publisher: "靠谱新闻聚合", articleHosts: [] },
  { id: "freebuf", category: "security", publisher: "FreeBuf", articleHosts: ["freebuf.com"] },
  { id: "secwiki-latest", category: "security", publisher: "SecWiki", articleHosts: [] },
  { id: "cls-telegraph", category: "economy", publisher: "财联社", articleHosts: [] },
  { id: "wallstreetcn-quick", category: "economy", publisher: "华尔街见闻", articleHosts: [] },
  { id: "jin10", category: "economy", publisher: "金十数据", articleHosts: [] },
  { id: "x-tech", category: "technology", publisher: "X · 科技与 AI", articleHosts: publicArticleHosts },
  { id: "x-world", category: "world", publisher: "X · 国际要闻", articleHosts: publicArticleHosts },
  { id: "x-security", category: "security", publisher: "X · 网络安全", articleHosts: publicArticleHosts },
]
