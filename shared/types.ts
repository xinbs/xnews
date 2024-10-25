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

type ManualColumnID = Exclude<ColumnID, "focus" | "realtime" | "hottest">

export interface OriginSource extends Partial<Omit<Source, "name" | "redirect">> {
  name: string
  sub?: Record<string, {
    /**
     * Subtitle 小标题
     */
    title: string
    // type?: "hottest" | "realtime"
    // desc?: string
    // column?: ManualColumnID
    // color?: Color
    // home?: string
    // disable?: boolean
    // interval?: number
  } & Partial<Omit<Source, "title" | "name" | "redirect">>>
}

export interface Source {
  name: string
  /**
   * 刷新的间隔时间
   */
  interval: number
  color: Color

  /**
   * Subtitle 小标题
   */
  title?: string
  desc?: string
  /**
   * Default normal timeline
   */
  type?: "hottest" | "realtime"
  column?: ManualColumnID
  home?: string
  /**
   * @default false
   */
  disable?: boolean
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
