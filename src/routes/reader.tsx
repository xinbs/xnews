import { createFileRoute } from "@tanstack/react-router"
import { ReaderLayout } from "~/components/reader/Layout"

export const Route = createFileRoute("/reader")({
  component: ReaderLayout,
})
