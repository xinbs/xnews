import type { NewsItem, SourceID, SourceResponse } from "@shared/types"
import { sources } from "@shared/sources"
import { useAtom } from "jotai"
import { useQuery } from "@tanstack/react-query"
import { cacheSources, refetchSources } from "~/utils/data"
import { currentReaderPreviewAtom, currentReaderSourceAtom } from "~/atoms/reader"
import { OverlayScrollbar } from "~/components/common/overlay-scrollbar"
import { myFetch, safeParseString } from "~/utils"
import { useRelativeTime } from "~/hooks/useRelativeTime"
import { useRefetch } from "~/hooks/useRefetch"

export function List() {
  const [current] = useAtom(currentReaderSourceAtom)
  const [preview] = useAtom(currentReaderPreviewAtom)
  const { refresh } = useRefetch()
  const { data, isFetching } = useQuery({
    queryKey: ["source", current],
    queryFn: async ({ queryKey }) => {
      const id = queryKey[1] as SourceID
      let url = `/s?id=${id}`
      const headers: Record<string, any> = {}

      // 支持强制刷新 latest（与栏目卡片一致）
      if (refetchSources.has(id)) {
        url = `/s?id=${id}&latest`
        const jwt = safeParseString(localStorage.getItem("jwt"))
        if (jwt) headers.Authorization = `Bearer ${jwt}`
        refetchSources.delete(id)
      } else if (cacheSources.has(id)) {
        return cacheSources.get(id)!
      }

      const res: SourceResponse = await myFetch(url, { headers })
      cacheSources.set(id, res)
      return res
    },
    placeholderData: prev => prev,
    staleTime: 1000 * 60 * 3,
    retry: false,
  })
  const updatedRelative = useRelativeTime(data?.updatedTime ?? "")

  return (
    <OverlayScrollbar className={$(["h-full overflow-y-auto", isFetching && "animate-pulse"])} defer>
      <div className="sticky top-0 z-10 bg-base/80 backdrop-blur flex items-center justify-between px-2 py-2 border-b border-base">
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
        <div className="flex items-center gap-2">
          <span className="text-xs op-60">
            {updatedRelative || "加载中..."}
            {" "}
            更新
          </span>
          <button
            type="button"
            title="强制刷新"
            className={$("btn i-ph:arrow-counter-clockwise-duotone", isFetching && "animate-spin i-ph:circle-dashed-duotone")}
            onClick={() => refresh(current)}
          />
        </div>
      </div>
      <ul className="space-y-1 p-2">
        {data?.items?.map(item => (
          <li key={item.id}>
            <ListItem item={item} active={preview?.id === item.id} />
          </li>
        ))}
      </ul>
    </OverlayScrollbar>
  )
}

function ListItem({ item, active }: { item: NewsItem, active?: boolean }) {
  const [, setPreview] = useAtom(currentReaderPreviewAtom)
  const time = useRelativeTime((item.pubDate || item?.extra?.date || "") as any)
  return (
    <button type="button" className={$("w-full text-left p-2 rounded-md transition-all visited:(text-neutral-400)", active ? "bg-base/70" : "hover:bg-neutral-400/10")} onClick={() => setPreview(item)}>
      <div className="text-sm font-medium leading-tight">{item.title}</div>
      <div className="flex items-center gap-2 text-xs op-70 mt-1">
        {time && <span>{time}</span>}
        {item.extra?.info && <span className="truncate">{item.extra.info}</span>}
      </div>
    </button>
  )
}
