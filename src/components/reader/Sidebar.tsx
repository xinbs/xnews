import type { SourceID } from "@shared/types"
import { columns, metadata } from "@shared/metadata"
import { sources } from "@shared/sources"
import { useMemo, useState } from "react"
import { useAtom } from "jotai"
import { currentReaderSourceAtom } from "~/atoms/reader"
import { OverlayScrollbar } from "~/components/common/overlay-scrollbar"

export function Sidebar() {
  const [filter, setFilter] = useState("")
  const [column, setColumn] = useState<keyof typeof columns>("tech")

  const groups = useMemo(() => {
    const ids = metadata[column].sources
    return ids
      .map(id => ({ id, name: sources[id].name, title: sources[id].title }))
      .filter(x => x.name.toLowerCase().includes(filter.toLowerCase())
        || (x.title ?? "").toLowerCase().includes(filter.toLowerCase()))
  }, [filter, column])

  return (
    <OverlayScrollbar className="space-y-2 h-full overflow-y-auto" defer>
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
      <nav className="space-y-1">
        {groups.map(g => (
          <SourceItem key={g.id} id={g.id} name={g.name} title={g.title} />
        ))}
      </nav>
    </OverlayScrollbar>
  )
}

function SourceItem({ id, name, title }: { id: SourceID, name: string, title?: string }) {
  const [, setCurrent] = useAtom(currentReaderSourceAtom)
  return (
    <button
      type="button"
      className="w-full flex items-center gap-2 justify-start px-2 py-2 rounded-lg hover:bg-base text-sm transition-all"
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
