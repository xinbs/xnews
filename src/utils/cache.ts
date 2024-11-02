import type { SourceID, SourceResponse } from "@shared/types"

export const cache: Map<SourceID, SourceResponse> = new Map()
