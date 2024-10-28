import "~/styles/globals.css"
import "virtual:uno.css"
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import type { QueryClient } from "@tanstack/react-query"
import clsx from "clsx"
import { Header } from "~/components/header"
import { useOnReload } from "~/hooks/useOnReload"
import { GlobalOverlayScrollbar } from "~/components/common/overlay-scrollbar"
import { useSync } from "~/hooks/useSync"
import { Footer } from "~/components/footer"
import { Toast } from "~/components/common/toast"
import { usePWA } from "~/hooks/usePWA"
import { SearchBar } from "~/components/common/search-bar"

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  beforeLoad: () => {
    const query = new URLSearchParams(window.location.search)
    if (query.has("login") && query.has("user") && query.has("jwt")) {
      localStorage.setItem("user", query.get("user")!)
      localStorage.setItem("jwt", JSON.stringify(query.get("jwt")!))
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  },
})

function NotFoundComponent() {
  const nav = Route.useNavigate()
  nav({
    to: "/",
  })
}

function RootComponent() {
  useOnReload()
  useSync()
  usePWA()
  return (
    <>
      <GlobalOverlayScrollbar className={clsx([
        "h-full overflow-x-auto px-4",
        "md:(px-10)",
        "lg:(px-24)",
      ])}
      >
        <header
          className={clsx([
            "grid items-center py-4 px-5",
            "lg:(py-6)",
            "sticky top-0 z-10 backdrop-blur-md",
          ])}
          style={{
            gridTemplateColumns: "50px auto 50px",
          }}
        >
          <Header />
        </header>
        <main className={clsx([
          "mt-2",
          "min-h-[calc(100vh-180px)]",
          "md:(min-h-[calc(100vh-175px)])",
          "lg:(min-h-[calc(100vh-194px)])",
        ])}
        >
          <Outlet />
        </main>
        <footer className="py-6 flex flex-col items-center justify-center text-sm text-neutral-500 font-mono">
          <Footer />
        </footer>
      </GlobalOverlayScrollbar>
      <Toast />
      <SearchBar />
      {import.meta.env.DEV && (
        <>
          <ReactQueryDevtools buttonPosition="bottom-left" />
          <TanStackRouterDevtools position="bottom-right" />
        </>
      )}
    </>
  )
}
