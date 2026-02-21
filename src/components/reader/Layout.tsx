import { useEffect, useRef } from "react"
import { useAtom, useAtomValue } from "jotai"
import { Sidebar } from "./Sidebar"
import { List } from "./List"
import { Detail } from "./Detail"
import { focusSourcesAtom } from "~/atoms"
import { currentReaderSourceAtom } from "~/atoms/reader"

export function ReaderLayout() {
  const focusSources = useAtomValue(focusSourcesAtom)
  const [current, setCurrent] = useAtom(currentReaderSourceAtom)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    if (focusSources.length && !focusSources.includes(current)) {
      setCurrent(focusSources[0])
    }
    initialized.current = true
  }, [focusSources, current, setCurrent])

  return (
    <div className={$([
      "grid gap-4",
      "md:grid-cols-[240px_360px_1fr]",
      "max-md:(flex flex-col)",
      "h-[calc(100vh-140px)]",
    ])}
    >
      <aside className="h-full max-md:order-1 rounded-2xl bg-base/60 shadow shadow-primary/10 overflow-hidden">
        <Sidebar />
      </aside>
      <section className="max-md:order-2 rounded-2xl bg-base/60 shadow shadow-primary/10 overflow-hidden">
        <List />
      </section>
      <section className="max-md:order-3 rounded-2xl bg-base/60 shadow shadow-primary/10 overflow-hidden">
        <Detail />
      </section>
    </div>
  )
}
