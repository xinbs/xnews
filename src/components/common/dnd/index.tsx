import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine"
import type { PropsWithChildren } from "react"
import type { AllEvents, ElementDragType } from "@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types"
import { InstanceIdContext } from "./useSortable"

interface ContextProps extends Partial<AllEvents<ElementDragType>> {
}
export function DndContext({ children, ...callback }: PropsWithChildren<ContextProps>) {
  const [instanceId] = useState<string>(randomUUID())
  useEffect(() => {
    return (
      combine(
        monitorForElements({
          canMonitor({ source }) {
            return source.data.instanceId === instanceId
          },
          ...callback,
        }),
      )
    )
  }, [callback, instanceId])
  return (
    <InstanceIdContext.Provider value={instanceId}>
      {children}
    </InstanceIdContext.Provider>
  )
}
