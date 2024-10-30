import { createFileRoute } from "@tanstack/react-router"
import { focusSourcesAtom } from "~/atoms"
import { Column } from "~/components/column"

export const Route = createFileRoute("/")({
  component: IndexComponent,
})

function IndexComponent() {
  const focusSources = useAtomValue(focusSourcesAtom)
  return <Column id={focusSources.length ? "focus" : "hottest"} />
}
