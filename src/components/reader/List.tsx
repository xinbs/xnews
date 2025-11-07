import type { SourceResponse, NewsItem } from "@shared/types"
import { sources } from "@shared/sources"
import { cacheSources } from "~/utils/data"
import { currentReaderSourceAtom, currentReaderPreviewAtom } from "~/atoms/reader"
import { useAtom } from "jotai"
import { useQuery } from "@tanstack/react-query"
import { OverlayScrollbar } from "~/components/common/overlay-scrollbar"
import { myFetch } from "~/utils"
import { useRelativeTime } from "~/hooks/useRelativeTime"

export function List() {
  const [current] = useAtom(currentReaderSourceAtom)
  const { data, isFetching } = useQuery({
    queryKey: ["source", current],
    queryFn: async ({ queryKey }) => {
      const id = queryKey[1] as any
      if (cacheSources.has(id)) return cacheSources.get(id)!
      const res: SourceResponse = await myFetch(`/s?id=${id}`)
      cacheSources.set(id, res)
      return res
    },
    placeholderData: prev => prev,
    staleTime: 1000 * 60 * 3,
    retry: false,
  })
  const updatedRelative = useRelativeTime(data?.updatedTime ?? "")

  return (
    <OverlayScrollbar className={$(["h-full overflow-y-auto", isFetching && "animate-pulse"]) } defer>
      <div className="flex items-center justify-between px-2 py-2 mb-2 border-b border-base">
        <div className="flex items-center gap-2">
          <span
            className="w-5 h-5 rounded bg-cover"
            style={{ backgroundImage: `url(/icons/${String(current).split("-")[0]}.png)` }}
          />
          <span className="text-sm font-semibold">{sources[current]?.name}</span>
          {sources[current]?.title && (
            <span className={$(`text-xs px-1 rounded bg-base op-70 bg-op-50!`, `color-${sources[current].color}`)}>
              {sources[current].title}
            </span>
          )}
        </div>
        <span className="text-xs op-60">{updatedRelative || "加载中..."} 更新</span>
      </div>
      <ul className="space-y-1">
        {data?.items?.map((item) => (
          <li key={item.id}>
            <ListItem item={item} />
          </li>
        ))}
      </ul>
    </OverlayScrollbar>
  )
}

function ListItem({ item }: { item: NewsItem }) {
  const [, setPreview] = useAtom(currentReaderPreviewAtom)
  const time = useRelativeTime((item.pubDate || item?.extra?.date || "") as any)
  return (
    <button type="button" className="w-full text-left p-2 rounded-md hover:bg-neutral-400/10 transition-all visited:(text-neutral-400)" onClick={() => setPreview(item)}>
      <div className="text-sm font-medium leading-tight">{item.title}</div>
      <div className="flex items-center gap-2 text-xs op-70 mt-1">
        {time && <span>{time}</span>}
        {item.extra?.info && <span className="truncate">{item.extra.info}</span>}
      </div>
    </button>
  )
}