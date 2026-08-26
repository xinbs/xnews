import type { SourceID } from "./types"

// The editorial source profile lives in xnews, never in downstream consumers.
export const briefingSources: { id: SourceID, category: string, publisher: string, articleHosts: string[] }[] = [
  { id: "ithome", category: "technology", publisher: "IT之家", articleHosts: ["ithome.com"] },
  { id: "36kr-quick", category: "technology", publisher: "36氪", articleHosts: ["36kr.com"] },
  { id: "hackernews", category: "technology", publisher: "Hacker News", articleHosts: [] },
  { id: "solidot", category: "technology", publisher: "Solidot", articleHosts: ["solidot.org"] },
  { id: "reuters", category: "world", publisher: "Reuters", articleHosts: [] },
  { id: "zaobao", category: "world", publisher: "早晨报（早报聚合）", articleHosts: [] },
  { id: "kaopu", category: "world", publisher: "靠谱新闻聚合", articleHosts: [] },
  { id: "freebuf", category: "security", publisher: "FreeBuf", articleHosts: ["freebuf.com"] },
  { id: "secwiki-latest", category: "security", publisher: "SecWiki", articleHosts: [] },
  { id: "cls-telegraph", category: "economy", publisher: "财联社", articleHosts: [] },
  { id: "wallstreetcn-quick", category: "economy", publisher: "华尔街见闻", articleHosts: [] },
  { id: "jin10", category: "economy", publisher: "金十数据", articleHosts: [] },
]
