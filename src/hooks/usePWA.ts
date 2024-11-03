import { useEffect } from "react"
import { useRegisterSW } from "virtual:pwa-register/react"
import { useToast } from "./useToast"

export function usePWA() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const toaster = useToast()

  useEffect(() => {
    if (needRefresh) {
      toaster("网站有更新，点击更新", {
        action: {
          label: "更新",
          onClick: () => updateServiceWorker(true),
        },
        onDismiss: () => updateServiceWorker(true),
      })
    }
  }, [needRefresh, updateServiceWorker, setNeedRefresh, toaster])
}
