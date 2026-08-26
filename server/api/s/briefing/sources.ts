import { defineEventHandler } from "h3"
import { briefingSources } from "@shared/briefing-sources"
import sources from "@shared/sources"
import { isXNewsEnabled } from "../../../utils/x-news"

export function getBriefingSourceCatalog() {
  return {
    version: 1,
    sources: briefingSources.map(({ articleHosts: _hosts, ...profile }) => ({ ...profile, name: `${sources[profile.id]?.name || ""}${profile.id.startsWith("x-") ? ` · ${sources[profile.id]?.title || ""}` : ""}`, interval: sources[profile.id]?.interval, enabled: !!sources[profile.id] && sources[profile.id]?.disable !== true && (!profile.id.startsWith("x-") || isXNewsEnabled()) })),
    excluded: isXNewsEnabled() ? [] : [{ id: "x", reason: "X public sources are disabled by configuration" }],
  }
}
export default defineEventHandler(() => getBriefingSourceCatalog())
