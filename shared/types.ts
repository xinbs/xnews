import type { colors } from "unocss/preset-mini"
import type { columnIds } from "./metadata"
import type { originSources } from "./sources"

export type Color = "primary" | Exclude<keyof typeof colors, "current" | "inherit" | "transparent" | "black" | "white">

type ConstSources = typeof originSources
type MainSourceID = keyof(ConstSources)

export type SourceID = {
  [Key in MainSourceID]: ConstSources[Key] extends { disable?: true } ? never :
    ConstSources[Key] extends { sub?: infer SubSource } ? {
    // @ts-expect-error >_<
      [SubKey in keyof SubSource ]: SubSource[SubKey] extends { disable?: true } ? never : `${Key}-${SubKey}`
    }[keyof SubSource] | Key : Key;
}[MainSourceID]

export type AllSourceID = {
  [Key in MainSourceID]: ConstSources[Key] extends { sub?: infer SubSource } ? keyof {
    // @ts-expect-error >_<
    [SubKey in keyof SubSource as `${Key}-${SubKey}`]: never
  } | Key : Key
}[MainSourceID]

// export type DisabledSourceID = Exclude<SourceID, MainSourceID>

export type ColumnID = (typeof columnIds)[number]
export type Metadata = Record<ColumnID, Column>

export interface PrimitiveMetadata {
  updatedTime: number
  data: Record<ColumnID, SourceID[]>
  action: "init" | "manual" | "sync"
}

export interface OriginSource {
  name: string
  title?: string
  desc?: string
  /**
   * 刷新的间隔时间，复用缓存
   */
  interval?: number
  type?: "hottest" | "realtime"
  /**
   * @default false
   */
  disable?: boolean
  home?: string
  color?: Color
  sub?: Record<string, {
    title: string
    type?: "hottest" | "realtime"
    desc?: string
    home?: string
    disable?: boolean
    interval?: number
  }>
}

export interface Source {
  name: string
  title?: string
  type?: "hottest" | "realtime"
  color: Color
  desc?: string
  home?: string
  disable?: boolean
  interval: number
  redirect?: SourceID
}

export interface Column {
  name: string
  sources: SourceID[]
}

export interface NewsItem {
  id: string | number // unique
  title: string
  url: string
  mobileUrl?: string
  pubDate?: number | string
  extra?: Record<string, any>
}

export interface SourceResponse {
  status: "success" | "cache"
  updatedTime: number | string
  items: NewsItem[]
}
