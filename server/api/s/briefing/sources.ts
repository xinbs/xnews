import { briefingSources } from "@shared/briefing-sources"
import sources from "@shared/sources"

export default defineEventHandler(() => ({
  version: 1,
  sources: briefingSources.map(({ articleHosts: _hosts, ...profile }) => ({ ...profile, name: sources[profile.id]?.name, interval: sources[profile.id]?.interval, enabled: !!sources[profile.id] && !sources[profile.id]?.disable })),
  excluded: [{ id: "x", reason: "Real post retrieval has not passed validation" }],
}))
