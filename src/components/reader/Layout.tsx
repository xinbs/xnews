import { Sidebar } from "./Sidebar"
import { List } from "./List"
import { Detail } from "./Detail"

export function ReaderLayout() {
  return (
    <div className={$([
      "grid gap-4",
      "md:grid-cols-[200px_300px_1fr]",
      "max-md:(flex flex-col)",
      "h-[calc(100vh-140px)]",
    ])}
    >
      <aside className="h-full max-md:order-1">
        <Sidebar />
      </aside>
      <section className="max-md:order-2">
        <List />
      </section>
      <section className="max-md:order-3">
        <Detail />
      </section>
    </div>
  )
}
