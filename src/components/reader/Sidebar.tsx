import type { SourceID } from "@shared/types"
import { columns, metadata } from "@shared/metadata"
import { sources } from "@shared/sources"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAtom, useAtomValue } from "jotai"
import { focusSourcesAtom } from "~/atoms"
import { currentReaderSourceAtom } from "~/atoms/reader"
import { OverlayScrollbar } from "~/components/common/overlay-scrollbar"

export function Sidebar() {
  const [filter, setFilter] = useState("")
  const focusSources = useAtomValue(focusSourcesAtom)
  const [column, setColumn] = useState<keyof typeof columns>(() => focusSources.length ? "focus" : "tech")
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    if (focusSources.length) setColumn("focus")
    initialized.current = true
  }, [focusSources])

  const groups = useMemo(() => {
    const ids = column === "focus" ? focusSources : metadata[column].sources
    return ids
      .map(id => ({ id, name: sources[id].name, title: sources[id].title }))
      .filter(x => x.name.toLowerCase().includes(filter.toLowerCase())
        || (x.title ?? "").toLowerCase().includes(filter.toLowerCase()))
  }, [filter, column, focusSources])

  return (
    <OverlayScrollbar className="h-full overflow-y-auto" defer>
      <div className="sticky top-0 z-10 bg-base/80 backdrop-blur px-2 pt-2 pb-2 space-y-2">
        <div className="flex gap-2">
          <input
            className="input w-full text-sm px-2 py-1 rounded-md"
            placeholder="筛选来源或标题"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.keys(columns).map(k => (
            <button
              type="button"
              key={k}
              className={$([
                "text-xs px-2 py-1 rounded-md",
                column === k ? "color-primary bg-primary/10" : "op-70 hover:bg-base",
              ])}
              onClick={() => setColumn(k as keyof typeof columns)}
            >
              {columns[k as keyof typeof columns].zh}
            </button>
          ))}
        </div>
      </div>
      <nav className="space-y-1 px-2 pb-2">
        {groups.length
          ? groups.map(g => (
              <SourceItem key={g.id} id={g.id} name={g.name} title={g.title} />
            ))
          : (
              <div className="text-xs op-60 px-2 py-3">
                {column === "focus" ? "关注为空" : "暂无来源"}
              </div>
            )}
      </nav>
    </OverlayScrollbar>
  )
}

function SourceItem({ id, name, title }: { id: SourceID, name: string, title?: string }) {
  const [current, setCurrent] = useAtom(currentReaderSourceAtom)
  return (
    <button
      type="button"
      className={$("w-full flex items-center gap-2 justify-start px-2 py-2 rounded-lg text-sm transition-all", current === id ? "bg-base color-primary" : "hover:bg-base")}
      onClick={() => setCurrent(id)}
    >
      <span
        className="w-4 h-4 rounded-md bg-cover"
        style={{ backgroundImage: `url(/icons/${id.split("-")[0]}.png)` }}
      />
      <span className="font-medium truncate">{name}</span>
      {title && <span className="op-60 ml-auto text-xs">{title}</span>}
    </button>
  )
}
