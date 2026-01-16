import { atom } from "jotai"
import type { NewsItem, SourceID } from "@shared/types"
import { sources } from "@shared/sources"

// 以第一个来源作为默认来源
const defaultSource = Object.keys(sources)[0] as SourceID

export const currentReaderSourceAtom = atom<SourceID>(defaultSource)
export const currentReaderPreviewAtom = atom<NewsItem | null>(null)
