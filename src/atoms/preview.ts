import { atom } from "jotai"
import type { NewsItem } from "@shared/types"

export const previewItemAtom = atom<NewsItem | null>(null)
