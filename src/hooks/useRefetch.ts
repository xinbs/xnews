import type { SourceID } from "@shared/types"

function initRefetchSources() {
  let time = 0
  // useOnReload
  // 没有放在 useOnReload 里面, 可以避免初始化后再修改 refetchSourceAtom，导致多次请求 API
  const _ = localStorage.getItem("quitTime")
  const now = Date.now()
  const quitTime = _ ? Number(_) : 0
  if (!Number.isNaN(quitTime) && now - quitTime < 1000) {
    time = now
  }
  return Object.fromEntries(Object.keys(sources).map(k => [k, time])) as Record<SourceID, number>
}

const refetchSourcesAtom = atom(initRefetchSources())
export function useRefetch() {
  const [refetchSource, setRefetchSource] = useAtom(refetchSourcesAtom)
  const { enableLogin, loggedIn, login } = useLogin()
  const toaster = useToast()

  const refresh = useCallback((...sources: SourceID[]) => {
    if (enableLogin && !loggedIn) {
      toaster("登录后可以强制拉取最新数据", {
        type: "warning",
        action: {
          label: "登录",
          onClick: login,
        },
      })
    } else {
      const obj = Object.fromEntries(sources.map(id => [id, Date.now()]))
      setRefetchSource(prev => ({
        ...prev,
        ...obj,
      }))
    }
  }, [setRefetchSource, loggedIn, toaster, login, enableLogin])

  const getRefreshId = useCallback((id: SourceID) => refetchSource[id], [refetchSource])

  return {
    refresh,
    getRefreshId,
  }
}
