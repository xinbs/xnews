import { useAtomValue } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { useCallback } from "react"

const userAtom = atomWithStorage<{
  name?: string
  avatar?: string
}>("user", {})

const jwtAtom = atomWithStorage("jwt", "")

export function useLogin() {
  const userInfo = useAtomValue(userAtom)
  const jwt = useAtomValue(jwtAtom)
  const login = useCallback(() => {
    window.location.href = __LOGIN_URL__
  }, [])

  const logout = useCallback(() => {
    window.localStorage.clear()
    window.location.reload()
  }, [])

  return {
    loggedIn: !!jwt,
    userInfo,
    logout,
    login,
  }
}
