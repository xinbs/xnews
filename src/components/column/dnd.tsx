import type { PropsWithChildren } from "react"
import { useCallback, useState } from "react"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { AnimateLayoutChanges } from "@dnd-kit/sortable"
import { SortableContext, arrayMove, defaultAnimateLayoutChanges, rectSortingStrategy, useSortable } from "@dnd-kit/sortable"
import type { SourceID } from "@shared/types"
import { CSS } from "@dnd-kit/utilities"
import { motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import type { ItemsProps } from "./card"
import { CardWrapper } from "./card"
import { currentSourcesAtom } from "~/atoms"

export function Dnd() {
  const [items, setItems] = useAtom(currentSourcesAtom)
  useQuery({
    // sort in place
    queryKey: ["entries", [...items].sort()],
    queryFn: async ({ queryKey }) => {
      const sources = queryKey[1]
      const res: EntriesSourceResponse = await myFetch("/s/entries", {
        method: "POST",
        body: {
          sources,
        },
      })
      if (res) {
        for (const [k, v] of Object.entries(res)) {
          cache.set(k as SourceID, v)
        }
        return res
      }
      return null
    },
    staleTime: 1000 * 60 * 5,
  })

  return (
    <DndWrapper items={items} setItems={setItems}>
      <motion.ol
        className="grid w-full gap-6"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
        }}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {
            opacity: 0,
          },
          visible: {
            opacity: 1,
            transition: {
              delayChildren: 0.1,
              staggerChildren: 0.1,
            },
          },
        }}
      >
        {items.map(id => (
          <motion.li
            key={id}
            transition={{
              type: "tween",
            }}
            variants={{
              hidden: { y: 20, opacity: 0 },
              visible: {
                y: 0,
                opacity: 1,
              },
            }}
          >
            <SortableCardWrapper id={id} />
          </motion.li>
        ))}
      </motion.ol>
    </DndWrapper>
  )
}

interface DndProps {
  items: SourceID[]
  setItems: (update: SourceID[]) => void
}

function DndWrapper({ items, setItems, children }: PropsWithChildren<DndProps>) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor))

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = items.indexOf(active.id as any)
      const newIndex = items.indexOf(over!.id as any)
      setItems(arrayMove(items, oldIndex, newIndex))
    }

    setActiveId(null)
  }, [setItems, items])

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  return (
    <DndContext
      sensors={sensors}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={items} strategy={rectSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay
        className="transition-opacity-300"
        dropAnimation={{
          easing: "cubic-bezier(0.25, 1, 0.5, 1)",
          duration: 300,
          sideEffects: defaultDropAnimationSideEffects({
            className: {
              active: "op-100",
              dragOverlay: "op-0",
            },
          }),
        }}
      >
        {!!activeId && <CardOverlay id={activeId as SourceID} />}
      </DragOverlay>
    </DndContext>
  )
}

function CardOverlay({ id }: { id: SourceID }) {
  return (
    <div className={$(
      "flex flex-col rounded-2xl p-4 backdrop-blur-5",
      `bg-${sources[id].color}-500 dark:bg-${sources[id].color} bg-op-40!`,
    )}
    >
      <div className={$("flex justify-between mx-2 items-center")}>
        <div className="flex gap-2 items-center">
          <div
            className={$("w-8 h-8 rounded-full bg-cover")}
            style={{
              backgroundImage: `url(/icons/${id.split("-")[0]}.png)`,
            }}
          />
          <span className="flex flex-col">
            <span className="flex items-center gap-2">
              <span className="text-xl font-bold">
                {sources[id].name}
              </span>
              {sources[id]?.title && <span className={$("text-sm", `color-${sources[id].color} bg-base op-80 bg-op-50! px-1 rounded`)}>{sources[id].title}</span>}
            </span>
            <span className="text-xs op-70">拖拽中</span>
          </span>
        </div>
        <div className={$("flex gap-2 text-lg", `color-${sources[id].color}`)}>
          <button
            type="button"
            className={$("i-ph:dots-six-vertical-duotone", "cursor-grabbing")}
          />
        </div>
      </div>
    </div>
  )
}

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args
  if (isSorting || wasDragging) {
    return defaultAnimateLayoutChanges(args)
  }
  return true
}

function SortableCardWrapper({ id, ...props }: ItemsProps) {
  const {
    isDragging,
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
    animateLayoutChanges,
    transition: {
      duration: 300,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <CardWrapper
      ref={setNodeRef}
      id={id}
      style={style}
      isDragged={isDragging}
      handleListeners={listeners}
      {...attributes}
      {...props}
    />
  )
}
