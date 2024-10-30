import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useMemo, useRef } from "react"
import { useHoverDirty, useMount, useUpdateEffect, useWindowSize } from "react-use"
import type { ToastItem } from "~/atoms/types"
import { Timer } from "~/utils"

const WIDTH = 320
export function Toast() {
  const { width } = useWindowSize()
  const center = useMemo(() => {
    const t = (width - WIDTH) / 2
    return t > width * 0.9 ? width * 0.9 : t
  }, [width])
  const toastItems = useAtomValue(toastAtom)

  return (
    <AnimatePresence>
      {toastItems.length && (
        <motion.ol
          initial="hidden"
          animate="visible"
          style={{
            width: WIDTH,
            left: center,
          }}
          variants={{
            visible: {
              transition: {
                delayChildren: 0.1,
                staggerChildren: 0.2,
              },
            },
          }}
          className="absolute top-0 z-99 flex flex-col gap-2"
        >
          {
            toastItems.map(k => <Item key={k.id} info={k} />)
          }
        </motion.ol>
      )}
    </AnimatePresence>
  )
}

const colors = {
  success: "green",
  error: "red",
  warning: "orange",
  info: "blue",
}

function Item({ info }: { info: ToastItem }) {
  const color = colors[info.type ?? "info"]
  const setToastItems = useSetAtom(toastAtom)
  const hidden = useCallback((dismiss = true) => {
    setToastItems(prev => prev.filter(k => k.id !== info.id))
    if (dismiss) {
      info.onDismiss?.()
    }
  }, [info, setToastItems])
  const timer = useRef<Timer>()

  useMount(() => {
    timer.current = new Timer(() => {
      hidden()
    }, info.duration ?? 5000)
    return () => timer.current?.clear()
  })

  const ref = useRef(null)
  const isHoverd = useHoverDirty(ref)
  useUpdateEffect(() => {
    if (isHoverd) {
      timer.current?.pause()
    } else {
      timer.current?.resume()
    }
  }, [isHoverd])

  return (
    <motion.li
      ref={ref}
      layout
      variants={{
        hidden: { y: 0, opacity: 0 },
        visible: {
          y: 15,
          opacity: 1,
        },
      }}
      className={$(
        "bg-base rounded-lg shadow-xl relative",
      )}
    >
      <div className={$(
        `bg-${color}-500 dark:bg-${color} bg-op-40! p2 backdrop-blur-5 rounded-lg w-full`,
        "flex items-center gap-2",
      )}
      >
        {
          isHoverd
            ? <button type="button" className={`i-ph:x-circle color-${color}-500 i-ph:info`} onClick={() => hidden(false)} />
            : <span className={`i-ph:info color-${color}-500 `} />
        }
        <div className="flex justify-between w-full">
          <span className="op-90 dark:op-100">
            {info.msg}
          </span>
          {info.action && (
            <button
              type="button"
              className={`text-sm color-${color}-500 bg-base op-80 bg-op-50! px-1 rounded min-w-10 hover:bg-op-70!`}
              onClick={info.action.onClick}
            >
              {info.action.label}
            </button>
          )}
        </div>
      </div>
    </motion.li>
  )
}
